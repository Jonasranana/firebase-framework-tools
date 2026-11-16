import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Phone, ExternalLink } from "lucide-react";
import { useLeads } from "@/lib/crmStore";
import { crmFirestore } from "@/lib/crmDb";
import type { Lead } from "@/lib/crm";
import { useColumnsConfig } from "@/lib/crmColumnsConfig";
import { ceeSeule, mprRecue, isSigne, moisSigne } from "@/lib/chantiers";

// ─────────────────────────────────────────────────────────────────────────
// « Planning chantiers » (Jonas et Alexis) : tous les clients signés, avec un
// calendrier du mois pour caler les pré-visites (colonne « 🗓 Date VT ») et les
// poses (« 🔧 Date Pose »), et ce qui bloque : on ne pose pas tant que la CEE
// ne couvre pas le fourni-posé et que MaPrimeRénov' n'est pas reçue (on
// n'avance rien). Les dates sont celles du tableau Pac Pac : modifier ici ou
// dans le tableau revient au même. La colonne « 🔧 Pipeline » avance seule.
// ─────────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => isoOf(new Date());
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const frDate = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "");
const AVANT_VT = ["", "Docs demandés", "Docs reçus", "Attente conf. VT"];

const dateVt = (l: Lead) => String(l.fields.dateVt ?? "").slice(0, 10);
const datePose = (l: Lead) => String(l.fields.datePose ?? "").slice(0, 10);
const installe = (l: Lead) => l.fields.pipeline === "Installé";
const peutPoser = (l: Lead) => (ceeSeule(l) ?? 0) >= 0 || mprRecue(l);
const montantsInconnus = (l: Lead) => ceeSeule(l) === null;

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
  { key: "pret", titre: "✅ Prêt à poser", aide: "Pré-visite calée et dossier qui permet d'installer : il reste à fixer la date.", ton: "border-emerald-300 bg-emerald-50" },
  { key: "pose", titre: "🔧 Pose programmée", aide: "Date de pose fixée.", ton: "border-violet-300 bg-violet-50" },
  { key: "fait", titre: "🏁 Installés", aide: "Marqués « Installé ».", ton: "border-gray-300 bg-gray-50" },
];

