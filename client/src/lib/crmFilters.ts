import type { Lead } from "@/lib/crm";
import { LEAD_COLUMNS, cellValue, formulaValue, type LeadColumn } from "@/lib/crmColumns";

// Filtres façon Monday : une liste de règles « colonne + condition + valeurs »,
// toutes appliquées ensemble (ET).
export type FilterOp = "is" | "isnot" | "contains" | "empty" | "notempty";
export type LeadFilter = { id: string; col: string; op: FilterOp; values: string[] };

export const OP_LABELS: Record<FilterOp, string> = {
  is: "est",
  isnot: "n'est pas",
  contains: "contient",
  empty: "est vide",
  notempty: "n'est pas vide",
};

export const opsFor = (c: LeadColumn): FilterOp[] =>
  c.type === "status" ? ["is", "isnot", "empty", "notempty"] : ["contains", "empty", "notempty"];

export const filterColumns = LEAD_COLUMNS.filter((c) => c.type !== "files" && c.type !== "autodate");

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function valueOf(l: Lead, c: LeadColumn): string {
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
  }
}

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
