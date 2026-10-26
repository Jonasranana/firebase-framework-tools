import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BellRing, Loader2, Minus } from "lucide-react";
import { useArtisans, useLeads } from "@/lib/crmStore";
import {
  ARTISAN_STATUSES,
  LEAD_STATUSES,
  LEAD_TYPES,
  LOST_STATUSES,
  STATUS_RANK,
  TOTALS_VIEWERS,
  isClosedStatus,
  todayYmd,
  type Lead,
} from "@/lib/crm";
import { ATTRIBUE, ATTRIBUE_KEY } from "@/lib/crmColumns";
import { RAPPEL_HEURE_KEY, rappelEnRetard, rappelShort } from "@/lib/rappel";
import { trancheInfo } from "@/lib/tranche";

// ─────────────────────────────────────────────────────────────────────────
// Onglet Statistiques du CRM : tout est calculé dans le navigateur à partir des
// fiches Pac Pac (crm_leads) et des artisans. Les statuts sont ceux d'AUJOURD'HUI :
// le CRM ne garde pas la date de chaque changement de statut.
// Chaque chiffre est comparé à la période précédente de même durée.
// ─────────────────────────────────────────────────────────────────────────

const PERIODS = [
  { key: "1", label: "Aujourd'hui", days: 1 },
  { key: "7", label: "7 jours", days: 7 },
  { key: "30", label: "30 jours", days: 30 },
  { key: "90", label: "90 jours", days: 90 },
  { key: "all", label: "Tout", days: 0 },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const DAY = 86400000;
const ORANGE = "#ff7a1a";
const GRAD = "linear-gradient(90deg,#ff8a00,#ff4d4d 55%,#e0218a)";
const GRAD_V = "linear-gradient(180deg,#ff8a00,#e0218a)";

const rank = (l: Lead) => STATUS_RANK[l.status] ?? 0;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "—");
const pctNum = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const euro = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtDay = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
const nameOf = (by: string) => {
  const local = String(by ?? "").split("@")[0].split(/[._-]/)[0];
  return local ? local[0].toUpperCase() + local.slice(1) : "Inconnu";
};
const parisHour = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Paris" }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return isNaN(h) ? 0 : h % 24;
};
const median = (v: number[]) => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmtDuration = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} j`);
const createdMs = (l: Lead) => (l.createdAt ? Date.parse(l.createdAt) : NaN);
const firstCallMs = (l: Lead) => {
  const t = (l.calls ?? []).map((c) => Date.parse(c.at)).filter((x) => !isNaN(x));
  return t.length ? Math.min(...t) : NaN;
};

// ── Petits composants ────────────────────────────────────────────────────

const Trend = ({ cur, prev, invert = false }: { cur: number; prev: number | null; invert?: boolean }) => {
  if (prev === null) return null;
  if (prev === 0 && cur === 0) return <span className="text-[11px] text-gray-400 inline-flex items-center gap-0.5"><Minus size={11} /> stable</span>;
  if (prev === 0) return <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-0.5"><ArrowUpRight size={12} /> nouveau</span>;
  const d = Math.round(((cur - prev) / prev) * 100);
  if (d === 0) return <span className="text-[11px] text-gray-400 inline-flex items-center gap-0.5"><Minus size={11} /> stable</span>;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${good ? "text-emerald-600" : "text-rose-600"}`}>
      {d > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {d > 0 ? "+" : ""}
      {d} % <span className="font-normal text-gray-400">vs avant</span>
    </span>
  );
};

