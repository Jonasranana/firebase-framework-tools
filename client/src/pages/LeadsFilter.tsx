import { useState } from "react";
import { Filter, Plus, Trash2, User, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LEAD_COLUMNS } from "@/lib/crmColumns";
import { OP_LABELS, filterColumns, opsFor, type FilterOp, type LeadFilter, type Person } from "@/lib/crmFilters";
import { initials } from "@/lib/crmTeam";

// Bouton « Filtre » façon Monday : choisir une colonne, une condition, une ou
// plusieurs valeurs ; plusieurs filtres se cumulent.
const sel = "text-xs bg-white text-gray-900 border border-gray-200 rounded-md px-1.5 py-1";

export function FilterMenu({ filters, onChange }: { filters: LeadFilter[]; onChange: (f: LeadFilter[]) => void }) {
  const [, force] = useState(0);
  const add = () =>
    onChange([...filters, { id: Math.random().toString(36).slice(2, 8), col: "status", op: "is", values: [] }]);
  const patch = (id: string, p: Partial<LeadFilter>) => {
    onChange(filters.map((f) => (f.id === id ? { ...f, ...p } : f)));
    force((n) => n + 1);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${
            filters.length ? "bg-[#e5efff] text-[#1f4f8f] border-[#579bfc]" : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          <Filter size={13} /> Filtre{filters.length ? ` (${filters.length})` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[26rem] max-w-[92vw] p-3 bg-white text-gray-900 border border-gray-200 shadow-xl">
        <p className="text-sm font-bold mb-2">Filtrer les leads</p>
        {filters.length === 0 && <p className="text-xs text-gray-400 mb-2">Aucun filtre. Ajoutez-en un pour commencer.</p>}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filters.map((f) => {
            const col = LEAD_COLUMNS.find((c) => c.key === f.col)!;
            const ops = opsFor(col);
            return (
              <div key={f.id} className="flex flex-wrap items-center gap-1.5 bg-gray-50 rounded-lg p-2">
                <select
                  value={f.col}
                  onChange={(e) => {
                    const c = LEAD_COLUMNS.find((x) => x.key === e.target.value)!;
                    patch(f.id, { col: c.key, op: opsFor(c)[0], values: [] });
                  }}
                  className={`${sel} max-w-[9.5rem]`}
                >
                  {filterColumns.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <select value={f.op} onChange={(e) => patch(f.id, { op: e.target.value as FilterOp })} className={sel}>
                  {ops.map((o) => (
                    <option key={o} value={o}>
                      {OP_LABELS[o]}
                    </option>
                  ))}
                </select>
                <button onClick={() => onChange(filters.filter((x) => x.id !== f.id))} aria-label="Retirer le filtre" className="ml-auto text-gray-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
                {(f.op === "is" || f.op === "isnot") && col.options && (
                  <div className="w-full flex flex-wrap gap-1 mt-1">
                    {col.options
                      .filter((o) => o.label !== "")
                      .map((o) => {
                        const on = f.values.includes(o.key);
                        return (
                          <button
                            key={o.key}
                            onClick={() => patch(f.id, { values: on ? f.values.filter((v) => v !== o.key) : [...f.values, o.key] })}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${on ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`}
                            style={on ? { background: o.hex } : undefined}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                  </div>
                )}
                {f.op === "contains" && (
                  <input
                    value={f.values[0] ?? ""}
                    onChange={(e) => patch(f.id, { values: [e.target.value] })}
                    placeholder="Texte à chercher"
                    className="w-full text-xs bg-white text-gray-900 border border-gray-200 rounded-md px-2 py-1 mt-1"
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={add} className="inline-flex items-center gap-1 text-xs font-bold text-[#2b5a8f]">
            <Plus size={13} /> Nouveau filtre
          </button>
          {filters.length > 0 && (
            <button onClick={() => onChange([])} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
              <X size={12} /> Tout effacer
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Barre « Personne » : un clic sur un prénom ne montre que ce qui le concerne.
export function PersonBar({
  people,
  selected,
  onSelect,
  meKey,
}: {
  people: Person[];
  selected: string;
  onSelect: (key: string) => void;
  meKey: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${
            selected ? "bg-[#e5efff] text-[#1f4f8f] border-[#579bfc]" : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          <User size={13} /> {selected ? people.find((p) => p.key === selected)?.label : "Personne"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2 bg-white text-gray-900 border border-gray-200 shadow-xl">
        <button
          onClick={() => onSelect("")}
          className="w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-gray-100 text-gray-600"
        >
          Tout le monde
        </button>
        {people.map((p) => (
          <button
            key={p.key}
            onClick={() => onSelect(p.key)}
            className={`w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded-md hover:bg-gray-100 ${selected === p.key ? "bg-[#e5efff]" : ""}`}
          >
            <span className="w-6 h-6 rounded-full bg-[#2b5a8f] text-white text-[10px] font-bold flex items-center justify-center">
              {initials(p.label)}
            </span>
            {p.label}
            {p.key === meKey && <span className="text-[10px] text-gray-400">(moi)</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
