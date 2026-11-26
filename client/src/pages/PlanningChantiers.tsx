import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, ChevronRight, X, Phone, ExternalLink } from "lucide-react";
import { useLeads } from "@/lib/crmStore";
import { crmFirestore } from "@/lib/crmDb";
import { TOTALS_VIEWERS, type Lead } from "@/lib/crm";
import { POSEUR } from "@/lib/crmColumns";
import { useColumnsConfig } from "@/lib/crmColumnsConfig";
import { ceeSeule, mprRecue, isSigne, moisSigne } from "@/lib/chantiers";

// ─────────────────────────────────────────────────────────────────────────
// « Planning chantiers » : tous les clients signés, dans un calendrier (mois ou
// semaine) avec les pré-visites, les poses, les dépôts MaPrimeRénov' et les
// paiements prévus (ces derniers pour les administrateurs seulement), et ce qui
// bloque : on ne pose pas tant que la CEE ne couvre pas le fourni-posé et que
// MaPrimeRénov' n'est pas reçue (on n'avance rien).
// Tout vient des colonnes du tableau Pac Pac (🗓 Date VT, 🕘 Heure VT, 🔧 Date Pose,
// 🕘 Heure Pose, 📨 Dépôt MPR, ✅ MPR reçue, 👷 Poseur, 🔧 Pipeline, 💰 Date prévue
// de paiement) : modifier ici ou dans le tableau revient au même.
// ─────────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => isoOf(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
const lundiDe = (iso: string) => addDays(iso, -((new Date(`${iso}T12:00:00`).getDay() + 6) % 7));
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const frDate = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "");
const frJour = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const AVANT_VT = ["", "Docs demandés", "Docs reçus", "Attente conf. VT"];

const f = (l: Lead, k: string) => String(l.fields[k] ?? "").trim();
const dateVt = (l: Lead) => f(l, "dateVt").slice(0, 10);
const datePose = (l: Lead) => f(l, "datePose").slice(0, 10);
const installe = (l: Lead) => l.fields.pipeline === "Installé";
const peutPoser = (l: Lead) => (ceeSeule(l) ?? 0) >= 0 || mprRecue(l);
const montantsInconnus = (l: Lead) => ceeSeule(l) === null;
const poseurOf = (l: Lead) => f(l, "poseur") || "Sans poseur";

type Etape = "vt" | "mpr" | "pret" | "pose" | "fait";
const etapeOf = (l: Lead): Etape => {
  if (installe(l)) return "fait";
  if (datePose(l)) return "pose";
  if (!dateVt(l)) return "vt";
  return peutPoser(l) ? "pret" : "mpr";
};
const ETAPES: { key: Etape; titre: string; aide: string; ton: string }[] = [
  { key: "vt", titre: "🔍 Pré-visite à caler", aide: "Signés sans date de pré-visite.", ton: "border-sky-300 bg-sky-50" },
  { key: "mpr", titre: "⏳ Attend MaPrimeRénov'", aide: "Pré-visite calée, mais la CEE ne couvre pas la pose : on attend l'octroi.", ton: "border-amber-300 bg-amber-50" },
  { key: "pret", titre: "✅ Prêt à poser", aide: "Le dossier permet d'installer : il reste à fixer la date de pose.", ton: "border-emerald-300 bg-emerald-50" },
  { key: "pose", titre: "🔧 Pose programmée", aide: "Date de pose fixée.", ton: "border-violet-300 bg-violet-50" },
  { key: "fait", titre: "🏁 Installés", aide: "Marqués « Installé ».", ton: "border-gray-300 bg-gray-50" },
];

type TypeEv = "vt" | "pose" | "depot" | "paiement";
const TYPES: Record<TypeEv, { label: string; icone: string; couleur: string; date: string; heure?: string }> = {
  vt: { label: "Pré-visite", icone: "🔍", couleur: "bg-sky-500", date: "dateVt", heure: "heureVt" },
  pose: { label: "Pose", icone: "🔧", couleur: "bg-violet-500", date: "datePose", heure: "heurePose" },
  depot: { label: "Dépôt MPR", icone: "📨", couleur: "bg-fuchsia-500", date: "dateDepotMpr" },
  paiement: { label: "Paiement prévu", icone: "💰", couleur: "bg-indigo-500", date: "datePaiementPrevue" },
};
type Ev = { l: Lead; type: TypeEv; heure: string; alerte: boolean };

