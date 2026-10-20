import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  Download,
  EyeOff,
  Filter,
  Layers,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LEAD_COLUMNS, formulaValue } from "@/lib/crmColumns";
import {
  DATE_BUCKETS,
  GROUPABLE,
  dateInBucket,
  valueOf,
  type LeadFilter,
  type LeadSort,
} from "@/lib/crmFilters";
import { AdvancedFilters } from "./LeadsFilter";
import type { Lead } from "@/lib/crm";

// Barre d'outils façon Monday : Ajouter ▾ · Rechercher · Personne · Filtre ▾ ·
// Trier · Masquer · Grouper par · « … ». Le panneau « Filtre » reprend les
// « Filtres rapides » de Monday : toutes les colonnes, valeurs et compteurs.

const POP = "bg-white text-gray-900 border border-gray-200 shadow-xl";
const btn =
  "inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 data-[state=open]:bg-gray-100";
const btnOn = "inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1.5 rounded-md bg-[#e5efff] text-[#1f4f8f]";

// ── Ajouter ▾ ──────────────────────────────────────────────────────────────
export function AddSplit({ onAddLead, onAddGroup }: { onAddLead: () => void; onAddGroup: () => void }) {
  return (
    <div className="inline-flex rounded-md overflow-hidden shadow-sm">
      <button onClick={onAddLead} className="inline-flex items-center gap-1.5 bg-[#0073ea] hover:bg-[#0060c2] text-white text-sm font-semibold px-3 py-1.5">
        <Plus size={15} /> <span className="hidden sm:inline">Ajouter noms sociétés</span>
        <span className="sm:hidden">Ajouter</span>
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button aria-label="Plus d'options" className="bg-[#0073ea] hover:bg-[#0060c2] text-white px-1.5 border-l border-white/30">
            <ChevronDown size={15} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className={`w-56 p-1.5 ${POP}`}>
          <button onClick={onAddLead} className="w-full text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-gray-100">
            Nouvelle fiche complète
          </button>
          <button onClick={onAddGroup} className="w-full text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-gray-100">
            Ajouter un groupe
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Rechercher ─────────────────────────────────────────────────────────────
export function SearchToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(!!value);
  if (!open && !value) {
    return (
      <button onClick={() => setOpen(true)} className={btn}>
        <Search size={15} /> Rechercher
      </button>
    );
  }
  return (
    <div className="relative">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => !value && setOpen(false)}
        placeholder="Nom, téléphone, e-mail, ville…"
        className="w-64 text-sm bg-white border border-gray-300 rounded-md pl-8 pr-7 py-1.5 outline-none focus:border-[#0073ea]"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" aria-label="Effacer">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ── Filtre : « Filtres rapides » ───────────────────────────────────────────
const QUICK_COLS = [
  "status", "rappel", "pipeline", "commercial", "mailAuto", "cp", "zoneCalc",
  "profilAides", "opportunite", "type", "source", "typeDemande", "poseur", "dateVt", "datePose", "ressenti",
  "chauffage", "foyerSite", "tranche", "projet", "region", "premierContact",
];
const RECENT_KEY = "crm-recent-filters";
type Recent = { col: string; value: string; label: string };

function readRecent(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function QuickFilter({
  leads,
  filters,
  onFilters,
  onSaveView,
  trigger,
}: {
  leads: Lead[];
  filters: LeadFilter[];
  onFilters: (f: LeadFilter[]) => void;
  onSaveView: (name: string) => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [viewName, setViewName] = useState("");
  const [recent, setRecent] = useState<Recent[]>(readRecent);

  // Valeurs et compteurs de chaque colonne (calculés à l'ouverture du panneau).
  const columns = useMemo(() => {
    if (!open) return [];
    return [...QUICK_COLS.map((k) => LEAD_COLUMNS.find((c) => c.key === k)!), ...LEAD_COLUMNS.filter((c) => c.custom && c.type !== "timeline")]
      .filter(Boolean)
      .map((c) => {
        if (c.type === "date") {
          const items = DATE_BUCKETS.map((b) => ({
            value: b.key,
            label: b.label,
            hex: "",
            count: leads.filter((l) => dateInBucket(valueOf(l, c), b.key)).length,
          }));
          return { c, items, op: "when" as const };
        }
        const counts = new Map<string, number>();
        for (const l of leads) {
          const v = valueOf(l, c);
          counts.set(v, (counts.get(v) ?? 0) + 1);
        }
        let items: { value: string; label: string; hex: string; count: number }[];
        if (c.options) {
          items = c.options
            .map((o) => ({ value: o.key, label: o.label || "(sans valeur)", hex: o.hex, count: counts.get(o.key) ?? 0 }))
            .filter((i) => i.count > 0);
          const known = new Set(c.options.map((o) => o.key));
          const empty = counts.get("") ?? 0;
          if (empty && !c.options.some((o) => o.key === "")) items.push({ value: "", label: "(sans valeur)", hex: "#c4c4c4", count: empty });
          void known;
        } else {
          items = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 40)
            .map(([v, n]) => ({ value: v, label: v || "(sans valeur)", hex: v ? "" : "#c4c4c4", count: n }));
        }
        return { c, items, op: "is" as const };
      });
  }, [open, leads]);

  const selected = (col: string, op: string) => filters.find((f) => f.col === col && f.op === op)?.values ?? [];

  const toggle = (col: string, op: "is" | "when", value: string, label: string) => {
    const existing = filters.find((f) => f.col === col && f.op === op);
    if (!existing) {
      onFilters([...filters, { id: Math.random().toString(36).slice(2, 8), col, op, values: [value] }]);
      const next = [{ col, value, label }, ...recent.filter((r) => !(r.col === col && r.value === value))].slice(0, 8);
      setRecent(next);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* non essentiel */
      }
      return;
    }
    const values = existing.values.includes(value) ? existing.values.filter((v) => v !== value) : [...existing.values, value];
    onFilters(values.length ? filters.map((f) => (f.id === existing.id ? { ...f, values } : f)) : filters.filter((f) => f.id !== existing.id));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <button className={filters.length ? btnOn : btn}>
            <Filter size={15} /> Filtre{filters.length ? ` / ${filters.length}` : ""} <ChevronDown size={13} />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className={`p-0 w-[min(94vw,880px)] ${POP}`}>
        <div className="flex flex-wrap items-center gap-3 px-4 pt-3 pb-2">
          <span className="text-sm font-bold">Filtres rapides</span>
          <span className="text-xs text-gray-500">
            Afficher tous les {leads.length} noms sociétés
          </span>
          <button onClick={() => onFilters([])} className="text-xs text-gray-500 hover:text-gray-800 ml-auto">
            Tout enlever
          </button>
          <input
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && viewName.trim()) {
                onSaveView(viewName.trim());
                setViewName("");
              }
            }}
            placeholder="Enregistrer en tant que nouvel affichage"
            className="w-60 text-xs bg-white border border-gray-300 rounded-md px-2.5 py-1.5 outline-none focus:border-[#0073ea]"
          />
        </div>

        {!advanced ? (
          <div className="flex gap-4 px-4 pb-3 max-h-[26rem]">
            <div className="w-40 shrink-0">
              <p className="text-xs font-bold text-gray-700 mb-2">Filtres récents</p>
              {recent.length === 0 && <p className="text-xs text-gray-400">Vos derniers filtres apparaîtront ici.</p>}
              <div className="space-y-1.5">
                {recent.map((r) => (
                  <button
                    key={`${r.col}-${r.value}`}
                    onClick={() => {
                      const op = LEAD_COLUMNS.find((c) => c.key === r.col)?.type === "date" ? "when" : "is";
                      if (!selected(r.col, op).includes(r.value)) toggle(r.col, op, r.value, r.label);
                    }}
                    className="w-full text-left text-xs px-2 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 truncate"
                    title={r.label}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-700 mb-2">Toutes les colonnes</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {columns.map(({ c, items, op }) => (
                  <div key={c.key} className="w-44 shrink-0">
                    <p className="text-xs text-gray-500 mb-1.5 truncate" title={c.title}>
                      {c.title}
                    </p>
                    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                      {items.map((it) => {
                        const on = selected(c.key, op).includes(it.value);
                        return (
                          <button
                            key={it.value || "__empty"}
                            onClick={() => toggle(c.key, op, it.value, `${c.title.replace(/^\S+\s/, "")} : ${it.label}`)}
                            className={`w-full flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md text-left ${
                              on ? "bg-[#cce5ff] text-[#0a3d7a] font-semibold" : "bg-gray-100 hover:bg-gray-200"
                            }`}
                          >
                            {it.hex && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.hex }} />}
                            <span className="truncate flex-1">{it.label}</span>
                            <span className="text-gray-400 shrink-0">{it.count}</span>
                            {on && <Check size={12} className="shrink-0" />}
                          </button>
                        );
                      })}
                      {items.length === 0 && <p className="text-xs text-gray-400">Aucune valeur.</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 pb-3 max-h-[26rem] overflow-y-auto">
            <AdvancedFilters filters={filters} onChange={onFilters} />
          </div>
        )}

        <div className="border-t border-gray-200 px-4 py-2 text-right">
          <button onClick={() => setAdvanced((v) => !v)} className="text-xs font-semibold text-gray-700 hover:text-black">
            {advanced ? "Retour aux filtres rapides" : "Passer aux filtres avancés"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Trier ──────────────────────────────────────────────────────────────────
export function SortMenu({ sorts, onChange }: { sorts: LeadSort[]; onChange: (s: LeadSort[]) => void }) {
  const cols = LEAD_COLUMNS.filter((c) => c.type !== "files");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={sorts.length ? btnOn : btn}>
          <ArrowDownUp size={15} /> Trier{sorts.length ? ` / ${sorts.length}` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={`w-80 p-3 ${POP}`}>
        <p className="text-sm font-bold mb-2">Trier par</p>
        {sorts.length === 0 && <p className="text-xs text-gray-400 mb-2">Aucun tri. Les leads suivent l'ordre d'arrivée.</p>}
        <div className="space-y-2">
          {sorts.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select
                value={s.col}
                onChange={(e) => onChange(sorts.map((x, k) => (k === i ? { ...x, col: e.target.value } : x)))}
                className="flex-1 text-xs bg-white border border-gray-200 rounded-md px-1.5 py-1.5 min-w-0"
              >
                {cols.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.title}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onChange(sorts.map((x, k) => (k === i ? { ...x, dir: x.dir === "asc" ? "desc" : "asc" } : x)))}
                className="text-xs font-semibold border border-gray-200 rounded-md px-2 py-1.5 w-20"
              >
                {s.dir === "asc" ? "A → Z" : "Z → A"}
              </button>
              <button onClick={() => onChange(sorts.filter((_, k) => k !== i))} aria-label="Retirer" className="text-gray-400 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => onChange([...sorts, { col: "creation", dir: "desc" }])}
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#0073ea]"
        >
          <Plus size={13} /> Nouveau tri
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ── Grouper par ────────────────────────────────────────────────────────────
export function GroupByMenu({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const cols = [...GROUPABLE.map((k) => LEAD_COLUMNS.find((c) => c.key === k)!), ...LEAD_COLUMNS.filter((c) => c.custom && c.type === "status")].filter(Boolean);
  const label = value ? cols.find((c) => c.key === value)?.title : "";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={value ? btnOn : btn}>
          <Layers size={15} /> Grouper par{label ? ` / ${label.replace(/^\S+\s/, "")}` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={`w-64 p-1.5 max-h-80 overflow-y-auto ${POP}`}>
        <button
          onClick={() => onChange("")}
          className={`w-full text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-gray-100 ${!value ? "font-bold" : ""}`}
        >
          Mes groupes (par défaut) {!value && "✓"}
        </button>
        <div className="my-1 border-t border-gray-100" />
        {cols.map((c) => (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={`w-full text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-gray-100 ${value === c.key ? "font-bold" : ""}`}
          >
            {c.title} {value === c.key && "✓"}
          </button>
        ))}
        <p className="text-[11px] text-gray-400 px-2.5 pt-2">
          Groupé par une colonne, les groupes sont automatiques (pas de glisser-déposer).
        </p>
      </PopoverContent>
    </Popover>
  );
}

// ── « … » : export, actualiser ─────────────────────────────────────────────
export function MoreMenu({ onExport, count, zoom, onZoom }: { onExport: () => void; count: number; zoom?: number; onZoom?: (z: number) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={btn} aria-label="Plus d'actions">
          <MoreHorizontal size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={`w-64 p-1.5 ${POP}`}>
        <button onClick={onExport} className="w-full flex items-center gap-2 text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-gray-100">
          <Download size={15} /> Exporter en Excel (CSV) — {count} lead{count > 1 ? "s" : ""}
        </button>
        <button onClick={() => window.location.reload()} className="w-full flex items-center gap-2 text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-gray-100">
          <RefreshCw size={15} /> Recharger la page
        </button>
        {zoom !== undefined && onZoom && (
          <div className="mt-1 pt-2 px-2.5 pb-1.5 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Zoom du tableau</span>
              <span className="inline-flex items-center rounded-md border border-gray-200">
                <button onClick={() => onZoom(zoom - 0.1)} aria-label="Dézoomer" className="px-2 py-1 hover:bg-gray-100 rounded-l-md">
                  <ZoomOut size={14} />
                </button>
                <button onClick={() => onZoom(1)} title="Revenir à 100 %" className="px-2 text-xs font-semibold min-w-[3rem] hover:bg-gray-100 py-1.5">
                  {Math.round(zoom * 100)}%
                </button>
                <button onClick={() => onZoom(zoom + 0.1)} aria-label="Zoomer" className="px-2 py-1 hover:bg-gray-100 rounded-r-md">
                  <ZoomIn size={14} />
                </button>
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-snug text-gray-500">
              Astuce : pour zoomer ou dézoomer, utilisez plutôt le zoom de Chrome (Ctrl et + / −, ou ⌘ sur Mac). C'est plus fluide.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Masquer (colonnes) : bouton identique aux autres ───────────────────────
export const HideLabel = () => (
  <>
    <EyeOff size={15} /> Masquer
  </>
);

export { formulaValue };
