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

  const champ = (c: Champ) => (
    <label key={c.k} className="flex items-center justify-between gap-2 text-[13px] text-gray-600">
      <span className="truncate">{c.label}</span>
      <span className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          step={c.step ?? 1}
          value={params[c.k]}
          onChange={(e) => set(c.k, Number(e.target.value) || 0)}
          className="w-[84px] text-right border border-gray-200 rounded-lg px-2 py-1 text-[13px] focus:border-[#1f4b7f] outline-none"
        />
        <span className="w-11 text-[11px] text-gray-400">{c.unite}</span>
      </span>
    </label>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-3 [color-scheme:light] [&_input]:bg-white [&_select]:bg-white [&_input]:text-gray-900 [&_select]:text-gray-900">
      {/* En-tête compact */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Simulateur de marge PAC</h1>
          <p className="text-xs text-gray-500">PAC air/eau vendue et posée par nous · CEE BAR-TH-171 + Coup de pouce + MaPrimeRénov' · règles du 16/11/2026</p>
        </div>
        <label className="text-[13px] text-gray-700 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
          <input type="checkbox" checked={avant} onChange={(e) => setAvant(e.target.checked)} />
          Devis signé avant le 16/11 (Jaune ×5)
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-3 items-start">
        {/* Gauche : tous les réglages, compacts */}
        <aside className="bg-white border border-[#e6eaf2] rounded-2xl p-3.5 space-y-3 shadow-sm">
          {BLOCS.map((b) => (
            <div key={b.titre}>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-[#1f4b7f] mb-1.5">{b.titre}</h3>
              <div className="space-y-1">{b.champs.map(champ)}</div>
              {b.titre === "Le chantier" && <p className="mt-1 text-[10px] text-gray-400">Facteur surface {facteurSurface(params.surface).toLocaleString("fr-FR")} (0,5 &lt; 70 m² · 0,7 &lt; 90 m² · 1 au-delà)</p>}
            </div>
          ))}
          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-[#1f4b7f] mb-1.5">Pompe à chaleur</h3>
            <div className="space-y-1">
              <label className="flex items-center justify-between gap-2 text-[13px] text-gray-600">
                Performance
                <select value={params.etas} onChange={(e) => set("etas", Number(e.target.value))} className="border border-gray-200 rounded-lg px-2 py-1 text-[13px]">
                  <option value={109200}>Etas ≥ 140 %</option>
                  <option value={90900}>Etas &lt; 140 %</option>
                </select>
              </label>
              {champ({ k: "tva", label: "TVA", unite: "%", step: 0.1 })}
            </div>
          </div>
          <button onClick={() => save(SIMU_DEFAUT)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <RotateCcw size={12} /> Valeurs par défaut
          </button>
        </aside>

        {/* Droite : chiffres clés + tableau, sans descendre */}
        <section className="space-y-3 min-w-0">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white border border-[#e6eaf2] px-4 py-3 shadow-sm">
              <p className="text-xs text-gray-500">Marge selon zone et profil</p>
              <p className="text-2xl font-extrabold text-gray-900 leading-tight">
                {eur(Math.min(...marges))} – {eur(Math.max(...marges))}
              </p>
              <p className="text-[11px] text-gray-500">vente à {eur(params.prix)} TTC</p>
            </div>
            <div className="rounded-2xl px-4 py-3 shadow-sm text-white" style={{ background: "linear-gradient(120deg,#047857,#059669)" }}>
              <p className="text-xs text-white/80">Meilleur cas</p>
              <p className="text-2xl font-extrabold leading-tight">{eur(best.r.marge)}</p>
              <p className="text-[11px] text-white/80">
                {best.z} · {best.pr.p} · {pct(best.r.margePct)}
              </p>
            </div>
            <div className="rounded-2xl bg-white border border-[#e6eaf2] px-4 py-3 shadow-sm">
              <p className="text-xs text-gray-500">Surplus de CEE au maximum</p>
              <p className="text-2xl font-extrabold text-[#1f4b7f] leading-tight">{eur(surplusMax)}</p>
              <p className="text-[11px] text-gray-500">prime gardée au-delà de l'annoncée</p>
            </div>
          </div>

          {plafond.length > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800 flex gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                Aides au-dessus du plafond (MPR + CEE affiché &gt; 90 / 75 / 60 % de la dépense plafonnée à 12 000 €) : {plafond.map((l) => `${l.z} ${l.pr.p}`).join(", ")}.
                Augmentez le reste à charge visé.
              </span>
            </div>
          )}

          <div className="bg-white border border-[#e6eaf2] rounded-2xl overflow-x-auto shadow-sm">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-500 bg-[#f7f9fc] text-right [&>th]:py-2 [&>th]:px-2.5">
                  <th className="text-left">Zone</th>
                  <th className="text-left">Profil</th>
                  <th>CEE total</th>
                  <th>CEE affiché</th>
                  <th>Surplus</th>
                  <th>MPR</th>
                  <th>Reste à charge</th>
                  <th>RAC %</th>
                  <th>Encaissé HT</th>
                  <th>Marge</th>
                  <th>Marge %</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr
                    key={`${l.z}${l.pr.p}`}
                    className={`text-right [&>td]:py-1.5 [&>td]:px-2.5 ${i % PROFILS.length === 0 && i > 0 ? "border-t-2 border-gray-200" : "border-t border-gray-100"}`}
                    style={{ background: `color-mix(in srgb, ${l.pr.hex} 9%, white)` }}
                  >
                    <td className="text-left font-extrabold text-gray-900">{i % PROFILS.length === 0 ? l.z : ""}</td>
                    <td className="text-left whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold text-white" style={{ background: l.pr.hex === "#ffffff" ? "#9ca3af" : l.pr.hex }}>
                        {l.pr.p}
                      </span>
                    </td>
                    <td>{eur(l.r.ceeTotal)}</td>
                    <td>{eur(l.r.ceeAffiche)}</td>
                    <td className="text-gray-500">{eur(l.r.surplus)}</td>
                    <td>{eur(l.r.mpr)}</td>
                    <td className={l.r.depassePlafond ? "text-red-600 font-bold" : ""}>{eur(l.r.rac)}</td>
                    <td className="text-gray-500">{pct(l.r.racPct)}</td>
                    <td>{eur(l.r.encaisseHT)}</td>
                    <td>
                      <span className={`inline-block rounded-lg px-2 py-0.5 font-extrabold ${l.r.marge < 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`}>{eur(l.r.marge)}</span>
                    </td>
                    <td className={l.r.marge < 0 ? "text-red-600 font-semibold" : "text-gray-700 font-semibold"}>{pct(l.r.margePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer select-none font-semibold text-[#1f4b7f]">ⓘ Comment c'est calculé</summary>
            <p className="mt-1.5 leading-relaxed">
              MaPrimeRénov' : Bleu 5 000 € · Jaune 4 000 € · Violet 3 000 € · Rose 0 €. Coup de pouce ×5, sauf Jaune ×3 (devis signés depuis le 16/11/2026). Zone : H1 ×1,2 · H2 ×1 ·
              H3 ×0,7. CEE affiché = prime annoncée au client (prix × (1 − reste à charge visé) − MaPrimeRénov', dans la limite de la prime CEE totale). Le surplus est gardé comme
              marge : la prime écrite sur le devis doit être celle que le client reçoit vraiment. Encaissé HT = (CEE total + MPR + reste à charge) / (1 + TVA). Marge = encaissé HT −
              matériel − pose. Valorisations à confirmer avec le délégataire à la signature. Sources : Anah, guide des aides 2026 ; fiche BAR-TH-171 ; arrêté du 5/11/2026.
            </p>
          </details>
        </section>
      </div>
    </div>
  );
}