const Tile = ({
  label,
  value,
  sub,
  trend,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: React.ReactNode;
  accent?: string;
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 relative overflow-hidden">
    <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r" style={{ background: accent ?? GRAD_V }} />
    <p className="text-xs font-semibold text-gray-500 pl-1">{label}</p>
    <p className="text-[26px] leading-8 font-extrabold text-gray-900 mt-1 pl-1">{value}</p>
    <div className="pl-1 mt-0.5 min-h-[16px] flex flex-wrap items-center gap-x-2">
      {trend}
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  </div>
);

const Card = ({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) => (
  <section className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 ${className}`}>
    <div className="flex items-baseline justify-between gap-2 mb-3">
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      {hint && <span className="text-[11px] text-gray-400 text-right">{hint}</span>}
    </div>
    {children}
  </section>
);

const Empty = ({ text = "Aucune donnée sur la période." }: { text?: string }) => <p className="text-xs text-gray-400">{text}</p>;

// Barres horizontales : libellé, barre proportionnelle, valeur (et part en %).
const BarList = ({
  rows,
  total,
  empty,
}: {
  rows: { label: string; value: number; hex?: string; dot?: string }[];
  total?: number;
  empty?: string;
}) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length || rows.every((r) => r.value === 0)) return <Empty text={empty} />;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-xs">
          <span className="w-36 shrink-0 truncate text-gray-600 flex items-center gap-1.5" title={r.label}>
            {r.dot && <span className="inline-block w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ background: r.dot }} />}
            {r.label}
          </span>
          <span className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
            <span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.hex ?? GRAD }} />
          </span>
          <span className="w-8 text-right font-bold text-gray-800">{r.value}</span>
          {total !== undefined && <span className="w-9 text-right text-gray-400">{pct(r.value, total)}</span>}
        </li>
      ))}
    </ul>
  );
};

// Histogramme (jours, semaines, heures…) avec ligne de moyenne et infobulle.
const Columns = ({
  buckets,
  avg,
  height = 130,
  labelEvery = 1,
}: {
  buckets: { label: string; value: number }[];
  avg?: number;
  height?: number;
  labelEvery?: number;
}) => {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return (
    <div>
      <div className="relative flex items-end gap-[3px]" style={{ height }}>
        {avg !== undefined && avg > 0 && (
          <div className="absolute left-0 right-0 border-t border-dashed border-gray-400/70 pointer-events-none" style={{ bottom: `${(avg / max) * 100}%` }}>
            <span className="absolute right-0 -top-4 text-[10px] text-gray-500 bg-white/80 px-1 rounded">moyenne {avg.toFixed(1).replace(".", ",")}</span>
          </div>
        )}
        {buckets.map((b) => (
          <div key={b.label} className="flex-1 flex flex-col justify-end h-full group relative" title={`${b.label} : ${b.value}`}>
            {b.value > 0 && buckets.length <= 31 && <span className="text-[9px] text-gray-500 text-center leading-3 mb-0.5">{b.value}</span>}
            <div className="w-full rounded-t" style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value ? 3 : 0, background: GRAD_V, opacity: b.value ? 1 : 0.15 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1">
        {buckets.map((b, i) => (
          <span key={b.label} className="flex-1 text-[9px] text-gray-400 text-center overflow-visible whitespace-nowrap">
            {i % labelEvery === 0 ? b.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
};

// Entonnoir : chaque étape avec sa part du total et son taux de passage depuis l'étape d'avant.
const Funnel = ({ steps }: { steps: { label: string; value: number; color?: string }[] }) => {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ul className="space-y-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between text-xs mb-0.5">
              <span className="font-semibold text-gray-700">{s.label}</span>
              <span className="text-gray-500">
                <b className="text-gray-900 text-sm">{s.value}</b> · {pct(s.value, top)} des reçus
                {prev !== null && prev > 0 && <span className="text-gray-400"> · {pct(s.value, prev)} de l'étape d'avant</span>}
              </span>
            </div>
            <div className="h-5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.max(s.value ? 2 : 0, (s.value / top) * 100)}%`, background: s.color ?? GRAD }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const Th = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th className={`py-1.5 px-1 text-[11px] font-semibold text-gray-500 ${right ? "text-right" : "text-left"}`}>{children}</th>
);
const Td = ({ children, right, bold }: { children?: React.ReactNode; right?: boolean; bold?: boolean }) => (
  <td className={`py-1.5 px-1 ${right ? "text-right" : ""} ${bold ? "font-bold text-gray-900" : "text-gray-700"}`}>{children}</td>
);

// Taux affiché avec une petite pastille de niveau (vert / orange / rouge selon les seuils).
const Rate = ({ n, d, good, ok }: { n: number; d: number; good: number; ok: number }) => {
  if (!d) return <span className="text-gray-300">—</span>;
  const v = (n / d) * 100;
  const c = v >= good ? "#16a34a" : v >= ok ? "#f59e0b" : "#ef4444";
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: c }} />
      {Math.round(v)} %
    </span>
  );
};

const isFb = (l: Lead) => /facebook|meta|\bfb\b|insta/i.test(l.source);