export default function PlanningChantiers({ email, onOpenLead }: { email: string; onOpenLead: (id: string) => void }) {
  const { data: allLeads } = useLeads();
  const { version: colsVersion } = useColumnsConfig(email, "leads");
  const admin = TOTALS_VIEWERS.includes(email.toLowerCase());
  const today = todayIso();
  const [vue, setVue] = useState<"mois" | "semaine">("mois");
  const [ref, setRef] = useState(today); // jour de référence du mois / de la semaine affichés
  const [types, setTypes] = useState<Record<TypeEv, boolean>>({ vt: true, pose: true, depot: true, paiement: admin });
  const [poseur, setPoseur] = useState("tous");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [voirFaits, setVoirFaits] = useState(false);
  const [erreur, setErreur] = useState("");
  // Téléphone : deux onglets (agenda en liste jour par jour / ce qu'il faut organiser) au lieu du calendrier 7 colonnes.
  const mobile = useIsMobile();
  const [onglet, setOnglet] = useState<"agenda" | "organiser">("agenda");

  // Clients signés (étiquettes « Signé en … ») + ceux déjà passés en pose / installés.
  const tous = useMemo(
    () =>
      (allLeads ?? [])
        .filter((l) => isSigne(l) || !!datePose(l) || installe(l) || l.fields.pipeline === "Pose programmée")
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [allLeads, colsVersion],
  );
  const poseurs = useMemo(() => Array.from(new Set(tous.map(poseurOf))).sort(), [tous]);
  const clients = poseur === "tous" ? tous : tous.filter((l) => poseurOf(l) === poseur);
  const parEtape = (e: Etape) => clients.filter((l) => etapeOf(l) === e);

  const evenements = useMemo(() => {
    const m = new Map<string, Ev[]>();
    for (const l of clients) {
      for (const t of Object.keys(TYPES) as TypeEv[]) {
        if (!types[t] || (t === "paiement" && !admin)) continue;
        const iso = f(l, TYPES[t].date).slice(0, 10);
        if (!iso) continue;
        const ev: Ev = { l, type: t, heure: TYPES[t].heure ? f(l, TYPES[t].heure!) : "", alerte: t === "pose" && !peutPoser(l) && !installe(l) };
        m.set(iso, [...(m.get(iso) ?? []), ev]);
      }
    }
    for (const evs of Array.from(m.values())) evs.sort((a, b) => (a.heure || "99").localeCompare(b.heure || "99"));
    return m;
  }, [clients, types, admin]);

  // Jours affichés : mois complet (semaines entières) ou une semaine.
  const jours = useMemo(() => {
    if (vue === "semaine") return Array.from({ length: 7 }, (_, i) => addDays(lundiDe(ref), i));
    const premier = `${ref.slice(0, 8)}01`;
    const d = new Date(`${premier}T12:00:00`);
    const dernier = isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
    const out: string[] = [];
    for (let x = lundiDe(premier); x <= addDays(lundiDe(dernier), 6); x = addDays(x, 1)) out.push(x);
    return out;
  }, [vue, ref]);
  const moisRef = Number(ref.slice(5, 7)) - 1;
  const titre =
    vue === "mois"
      ? `${MOIS[moisRef]} ${ref.slice(0, 4)}`
      : `Semaine du ${new Date(`${jours[0]}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au ${new Date(`${jours[6]}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
  const deplacer = (sens: number) => {
    if (vue === "semaine") return setRef(addDays(ref, 7 * sens));
    const d = new Date(`${ref.slice(0, 8)}01T12:00:00`);
    setRef(isoOf(new Date(d.getFullYear(), d.getMonth() + sens, 1, 12)));
  };

  const enregistrer = async (l: Lead, maj: Record<string, string>) => {
    try {
      const { m, db } = await crmFirestore();
      const data: Record<string, any> = { updatedAt: m.serverTimestamp(), updatedBy: email };
      for (const [k, v] of Object.entries(maj)) data[`fields.${k}`] = v;
      await m.updateDoc(m.doc(db, "crm_leads", l.id), data);
      setErreur("");
    } catch {
      setErreur("Modification refusée.");
    }
  };
  const poserVt = (l: Lead, iso: string) =>
    enregistrer(l, { dateVt: iso, ...(iso && AVANT_VT.includes(l.fields.pipeline ?? "") ? { pipeline: "VT programmée" } : {}) });
  const poserPose = (l: Lead, iso: string) => {
    if (iso && !peutPoser(l) && !window.confirm(`${l.name} : la CEE ne couvre pas la pose et MaPrimeRénov' n'est pas reçue. Programmer la pose quand même ?`)) return;
    return enregistrer(l, { datePose: iso, ...(iso && !installe(l) ? { pipeline: "Pose programmée" } : {}) });
  };
  const marquerInstalle = (l: Lead) => enregistrer(l, { pipeline: "Installé", ...(datePose(l) ? {} : { datePose: today }) });
  const basculerMpr = (l: Lead) => enregistrer(l, { mprRecue: mprRecue(l) ? "" : "oui" });

  // Glisser sur un jour : un client de la liste reçoit sa pré-visite (ou sa pose s'il en a déjà une) ;
  // un rendez-vous du calendrier est simplement déplacé.
  const deposer = (iso: string, data: string) => {
    const [id, type] = data.split("|");
    const l = tous.find((x) => x.id === id);
    if (!l) return;
    const t = (type in TYPES ? type : dateVt(l) ? "pose" : "vt") as TypeEv;
    if (t === "vt") poserVt(l, iso);
    else if (t === "pose") poserPose(l, iso);
    else enregistrer(l, { [TYPES[t].date]: iso });
  };

  const sel = tous.find((l) => l.id === ouvert) ?? null;
  const compte = (e: Etape) => parEtape(e).length;
  const prochains = [today, addDays(today, 1)].map((iso) => ({ iso, evs: evenements.get(iso) ?? [] }));

  const Puce = ({ ev, grand }: { ev: Ev; grand?: boolean }) => (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", `${ev.l.id}|${ev.type}`)}
      onClick={() => setOuvert(ev.l.id)}
      title={`${TYPES[ev.type].label}${ev.heure ? ` à ${ev.heure}` : ""} : ${ev.l.name}${ev.l.city ? ` (${ev.l.city})` : ""}`}
      className={`block w-full truncate rounded-md px-1.5 text-left font-bold text-white ${grand ? "py-1.5 text-xs" : "py-1 text-[11px]"} ${ev.alerte ? "bg-red-500" : ev.type === "pose" && installe(ev.l) ? "bg-gray-400" : TYPES[ev.type].couleur}`}
    >
      {ev.type === "pose" && installe(ev.l) ? "🏁" : TYPES[ev.type].icone} {ev.heure && <span className="opacity-90">{ev.heure} </span>}
      {ev.l.name}
      {grand && ev.l.city && <span className="block truncate font-medium opacity-90">📍 {ev.l.city}</span>}
    </button>
  );

  return (
    <div className="w-full px-1 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">🗓️ Planning chantiers</h1>
          <p className="hidden sm:block text-sm text-gray-500 mt-1">
            Les {tous.length} clients signés. Glissez un client sur un jour pour lui donner une date, cliquez dessus pour tout régler. Relié au tableau Pac Pac.
          </p>
        </div>
        {erreur && <p className="text-sm font-semibold text-red-600">{erreur}</p>}
      </div>

      {/* Aujourd'hui et demain */}
      <div className="grid gap-3 md:grid-cols-2">
        {prochains.map(({ iso, evs }, i) => (
          <div key={iso} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-2 text-sm font-extrabold text-gray-900">
              {i === 0 ? "📍 Aujourd'hui" : "➡️ Demain"} <span className="font-semibold capitalize text-gray-500">· {frJour(iso)}</span>
            </div>
            {evs.length === 0 ? <p className="text-xs text-gray-400 italic">Rien de prévu.</p> : <div className="grid gap-1.5 sm:grid-cols-2">{evs.map((ev) => <Puce key={`${ev.l.id}-${ev.type}`} ev={ev} grand />)}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["vt", "mpr", "pret", "pose"] as Etape[]).map((e) => {
          const d = ETAPES.find((x) => x.key === e)!;
          return (
            <div key={e} className={`rounded-2xl border-2 px-4 py-3 ${d.ton}`}>
              <div className="text-3xl font-extrabold text-gray-900">{compte(e)}</div>
              <div className="text-sm font-bold text-gray-800">{d.titre}</div>
            </div>
          );
        })}
      </div>

      {mobile && (
        <div className="sticky top-0 z-20 -mx-1 px-1 py-1.5 bg-gray-50/95 backdrop-blur">
          <div className="flex rounded-2xl bg-gray-200/70 p-1">
            {([["agenda", "📅 Agenda"], ["organiser", `📋 À organiser (${compte("vt") + compte("mpr") + compte("pret") + compte("pose")})`]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setOnglet(k)}
                className={`flex-1 text-[14px] font-bold py-2 rounded-xl ${onglet === k ? "bg-white text-[#1f4b7f] shadow-sm" : "text-gray-500"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className={`self-start rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden ${mobile && onglet !== "agenda" ? "hidden" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0f172a] text-white px-4 py-3">
            <div className="flex items-center gap-1">
              <button onClick={() => deplacer(-1)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Précédent">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => deplacer(1)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Suivant">
                <ChevronRight size={20} />
              </button>
              <h2 className={`ml-2 text-lg font-extrabold ${vue === "mois" ? "capitalize" : ""}`}>{titre}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setRef(today)} className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold hover:bg-white/25">
                Aujourd'hui
              </button>
              <div className="flex rounded-lg bg-white/10 p-0.5">
                {(["mois", "semaine"] as const).map((v) => (
                  <button key={v} onClick={() => setVue(v)} className={`rounded-md px-2.5 py-1 text-xs font-bold capitalize ${vue === v ? "bg-orange-500 text-white" : "text-white/80 hover:text-white"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Filtres : types de rendez-vous et poseur */}
          <div className={`flex items-center gap-2 px-4 py-2 border-b border-gray-100 text-xs font-semibold ${mobile ? "overflow-x-auto no-scrollbar [&>*]:shrink-0" : "flex-wrap"}`}>
            {(Object.keys(TYPES) as TypeEv[])
              .filter((t) => t !== "paiement" || admin)
              .map((t) => (
                <button
                  key={t}
                  onClick={() => setTypes({ ...types, [t]: !types[t] })}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${types[t] ? "border-gray-300 bg-white text-gray-800" : "border-gray-200 bg-gray-100 text-gray-400 line-through"}`}
                >
                  <i className={`w-3 h-3 rounded ${TYPES[t].couleur}`} /> {TYPES[t].label}
                </button>
              ))}
            <span className="flex items-center gap-1.5 px-1 text-gray-500">
              <i className="w-3 h-3 rounded bg-red-500" /> Pose sans MPR reçue
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              👷
              <select value={poseur} onChange={(e) => setPoseur(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800">
                <option value="tous">Tous les poseurs</option>
                {poseurs.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </span>
          </div>
          {mobile ? (
            <div className="divide-y divide-gray-100">
              {(() => {
                const jl = jours.filter((iso) => (vue === "semaine" || Number(iso.slice(5, 7)) - 1 === moisRef) && (evenements.get(iso)?.length ?? 0) > 0);
                if (!jl.length) return <p className="px-4 py-10 text-center text-sm text-gray-400">Aucun rendez-vous sur cette période.</p>;
                return jl.map((iso) => (
                  <div key={iso} className={`px-3 py-2.5 ${iso === today ? "bg-[#edf2f8]" : iso < today ? "opacity-60" : ""}`}>
                    <div className="mb-1.5 text-[13px] font-extrabold capitalize text-gray-900">
                      {iso === today ? "📍 Aujourd'hui · " : ""}
                      {frJour(iso)}
                    </div>
                    <div className="space-y-1.5">
                      {(evenements.get(iso) ?? []).map((ev) => (
                        <Puce key={`${ev.l.id}-${ev.type}`} ev={ev} grand />
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
          <>
          <div className="grid grid-cols-7 text-center text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
            {jours.slice(0, 7).map((iso, i) => (
              <div key={iso} className="py-2">
                {JOURS[i]}
                {vue === "semaine" && <span className="ml-1 text-gray-800">{Number(iso.slice(8))}</span>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {jours.map((iso, i) => {
              const horsMois = vue === "mois" && Number(iso.slice(5, 7)) - 1 !== moisRef;
              const weekend = i % 7 >= 5;
              const evs = evenements.get(iso) ?? [];
              return (
                <div
                  key={iso}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    deposer(iso, e.dataTransfer.getData("text/plain"));
                  }}
                  className={`${vue === "semaine" ? "min-h-[420px]" : "min-h-[110px]"} border-b border-r border-gray-100 p-1.5 ${horsMois ? "bg-gray-50/70" : weekend ? "bg-slate-50" : "bg-white"}`}
                >
                  {vue === "mois" && (
                    <div className={`mb-1 text-xs font-bold ${iso === today ? "inline-flex w-6 h-6 items-center justify-center rounded-full bg-orange-500 text-white" : horsMois ? "text-gray-300" : "text-gray-600"}`}>{Number(iso.slice(8))}</div>
                  )}
                  {vue === "semaine" && iso === today && <div className="mb-1 h-1 rounded bg-orange-500" />}
                  <div className="space-y-1">
                    {evs.map((ev) => (
                      <Puce key={`${ev.l.id}-${ev.type}`} ev={ev} grand={vue === "semaine"} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          </>
          )}
        </section>

        {/* Ce qu'il faut organiser */}
        <aside className={`space-y-4 ${mobile && onglet !== "organiser" ? "hidden" : ""}`}>
          {ETAPES.filter((e) => e.key !== "fait" || voirFaits).map((e) => {
            const ls = parEtape(e.key).sort((a, b) => (e.key === "pose" ? datePose(a).localeCompare(datePose(b)) : 0));
            return (
              <section key={e.key} className={`rounded-2xl border-2 ${e.ton} p-3`}>
                <h3 className="font-extrabold text-gray-900">
                  {e.titre} <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs">{ls.length}</span>
                </h3>
                <p className="text-xs text-gray-600 mb-2">{e.aide}</p>
                {ls.length === 0 && <p className="text-xs text-gray-400 italic">Aucun client.</p>}
                <div className="space-y-1.5">
                  {ls.map((l) => (
                    <button
                      key={l.id}
                      draggable
                      onDragStart={(ev) => ev.dataTransfer.setData("text/plain", l.id)}
                      onClick={() => setOuvert(l.id)}
                      className="w-full rounded-xl border border-white bg-white px-3 py-2 text-left shadow-sm hover:border-gray-300 cursor-grab"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-bold text-gray-900">{l.name}</span>
                        {moisSigne(l) !== "—" && <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold capitalize text-gray-700">signé en {moisSigne(l)}</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                        {l.city && <span>📍 {l.city}</span>}
                        {l.fields.zoneProfil && <span>{l.fields.zoneProfil}</span>}
                        {f(l, "poseur") && <span>👷 {f(l, "poseur")}</span>}
                        {dateVt(l) && <span>🔍 {frDate(dateVt(l))}{f(l, "heureVt") && ` ${f(l, "heureVt")}`}</span>}
                        {f(l, "dateDepotMpr") && <span>📨 {frDate(f(l, "dateDepotMpr").slice(0, 10))}</span>}
                        {datePose(l) && (
                          <span className={datePose(l) < today && !installe(l) ? "font-bold text-red-600" : ""}>
                            🔧 {frDate(datePose(l))}{f(l, "heurePose") && ` ${f(l, "heurePose")}`}{datePose(l) < today && !installe(l) ? " · passée, installé ?" : ""}
                          </span>
                        )}
                        {e.key === "vt" && !peutPoser(l) && <span className="font-semibold text-amber-700">⏳ MPR à attendre</span>}
                        {e.key === "mpr" && !f(l, "dateDepotMpr") && <span className="font-semibold text-fuchsia-700">📨 dépôt MPR à noter</span>}
                        {montantsInconnus(l) && <span className="font-semibold text-gray-600">❓ zone + profil manquant</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          <button onClick={() => setVoirFaits(!voirFaits)} className="text-sm font-semibold text-gray-600 underline">
            {voirFaits ? "Masquer les installés" : `Voir les installés (${compte("fait")})`}
          </button>
        </aside>
      </div>

      {/* Fiche planning d'un client */}
      {sel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setOuvert(null)}>
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl space-y-4" dir="ltr" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">{sel.name}</h3>
                <p className="text-sm text-gray-500">
                  {[sel.city, sel.fields.zoneProfil, moisSigne(sel) !== "—" && `signé en ${moisSigne(sel)}`, sel.fields.pipeline && `étape : ${sel.fields.pipeline}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button onClick={() => setOuvert(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" aria-label="Fermer">
                <X size={20} />
              </button>
            </div>

            <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${montantsInconnus(sel) ? "bg-gray-100 text-gray-700" : peutPoser(sel) ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              {montantsInconnus(sel)
                ? "❓ Zone + profil manquant : impossible de savoir si la CEE couvre la pose."
                : peutPoser(sel)
                  ? mprRecue(sel) ? "✅ MaPrimeRénov' reçue : on peut poser." : "✅ La CEE couvre la pose : on peut poser."
                  : "⏳ La CEE ne couvre pas la pose : on attend l'octroi MaPrimeRénov' avant d'installer."}
            </div>

            <div className="grid grid-cols-[1fr_110px] gap-2">
              <label className="block">
                <span className="text-sm font-bold text-gray-700">🔍 Pré-visite</span>
                <input type="date" value={dateVt(sel)} onChange={(e) => poserVt(sel, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900" />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-gray-700">🕘 Heure</span>
                <input type="time" value={f(sel, "heureVt")} onChange={(e) => enregistrer(sel, { heureVt: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-2 py-2 text-gray-900" />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-gray-700">🔧 Pose</span>
                <input type="date" value={datePose(sel)} onChange={(e) => poserPose(sel, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900" />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-gray-700">🕘 Heure</span>
                <input type="time" value={f(sel, "heurePose")} onChange={(e) => enregistrer(sel, { heurePose: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-2 py-2 text-gray-900" />
              </label>
              <label className="block col-span-2">
                <span className="text-sm font-bold text-gray-700">📨 Dépôt du dossier MaPrimeRénov'</span>
                <input type="date" value={f(sel, "dateDepotMpr").slice(0, 10)} onChange={(e) => enregistrer(sel, { dateDepotMpr: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900" />
              </label>
              {admin && (
                <label className="block col-span-2">
                  <span className="text-sm font-bold text-gray-700">💰 Paiement prévu</span>
                  <input type="date" value={f(sel, "datePaiementPrevue").slice(0, 10)} onChange={(e) => enregistrer(sel, { datePaiementPrevue: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900" />
                </label>
              )}
              <label className="block col-span-2">
                <span className="text-sm font-bold text-gray-700">👷 Poseur</span>
                <select value={f(sel, "poseur")} onChange={(e) => enregistrer(sel, { poseur: e.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900">
                  <option value="">—</option>
                  {POSEUR.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => basculerMpr(sel)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${mprRecue(sel) ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"}`}>
                {mprRecue(sel) ? "✅ MPR reçue" : "⏳ MPR pas reçue · cliquer si reçue"}
              </button>
              {!installe(sel) && (
                <button onClick={() => marquerInstalle(sel)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50">
                  🏁 Marquer installé
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              {sel.phone && (
                <a href={`tel:${sel.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-sm font-bold text-white">
                  <Phone size={15} /> {sel.phone}
                </a>
              )}
              <button onClick={() => onOpenLead(sel.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50">
                <ExternalLink size={15} /> Ouvrir la fiche
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
