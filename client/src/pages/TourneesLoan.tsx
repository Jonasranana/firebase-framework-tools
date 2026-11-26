import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Car, FileUp, Hotel, RotateCcw, Truck, Wrench } from "lucide-react";
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
import { useSimuParams } from "@/lib/margeSimu";
import { useIsMobile } from "@/hooks/use-mobile";
import { FRANCE_OUTLINE } from "@/lib/franceOutline";

// ─────────────────────────────────────────────────────────────────────────
// Page « Tournées Loan » : plan des installations de l'équipe de Loan
// (2 installateurs, départ Aix-en-Provence par défaut). Données partagées : Firestore
// crm_boards/tournees_loan (dossiers importés depuis l'Excel + réglages).
// ─────────────────────────────────────────────────────────────────────────
const DOC = ["crm_boards", "tournees_loan"] as const;
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const km = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} km`;
const jourFr = (iso: string) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "—";
const DEPARTS = [
  { nom: "Aix-en-Provence", lat: 43.5297, lng: 5.4474 },
  { nom: "Marseille", lat: 43.2965, lng: 5.3698 },
];
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
    titre: "Logement (et repas si payés)",
    icon: Hotel,
    champs: [
      { k: "hotelNuit", label: "Hôtel, la nuit pour les 2", unite: "€" },
      { k: "airbnbNuit", label: "Airbnb, la nuit (logement entier)", unite: "€" },
      { k: "airbnbDesNuits", label: "Airbnb dès … nuits au même endroit", unite: "nuits" },
      { k: "repasHotel", label: "Repas / pers. / jour (hôtel)", unite: "€", aide: "0 = repas à la charge de l'équipe." },
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
  // Téléphone : les jours de chaque semaine sont empilés (au lieu de 5 à 7 colonnes serrées).
  const mobile = useIsMobile();
  const [dossiers, setDossiers] = useState<DossierLoan[]>([]);
  const [params, setParams] = useState<ParamsLoan>(PARAMS_DEFAUT);
  const [loaded, setLoaded] = useState(false);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [logement, setLogement] = useState<ModeLogement>("auto");
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
            if (d?.params) {
              const pr = { ...PARAMS_DEFAUT, ...d.params };
              // Réglages enregistrés avant le départ d'Aix et la règle des 500 km : on passe au départ d'Aix.
              if (d.params.rayonMax === undefined && pr.depart === "Marseille") Object.assign(pr, { depart: PARAMS_DEFAUT.depart, departLat: PARAMS_DEFAUT.departLat, departLng: PARAMS_DEFAUT.departLng });
              if (d.params.rayonLoin === undefined) Object.assign(pr, { groupeMin: PARAMS_DEFAUT.groupeMin, rayonLoin: PARAMS_DEFAUT.rayonLoin, groupeMinLoin: PARAMS_DEFAUT.groupeMinLoin });
              // Repas retirés (pas payés par IP5) : une fois pour les réglages enregistrés avant.
              if (d.params.sansRepas === undefined) Object.assign(pr, { repasHotel: 0, repasAirbnb: 0 });
              // Loan payé 1 200 € par pose et marge calculée par le simulateur : une fois pour les réglages enregistrés avant.
              if (d.params.margeSource === undefined) {
                pr.margeSource = "simulateur";
                if (!d.params.primeParPose) Object.assign(pr, { coutJourPose: 0, coutJourRoute: 0, primeParPose: 1200 });
              }
              setParams(pr);
            }
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

  const { params: simu } = useSimuParams(email);
  const res: Resultat | null = useMemo(() => (geo && dossiers.length ? simuler(dossiers, geo, params, logement, simu) : null), [geo, dossiers, params, logement, simu]);
  const scenarios = useMemo(() => {
    if (!geo || !dossiers.length) return [];
    const s = (label: string, p: ParamsLoan, l: ModeLogement) => ({ label, r: simuler(dossiers, geo, p, l, simu) });
    return [
      s(`Retour à ${params.depart} chaque week-end` + " · hôtel partout", { ...params, retourWeekend: true }, "hotel"),
      s(`Retour à ${params.depart} chaque week-end`+" · Airbnb dès " + params.airbnbDesNuits + " nuits", { ...params, retourWeekend: true }, "auto"),
      s("Restent sur place le week-end · hôtel partout", { ...params, retourWeekend: false }, "hotel"),
      s("Restent sur place le week-end · Airbnb dès " + params.airbnbDesNuits + " nuits", { ...params, retourWeekend: false }, "auto"),
    ];
  }, [geo, dossiers, params, simu]);
  const meilleur = scenarios.length ? scenarios.reduce((a, b) => (a.r.total.cout <= b.r.total.cout ? a : b)) : null;

  const setP = (k: keyof ParamsLoan, v: any) => enregistrer({ params: { ...params, [k]: v } });
  const setD = (ref: string, patch: Partial<DossierLoan>) => enregistrer({ dossiers: dossiers.map((d) => (d.ref === ref ? { ...d, ...patch } : d)) });

  if (!loaded) return <p className="text-sm text-gray-500 py-10 text-center">Chargement…</p>;

  return (
    <div className="p-1 sm:p-6 max-w-[1400px] mx-auto space-y-4 sm:space-y-6 [color-scheme:light] [&_input]:bg-white [&_select]:bg-white [&_input]:text-gray-900 [&_select]:text-gray-900 [&_input[type=checkbox]]:accent-[#0073ea]">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-2xl font-bold text-gray-900">🚐 Tournées Loan</h1>
          <p className="text-sm text-gray-500 mt-0.5">Qui on pose, quel jour, où dormir, et ce qu'il nous reste.</p>
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
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg px-4 py-2">
          <FileUp size={16} /> {dossiers.length ? "Mettre à jour avec le fichier Excel" : "Importer le fichier Excel"}
        </button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {info && <p className="text-sm text-emerald-700">{info}</p>}

      {!dossiers.length ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center">
          <p className="text-lg font-bold text-gray-800">Commencez par importer le fichier Excel des dossiers</p>
          <p className="text-sm text-gray-500 mt-2">Les dossiers « Signé » et « Audit » sont mis dans le plan tout seuls.</p>
        </div>
      ) : !res ? (
        <p className="text-sm text-gray-500 py-10 text-center">Calcul…</p>
      ) : (
        <>
          {/* Les 3 chiffres qui comptent */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Installations prévues</p>
              <p className="text-4xl font-extrabold text-gray-900 mt-1">{res.total.poses}</p>
              <p className="text-sm text-gray-500 mt-1">
                en {res.tournees.length} semaines · du {jourFr(res.tournees[0]?.debut ?? params.debut)} au {jourFr(res.total.fin)}
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Ce que ça nous coûte</p>
              <p className="text-4xl font-extrabold text-gray-900 mt-1">{eur(res.total.cout)}</p>
              <p className="text-sm text-gray-500 mt-1">soit {eur(res.total.poses ? res.total.cout / res.total.poses : 0)} par installation, tout compris</p>
            </div>
            <div className={`rounded-2xl border p-5 ${res.total.net >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <p className="text-sm text-gray-600">Ce qu'il nous reste</p>
              <p className={`text-4xl font-extrabold mt-1 ${res.total.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{eur(res.total.net)}</p>
              <p className="text-sm text-gray-600 mt-1">marge des dossiers {eur(res.total.marge)} moins le coût</p>
            </div>
          </div>

          {/* Le conseil */}
          {meilleur && (
            <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 flex flex-wrap items-center gap-3">
              <span className="text-2xl">💡</span>
              <p className="flex-1 min-w-[260px] text-sm text-blue-900">
                {meilleur.r.total.cout < res.total.cout - 50 ? (
                  <>
                    <b>Notre conseil :</b> {meilleur.label}. On économiserait <b>{eur(res.total.cout - meilleur.r.total.cout)}</b> et on finirait le{" "}
                    {jourFr(meilleur.r.total.fin)}.
                  </>
                ) : (
                  <>
                    <b>C'est déjà l'organisation la moins chère</b> parmi celles qu'on a comparées.
                  </>
                )}
              </p>
              <select value={params.retourWeekend ? "1" : "0"} onChange={(e) => setP("retourWeekend", e.target.value === "1")} className="max-w-full border border-blue-300 bg-white rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-900">
                <option value="1">Ils rentrent à {params.depart} chaque week-end</option>
                <option value="0">Ils restent sur place le week-end</option>
              </select>
            </div>
          )}

          {/* Les chiffres en détail + carte */}
          <div className="grid xl:grid-cols-[1.1fr_1fr] gap-4 [&>*]:min-w-0">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-xl font-extrabold text-gray-900 mb-4">Les chiffres en détail</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-extrabold text-gray-800 mb-2">D'où vient le coût</h3>
                  {[
                    { l: "Équipe (jours de pose et de route)", v: res.total.equipe, c: "#2563eb" },
                    { l: `Gazole et péages (${km(res.total.km)})`, v: res.total.route, c: "#ea580c" },
                    { l: `Logement (${res.total.nuitsHotel} nuits d'hôtel, ${res.total.nuitsAirbnb} d'Airbnb)`, v: res.total.logement, c: "#9333ea" },
                    ...(res.total.repas ? [{ l: "Repas", v: res.total.repas, c: "#16a34a" }] : []),
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
                <div>
                  <h3 className="text-sm font-extrabold text-gray-800 mb-2">Les 4 façons de s'organiser</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {scenarios.map((s) => (
                        <tr key={s.label} className={`border-b border-gray-100 ${s === meilleur ? "font-bold text-emerald-800" : "text-gray-700"}`}>
                          <td className="py-1.5 pr-2">
                            {s === meilleur ? "✅ " : ""}
                            {s.label}
                          </td>
                          <td className="py-1.5 text-right whitespace-nowrap">{eur(s.r.total.cout)}</td>
                          <td className="py-1.5 text-right whitespace-nowrap pl-3">fin {jourFr(s.r.total.fin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <label className="text-sm text-gray-700 flex items-center gap-2 mt-3">
                    Logement
                    <select value={logement} onChange={(e) => setLogement(e.target.value as ModeLogement)} className="border border-gray-300 rounded-md px-2 py-1 text-sm">
                      <option value="auto">Airbnb dès {params.airbnbDesNuits} nuits au même endroit, sinon hôtel</option>
                      <option value="hotel">Hôtel partout</option>
                      <option value="airbnb">Airbnb partout</option>
                    </select>
                  </label>
                  <label className="text-sm text-gray-700 flex items-center gap-2 mt-2">
                    Marge des dossiers
                    <select
                      value={params.margeSource ?? "simulateur"}
                      onChange={(e) => setP("margeSource", e.target.value)}
                      className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                    >
                      <option value="simulateur">Simulateur (vente posée par nous, règles du 16/11)</option>
                      <option value="excel">Colonne « Marge » du fichier Excel (Praimy)</option>
                    </select>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Simulateur : vente à {eur(simu.prix)} TTC, matériel {eur(simu.materiel)} HT, CEE à {simu.valoBleu} / {simu.valoJaune} / {simu.valoViolet} €/MWh
                    (Bleu / Jaune / Violet), surface du fichier. La pose n'y est pas : c'est le coût Loan des tournées. Réglages dans la page « Marges PRAIMY ».
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">La carte</h2>
              <p className="text-sm text-gray-500 mb-3">Une couleur par semaine. Orange : trop loin pour l'instant. Gris : pas dans le plan. Noir : déjà posé.</p>
              <Carte res={res} params={params} ouverte={null} />
            </div>
          </div>

          {/* Le planning semaine par semaine */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-extrabold text-gray-900">Le planning</h2>
              <label className="text-sm text-gray-600 flex items-center gap-2 ml-auto">
                Départ
                <select
                  value={params.depart}
                  onChange={(e) => {
                    const v = DEPARTS.find((x) => x.nom === e.target.value)!;
                    enregistrer({ params: { ...params, depart: v.nom, departLat: v.lat, departLng: v.lng } });
                  }}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                >
                  {DEPARTS.map((x) => (
                    <option key={x.nom}>{x.nom}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-600 flex items-center gap-2">
                Premier jour
                <input type="date" value={params.debut} onChange={(e) => setP("debut", e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm" />
              </label>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 px-4 py-3 text-sm text-gray-700 flex flex-wrap items-center gap-2">
              <span>📍 On va jusqu'à</span>
              <input type="number" value={params.rayonMax} onChange={(e) => setP("rayonMax", Number(e.target.value) || 0)} className="w-20 border border-gray-300 rounded-md px-2 py-1 text-right" />
              <span>km de {params.depart}. Plus loin, seulement s'il y a au moins</span>
              <input type="number" value={params.groupeMin} onChange={(e) => setP("groupeMin", Number(e.target.value) || 1)} className="w-14 border border-gray-300 rounded-md px-2 py-1 text-right" />
              <span>poses à moins de</span>
              <input type="number" value={params.groupeRayon} onChange={(e) => setP("groupeRayon", Number(e.target.value) || 0)} className="w-16 border border-gray-300 rounded-md px-2 py-1 text-right" />
              <span>km les unes des autres, et au moins</span>
              <input type="number" value={params.groupeMinLoin} onChange={(e) => setP("groupeMinLoin", Number(e.target.value) || 1)} className="w-14 border border-gray-300 rounded-md px-2 py-1 text-right" />
              <span>au-delà de</span>
              <input type="number" value={params.rayonLoin} onChange={(e) => setP("rayonLoin", Number(e.target.value) || 0)} className="w-20 border border-gray-300 rounded-md px-2 py-1 text-right" />
              <span>km.</span>
            </div>
            {res.lignes.some((l) => l.tropLoin) && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                <b>Trop loin pour l'instant ({res.lignes.filter((l) => l.tropLoin).length}) :</b>{" "}
                {res.lignes
                  .filter((l) => l.tropLoin)
                  .sort((a, b) => a.kmDepart - b.kmDepart)
                  .map((l) => `${l.d.client} (${l.d.ville}, ${km(l.kmDepart)})`)
                  .join(" · ")}
                . Ils entreront dans le planning dès qu'il y aura assez de poses dans leur coin.
              </div>
            )}
            {res.nonPlaces.length > 0 && <p className="text-sm text-amber-700">Pas placés (ville introuvable) : {res.nonPlaces.map((l) => `${l.d.client} (${l.d.ville})`).join(", ")}.</p>}
            {res.tournees.map((t) => {
              const c = COULEURS[(t.n - 1) % COULEURS.length];
              const netT = t.marge - t.cout.total;
              const dormir = t.sejours.filter((s) => s.ville !== "Étape sur la route");
              const etape = t.sejours.some((s) => s.ville === "Étape sur la route");
              return (
                <div key={t.n} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-100">
                    <span className="w-3 h-3 rounded-full" style={{ background: c }} />
                    <span className="text-lg font-extrabold text-gray-900">Semaine {t.n}</span>
                    <span className="text-sm text-gray-500">
                      {jourFr(t.debut)} → {jourFr(t.fin)}
                    </span>
                    <span className="ml-auto text-sm text-gray-500">
                      {t.refs.length} pose{t.refs.length > 1 ? "s" : ""} · coût {eur(t.cout.total)} ·{" "}
                      <b className={netT >= 0 ? "text-emerald-700" : "text-red-600"}>reste {eur(netT)}</b>
                    </span>
                  </div>
                  <div className="p-3 sm:p-4 grid gap-2" style={mobile ? undefined : { gridTemplateColumns: `repeat(${Math.min(t.jours.length, 7)}, minmax(0, 1fr))` }}>
                    {t.jours.map((j, i) => {
                      const lig = j.ref ? res.lignes.find((l) => l.d.ref === j.ref) : undefined;
                      const sej = t.sejours.find((s) => j.nuit && s.ville === j.nuit && s.debut <= j.date);
                      const style =
                        j.type === "pose" ? "bg-emerald-50 border-emerald-200" : j.type === "route" ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200";
                      return (
                        <div key={i} className={`rounded-xl border p-3 flex flex-col ${mobile ? "" : "min-h-[132px]"} ${style}`}>
                          <p className="text-xs font-bold text-gray-500 uppercase">{jourFr(j.date)}</p>
                          {j.type === "pose" ? (
                            <>
                              <p className="mt-1.5 text-sm font-extrabold text-gray-900 leading-tight">🔧 {lig?.d.client ?? ""}</p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {lig?.d.ville}
                                {lig && lig.jours > 1 ? ` · ${j.texte.includes("jour 2") ? "2e jour" : "1er jour"}` : ""}
                              </p>
                            </>
                          ) : j.type === "route" ? (
                            <>
                              <p className="mt-1.5 text-sm font-extrabold text-gray-900 leading-tight">🚐 Route</p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {j.texte.replace(/^Route |^Retour /, "")} · {j.heures.toFixed(0)} h
                              </p>
                            </>
                          ) : (
                            <p className="mt-1.5 text-sm font-bold text-gray-500">🛌 Repos</p>
                          )}
                          {j.type === "pose" && j.km > 150 && (
                            <p className="text-[11px] text-amber-700 mt-1">
                              + {Math.round(j.heures)} h de route le soir{j.texte.includes("retour à") ? ` (retour à ${params.depart})` : ""}
                            </p>
                          )}
                          <p className="mt-auto pt-2 text-[11px] text-gray-500">
                            {j.nuit ? (j.nuit === "Étape sur la route" ? "🛏️ Hôtel d'étape" : `${sej?.type === "airbnb" ? "🏠 Airbnb" : "🏨 Hôtel"} · ${j.nuit}`) : "🏡 Maison"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-5 pb-4 text-sm text-gray-600">
                    <b className="text-gray-800">À réserver :</b>{" "}
                    {dormir.length
                      ? dormir.map((s) => `${s.type === "airbnb" ? "Airbnb" : "hôtel"} à ${s.ville} (${s.nuits} nuit${s.nuits > 1 ? "s" : ""})`).join(" · ")
                      : "rien"}
                    {etape ? " · un hôtel d'étape sur l'autoroute" : ""}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Les dossiers */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-xl font-extrabold text-gray-900">Les dossiers</h2>
              <p className="text-sm text-gray-500 mt-0.5">Cochez pour mettre un client dans le plan ou l'en retirer. Cochez « Posé » quand c'est fait.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 bg-gray-50">
                    <th className="py-2.5 px-3 text-center font-semibold">Dans le plan</th>
                    <th className="py-2.5 px-3 text-left font-semibold">Client</th>
                    <th className="py-2.5 px-3 text-left font-semibold">Quand</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Marge</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Coût Loan</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Il reste</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Durée</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Posé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...res.lignes]
                    .sort((a, b) => (a.tournee ?? (a.tropLoin ? 900 : 999)) - (b.tournee ?? (b.tropLoin ? 900 : 999)) || (a.date ?? "").localeCompare(b.date ?? "") || a.d.client.localeCompare(b.d.client))
                    .map((l, i, arr) => (
                      <Fragment key={l.d.ref}>
                      {l.tropLoin && (i === 0 || !arr[i - 1].tropLoin) && (
                        <tr>
                          <td colSpan={8} className="bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 uppercase">
                            Trop loin pour l'instant · plus de {params.rayonMax} km et pas assez de poses dans le coin
                          </td>
                        </tr>
                      )}
                      {!l.tournee && !l.tropLoin && (i === 0 || arr[i - 1].tournee || arr[i - 1].tropLoin) && (
                        <tr>
                          <td colSpan={8} className="bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500 uppercase">Pas dans le plan · cochez la case pour en ajouter</td>
                        </tr>
                      )}
                      <tr className={l.d.inclus && !l.d.fait ? "" : "text-gray-400"}>
                        <td className="py-2 px-3 text-center">
                          <input type="checkbox" className="w-4 h-4" checked={l.d.inclus} onChange={(e) => setD(l.d.ref, { inclus: e.target.checked })} />
                        </td>
                        <td className="py-2 px-3">
                          <span className={`font-semibold ${l.d.inclus && !l.d.fait ? "text-gray-900" : ""}`}>{l.d.client}</span>
                          <span className="block text-xs text-gray-500">
                            {l.d.ville} ({l.d.cp.slice(0, 2)}) · {l.d.statut}
                            {l.margeCalc ? ` · ${l.margeCalc.profil} ${l.margeCalc.zone}` : l.d.categorie ? ` · ${l.d.categorie}` : ""}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {l.tournee ? (
                            <span className="inline-flex items-center gap-1.5 text-gray-800">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COULEURS[(l.tournee - 1) % COULEURS.length] }} />
                              {jourFr(l.date ?? "")}
                            </span>
                          ) : l.tropLoin ? (
                            <span className="text-amber-700">{km(l.kmDepart)} · en attente</span>
                          ) : l.d.fait ? (
                            "Déjà posé"
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            value={l.d.margeModifiee ? l.d.marge ?? "" : l.marge}
                            placeholder="?"
                            onChange={(e) => setD(l.d.ref, { marge: e.target.value === "" ? null : Number(e.target.value), margeModifiee: true })}
                            className={`w-24 text-right border rounded-md px-1.5 py-1 ${l.d.margeModifiee ? "border-amber-400" : "border-gray-200"}`}
                            title={
                              l.d.margeModifiee
                                ? "Marge corrigée à la main"
                                : l.margeCalc
                                  ? `Simulateur : ${l.margeCalc.profil} · ${l.margeCalc.zone} · ${l.margeCalc.surface} m²${l.margeCalc.avant ? " · signé avant le 16/11 (×5)" : ""} (hors pose)`
                                  : "Colonne Marge du fichier"
                            }
                          />
                          {l.d.margeModifiee && (
                            <button onClick={() => setD(l.d.ref, { margeModifiee: false })} className="block ml-auto text-[11px] text-amber-700 hover:underline" title="Revenir à la marge calculée">
                              ↺ calculée
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{l.tournee ? eur(l.cout) : "—"}</td>
                        <td className={`py-2 px-3 text-right whitespace-nowrap font-bold ${!l.tournee ? "" : l.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {l.tournee ? eur(l.net) : "—"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <select value={l.d.jours ?? 0} onChange={(e) => setD(l.d.ref, { jours: Number(e.target.value) || null })} className="text-xs border border-gray-200 rounded-md px-1 py-1 bg-white">
                            <option value={0}>{l.jours} jour{l.jours > 1 ? "s" : ""}</option>
                            <option value={1}>1 jour</option>
                            <option value={2}>2 jours</option>
                            <option value={3}>3 jours</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input type="checkbox" className="w-4 h-4" checked={!!l.d.fait} onChange={(e) => setD(l.d.ref, { fait: e.target.checked })} />
                        </td>
                      </tr>
                      </Fragment>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Réglages et détails, repliés */}
          <details className="bg-white border border-gray-200 rounded-2xl group">
            <summary className="px-5 py-4 cursor-pointer select-none flex items-center gap-2 text-gray-800 font-bold">
              ⚙️ Réglages, prix et détail des calculs
              <span className="text-sm font-normal text-gray-500">(à ouvrir si besoin)</span>
            </summary>
            <div className="px-5 pb-5 space-y-5">
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                {GROUPES.map((g) => (
                  <div key={g.titre} className="bg-gray-50 rounded-xl p-4">
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
                                className="w-20 text-right border border-gray-300 rounded px-1.5 py-1 text-sm text-gray-900 bg-white"
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
              <div className="flex flex-wrap items-start gap-4">
                <p className="flex-1 min-w-[300px] text-xs text-gray-500">
                  Comment c'est calculé : chaque semaine part de {params.depart} le lundi, commence par le coin de France où il y a le plus de clients groupés, puis
                  enchaîne le client le plus proche. Une pose dure 1 jour (2 jours au-delà de {params.seuilKw2Jours} kW). Jusqu'à {params.routeSoirMax} h de route le
                  soir après un chantier ; au-delà, une journée de route (les deux se relaient). Airbnb quand ils restent {params.airbnbDesNuits} nuits ou plus au même
                  endroit, sinon hôtel. Jours fériés exclus. Distances estimées sans GPS (± 10 %).
                </p>
                <button onClick={() => enregistrer({ params: PARAMS_DEFAUT })} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                  <RotateCcw size={13} /> Remettre les réglages par défaut
                </button>
              </div>
            </div>
          </details>
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
          const c = l.tournee ? COULEURS[(l.tournee - 1) % COULEURS.length] : l.tropLoin ? "#f59e0b" : "#9ca3af";
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
