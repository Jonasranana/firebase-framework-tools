import { useMemo, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { PROFILS, SIMU_DEFAUT, ZONES, calculMarge, facteurSurface, useSimuParams, type SimuParams } from "@/lib/margeSimu";

// ─────────────────────────────────────────────────────────────────────────
// Page « Marges PRAIMY » : simulateur de marge d'une pompe à chaleur vendue et
// posée par nous, règles du 16 novembre 2026 (Coup de pouce ×3 pour les Jaunes).
// Les réglages (prix, valorisations CEE, matériel, pose, restes à charge visés)
// sont partagés par toute l'équipe et servent aussi à « Tournées Loan ».
// ─────────────────────────────────────────────────────────────────────────
const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const pct = (n: number) => `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

type Champ = { k: keyof SimuParams; label: string; unite: string; step?: number };
const BLOCS: { titre: string; champs: Champ[] }[] = [
  {
    titre: "Le chantier",
    champs: [
      { k: "prix", label: "Prix de vente", unite: "€ TTC", step: 100 },
      { k: "surface", label: "Surface chauffée", unite: "m²" },
      { k: "materiel", label: "Matériel", unite: "€ HT", step: 50 },
      { k: "pose", label: "Pose", unite: "€ HT", step: 50 },
    ],
  },
  {
    titre: "Valorisation des CEE",
    champs: [
      { k: "valoBleu", label: "Bleu (grand précaire)", unite: "€/MWh", step: 0.1 },
      { k: "valoJaune", label: "Jaune (précaire)", unite: "€/MWh", step: 0.1 },
      { k: "valoViolet", label: "Violet (classique)", unite: "€/MWh", step: 0.1 },
      { k: "valoRose", label: "Rose (classique)", unite: "€/MWh", step: 0.1 },
    ],
  },
  {
    titre: "Reste à charge visé",
    champs: [
      { k: "racBleu", label: "Bleu", unite: "%" },
      { k: "racJaune", label: "Jaune", unite: "%" },
      { k: "racViolet", label: "Violet", unite: "%" },
      { k: "racRose", label: "Rose", unite: "%" },
    ],
  },
];

export default function SimulateurMarge({ email }: { email: string }) {
  const { params, save, loaded, error } = useSimuParams(email);
  const [avant, setAvant] = useState(false);
  const set = (k: keyof SimuParams, v: number) => save({ ...params, [k]: v });

  const lignes = useMemo(
    () => ZONES.flatMap(({ z }) => PROFILS.map((pr) => ({ z, pr, r: calculMarge(params, z, pr.p, { avantNouvelleRegle: avant }) }))),
    [params, avant],
  );
  const marges = lignes.map((l) => l.r.marge);
  const best = lignes.reduce((a, b) => (b.r.marge > a.r.marge ? b : a), lignes[0]);
  const surplusMax = Math.max(...lignes.map((l) => l.r.surplus));
  const plafond = lignes.filter((l) => l.r.depassePlafond);

  if (!loaded) return <p className="text-sm text-gray-500 py-10 text-center">Chargement…</p>;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 [color-scheme:light] [&_input]:bg-white [&_select]:bg-white [&_input]:text-gray-900 [&_select]:text-gray-900">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[280px]">
          <h1 className="text-2xl font-bold text-gray-900">Simulateur de marge PAC</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pompe à chaleur air/eau vendue et posée par nous · CEE BAR-TH-171 + Coup de pouce + MaPrimeRénov' · règles du 16 novembre 2026.
          </p>
        </div>
        <label className="text-sm text-gray-700 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <input type="checkbox" checked={avant} onChange={(e) => setAvant(e.target.checked)} />
          Devis signé avant le 16 novembre (Jaune ×5)
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Chiffres clés */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Marge selon la zone et le profil</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">
            {eur(Math.min(...marges))} – {eur(Math.max(...marges))}
          </p>
          <p className="text-sm text-gray-500 mt-1">pour une vente à {eur(params.prix)} TTC</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5">
          <p className="text-sm text-gray-600">Meilleur cas</p>
          <p className="text-3xl font-extrabold text-emerald-700 mt-1">{eur(best.r.marge)}</p>
          <p className="text-sm text-gray-600 mt-1">
            {best.z} · {best.pr.p} · {pct(best.r.margePct)} de marge
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Surplus de CEE au maximum</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">{eur(surplusMax)}</p>
          <p className="text-sm text-gray-500 mt-1">prime touchée au-delà de celle annoncée au client</p>
        </div>
      </div>

      {/* Réglages */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {BLOCS.map((b) => (
          <div key={b.titre} className="bg-white border border-gray-200 rounded-2xl p-4">
            <h3 className="text-sm font-extrabold text-gray-800 mb-3">{b.titre}</h3>
            <div className="space-y-2">
              {b.champs.map((c) => (
                <label key={c.k} className="flex items-center justify-between gap-2 text-sm text-gray-600">
                  <span>{c.label}</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      step={c.step ?? 1}
                      value={params[c.k]}
                      onChange={(e) => set(c.k, Number(e.target.value) || 0)}
                      className="w-24 text-right border border-gray-300 rounded-md px-2 py-1 text-sm"
                    />
                    <span className="w-14 text-xs text-gray-400">{c.unite}</span>
                  </span>
                </label>
              ))}
              {b.titre === "Le chantier" && <p className="text-[11px] text-gray-400">Facteur surface : {facteurSurface(params.surface).toLocaleString("fr-FR")} (0,5 sous 70 m² · 0,7 sous 90 m² · 1 au-delà)</p>}
            </div>
          </div>
        ))}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-extrabold text-gray-800">Pompe à chaleur</h3>
          <label className="flex items-center justify-between gap-2 text-sm text-gray-600">
            Performance
            <select value={params.etas} onChange={(e) => set("etas", Number(e.target.value))} className="border border-gray-300 rounded-md px-2 py-1 text-sm">
              <option value={109200}>Etas ≥ 140 %</option>
              <option value={90900}>Etas &lt; 140 %</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-gray-600">
            TVA
            <span className="flex items-center gap-1">
              <input type="number" step={0.1} value={params.tva} onChange={(e) => set("tva", Number(e.target.value) || 0)} className="w-20 text-right border border-gray-300 rounded-md px-2 py-1 text-sm" />
              <span className="text-xs text-gray-400">%</span>
            </span>
          </label>
          <p className="text-xs text-gray-500">
            MaPrimeRénov' : Bleu 5 000 € · Jaune 4 000 € · Violet 3 000 € · Rose 0 €. Coup de pouce ×5, sauf Jaune ×3 (devis signés depuis le 16/11/2026). Zone :
            H1 ×1,2 · H2 ×1 · H3 ×0,7.
          </p>
          <button onClick={() => save(SIMU_DEFAUT)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <RotateCcw size={13} /> Valeurs par défaut
          </button>
        </div>
      </div>

      {plafond.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 flex gap-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>
            Aides annoncées au-dessus du plafond (MPR + CEE affiché &gt; 90 % / 75 % / 60 % de la dépense, plafonnée à 12 000 €) :{" "}
            {plafond.map((l) => `${l.z} ${l.pr.p}`).join(", ")}. L'Anah réduirait MaPrimeRénov' : augmentez le reste à charge visé.
          </span>
        </div>
      )}

      {/* Tableau zone × profil */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 bg-gray-50 text-right">
              <th className="py-2.5 px-3 text-left">Zone</th>
              <th className="py-2.5 px-3 text-left">Profil</th>
              <th className="py-2.5 px-3">CEE total</th>
              <th className="py-2.5 px-3">CEE affiché</th>
              <th className="py-2.5 px-3">Surplus CEE</th>
              <th className="py-2.5 px-3">MaPrimeRénov'</th>
              <th className="py-2.5 px-3">Reste à charge</th>
              <th className="py-2.5 px-3">RAC %</th>
              <th className="py-2.5 px-3">Encaissé HT</th>
              <th className="py-2.5 px-3">Marge</th>
              <th className="py-2.5 px-3">Marge %</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={`${l.z}${l.pr.p}`} className={`text-right ${i % PROFILS.length === 0 && i > 0 ? "border-t-2 border-gray-200" : "border-t border-gray-100"}`}>
                <td className="py-2 px-3 text-left font-extrabold text-gray-900">{i % PROFILS.length === 0 ? l.z : ""}</td>
                <td className="py-2 px-3 text-left whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.pr.hex }} />
                    {l.pr.p}
                  </span>
                </td>
                <td className="py-2 px-3">{eur(l.r.ceeTotal)}</td>
                <td className="py-2 px-3">{eur(l.r.ceeAffiche)}</td>
                <td className="py-2 px-3 text-gray-500">{eur(l.r.surplus)}</td>
                <td className="py-2 px-3">{eur(l.r.mpr)}</td>
                <td className={`py-2 px-3 ${l.r.depassePlafond ? "text-red-600 font-bold" : ""}`}>{eur(l.r.rac)}</td>
                <td className="py-2 px-3 text-gray-500">{pct(l.r.racPct)}</td>
                <td className="py-2 px-3">{eur(l.r.encaisseHT)}</td>
                <td className={`py-2 px-3 font-extrabold ${l.r.marge < 0 ? "text-red-600" : "text-emerald-700"}`}>{eur(l.r.marge)}</td>
                <td className={`py-2 px-3 ${l.r.marge < 0 ? "text-red-600" : "text-gray-700"}`}>{pct(l.r.margePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        CEE affiché = prime annoncée au client (prix × (1 − reste à charge visé) − MaPrimeRénov', dans la limite de la prime CEE totale). Le surplus est gardé
        comme marge : la prime écrite sur le devis doit être celle que le client reçoit vraiment. Encaissé HT = (CEE total + MPR + reste à charge) / (1 + TVA).
        Marge = encaissé HT − matériel − pose. Valorisations à confirmer avec le délégataire à la signature. Sources : Anah, guide des aides 2026 ; fiche
        BAR-TH-171 ; arrêté du 5/11/2026 (Coup de pouce ×3 pour les ménages en précarité non très modestes).
      </p>
    </div>
  );
}
