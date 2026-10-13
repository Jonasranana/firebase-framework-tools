import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useArtisans, useLeads } from "@/lib/crmStore";
import {
  ARTISAN_STATUSES,
  CRM_ARTISANS_COLLECTION,
  CRM_LEADS_COLLECTION,
  LEAD_STATUSES,
  LEAD_TYPES,
  artisanFromDoc,
  leadFromDoc,
  todayYmd,
  type Artisan,
  type Lead,
} from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// Onglet Stats — tableau de bord du CRM maison (étape 7). Tout est calculé
// dans le navigateur à partir des collections crm_leads et crm_artisans
// (lecture en temps réel, mêmes règles d'accès que les autres onglets).
// Les statuts sont ceux d'AUJOURD'HUI : un lead « RDV pris » compte dans
// « RDV et plus », mais le CRM ne garde pas la date de chaque étape.
// ─────────────────────────────────────────────────────────────────────────

const PERIODS = [
  { key: "7", label: "7 jours", days: 7 },
  { key: "30", label: "30 jours", days: 30 },
  { key: "90", label: "90 jours", days: 90 },
  { key: "all", label: "Tout", days: 0 },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const DAY = 86400000;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "—");

// Rang d'avancement d'un lead (d'après son statut actuel).
const RANK: Record<string, number> = {
  nouveau: 0,
  a_rappeler: 1,
  injoignable: 1,
  perdu: 1,
  interesse: 2,
  rdv: 3,
  dossier: 4,
  gagne: 5,
};

const Tile = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
    <p className="text-xs font-semibold text-gray-500">{label}</p>
    <p className="text-2xl font-extrabold text-gray-900 mt-1">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
    <h3 className="text-sm font-bold text-gray-800 mb-3">{title}</h3>
    {children}
  </section>
);

// Barres horizontales : libellé, barre proportionnelle, valeur.
const BarList = ({
  rows,
  empty = "Aucune donnée sur la période.",
}: {
  rows: { label: string; value: number; color?: string }[];
  empty?: string;
}) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.every((r) => r.value === 0)) return <p className="text-xs text-gray-400">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 truncate text-gray-600" title={r.label}>
            {r.label}
          </span>
          <span className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
            <span
              className={`block h-full rounded-full ${r.color ?? "bg-[#2b5a8f]"}`}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className="w-9 text-right font-bold text-gray-800">{r.value}</span>
        </li>
      ))}
    </ul>
  );
};

