import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Car, FileUp, Home, Hotel, MapPin, RotateCcw, Truck, Wrench } from "lucide-react";
import { crmFirestore } from "@/lib/crmDb";
import {
  PARAMS_DEFAUT,
  lireExcel,
  loadGeo,
  simuler,
  versDossiers,
  type DossierLoan,
  type Geo,
  type ModeLogement,
  type ParamsLoan,
  type Resultat,
} from "@/lib/tourneesLoan";
import { FRANCE_OUTLINE } from "@/lib/franceOutline";

// ─────────────────────────────────────────────────────────────────────────
// Page « Tournées Loan » : plan des installations de l'équipe de Loan
// (2 installateurs, départ Marseille). Données partagées : Firestore
// crm_boards/tournees_loan (dossiers importés depuis l'Excel + réglages).
// ─────────────────────────────────────────────────────────────────────────
const DOC = ["crm_boards", "tournees_loan"] as const;
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const km = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} km`;
const jourFr = (iso: string) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "—";
const dateFr = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—");
const COULEURS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#ca8a04", "#db2777", "#4f46e5", "#059669", "#b91c1c", "#7c3aed"];

type Champ = { k: keyof ParamsLoan; label: string; unite?: string; step?: number; aide?: string };
const GROUPES: { titre: string; icon: typeof Wrench; champs: Champ[] }[] = [
  {
    titre: "Équipe",
    icon: Wrench,
    champs: [
      { k: "coutJourPose", label: "Coût d'un jour de pose (les 2)", unite: "€" },
      { k: "coutJourRoute", label: "Coût d'un jour de route seule", unite: "€" },
      { k: "primeParPose", label: "Prime par installation", unite: "€", aide: "Si Loan est payé à la pose : mettez 0 aux jours et le prix ici." },
      { k: "seuilKw2Jours", label: "Pose en 2 jours au-delà de", unite: "kW" },
    ],
  },
  {
    titre: "Camion",
    icon: Truck,
    champs: [
      { k: "consoL100", label: "Consommation", unite: "L/100", step: 0.5 },
      { k: "prixCarburant", label: "Prix du gazole", unite: "€/L", step: 0.01 },
      { k: "peageKm", label: "Péages (moyenne)", unite: "€/km", step: 0.01 },
      { k: "vitesse", label: "Vitesse moyenne", unite: "km/h" },
    ],
  },
  {
    titre: "Logement et repas",
    icon: Hotel,
    champs: [
      { k: "hotelNuit", label: "Hôtel, la nuit pour les 2", unite: "€" },
      { k: "airbnbNuit", label: "Airbnb, la nuit (logement entier)", unite: "€" },
      { k: "airbnbDesNuits", label: "Airbnb dès … nuits au même endroit", unite: "nuits" },
      { k: "repasHotel", label: "Repas / pers. / jour (hôtel)", unite: "€" },
      { k: "repasAirbnb", label: "Repas / pers. / jour (Airbnb, cuisine)", unite: "€" },
    ],
  },
  {
    titre: "Route",
    icon: Car,
    champs: [
      { k: "routeSoirMax", label: "Route possible le soir après un chantier", unite: "h", step: 0.5 },
      { k: "routeMatinMax", label: "Route le matin avant un chantier", unite: "h", step: 0.5 },
      { k: "routeJourMax", label: "Route sur une journée sans chantier", unite: "h", step: 0.5, aide: "À deux, ils peuvent se relayer au volant." },
      { k: "coefRoute", label: "Détour route / vol d'oiseau", unite: "×", step: 0.05 },
    ],
  },
];

export default function TourneesLoan({ email }: { email: string }) {
  const [dossiers, setDossiers] = useState<DossierLoan[]>([]);
  const [params, setParams] = useState<ParamsLoan>(PARAMS_DEFAUT);
  const [loaded, setLoaded] = useState(false);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [logement, setLogement] = useState<ModeLogement>("auto");
  const [ouverte, setOuverte] = useState<number | null>(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadGeo()
      .then(setGeo)
      .catch(() => setErr("Impossible de charger la carte des communes. Rechargez la page."));
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.doc(db, ...DOC),
          (snap) => {
            if (cancelled) return;
            const d = snap.data();
            if (d?.dossiers) setDossiers(d.dossiers);
            if (d?.params) setParams({ ...PARAMS_DEFAUT, ...d.params });
            setLoaded(true);
          },
          () => !cancelled && setLoaded(true),
        );
      } catch {
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const enregistrer = (next: { dossiers?: DossierLoan[]; params?: ParamsLoan }) => {
    if (next.dossiers) setDossiers(next.dossiers);
    if (next.params) setParams(next.params);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const { m, db } = await crmFirestore();
        await m.setDoc(
          m.doc(db, ...DOC),
          { ...(next.dossiers ? { dossiers: next.dossiers } : {}), ...(next.params ? { params: next.params } : {}), updatedAt: m.serverTimestamp(), updatedBy: email },
          { merge: true },
        );
        setErr("");
      } catch (e) {
        console.error(e);
        setErr("Impossible d'enregistrer. Vérifiez la connexion et réessayez.");
      }
    }, 600);
  };

  const importer = async (f: File) => {
    setErr("");
    setInfo("");
    try {
      const rows = await lireExcel(f);
      const lus = versDossiers(rows);
      if (!lus.length) throw new Error("Aucun dossier (référence IC-…) trouvé dans le fichier.");
      // On garde les choix déjà faits (inclus, posé, jours, marge corrigée…) pour les dossiers déjà connus.
      const avant = new Map(dossiers.map((d) => [d.ref, d]));
      const fusion = lus.map((d) => {
        const a = avant.get(d.ref);
        return a ? { ...d, inclus: a.inclus, fait: a.fait || d.fait, jours: a.jours ?? null, nouvelleFiche: a.nouvelleFiche ?? false, marge: a.margeModifiee ? a.marge : d.marge, margeModifiee: !!a.margeModifiee } : d;
      });
      enregistrer({ dossiers: fusion });
      setInfo(`${lus.length} dossiers importés, dont ${lus.filter((d) => d.inclus).length} « Signé » ou « Audit » mis dans le plan.`);
    } catch (e: any) {
      setErr(e?.message || "Fichier illisible.");
    }
  };

  const res: Resultat | null = useMemo(() => (geo && dossiers.length ? simuler(dossiers, geo, params, logement) : null), [geo, dossiers, params, logement]);
  const scenarios = useMemo(() => {
    if (!geo || !dossiers.length) return [];
    const s = (label: string, p: ParamsLoan, l: ModeLogement) => ({ label, r: simuler(dossiers, geo, p, l) });
    return [
      s("Retour à Marseille chaque week-end · hôtel partout", { ...params, retourWeekend: true }, "hotel"),
      s("Retour à Marseille chaque week-end · Airbnb dès " + params.airbnbDesNuits + " nuits", { ...params, retourWeekend: true }, "auto"),
      s("Restent sur place le week-end · hôtel partout", { ...params, retourWeekend: false }, "hotel"),
      s("Restent sur place le week-end · Airbnb dès " + params.airbnbDesNuits + " nuits", { ...params, retourWeekend: false }, "auto"),
    ];
  }, [geo, dossiers, params]);
  const meilleur = scenarios.length ? scenarios.reduce((a, b) => (a.r.total.cout <= b.r.total.cout ? a : b)) : null;

  const setP = (k: keyof ParamsLoan, v: any) => enregistrer({ params: { ...params, [k]: v } });
  const setD = (ref: string, patch: Partial<DossierLoan>) => enregistrer({ dossiers: dossiers.map((d) => (d.ref === ref ? { ...d, ...patch } : d)) });

  if (!loaded) return <p className="text-sm text-gray-500 py-10 text-center">Chargement…</p>;

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-6">
      <div className="pb-4 border-b border-gray-200 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[300px]">
          <h1 className="text-2xl font-bold text-gray-900">Tournées Loan</h1>
          <p className="text-sm text-gray-600 mt-1">
            Plan des installations de l'équipe de Loan (2 installateurs, départ de {params.depart}) : ordre des chantiers, route, nuits, coût complet et marge
            restante par dossier. Tout se recalcule dès qu'un réglage change. Distances estimées (pas de GPS) : comptez ± 10 %.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importer(f);
            e.target.value = "";
          }}
        />
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 bg-[#0073ea] hover:bg-[#0060c0] text-white text-sm font-semibold rounded-lg px-4 py-2">
          <FileUp size={16} /> Importer le fichier Excel des dossiers
        </button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {info && <p className="text-sm text-emerald-700">{info}</p>}

      {!dossiers.length ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-sm text-gray-600">
          Importez le fichier Excel des dossiers (celui avec la feuille « Tous les dossiers »). Les dossiers « Signé » et « Audit » sont mis dans le plan
          automatiquement ; vous pourrez en ajouter ou en retirer ensuite.
        </div>
      ) : !res ? (
        <p className="text-sm text-gray-500 py-10 text-center">Calcul…</p>
      ) : (
        <>
          {/* Réglages principaux */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CalendarDays size={16} className="text-gray-400" /> Début des poses
              <input type="date" value={params.debut} onChange={(e) => setP("debut", e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-sm" />
            </label>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Home size={16} className="text-gray-400" /> Week-ends
              <select value={params.retourWeekend ? "1" : "0"} onChange={(e) => setP("retourWeekend", e.target.value === "1")} className="border border-gray-300 rounded-md px-2 py-1 text-sm">
                <option value="1">Retour à Marseille chaque week-end</option>
                <option value="0">Restent sur place (rentrent à la fin)</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Hotel size={16} className="text-gray-400" /> Logement
              <select value={logement} onChange={(e) => setLogement(e.target.value as ModeLogement)} className="border border-gray-300 rounded-md px-2 py-1 text-sm">
                <option value="auto">Le mieux : Airbnb dès {params.airbnbDesNuits} nuits au même endroit, sinon hôtel</option>
                <option value="hotel">Hôtel partout</option>
                <option value="airbnb">Airbnb partout</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              Gain nouvelle fiche CEE
              <input
                type="number"
                value={params.gainNouvelleFiche}
                onChange={(e) => setP("gainNouvelleFiche", Number(e.target.value) || 0)}
                className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm text-right"
              />
              <span className="font-normal text-gray-500">€ / dossier coché « Nouvelle fiche »</span>
            </label>
          </div>

          {/* Chiffres clés */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { t: "Installations", v: `${res.total.poses}`, s: `${res.total.joursPose} jours de pose · ${res.total.joursRoute} jours de route` },
              { t: "Tournées", v: `${res.tournees.length}`, s: `du ${dateFr(params.debut)} au ${dateFr(res.total.fin)}` },
              { t: "Kilomètres", v: km(res.total.km), s: `${eur(res.total.route)} de gazole et péages` },
              { t: "Coût complet", v: eur(res.total.cout), s: `${eur(res.total.poses ? res.total.cout / res.total.poses : 0)} par installation` },
              { t: "Marge des dossiers", v: eur(res.total.marge), s: "avant frais d'installation" },
              { t: "Marge nette", v: eur(res.total.net), s: "après équipe, route, logement, repas", vert: true },
            ].map((k) => (
              <div key={k.t} className={`rounded-xl border p-4 ${(k as any).vert ? (res.total.net >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200") : "bg-white border-gray-200"}`}>
                <p className="text-xs font-semibold text-gray-500 uppercase">{k.t}</p>
                <p className="text-2xl font-extrabold text-gray-900 mt-1">{k.v}</p>
                <p className="text-xs text-gray-500 mt-1">{k.s}</p>
              </div>
            ))}
          </div>

          <div className="grid xl:grid-cols-[1fr_1fr] gap-6">
            {/* Carte */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-extrabold text-gray-800 mb-2">Carte des tournées</h2>
              <Carte res={res} params={params} ouverte={ouverte} />
            </div>
            {/* Détail des coûts + scénarios */}
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h2 className="text-sm font-extrabold text-gray-800 mb-3">D'où vient le coût</h2>
                {[
                  { l: "Équipe (jours de pose et de route)", v: res.total.equipe, c: "#2563eb" },
                  { l: "Gazole et péages", v: res.total.route, c: "#ea580c" },
                  { l: `Logement (${res.total.nuitsHotel} nuits d'hôtel, ${res.total.nuitsAirbnb} nuits d'Airbnb)`, v: res.total.logement, c: "#9333ea" },
                  { l: "Repas", v: res.total.repas, c: "#16a34a" },
                ].map((x) => (
                  <div key={x.l} className="mb-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{x.l}</span>
                      <span className="font-bold text-gray-900">{eur(x.v)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full mt-1">
                      <div className="h-2 rounded-full" style={{ width: `${res.total.cout ? (100 * x.v) / res.total.cout : 0}%`, background: x.c }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h2 className="text-sm font-extrabold text-gray-800 mb-1">Comparer les façons de faire</h2>
                <p className="text-xs text-gray-500 mb-3">Mêmes dossiers, mêmes prix : seule l'organisation change.</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-200">
                      <th className="text-left py-1.5">Organisation</th>
                      <th className="text-right py-1.5">Fin</th>
                      <th className="text-right py-1.5">Km</th>
                      <th className="text-right py-1.5">Coût</th>
                      <th className="text-right py-1.5">Marge nette</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((s) => (
                      <tr key={s.label} className={`border-b border-gray-100 ${s === meilleur ? "bg-emerald-50 font-semibold" : ""}`}>
                        <td className="py-1.5 pr-2">
                          {s === meilleur ? "✅ " : ""}
                          {s.label}
                        </td>
                        <td className="py-1.5 text-right whitespace-nowrap">{jourFr(s.r.total.fin)}</td>
                        <td className="py-1.5 text-right whitespace-nowrap">{km(s.r.total.km)}</td>
                        <td className="py-1.5 text-right whitespace-nowrap">{eur(s.r.total.cout)}</td>
                        <td className="py-1.5 text-right whitespace-nowrap">{eur(s.r.total.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {meilleur && (
                  <p className="text-xs text-gray-600 mt-3">
                    Le moins cher : <b>{meilleur.label.toLowerCase()}</b>. Rester sur place évite les allers-retours vers Marseille (souvent 1 à 2 jours de route par
                    semaine) mais demande l'accord de l'équipe et des nuits en plus le week-end.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tournées semaine par semaine */}
          <div className="space-y-3">
            <h2 className="text-lg font-extrabold text-gray-900">Le planning, tournée par tournée</h2>
            {res.nonPlaces.length > 0 && (
              <p className="text-sm text-amber-700">
                Non placés (commune introuvable) : {res.nonPlaces.map((l) => `${l.d.client} (${l.d.ville})`).join(", ")}.
              </p>
            )}
            {res.tournees.map((t) => {
              const c = COULEURS[(t.n - 1) % COULEURS.length];
              const ouvert = ouverte === t.n;
              const netT = t.marge - t.cout.total;
              return (
                <div key={t.n} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <button onClick={() => setOuverte(ouvert ? null : t.n)} className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1 hover:bg-gray-50" style={{ borderLeft: `6px solid ${c}` }}>
                    <span className="font-extrabold text-gray-900">Tournée {t.n}</span>
                    <span className="text-sm text-gray-600">
                      {jourFr(t.debut)} → {jourFr(t.fin)}
                    </span>
                    <span className="text-sm text-gray-800 font-semibold">{t.refs.length} pose(s)</span>
                    <span className="text-sm text-gray-600">{km(t.km)}</span>
                    <span className="text-sm text-gray-600">Coût {eur(t.cout.total)}</span>
                    <span className={`text-sm font-bold ${netT >= 0 ? "text-emerald-700" : "text-red-600"}`}>Net {eur(netT)}</span>
                    <span className="ml-auto text-xs text-gray-400">{ouvert ? "Masquer" : "Voir le détail"}</span>
                  </button>
                  {ouvert && (
                    <div className="px-4 pb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 border-b border-gray-200">
                            <th className="text-left py-2 w-32">Jour</th>
                            <th className="text-left py-2">Programme</th>
                            <th className="text-right py-2 w-24">Route</th>
                            <th className="text-left py-2 pl-4 w-64">Nuit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {t.jours.map((j, i) => {
                            const sej = t.sejours.find((s) => j.nuit && s.ville === j.nuit && s.debut <= j.date);
                            return (
                              <tr key={i} className={j.type === "pose" ? "" : j.type === "route" ? "bg-amber-50/50" : "bg-gray-50"}>
                                <td className="py-1.5 font-semibold text-gray-700 whitespace-nowrap">{jourFr(j.date)}</td>
                                <td className="py-1.5 text-gray-800">
                                  {j.type === "pose" ? "🔧 " : j.type === "route" ? "🚐 " : "🛌 "}
                                  {j.texte}
                                </td>
                                <td className="py-1.5 text-right text-gray-600 whitespace-nowrap">{j.km ? `${j.km} km · ${j.heures.toFixed(1).replace(".", ",")} h` : "—"}</td>
                                <td className="py-1.5 pl-4 text-gray-700">
                                  {j.nuit ? (
                                    <>
                                      {sej?.type === "airbnb" ? "🏠 Airbnb" : "🏨 Hôtel"} · {j.nuit}
                                    </>
                                  ) : (
                                    <span className="text-gray-400">À la maison</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
                        {[
                          ["Équipe", t.cout.equipe],
                          ["Gazole + péages", t.cout.route],
                          ["Logement", t.cout.logement],
                          ["Repas", t.cout.repas],
                          ["Marge des dossiers", t.marge],
                        ].map(([l, v]) => (
                          <div key={l as string} className="bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-gray-500">{l}</span> <b className="text-gray-900 float-right">{eur(v as number)}</b>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        À réserver :{" "}
                        {t.sejours.filter((s) => s.ville !== "Étape sur la route").length
                          ? t.sejours
                              .filter((s) => s.ville !== "Étape sur la route")
                              .map((s) => `${s.type === "airbnb" ? "Airbnb" : "hôtel"} à ${s.ville} (${s.nuits} nuit${s.nuits > 1 ? "s" : ""}, dès le ${jourFr(s.debut)})`)
                              .join(" · ")
                          : "rien"}
                        {t.sejours.some((s) => s.ville === "Étape sur la route") ? " · + hôtel d'étape sur l'autoroute" : ""}.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dossiers */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b border-gray-200">
              <h2 className="text-lg font-extrabold text-gray-900">Dossiers</h2>
              <span className="text-xs text-gray-500">Cochez « Dans le plan » pour ajouter ou retirer un dossier, « Posé » quand c'est fait. La marge et la durée se modifient directement.</span>
              <button
                onClick={() => enregistrer({ params: PARAMS_DEFAUT })}
                className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
                title="Remettre tous les réglages par défaut"
              >
                <RotateCcw size={13} /> Réglages par défaut
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
                    <th className="py-2 px-3 text-center">Dans le plan</th>
                    <th className="py-2 px-3 text-center">Posé</th>
                    <th className="py-2 px-3 text-left">Client</th>
                    <th className="py-2 px-3 text-left">Ville</th>
                    <th className="py-2 px-3 text-left">Statut</th>
                    <th className="py-2 px-3 text-left">Catégorie</th>
                    <th className="py-2 px-3 text-right">kW</th>
                    <th className="py-2 px-3 text-center">Durée</th>
                    <th className="py-2 px-3 text-right">Depuis Marseille</th>
                    <th className="py-2 px-3 text-center">Tournée</th>
                    <th className="py-2 px-3 text-right">Marge</th>
                    <th className="py-2 px-3 text-center">Nouvelle fiche</th>
                    <th className="py-2 px-3 text-right">Coût Loan</th>
                    <th className="py-2 px-3 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...res.lignes]
                    .sort((a, b) => (a.tournee ?? 999) - (b.tournee ?? 999) || (a.date ?? "").localeCompare(b.date ?? "") || a.d.client.localeCompare(b.d.client))
                    .map((l) => (
                      <tr key={l.d.ref} className={l.d.inclus && !l.d.fait ? "" : "opacity-50"}>
                        <td className="py-1.5 px-3 text-center">
                          <input type="checkbox" checked={l.d.inclus} onChange={(e) => setD(l.d.ref, { inclus: e.target.checked })} />
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <input type="checkbox" checked={!!l.d.fait} onChange={(e) => setD(l.d.ref, { fait: e.target.checked })} />
                        </td>
                        <td className="py-1.5 px-3 font-semibold text-gray-900 whitespace-nowrap">
                          {l.d.client}
                          <span className="block text-[11px] font-mono font-normal text-gray-400">{l.d.ref}</span>
                        </td>
                        <td className="py-1.5 px-3 text-gray-700 whitespace-nowrap">
                          <MapPin size={12} className="inline text-gray-400 mr-1" />
                          {l.d.cp} {l.d.ville}
                          {l.pt?.approx && <span className="text-amber-600" title="Commune non trouvée exactement : position approximative"> ≈</span>}
                        </td>
                        <td className="py-1.5 px-3 text-gray-700">{l.d.statut}</td>
                        <td className="py-1.5 px-3 text-gray-700">{l.d.categorie}</td>
                        <td className="py-1.5 px-3 text-right">{l.d.kw ?? "—"}</td>
                        <td className="py-1.5 px-3 text-center">
                          <select value={l.d.jours ?? 0} onChange={(e) => setD(l.d.ref, { jours: Number(e.target.value) || null })} className="text-xs border border-gray-300 rounded px-1 py-0.5">
                            <option value={0}>Auto ({l.jours} j)</option>
                            <option value={1}>1 jour</option>
                            <option value={2}>2 jours</option>
                            <option value={3}>3 jours</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-3 text-right whitespace-nowrap text-gray-600">{l.kmMarseille ? km(l.kmMarseille) : "—"}</td>
                        <td className="py-1.5 px-3 text-center">
                          {l.tournee ? (
                            <span className="inline-block whitespace-nowrap text-xs font-bold text-white rounded-full px-2 py-0.5" style={{ background: COULEURS[(l.tournee - 1) % COULEURS.length] }} title={l.date ? jourFr(l.date) : ""}>
                              T{l.tournee} · {jourFr(l.date ?? "")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <input
                            type="number"
                            value={l.d.marge ?? ""}
                            placeholder="?"
                            onChange={(e) => setD(l.d.ref, { marge: e.target.value === "" ? null : Number(e.target.value), margeModifiee: true })}
                            className="w-24 text-right border border-gray-200 rounded px-1 py-0.5"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <input type="checkbox" checked={!!l.d.nouvelleFiche} onChange={(e) => setD(l.d.ref, { nouvelleFiche: e.target.checked })} />
                        </td>
                        <td className="py-1.5 px-3 text-right whitespace-nowrap text-gray-700">{l.tournee ? eur(l.cout) : "—"}</td>
                        <td className={`py-1.5 px-3 text-right whitespace-nowrap font-bold ${!l.tournee ? "text-gray-300" : l.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {l.tournee ? eur(l.net) : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Réglages détaillés */}
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {GROUPES.map((g) => (
              <div key={g.titre} className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-extrabold text-gray-800 mb-3 flex items-center gap-2">
                  <g.icon size={16} className="text-gray-400" /> {g.titre}
                </h3>
                <div className="space-y-2">
                  {g.champs.map((c) => (
                    <label key={c.k} className="block text-xs text-gray-600" title={c.aide}>
                      <span className="flex items-center justify-between gap-2">
                        <span>{c.label}</span>
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            step={c.step ?? 1}
                            value={params[c.k] as number}
                            onChange={(e) => setP(c.k, Number(e.target.value) || 0)}
                            className="w-20 text-right border border-gray-300 rounded px-1.5 py-1 text-sm text-gray-900"
                          />
                          <span className="w-10 text-gray-400">{c.unite}</span>
                        </span>
                      </span>
                      {c.aide && <span className="block text-[11px] text-gray-400 mt-0.5">{c.aide}</span>}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Comment c'est calculé : chaque tournée part de {params.depart} le lundi et commence par le coin de France où il y a le plus de travail groupé, puis
            enchaîne le chantier le plus proche. Une pose dure 1 jour (2 jours au-delà de {params.seuilKw2Jours} kW, ou la durée choisie). Jusqu'à {params.routeSoirMax} h de
            route le soir après un chantier et {params.routeMatinMax} h le matin ; au-delà, journée de route ({params.routeJourMax} h maximum, les deux se relaient). Nuits
            au même endroit regroupées : Airbnb dès {params.airbnbDesNuits} nuits (cuisine, machine à laver, place pour le camion), sinon hôtel. Jours fériés exclus. Le coût
            de chaque tournée est réparti sur ses dossiers selon les jours de pose.
          </p>
        </>
      )}
    </div>
  );
}

// Carte : contour de la France + tournées (traits colorés), points des dossiers.
function Carte({ res, params, ouverte }: { res: Resultat; params: ParamsLoan; ouverte: number | null }) {
  const W = 520;
  const Hh = 520;
  const lng0 = -5.3,
    lng1 = 9.7,
    lat0 = 41.2,
    lat1 = 51.2;
  const k = Math.cos((46.5 * Math.PI) / 180);
  const sx = W / ((lng1 - lng0) * k);
  const sy = Hh / (lat1 - lat0);
  const s = Math.min(sx, sy);
  const X = (lng: number) => (lng - lng0) * k * s;
  const Y = (lat: number) => (lat1 - lat) * s;
  const path = FRANCE_OUTLINE.map((ring) => "M" + ring.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join("L") + "Z").join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} className="w-full h-auto">
      <path d={path} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={1} />
      {res.tournees.map((t) => {
        const c = COULEURS[(t.n - 1) % COULEURS.length];
        const dim = ouverte !== null && ouverte !== t.n;
        return (
          <polyline
            key={t.n}
            points={t.trace.map((p) => `${X(p.lng).toFixed(1)},${Y(p.lat).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={c}
            strokeWidth={ouverte === t.n ? 3 : 1.8}
            strokeOpacity={dim ? 0.15 : 0.85}
            strokeLinejoin="round"
          />
        );
      })}
      {res.lignes
        .filter((l) => l.pt)
        .map((l) => {
          const c = l.tournee ? COULEURS[(l.tournee - 1) % COULEURS.length] : "#9ca3af";
          return (
            <circle key={l.d.ref} cx={X(l.pt!.lng)} cy={Y(l.pt!.lat)} r={l.tournee ? 4.5 : 3} fill={l.d.fait ? "#111827" : c} stroke="#fff" strokeWidth={1.2}>
              <title>
                {l.d.client} — {l.d.ville}
                {l.tournee ? ` · tournée ${l.tournee}` : l.d.fait ? " · déjà posé" : " · hors plan"}
              </title>
            </circle>
          );
        })}
      <rect x={X(params.departLng) - 6} y={Y(params.departLat) - 6} width={12} height={12} fill="#111827" rx={2} />
      <text x={X(params.departLng) + 9} y={Y(params.departLat) + 4} fontSize={12} fontWeight={700} fill="#111827">
        {params.depart}
      </text>
    </svg>
  );
}
