import { useState } from "react";
import { Calculator } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// Barème : plafonds de ressources 2026 (MaPrimeRénov' / CEE) en Île-de-France,
// avec un calculateur : nombre de personnes + revenu fiscal de référence
// (avis d'imposition) → profil bleu / jaune / violet / rose.
// ─────────────────────────────────────────────────────────────────────────
type Prof = { key: "bleu" | "jaune" | "violet" | "rose"; label: string; sub: string; main: string; soft: string; dark: string };

const PROFILS: Prof[] = [
  { key: "bleu", label: "Profil bleu", sub: "très modeste", main: "#3fa5e5", soft: "#e7f3fc", dark: "#1f3d5e" },
  { key: "jaune", label: "Profil jaune", sub: "modeste", main: "#f0bf2e", soft: "#fdf4d8", dark: "#4a4219" },
  { key: "violet", label: "Profil violet", sub: "intermédiaire", main: "#8b7fbd", soft: "#eeebf7", dark: "#38325a" },
  { key: "rose", label: "Profil rose", sub: "aisé", main: "#e8838f", soft: "#fcebee", dark: "#4d2a37" },
];

type Region = "idf" | "hors";
type Data = { max: Record<number, [number, number, number]>; plus: [number, number, number] };

// Plafonds hauts (en €) des profils bleu, jaune, violet pour 1 à 5 personnes, plus le supplément par personne.
const DATA: Record<Region, Data> = {
  idf: {
    max: { 1: [24031, 29253, 40851], 2: [35270, 42933, 60051], 3: [42357, 51564, 71846], 4: [49455, 60208, 84562], 5: [56580, 68877, 96817] },
    plus: [7116, 8663, 12257],
  },
  hors: {
    max: { 1: [17363, 22259, 31185], 2: [25393, 32553, 45842], 3: [30540, 39148, 55196], 4: [35676, 45735, 64550], 5: [40835, 52348, 73907] },
    plus: [5151, 6598, 9357],
  },
};
const REGION_LABEL: Record<Region, string> = { idf: "En Île-de-France", hors: "Hors Île-de-France" };

const ceilings = (region: Region, n: number): [number, number, number] => {
  const { max, plus } = DATA[region];
  if (n <= 5) return max[n];
  const k = n - 5;
  return [max[5][0] + k * plus[0], max[5][1] + k * plus[1], max[5][2] + k * plus[2]];
};

const eur = (v: number) => `${v.toLocaleString("fr-FR")} €`;

function range(region: Region, n: number, p: number) {
  const [b, j, v] = ceilings(region, n);
  if (p === 0) return { top: "de 0 €", bottom: `à ${eur(b)}` };
  if (p === 1) return { top: `de ${eur(b + 1)}`, bottom: `à ${eur(j)}` };
  if (p === 2) return { top: `de ${eur(j + 1)}`, bottom: `à ${eur(v)}` };
  return { top: "au-delà de", bottom: eur(v) };
}

export function profilOf(region: Region, n: number, rfr: number): number {
  const [b, j, v] = ceilings(region, n);
  return rfr <= b ? 0 : rfr <= j ? 1 : rfr <= v ? 2 : 3;
}

