import { statusInfo, type Lead } from "@/lib/crm";
import { LEAD_COLUMNS, cellValue, formulaValue, type LeadColumn } from "@/lib/crmColumns";

// Filtres façon Monday : une liste de règles « colonne + condition + valeurs »,
// toutes appliquées ensemble (ET).
export type FilterOp = "is" | "isnot" | "contains" | "empty" | "notempty" | "when";
export type LeadFilter = { id: string; col: string; op: FilterOp; values: string[] };

export const OP_LABELS: Record<FilterOp, string> = {
  is: "est",
  isnot: "n'est pas",
  contains: "contient",
  empty: "est vide",
  notempty: "n'est pas vide",
  when: "est",
};

export const opsFor = (c: LeadColumn): FilterOp[] =>
  c.type === "status"
    ? ["is", "isnot", "empty", "notempty"]
    : c.type === "date"
      ? ["when", "empty", "notempty"]
      : ["contains", "is", "empty", "notempty"];

export const filterColumns = LEAD_COLUMNS.filter((c) => c.type !== "files" && c.type !== "autodate");

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function valueOf(l: Lead, c: LeadColumn): string {
  return c.type === "formula" ? formulaValue(l, c) : c.key === "status" ? l.status : cellValue(l, c);
}

export function matchFilter(l: Lead, f: LeadFilter): boolean {
  const c = LEAD_COLUMNS.find((x) => x.key === f.col);
  if (!c) return true;
  const v = valueOf(l, c);
  switch (f.op) {
    case "empty":
      return v === "" || v === "vide";
    case "notempty":
      return v !== "" && v !== "vide";
    case "is":
      return f.values.length === 0 || f.values.includes(v);
    case "isnot":
      return f.values.length === 0 || !f.values.includes(v);
    case "contains":
      return f.values.length === 0 || norm(v).includes(norm(f.values[0] ?? ""));
    case "when":
      return f.values.length === 0 || f.values.some((b) => dateInBucket(v, b));
  }
}

// ── Dates : « Aujourd'hui », « Cette semaine »… ────────────────────────────
export const DATE_BUCKETS: { key: string; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "tomorrow", label: "Demain" },
  { key: "yesterday", label: "Hier" },
  { key: "thisweek", label: "Cette semaine" },
  { key: "lastweek", label: "La semaine dernière" },
  { key: "thismonth", label: "Ce mois-ci" },
  { key: "past", label: "Passé" },
  { key: "future", label: "À venir" },
];

const ymd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function dateInBucket(v: string, bucket: string): boolean {
  if (!v) return false;
  const d = v.slice(0, 10);
  const now = new Date();
  const today = ymd(now);
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  switch (bucket) {
    case "today":
      return d === today;
    case "tomorrow":
      return d === ymd(addDays(now, 1));
    case "yesterday":
      return d === ymd(addDays(now, -1));
    case "thisweek":
      return d >= ymd(monday) && d <= ymd(addDays(monday, 6));
    case "lastweek":
      return d >= ymd(addDays(monday, -7)) && d <= ymd(addDays(monday, -1));
    case "thismonth":
      return d.slice(0, 7) === today.slice(0, 7);
    case "past":
      return d < today;
    case "future":
      return d > today;
    default:
      return false;
  }
}

// ── Tri ────────────────────────────────────────────────────────────────────
export type LeadSort = { col: string; dir: "asc" | "desc" };

export function sortLeads(list: Lead[], sorts: LeadSort[]): Lead[] {
  if (!sorts.length) return list;
  const cols = sorts.map((s) => ({ ...s, c: LEAD_COLUMNS.find((x) => x.key === s.col) })).filter((x) => x.c);
  const key = (l: Lead, c: LeadColumn) => {
    const v = valueOf(l, c);
    if (c.type === "number") return parseFloat(v.replace(",", ".")) || 0;
    if (c.type === "status" && c.options) {
      const i = c.options.findIndex((o) => o.key === v);
      return i < 0 ? 9999 : i;
    }
    return norm(v);
  };
  return [...list].sort((a, b) => {
    for (const { c, dir } of cols) {
      const ka = key(a, c!);
      const kb = key(b, c!);
      if (ka < kb) return dir === "asc" ? -1 : 1;
      if (ka > kb) return dir === "asc" ? 1 : -1;
    }
    return 0;
  });
}

// ── Grouper par une colonne ────────────────────────────────────────────────
export const GROUPABLE = ["status", "commercial", "pipeline", "precarite", "marque", "zone", "type", "poseur", "chauffage", "ressenti", "typeDemande", "source"];

export function groupByColumn(list: Lead[], colKey: string): { groups: { id: string; title: string; color: string }[]; keyOf: (l: Lead) => string } {
  const c = LEAD_COLUMNS.find((x) => x.key === colKey)!;
  const keyOf = (l: Lead) => valueOf(l, c) || "__vide";
  const seen = new Map<string, number>();
  for (const l of list) seen.set(keyOf(l), (seen.get(keyOf(l)) ?? 0) + 1);
  const groups: { id: string; title: string; color: string }[] = [];
  if (c.options) {
    for (const o of c.options) if (seen.has(o.key)) groups.push({ id: o.key, title: o.label || "(sans valeur)", color: o.hex });
  } else {
    Array.from(seen.entries())
      .filter(([k]) => k !== "__vide")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .forEach(([k]) => groups.push({ id: k, title: k, color: "#579bfc" }));
  }
  if (seen.has("__vide") && !groups.some((g) => g.id === "__vide")) groups.push({ id: "__vide", title: "(sans valeur)", color: "#c4c4c4" });
  // Valeurs hors liste (anciennes options) : regroupées à la fin.
  const known = new Set(groups.map((g) => g.id));
  for (const k of Array.from(seen.keys())) if (!known.has(k)) groups.push({ id: k, title: k, color: "#7f8794" });
  return { groups, keyOf };
}

// ── Export CSV (ouvrable dans Excel) ───────────────────────────────────────
export function leadsToCsv(list: Lead[], cols: LeadColumn[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = cols.map((c) => esc(c.title)).join(";");
  const rows = list.map((l) =>
    cols
      .map((c) => {
        if (c.type === "formula") return esc(formulaValue(l, c));
        if (c.type === "files") return esc(String(l.docCount));
        if (c.type === "autodate") return esc((c.key === "creation" ? l.createdAt : l.updatedAt).slice(0, 10));
        if (c.key === "status") return esc(LEAD_STATUS_LABEL(l.status));
        if (c.type === "status" && c.options) return esc(c.options.find((o) => o.key === cellValue(l, c))?.label ?? cellValue(l, c));
        return esc(cellValue(l, c));
      })
      .join(";"),
  );
  return "\ufeff" + [head, ...rows].join("\r\n");
}
const LEAD_STATUS_LABEL = (k: string) => statusInfo(k).label;

export const applyFilters = (l: Lead, filters: LeadFilter[]) => filters.every((f) => matchFilter(l, f));

// ── Filtre « Personne » ────────────────────────────────────────────────────
// Rattache un lead à une personne : commercial assigné, nom dans la colonne
// « Personnes », ou personne qui a écrit une mise à jour sur la fiche.
export type Person = { key: string; label: string; emails: string[] };

export function leadMatchesPerson(l: Lead, p: Person): boolean {
  const first = norm(p.label.split(" ")[0]);
  if (norm(l.fields.commercial ?? "") === first) return true;
  if (norm(l.fields.personnes ?? "").includes(first)) return true;
  return l.notes.some((n) => (n.kind === "note" || !n.kind) && p.emails.includes(String(n.by).toLowerCase()));
}