// Histogramme des leads reçus : par jour (≤ 30 j) ou par semaine.
const Timeline = ({ buckets }: { buckets: { label: string; value: number }[] }) => {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return (
    <div>
      <div className="flex items-end gap-[3px] h-32">
        {buckets.map((b) => (
          <div key={b.label} className="flex-1 flex flex-col justify-end h-full" title={`${b.label} : ${b.value}`}>
            <div
              className="w-full bg-[#2b5a8f] rounded-t"
              style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  );
};

const fmtDay = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

export default function StatsCRM() {
  const { data: leads, error: leadsError } = useLeads();
  const { data: artisans, error: artisansError } = useArtisans();
  const error = leadsError || artisansError;
  const [period, setPeriod] = useState<PeriodKey>("30");
  const [type, setType] = useState("");

  const days = PERIODS.find((p) => p.key === period)!.days;

  const inPeriod = useMemo(() => {
    const since = days ? Date.now() - days * DAY : 0;
    return (leads ?? []).filter(
      (l) => (!type || l.type === type) && (!since || (l.createdAt && Date.parse(l.createdAt) >= since)),
    );
  }, [leads, days, type]);

  const funnel = useMemo(() => {
    const count = (min: number) => inPeriod.filter((l) => (RANK[l.status] ?? 0) >= min).length;
    return {
      recus: inPeriod.length,
      traites: inPeriod.filter((l) => l.status !== "nouveau").length,
      interesses: count(2),
      rdv: count(3),
      gagnes: count(5),
      perdus: inPeriod.filter((l) => l.status === "perdu").length,
    };
  }, [inPeriod]);

  const timeline = useMemo(() => {
    const parDay = days > 0 && days <= 30;
    const buckets: { label: string; value: number; start: number; end: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parDay) {
      for (let i = days - 1; i >= 0; i--) {
        const s = today.getTime() - i * DAY;
        buckets.push({ label: fmtDay(new Date(s)), value: 0, start: s, end: s + DAY });
      }
    } else {
      const weeks = days === 90 ? 13 : 26;
      const mon = new Date(today);
      mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); // lundi de la semaine en cours
      for (let i = weeks - 1; i >= 0; i--) {
        const s = mon.getTime() - i * 7 * DAY;
        buckets.push({ label: `sem. ${fmtDay(new Date(s))}`, value: 0, start: s, end: s + 7 * DAY });
      }
    }
    for (const l of inPeriod) {
      const t = Date.parse(l.createdAt);
      const b = buckets.find((x) => t >= x.start && t < x.end);
      if (b) b.value++;
    }
    return buckets;
  }, [inPeriod, days]);

  const bySource = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of inPeriod) c[l.source || "(inconnue)"] = (c[l.source || "(inconnue)"] ?? 0) + 1;
    return Object.entries(c)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));
  }, [inPeriod]);

  const retards = useMemo(
    () => (leads ?? []).filter((l) => l.rappelLe && l.rappelLe <= todayYmd() && !["gagne", "perdu"].includes(l.status)).length,
    [leads],
  );

  const artisanStats = useMemo(() => {
    const list = artisans ?? [];
    const since = days ? Date.now() - days * DAY : 0;
    const byStatus = ARTISAN_STATUSES.map((s) => ({
      label: s.label,
      value: list.filter((a) => a.status === s.key).length,
    }));
    const grilles = list.filter((a) => {
      const t = Date.parse(a.grille?.submittedAt ?? "");
      return !isNaN(t) && (!since || t >= since);
    }).length;
    return { byStatus, grilles, total: list.length, signes: list.filter((a) => a.status === "signe").length };
  }, [artisans, days]);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!leads || !artisans) {
    return (
      <div className="py-10 text-center text-gray-400">
        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full bg-gray-100 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                period === p.key ? "bg-white text-[#2b5a8f] shadow-sm" : "text-gray-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="text-xs font-semibold bg-white border border-gray-200 rounded-full px-3 py-1.5"
        >
          <option value="">Tous types</option>
          {LEAD_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Leads reçus" value={funnel.recus} />
        <Tile label="Traités" value={pct(funnel.traites, funnel.recus)} sub={`${funnel.traites} sur ${funnel.recus}`} />
        <Tile label="RDV et plus" value={pct(funnel.rdv, funnel.recus)} sub={`${funnel.rdv} lead${funnel.rdv > 1 ? "s" : ""}`} />
        <Tile label="Gagnés" value={funnel.gagnes} sub={`${pct(funnel.gagnes, funnel.recus)} des leads reçus`} />
      </div>

      <Card title={days > 0 && days <= 30 ? "Leads reçus par jour" : "Leads reçus par semaine"}>
        <Timeline buckets={timeline} />
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Parcours des leads (statut actuel)">
          <BarList
            rows={[
              { label: "Reçus", value: funnel.recus },
              { label: "Traités", value: funnel.traites },
              { label: "Intéressés et plus", value: funnel.interesses },
              { label: "RDV et plus", value: funnel.rdv },
              { label: "Gagnés", value: funnel.gagnes, color: "bg-green-500" },
              { label: "Perdus", value: funnel.perdus, color: "bg-gray-400" },
            ]}
          />
        </Card>
        <Card title="Répartition par statut">
          <BarList
            rows={LEAD_STATUSES.map((s) => ({
              label: s.label,
              value: inPeriod.filter((l) => l.status === s.key).length,
              color: s.dot,
            }))}
          />
        </Card>
        <Card title="Leads par source">
          <BarList rows={bySource} />
        </Card>
        <Card title="Leads par type">
          <BarList rows={LEAD_TYPES.map((t) => ({ label: t, value: inPeriod.filter((l) => l.type === t).length }))} />
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile
          label="Rappels en retard"
          value={retards}
          sub={retards ? "Voir l'onglet Leads › Rappels" : "Rien à rattraper"}
        />
        <Tile label="Artisans au total" value={artisanStats.total} />
        <Tile label="Grilles reçues" value={artisanStats.grilles} sub={days ? `sur ${days} jours` : "au total"} />
        <Tile label="Artisans signés" value={artisanStats.signes} />
      </div>

      <Card title="Artisans par étape">
        <BarList rows={artisanStats.byStatus} empty="Aucun artisan dans le CRM." />
      </Card>

      <p className="text-xs text-gray-400">
        Les fiches importées de Monday sont datées de leur 1er contact. Les étapes sont celles d'aujourd'hui :
        le CRM ne conserve pas la date de chaque changement de statut.
      </p>
    </div>
  );
}