type FunnelData = { recus: number; appeles: number; traites: number; interesses: number; rdv: number; gagnes: number; perdus: number; nrp: number };
const computeFunnel = (list: Lead[]): FunnelData => ({
  recus: list.length,
  appeles: list.filter((l) => (l.calls?.length ?? 0) > 0 || rank(l) >= 1).length,
  traites: list.filter((l) => rank(l) >= 1).length,
  interesses: list.filter((l) => rank(l) >= 2).length,
  rdv: list.filter((l) => rank(l) >= 3).length,
  gagnes: list.filter((l) => rank(l) >= 5).length,
  perdus: list.filter((l) => LOST_STATUSES.includes(l.status)).length,
  nrp: list.filter((l) => l.status === "nrp" || l.status === "nrp2").length,
});

export default function StatsCRM({ email = "" }: { email?: string }) {
  const { data: allLeads, error: leadsError } = useLeads();
  // Les statistiques portent sur les leads Pac Pac (pas sur les autres tableaux ni les visiteurs sans coordonnées).
  const leads = useMemo(() => (allLeads ? allLeads.filter((l) => (l.board || "leads") === "leads") : allLeads), [allLeads]);
  const { data: artisans, error: artisansError } = useArtisans();
  const error = leadsError || artisansError;
  const [period, setPeriod] = useState<PeriodKey>("30");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [who, setWho] = useState("");
  const canSeeMoney = TOTALS_VIEWERS.includes(email.toLowerCase());

  const days = PERIODS.find((p) => p.key === period)!.days;

  // Début de la journée (heure locale) pour « Aujourd'hui », sinon fenêtre glissante.
  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const since = days === 1 ? startOfToday : days ? Date.now() - days * DAY : 0;
  const prevSince = days === 1 ? startOfToday - DAY : days ? since - days * DAY : 0;

  const baseFilter = (l: Lead) =>
    (!type || l.type === type) && (!source || (l.source || "(inconnue)") === source) && (!who || (l.fields[ATTRIBUE_KEY] || "") === who);

  const sources = useMemo(() => {
    const c = new Map<string, number>();
    for (const l of leads ?? []) c.set(l.source || "(inconnue)", (c.get(l.source || "(inconnue)") ?? 0) + 1);
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [leads]);

  const inPeriod = useMemo(
    () => (leads ?? []).filter((l) => baseFilter(l) && (!since || createdMs(l) >= since)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, since, type, source, who],
  );
  const prevPeriod = useMemo(
    () => (days ? (leads ?? []).filter((l) => baseFilter(l) && createdMs(l) >= prevSince && createdMs(l) < since) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, since, prevSince, type, source, who, days],
  );

  const f = useMemo(() => computeFunnel(inPeriod), [inPeriod]);
  const pf = useMemo(() => (prevPeriod ? computeFunnel(prevPeriod) : null), [prevPeriod]);

  // Délai avant le 1er appel (leads reçus sur la période et déjà appelés) + leads jamais appelés.
  const delay = useMemo(() => {
    const hours: number[] = [];
    for (const l of inPeriod) {
      const c = firstCallMs(l);
      const r = createdMs(l);
      if (!isNaN(c) && !isNaN(r) && c >= r) hours.push((c - r) / 3600000);
    }
    const never = inPeriod.filter((l) => rank(l) === 0 && !(l.calls?.length));
    const waiting = never.filter((l) => Date.now() - createdMs(l) > 2 * DAY).length;
    return {
      n: hours.length,
      med: median(hours),
      within1h: hours.filter((h) => h <= 1).length,
      within24h: hours.filter((h) => h <= 24).length,
      never: never.length,
      waiting,
    };
  }, [inPeriod]);

  const timeline = useMemo(() => {
    const parDay = days > 0 && days <= 31;
    const buckets: { label: string; value: number; start: number; end: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (days === 1) {
      for (let h = 0; h < 24; h++) {
        const s = startOfToday + h * 3600000;
        buckets.push({ label: `${h}h`, value: 0, start: s, end: s + 3600000 });
      }
    } else if (parDay) {
      for (let i = days - 1; i >= 0; i--) {
        const s = today.getTime() - i * DAY;
        buckets.push({ label: fmtDay(new Date(s)), value: 0, start: s, end: s + DAY });
      }
    } else {
      const weeks = days === 90 ? 13 : 30;
      const mon = new Date(today);
      mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); // lundi de la semaine en cours
      for (let i = weeks - 1; i >= 0; i--) {
        const s = mon.getTime() - i * 7 * DAY;
        buckets.push({ label: fmtDay(new Date(s)), value: 0, start: s, end: s + 7 * DAY });
      }
    }
    for (const l of inPeriod) {
      const t = createdMs(l);
      const b = buckets.find((x) => t >= x.start && t < x.end);
      if (b) b.value++;
    }
    const total = buckets.reduce((s, b) => s + b.value, 0);
    const best = buckets.reduce((m, b) => (b.value > m.value ? b : m), buckets[0]);
    return { buckets, avg: total / Math.max(1, buckets.length), best, perWeek: parDay || days === 1 };
  }, [inPeriod, days, startOfToday]);

  // Arrivées par heure de la journée et par jour de la semaine (heure de Paris).
  const rhythm = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ label: `${h}h`, value: 0 }));
    const dows = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => ({ label, value: 0 }));
    for (const l of inPeriod) {
      if (!l.createdAt) continue;
      hours[parisHour(l.createdAt)].value++;
      dows[(new Date(l.createdAt).getDay() + 6) % 7].value++;
    }
    return { hours, dows };
  }, [inPeriod]);

  // Sources : volume et résultats.
  const bySource = useMemo(() => {
    const m = new Map<string, Lead[]>();
    for (const l of inPeriod) {
      const k = l.source || "(inconnue)";
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return Array.from(m.entries())
      .map(([label, list]) => ({ label, n: list.length, ...computeFunnel(list) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
  }, [inPeriod]);

  // Qualité des leads : tranche, chauffage, foyer, départements.
  const profile = useMemo(() => {
    const tr = new Map<string, { n: number; color: string }>();
    const ch = new Map<string, number>();
    const fo = new Map<string, number>();
    const dep = new Map<string, number>();
    for (const l of inPeriod) {
      const t = trancheInfo(l.fields.tranche ?? "");
      if (t) tr.set(t.name, { n: (tr.get(t.name)?.n ?? 0) + 1, color: t.color });
      const c = (l.fields.chauffageSite ?? "").trim();
      if (c) ch.set(c, (ch.get(c) ?? 0) + 1);
      const h = (l.fields.foyerSite ?? "").trim();
      if (h) fo.set(h, (fo.get(h) ?? 0) + 1);
      const d = (l.postalCode ?? "").trim().slice(0, 2);
      if (d) dep.set(d, (dep.get(d) ?? 0) + 1);
    }
    const order = ["Bleu", "Jaune", "Violet", "Rose"];
    const sorted = (m: Map<string, number>, n = 8) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
    return {
      tranche: order.filter((o) => tr.has(o)).map((o) => ({ label: o, value: tr.get(o)!.n, hex: tr.get(o)!.color, dot: tr.get(o)!.color })),
      chauffage: sorted(ch),
      foyer: sorted(fo, 6).map((r) => ({ ...r, label: `${r.label} pers.` })),
      dep: sorted(dep, 10).map((r) => ({ ...r, label: `Dép. ${r.label}` })),
      renseignes: inPeriod.filter((l) => trancheInfo(l.fields.tranche ?? "")).length,
    };
  }, [inPeriod]);

  // Appels passés sur la période (qui a appelé, combien de fiches différentes).
  const calls = useMemo(() => {
    const per = new Map<string, { n: number; leads: Set<string>; last: number }>();
    const parJour = new Map<string, number>();
    let total = 0;
    for (const l of leads ?? []) {
      if (type && l.type !== type) continue;
      for (const c of l.calls ?? []) {
        const t = Date.parse(c.at);
        if (isNaN(t) || (since && t < since)) continue;
        total++;
        const k = c.name || nameOf(c.by);
        const r = per.get(k) ?? { n: 0, leads: new Set<string>(), last: 0 };
        r.n++;
        r.leads.add(l.id);
        r.last = Math.max(r.last, t);
        per.set(k, r);
        const dk = fmtDay(new Date(t));
        parJour.set(dk, (parJour.get(dk) ?? 0) + 1);
      }
    }
    const rows = Array.from(per.entries()).sort((a, b) => b[1].n - a[1].n);
    return { total, rows, jours: parJour.size };
  }, [leads, since, type]);

  // Portefeuilles : leads attribués à chaque personne (toutes périodes confondues).
  const portfolios = useMemo(
    () =>
      ATTRIBUE.filter((o) => !o.off).map((o) => {
        const list = (leads ?? []).filter((l) => l.fields[ATTRIBUE_KEY] === o.key && (!type || l.type === type));
        return { name: o.label, hex: o.hex, ...computeFunnel(list), jamais: list.filter((l) => rank(l) === 0).length };
      }),
    [leads, type],
  );

  // Rappels à venir (toutes fiches ouvertes).
  const rappels = useMemo(() => {
    const t = todayYmd();
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    const d1 = `${demain.getFullYear()}-${String(demain.getMonth() + 1).padStart(2, "0")}-${String(demain.getDate()).padStart(2, "0")}`;
    const sem = new Date();
    sem.setDate(sem.getDate() + 7);
    const d7 = `${sem.getFullYear()}-${String(sem.getMonth() + 1).padStart(2, "0")}-${String(sem.getDate()).padStart(2, "0")}`;
    const open = (leads ?? []).filter((l) => l.rappelLe && !isClosedStatus(l.status) && (!type || l.type === type));
    const heure = (l: Lead) => l.fields[RAPPEL_HEURE_KEY] ?? "";
    const late = open.filter((l) => rappelEnRetard(l.rappelLe, heure(l)));
    late.sort((a, b) => (a.rappelLe + heure(a)).localeCompare(b.rappelLe + heure(b)));
    return {
      late,
      today: open.filter((l) => l.rappelLe === t && !rappelEnRetard(l.rappelLe, heure(l))).length,
      todayAll: open.filter((l) => l.rappelLe === t).length,
      tomorrow: open.filter((l) => l.rappelLe === d1).length,
      week: open.filter((l) => l.rappelLe > t && l.rappelLe <= d7).length,
      heure,
    };
  }, [leads, type]);

  // Argent attendu (réservé à Jonas, Alexis et contact@).
  const money = useMemo(() => {
    const list = (leads ?? []).filter((l) => !isClosedStatus(l.status) && !LOST_STATUSES.includes(l.status) && (!type || l.type === type));
    let attendu = 0;
    let pondere = 0;
    let n = 0;
    for (const l of list) {
      const m = parseFloat(String(l.fields.montantAttendu ?? "").replace(/\s/g, "").replace(",", "."));
      if (!isFinite(m) || m <= 0) continue;
      const p = parseFloat(String(l.fields.pctReussite ?? "").replace(",", "."));
      attendu += m;
      pondere += (m * (isFinite(p) ? p : 0)) / 100;
      n++;
    }
    return { attendu, pondere, n };
  }, [leads, type]);

  const statusRows = useMemo(
    () =>
      LEAD_STATUSES.map((s) => ({ label: s.label || "(sans statut)", value: inPeriod.filter((l) => l.status === s.key).length, hex: s.hex }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value),
    [inPeriod],
  );

  const artisanStats = useMemo(() => {
    const list = artisans ?? [];
    const sinceA = days === 1 ? startOfToday : days ? Date.now() - days * DAY : 0;
    const byStatus = ARTISAN_STATUSES.map((s) => ({ label: s.label, value: list.filter((a) => a.status === s.key).length, hex: s.hex }));
    const grilles = list.filter((a) => {
      const t = Date.parse(a.grille?.submittedAt ?? "");
      return !isNaN(t) && (!sinceA || t >= sinceA);
    }).length;
    return { byStatus, grilles, total: list.length, signes: list.filter((a) => a.status === "signe").length };
  }, [artisans, days, startOfToday]);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!leads || !artisans) {
    return (
      <div className="py-10 text-center text-gray-400">
        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
        Chargement…
      </div>
    );
  }

  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();
  const fbCount = inPeriod.filter(isFb).length;
  const tauxAppel = pctNum(f.appeles, f.recus);
  const ptauxAppel = pf ? pctNum(pf.appeles, pf.recus) : null;
  const tauxRdv = pctNum(f.rdv, f.recus);
  const ptauxRdv = pf ? pctNum(pf.rdv, pf.recus) : null;

  const selectCls = "text-xs font-semibold bg-white border border-gray-200 rounded-full px-3 py-1.5 outline-none focus:border-orange-300";

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full bg-gray-100 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full ${period === p.key ? "bg-white text-[#c2410c] shadow-sm" : "text-gray-500"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
          <option value="">Tous types</option>
          {LEAD_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={`${selectCls} max-w-[200px]`}>
          <option value="">Toutes sources</option>
          {sources.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={who} onChange={(e) => setWho(e.target.value)} className={selectCls}>
          <option value="">Tout le monde</option>
          {ATTRIBUE.filter((o) => !o.off).map((o) => (
            <option key={o.key} value={o.key}>
              Attribué à {o.label}
            </option>
          ))}
        </select>
        {(type || source || who) && (
          <button onClick={() => { setType(""); setSource(""); setWho(""); }} className="text-xs text-gray-400 hover:text-orange-600 underline">
            Tout afficher
          </button>
        )}
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label={`Leads reçus (${periodLabel})`}
          value={f.recus}
          trend={<Trend cur={f.recus} prev={pf ? pf.recus : null} />}
          sub={fbCount ? `dont ${fbCount} Facebook / Instagram` : undefined}
        />
        <Tile
          label="Leads appelés"
          value={pct(f.appeles, f.recus)}
          trend={<Trend cur={tauxAppel} prev={ptauxAppel} />}
          sub={`${f.appeles} sur ${f.recus}`}
        />
        <Tile
          label="RDV et plus"
          value={f.rdv}
          trend={<Trend cur={f.rdv} prev={pf ? pf.rdv : null} />}
          sub={`${pct(f.rdv, f.recus)} des reçus`}
        />
        <Tile
          label="Gagnés"
          value={f.gagnes}
          trend={<Trend cur={f.gagnes} prev={pf ? pf.gagnes : null} />}
          sub={`${pct(f.gagnes, f.recus)} des reçus`}
          accent="linear-gradient(180deg,#22c55e,#15803d)"
        />
        <Tile
          label="Intéressés et plus"
          value={f.interesses}
          trend={<Trend cur={f.interesses} prev={pf ? pf.interesses : null} />}
          sub={`${pct(f.interesses, f.recus)} des reçus`}
        />
        <Tile
          label="Perdus (pas intéressé, non éligible…)"
          value={f.perdus}
          trend={<Trend cur={f.perdus} prev={pf ? pf.perdus : null} invert />}
          sub={`${pct(f.perdus, f.recus)} des reçus`}
          accent="linear-gradient(180deg,#9ca3af,#6b7280)"
        />
        <Tile
          label="Injoignables (NRP)"
          value={f.nrp}
          trend={<Trend cur={f.nrp} prev={pf ? pf.nrp : null} invert />}
          sub={`${pct(f.nrp, f.appeles)} des appelés`}
          accent="linear-gradient(180deg,#f59e0b,#b45309)"
        />
        <Tile
          label="Rappels en retard"
          value={rappels.late.length}
          sub={rappels.late.length ? "voir la liste plus bas" : "rien à rattraper"}
          accent="linear-gradient(180deg,#ef4444,#b91c1c)"
        />
      </div>

      {/* Réactivité */}
      <Card title="Réactivité de l'équipe" hint="Temps entre l'arrivée du lead et son 1er appel">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="rounded-xl bg-orange-50/60 py-3">
            <p className="text-[11px] text-gray-500">Délai médian avant 1er appel</p>
            <p className="text-xl font-extrabold text-gray-900">{delay.n ? fmtDuration(delay.med) : "—"}</p>
            <p className="text-[11px] text-gray-400">{delay.n} lead{delay.n > 1 ? "s" : ""} mesuré{delay.n > 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-xl bg-orange-50/60 py-3">
            <p className="text-[11px] text-gray-500">Appelés en moins d'1 h</p>
            <p className="text-xl font-extrabold text-gray-900">{pct(delay.within1h, delay.n)}</p>
            <p className="text-[11px] text-gray-400">{delay.within1h} sur {delay.n}</p>
          </div>
          <div className="rounded-xl bg-orange-50/60 py-3">
            <p className="text-[11px] text-gray-500">Appelés en moins de 24 h</p>
            <p className="text-xl font-extrabold text-gray-900">{pct(delay.within24h, delay.n)}</p>
            <p className="text-[11px] text-gray-400">{delay.within24h} sur {delay.n}</p>
          </div>
          <div className="rounded-xl bg-rose-50 py-3">
            <p className="text-[11px] text-gray-500">Jamais appelés</p>
            <p className="text-xl font-extrabold text-rose-700">{delay.never}</p>
            <p className="text-[11px] text-gray-400">dont {delay.waiting} depuis plus de 2 jours</p>
          </div>
        </div>
      </Card>

      {/* Arrivées dans le temps */}
      <Card
        title={days === 1 ? "Leads reçus par heure (aujourd'hui)" : timeline.perWeek ? "Leads reçus par jour" : "Leads reçus par semaine"}
        hint={timeline.best?.value ? `Pic : ${timeline.best.label} (${timeline.best.value} lead${timeline.best.value > 1 ? "s" : ""})` : undefined}
      >
        <Columns buckets={timeline.buckets} avg={timeline.avg} labelEvery={timeline.buckets.length > 20 ? Math.ceil(timeline.buckets.length / 10) : timeline.buckets.length > 12 ? 2 : 1} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Parcours des leads" hint="statut actuel · % de passage d'une étape à l'autre">
          <Funnel
            steps={[
              { label: "Reçus", value: f.recus },
              { label: "Appelés", value: f.appeles },
              { label: "Intéressés et plus", value: f.interesses },
              { label: "RDV et plus", value: f.rdv },
              { label: "Gagnés", value: f.gagnes, color: "linear-gradient(90deg,#22c55e,#15803d)" },
            ]}
          />
          <p className="text-[11px] text-gray-400 mt-3">
            Taux RDV : <b className="text-gray-700">{tauxRdv} %</b>
            {ptauxRdv !== null && <> (avant : {ptauxRdv} %)</>} · Perdus : {f.perdus} · Injoignables : {f.nrp}
          </p>
        </Card>
        <Card title="Répartition par statut" hint={`${f.recus} lead${f.recus > 1 ? "s" : ""}`}>
          <BarList rows={statusRows} total={f.recus} />
        </Card>
      </div>

      {/* Sources */}
      <Card title="Sources : d'où viennent les bons leads" hint="triées par volume">
        {bySource.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <Th>Source</Th>
                  <Th right>Leads</Th>
                  <Th right>Appelés</Th>
                  <Th right>Intéressés</Th>
                  <Th right>RDV</Th>
                  <Th right>Gagnés</Th>
                  <Th right>Perdus</Th>
                  <Th right>Taux RDV</Th>
                </tr>
              </thead>
              <tbody>
                {bySource.map((r) => (
                  <tr key={r.label} className="border-t border-gray-50">
                    <Td>
                      <span className="inline-block max-w-[220px] truncate align-bottom" title={r.label}>{r.label}</span>
                    </Td>
                    <Td right bold>{r.n}</Td>
                    <Td right>{pct(r.appeles, r.n)}</Td>
                    <Td right>{r.interesses}</Td>
                    <Td right>{r.rdv}</Td>
                    <Td right>{r.gagnes}</Td>
                    <Td right>{r.perdus}</Td>
                    <Td right><Rate n={r.rdv} d={r.n} good={8} ok={3} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Équipe */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Activité d'appels" hint={`${calls.total} appel${calls.total > 1 ? "s" : ""} sur la période`}>
          {calls.rows.length === 0 ? (
            <Empty text="Aucun appel enregistré sur la période." />
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <Th>Personne</Th>
                  <Th right>Appels</Th>
                  <Th right>Fiches</Th>
                  <Th right>Dernier appel</Th>
                </tr>
              </thead>
              <tbody>
                {calls.rows.map(([name, r]) => (
                  <tr key={name} className="border-t border-gray-50">
                    <Td>{name}</Td>
                    <Td right bold>{r.n}</Td>
                    <Td right>{r.leads.size}</Td>
                    <Td right>{new Date(r.last).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-gray-400 mt-2">Appels suivis automatiquement par le CRM (qui a appelé, quand).</p>
        </Card>
        <Card title="Portefeuilles : leads attribués à chacun" hint="toutes périodes">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <Th>Personne</Th>
                  <Th right>Attribués</Th>
                  <Th right>Jamais appelés</Th>
                  <Th right>Appelés</Th>
                  <Th right>Intéressés</Th>
                  <Th right>RDV</Th>
                  <Th right>Gagnés</Th>
                </tr>
              </thead>
              <tbody>
                {portfolios.map((p) => (
                  <tr key={p.name} className="border-t border-gray-50">
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.hex }} />
                        {p.name}
                      </span>
                    </Td>
                    <Td right bold>{p.recus}</Td>
                    <Td right>{p.jamais}</Td>
                    <Td right>{pct(p.appeles, p.recus)}</Td>
                    <Td right>{p.interesses}</Td>
                    <Td right>{p.rdv}</Td>
                    <Td right>{p.gagnes}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Rappels */}
      <Card title="Rappels" hint="toutes fiches ouvertes">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-3">
          <div className="rounded-xl bg-rose-50 py-2.5">
            <p className="text-[11px] text-gray-500">En retard</p>
            <p className="text-xl font-extrabold text-rose-700">{rappels.late.length}</p>
          </div>
          <div className="rounded-xl bg-orange-50 py-2.5">
            <p className="text-[11px] text-gray-500">Encore à faire aujourd'hui</p>
            <p className="text-xl font-extrabold text-gray-900">{rappels.today}</p>
          </div>
          <div className="rounded-xl bg-orange-50/60 py-2.5">
            <p className="text-[11px] text-gray-500">Demain</p>
            <p className="text-xl font-extrabold text-gray-900">{rappels.tomorrow}</p>
          </div>
          <div className="rounded-xl bg-orange-50/60 py-2.5">
            <p className="text-[11px] text-gray-500">Dans les 7 jours</p>
            <p className="text-xl font-extrabold text-gray-900">{rappels.week}</p>
          </div>
        </div>
        {rappels.late.length > 0 ? (
          <ul className="divide-y divide-gray-50">
            {rappels.late.slice(0, 8).map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-1.5 text-xs">
                <BellRing size={12} className="text-rose-500 shrink-0" />
                <span className="font-semibold text-gray-800 truncate flex-1" title={l.name}>{l.name || "(sans nom)"}</span>
                <span className="text-gray-500">{rappelShort(l.rappelLe, rappels.heure(l))}</span>
                {l.fields[ATTRIBUE_KEY] && <span className="text-gray-400">· {l.fields[ATTRIBUE_KEY]}</span>}
              </li>
            ))}
            {rappels.late.length > 8 && <li className="pt-1.5 text-[11px] text-gray-400">… et {rappels.late.length - 8} autres (colonne « Rappel » du tableau)</li>}
          </ul>
        ) : (
          <Empty text="Aucun rappel en retard." />
        )}
      </Card>

      {/* Qui sont les leads */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Tranche de revenus" hint={`${profile.renseignes} sur ${f.recus} renseignées`}>
          <BarList rows={profile.tranche} total={profile.renseignes} empty="Tranche non renseignée sur la période." />
        </Card>
        <Card title="Chauffage actuel">
          <BarList rows={profile.chauffage} total={profile.chauffage.reduce((s, r) => s + r.value, 0)} empty="Chauffage non renseigné sur la période." />
        </Card>
        <Card title="Personnes au foyer">
          <BarList rows={profile.foyer} total={profile.foyer.reduce((s, r) => s + r.value, 0)} empty="Foyer non renseigné sur la période." />
        </Card>
        <Card title="Départements" hint="top 10">
          <BarList rows={profile.dep} total={f.recus} empty="Code postal non renseigné." />
        </Card>
        <Card title="Quand arrivent les leads (heure)" hint="heure de Paris">
          <Columns buckets={rhythm.hours} height={90} labelEvery={3} />
        </Card>
        <Card title="Quand arrivent les leads (jour)">
          <Columns buckets={rhythm.dows} height={90} />
        </Card>
        <Card title="Leads par type">
          <BarList rows={LEAD_TYPES.map((t) => ({ label: t, value: inPeriod.filter((l) => l.type === t).length }))} total={f.recus} />
        </Card>
        {canSeeMoney && (
          <Card title="Chiffre d'affaires attendu" hint="réservé à Jonas, Alexis et contact@">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-orange-50 py-3">
                <p className="text-[11px] text-gray-500">Montant attendu</p>
                <p className="text-xl font-extrabold text-gray-900">{euro(money.attendu)}</p>
              </div>
              <div className="rounded-xl bg-orange-50 py-3">
                <p className="text-[11px] text-gray-500">Montant pondéré</p>
                <p className="text-xl font-extrabold text-gray-900">{euro(money.pondere)}</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">{money.n} fiche{money.n > 1 ? "s" : ""} en cours avec un montant renseigné (colonnes « Montant attendu » et « % de réussite »).</p>
          </Card>
        )}
      </div>

      {/* Artisans */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Tile label="Artisans au total" value={artisanStats.total} />
        <Tile label="Grilles reçues" value={artisanStats.grilles} sub={days ? periodLabel : "au total"} />
        <Tile label="Artisans signés" value={artisanStats.signes} />
      </div>
      <Card title="Artisans par étape">
        <BarList rows={artisanStats.byStatus} empty="Aucun artisan dans le CRM." />
      </Card>

      <p className="text-xs text-gray-400">
        Les étapes sont celles d'aujourd'hui : le CRM ne conserve pas la date de chaque changement de statut. Les pourcentages « vs avant » comparent à la période
        précédente de même durée. Les leads importés de Monday sont datés de leur 1er contact.
      </p>
    </div>
  );
}