function Table({ region, n, hit }: { region: Region; n: number; hit: number }) {
  const rows = [1, 2, 3, 4, 5];
  const plus = DATA[region].plus;
  return (
    <section>
      <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-center">
          <thead>
            <tr>
              <th rowSpan={2} className="bg-[#1f4b7f] text-white text-sm font-bold px-4 py-2 w-44 rounded-tl-2xl">
                Personnes dans le foyer fiscal
              </th>
              <th colSpan={4} className="bg-[#1f4b7f] text-white text-sm font-bold px-4 py-2 rounded-tr-2xl">
                Revenu fiscal de référence (RFR) du foyer
              </th>
            </tr>
            <tr>
              {PROFILS.map((p) => (
                <th key={p.key} className="text-white px-3 py-2" style={{ background: p.main }}>
                  <div className="text-lg font-extrabold leading-tight">{p.label}</div>
                  <div className="text-xs font-medium opacity-95">{p.sub}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <th className={`text-base font-extrabold px-3 py-2.5 border-t border-gray-200 ${r === n ? "bg-[#edf2f8] text-[#1f4b7f]" : "text-[#1e2a44] bg-white"}`}>
                  {r} personne{r > 1 ? "s" : ""}
                </th>
                {PROFILS.map((p, i) => {
                  const g = range(region, r, i);
                  const on = r === n && i === hit;
                  return (
                    <td
                      key={p.key}
                      className={`px-3 py-2.5 border-t border-gray-200 text-sm font-bold text-[#1e2a44] leading-snug ${on ? "" : "crm-soft"}`}
                      style={{ ["--soft-dark" as any]: p.dark, background: on ? p.main : p.soft, color: on ? "#fff" : undefined, boxShadow: on ? "inset 0 0 0 3px rgba(255,255,255,.55)" : undefined }}
                    >
                      <div>{g.top}</div>
                      <div>{g.bottom}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th className="text-sm font-bold text-[#1e2a44] px-3 py-2 border-t border-gray-200 rounded-bl-2xl bg-white">Par personne en plus</th>
              {PROFILS.map((p, i) => (
                <td key={p.key} className={`crm-soft px-3 py-2 border-t border-gray-200 text-sm font-bold text-[#1e2a44] ${i === 3 ? "rounded-br-2xl" : ""}`} style={{ ["--soft-dark" as any]: p.dark, background: p.soft }}>
                  + {eur(plus[Math.min(i, 2)])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function BaremeCRM() {
  const [region, setRegion] = useState<Region>("idf");
  const [n, setN] = useState(2);
  const [rfrText, setRfrText] = useState("");
  const rfr = Number(rfrText.replace(/\s/g, "").replace(",", "."));
  const hasRfr = rfrText.trim() !== "" && !isNaN(rfr);
  const hit = hasRfr ? profilOf(region, n, rfr) : -1;
  const sel = "mt-1 block text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2";

  const champ = "block w-full text-base font-semibold bg-white text-gray-900 border-2 border-[#cddaea] rounded-xl px-3 py-2 outline-none focus:border-[#1f4b7f]";

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      {/* Titre + choix de la zone (un seul tableau à la fois, tout tient à l'écran) */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-2xl font-extrabold text-[#1e2a44] tracking-tight">
          Plafonds de ressources <span className="text-[#2e6db0]">2026</span>
        </h2>
        <div className="inline-flex rounded-2xl bg-[#edf2f8] p-1 shadow-inner" role="tablist">
          {(["idf", "hors"] as Region[]).map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={region === r}
              onClick={() => setRegion(r)}
              className={`rounded-xl px-5 py-2.5 text-sm font-extrabold transition ${region === r ? "text-white shadow-md" : "text-[#1f4b7f] hover:bg-white/70"}`}
              style={region === r ? { background: "var(--brand-grad-120, #1f4b7f)" } : undefined}
            >
              {REGION_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Trouver le profil d'un client */}
      <section className="rounded-2xl border-2 border-[#dde6f1] bg-white shadow-sm px-4 py-3">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-[#1f4b7f]">
              <Calculator size={14} /> Personnes dans le foyer fiscal
            </p>
            <div className="flex gap-1">
              {Array.from({ length: 8 }, (_, i) => i + 1).map((k) => (
                <button
                  key={k}
                  onClick={() => setN(k)}
                  className={`h-10 w-10 rounded-xl text-base font-extrabold transition ${n === k ? "text-white shadow-md" : "bg-[#edf2f8] text-[#1f4b7f] hover:bg-[#dde6f1]"}`}
                  style={n === k ? { background: "var(--brand-grad-120, #1f4b7f)" } : undefined}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <label className="w-56">
            <span className="mb-1 block text-xs font-bold text-[#1f4b7f]">Revenu fiscal de référence (€)</span>
            <input value={rfrText} onChange={(e) => setRfrText(e.target.value)} inputMode="numeric" placeholder="ex. 50000" className={champ} />
          </label>
          {hit >= 0 ? (
            <div className="rounded-xl px-5 py-2 text-white shadow-sm" style={{ background: PROFILS[hit].main }}>
              <div className="text-lg font-extrabold leading-tight">{PROFILS[hit].label}</div>
              <div className="text-xs opacity-90">
                {PROFILS[hit].sub} · {range(region, n, hit).top} {range(region, n, hit).bottom}
              </div>
            </div>
          ) : (
            <p className="pb-2 text-xs text-gray-500">Tapez le revenu (avis d'imposition) : le profil s'affiche ici.</p>
          )}
        </div>
      </section>

      <Table region={region} n={n} hit={hit} />

      <p className="text-xs text-gray-500">
        Au-delà de 5 personnes : ajoutez la dernière ligne au plafond de 5 personnes pour chaque personne en plus (le calcul ci-dessus le fait pour vous, jusqu'à 8).
      </p>
    </div>
  );
}