export default function PlanningChantiers({ email, onOpenLead }: { email: string; onOpenLead: (id: string) => void }) {
  const { data: allLeads } = useLeads();
  const { version: colsVersion } = useColumnsConfig(email, "leads");
  const [mois, setMois] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [voirFaits, setVoirFaits] = useState(false);
  const [erreur, setErreur] = useState("");

  // Clients signés (étiquettes « Signé en … ») + ceux déjà passés en pose / installés.
  const clients = useMemo(
    () =>
      (allLeads ?? [])
        .filter((l) => isSigne(l) || !!datePose(l) || installe(l) || l.fields.pipeline === "Pose programmée")
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [allLeads, colsVersion],
  );
  const parEtape = (e: Etape) => clients.filter((l) => etapeOf(l) === e);
  const today = todayIso();

  // Jours affichés : du lundi précédant le 1er au dimanche suivant la fin du mois.
  const jours = useMemo(() => {
    const debut = new Date(mois);
    debut.setDate(1 - ((debut.getDay() + 6) % 7));
    const fin = new Date(mois.getFullYear(), mois.getMonth() + 1, 0);
    fin.setDate(fin.getDate() + (6 - ((fin.getDay() + 6) % 7)));
    const out: string[] = [];
    for (const d = new Date(debut); d <= fin; d.setDate(d.getDate() + 1)) out.push(isoOf(d));
    return out;
  }, [mois]);
  const evenements = useMemo(() => {
    const m = new Map<string, { l: Lead; type: "vt" | "pose" }[]>();
    const add = (iso: string, l: Lead, type: "vt" | "pose") => {
      if (!iso) return;
      m.set(iso, [...(m.get(iso) ?? []), { l, type }]);
    };
    for (const l of clients) {
      add(dateVt(l), l, "vt");
      add(datePose(l), l, "pose");
    }
    return m;
  }, [clients]);

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

  // Glisser un client sur un jour : pré-visite s'il n'en a pas encore, sinon pose.
  const deposer = (iso: string, data: string) => {
    const [id, type] = data.split("|");
    const l = clients.find((x) => x.id === id);
    if (!l) return;
    const t = type === "vt" || type === "pose" ? type : dateVt(l) ? "pose" : "vt";
    if (t === "vt") poserVt(l, iso);
    else poserPose(l, iso);
  };

  const sel = clients.find((l) => l.id === ouvert) ?? null;
  const compte = (e: Etape) => parEtape(e).length;

  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">🗓️ Planning chantiers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Les {clients.length} clients signés : pré-visites, poses, et ce qui attend MaPrimeRénov'. Glissez un client sur un jour du calendrier pour lui donner une date.
          </p>
        </div>
        {erreur && <p className="text-sm font-semibold text-red-600">{erreur}</p>}
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Calendrier du mois */}
        <section className="self-start rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-2 bg-[#0f172a] text-white px-4 py-3">
            <button onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Mois précédent">
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-extrabold capitalize">
                {MOIS[mois.getMonth()]} {mois.getFullYear()}
              </h2>
              <button onClick={() => setMois(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold hover:bg-white/25">
                Aujourd'hui
              </button>
            </div>
            <button onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Mois suivant">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="flex flex-wrap gap-4 px-4 py-2 text-xs font-semibold text-gray-600 border-b border-gray-100">
            <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded bg-sky-500" /> Pré-visite</span>
            <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded bg-emerald-600" /> Pose</span>
            <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded bg-red-500" /> Pose alors que la MPR n'est pas reçue</span>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">
            {JOURS.map((j) => (
              <div key={j} className="py-2">{j}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {jours.map((iso, i) => {
              const d = new Date(`${iso}T12:00:00`);
              const horsMois = d.getMonth() !== mois.getMonth();
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
                  className={`min-h-[110px] border-b border-r border-gray-100 p-1.5 ${horsMois ? "bg-gray-50/70" : weekend ? "bg-slate-50" : "bg-white"}`}
                >
                  <div className={`mb-1 text-xs font-bold ${iso === today ? "inline-flex w-6 h-6 items-center justify-center rounded-full bg-orange-500 text-white" : horsMois ? "text-gray-300" : "text-gray-600"}`}>{d.getDate()}</div>
                  <div className="space-y-1">
                    {evs.map(({ l, type }) => {
                      const alerte = type === "pose" && !peutPoser(l) && !installe(l);
                      return (
                        <button
                          key={`${l.id}-${type}`}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", `${l.id}|${type}`)}
                          onClick={() => setOuvert(l.id)}
                          title={`${type === "vt" ? "Pré-visite" : "Pose"} : ${l.name}${l.city ? ` (${l.city})` : ""}`}
                          className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-[11px] font-bold text-white ${alerte ? "bg-red-500" : type === "vt" ? "bg-sky-500" : installe(l) ? "bg-gray-400" : "bg-emerald-600"}`}
                        >
                          {type === "vt" ? "🔍" : installe(l) ? "🏁" : "🔧"} {l.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Ce qu'il faut organiser */}
        <aside className="space-y-4">
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
                        {dateVt(l) && <span>🔍 {frDate(dateVt(l))}</span>}
                        {datePose(l) && <span className={datePose(l) < today && !installe(l) ? "font-bold text-red-600" : ""}>🔧 {frDate(datePose(l))}{datePose(l) < today && !installe(l) ? " · passée, installé ?" : ""}</span>}
                        {e.key === "vt" && !peutPoser(l) && <span className="font-semibold text-amber-700">⏳ MPR à attendre</span>}
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
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">{sel.name}</h3>
                <p className="text-sm text-gray-500">
                  {[sel.city, sel.fields.zoneProfil, sel.fields.poseur && `👷 ${sel.fields.poseur}`, moisSigne(sel) !== "—" && `signé en ${moisSigne(sel)}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button onClick={() => setOuvert(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" aria-label="Fermer">
                <X size={20} />
              </button>
            </div>

            <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${peutPoser(sel) ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              {montantsInconnus(sel)
                ? "❓ Zone + profil manquant : impossible de savoir si la CEE couvre la pose."
                : peutPoser(sel)
                  ? mprRecue(sel) ? "✅ MaPrimeRénov' reçue : on peut poser." : "✅ La CEE couvre la pose : on peut poser."
                  : "⏳ La CEE ne couvre pas la pose : on attend l'octroi MaPrimeRénov' avant d'installer."}
            </div>

            <label className="block">
              <span className="text-sm font-bold text-gray-700">🔍 Date de pré-visite</span>
              <input type="date" value={dateVt(sel)} onChange={(e) => poserVt(sel, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900" />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-gray-700">🔧 Date de pose</span>
              <input type="date" value={datePose(sel)} onChange={(e) => poserPose(sel, e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900" />
            </label>

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
