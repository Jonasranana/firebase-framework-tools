import { useState } from "react";
import {
  Archive,
  ArrowDownAZ,
  ArrowLeft,
  ArrowRight,
  ArrowUpAZ,
  Check,
  ChevronsLeftRight,
  Copy,
  Filter,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Settings,
  Trash2,
  WrapText,
  X,
  ArrowDownUp,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ADD_TYPES, CUSTOM_TYPES } from "@/lib/crmColumnsConfig";
import type { ColType, LeadColumn } from "@/lib/crmColumns";
import { DATE_BUCKETS, GROUPABLE, dateInBucket, valueOf, type LeadFilter, type LeadSort } from "@/lib/crmFilters";
import type { Lead, Opt } from "@/lib/crm";
import { GROUP_COLORS } from "@/lib/crm";

// Menu « ⋯ » à côté du titre de chaque colonne, comme dans Monday : paramètres,
// filtre, tri, réduire, retour à la ligne, grouper par, dupliquer, ajouter une
// colonne à droite (avec son type), changer le type, renommer, supprimer.
const POP = "bg-white text-gray-900 border border-gray-200 shadow-xl";

const Entry = ({ icon: Icon, label, onClick, disabled, danger, more, checked }: { icon: any; label: string; onClick?: () => void; disabled?: boolean; danger?: boolean; more?: boolean; checked?: boolean }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 text-left text-sm px-2.5 py-1.5 rounded-md disabled:opacity-35 disabled:cursor-not-allowed ${
      danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-100"
    }`}
  >
    <Icon size={15} className="shrink-0" />
    <span className="flex-1">{label}</span>
    {checked && <Check size={14} className="text-[#0073ea]" />}
    {more && <ArrowRight size={13} className="text-gray-400" />}
  </button>
);
const Sep = () => <div className="my-1 border-t border-gray-100" />;

export function AddTypeList({ onPick }: { onPick: (t: ColType) => void }) {
  return (
    <div>
      {ADD_TYPES.map((t) => (
        <button key={t.type} onClick={() => onPick(t.type)} className="w-full flex items-center gap-2.5 text-sm px-2.5 py-1.5 rounded-md hover:bg-gray-100">
          <span className="w-5 h-5 rounded text-white text-[11px] font-bold flex items-center justify-center" style={{ background: t.color }}>
            {t.letter}
          </span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function ColumnMenu({
  col,
  leads,
  filters,
  onFilters,
  sorts,
  onSorts,
  groupBy,
  onGroupBy,
  api,
  onDuplicate,
}: {
  col: LeadColumn;
  leads: Lead[];
  filters: LeadFilter[];
  onFilters: (f: LeadFilter[]) => void;
  sorts: LeadSort[];
  onSorts: (s: LeadSort[]) => void;
  groupBy: string;
  onGroupBy: (k: string) => void;
  api: {
    addAfter: (afterKey: string, type: ColType) => LeadColumn;
    rename: (key: string, title: string) => void;
    setWrap: (key: string, on: boolean) => void;
    setCollapsed: (key: string, on: boolean) => void;
    setType: (key: string, type: ColType) => void;
    setOptions: (key: string, options: Opt[]) => void;
    remove: (key: string, kind?: "archive" | "delete") => void;
    moveBy: (key: string, delta: number) => void;
  };
  onDuplicate: (col: LeadColumn) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"" | "settings" | "filter" | "sort" | "add" | "type" | "rename">("");
  const [title, setTitle] = useState(col.title);
  const close = () => {
    setOpen(false);
    setPanel("");
  };
  const groupable = GROUPABLE.includes(col.key) || (col.custom && col.type === "status");
  const sortNow = sorts.find((s) => s.col === col.key)?.dir;
  const duplicable = !["name", "files", "autodate", "filecol"].includes(col.type);
  const isDate = col.type === "date";

  // Valeurs de la colonne et compteurs, pour le panneau « Filtre ».
  const filterItems = () => {
    if (isDate) return DATE_BUCKETS.map((b) => ({ value: b.key, label: b.label, count: leads.filter((l) => dateInBucket(valueOf(l, col), b.key)).length, hex: "" }));
    const counts = new Map<string, number>();
    for (const l of leads) counts.set(valueOf(l, col), (counts.get(valueOf(l, col)) ?? 0) + 1);
    if (col.options) {
      return col.options.map((o) => ({ value: o.key, label: o.label || "(sans valeur)", count: counts.get(o.key) ?? 0, hex: o.hex })).filter((i) => i.count > 0);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([v, n]) => ({ value: v, label: v || "(sans valeur)", count: n, hex: "" }));
  };
  const op = isDate ? "when" : "is";
  const selected = filters.find((f) => f.col === col.key && f.op === op)?.values ?? [];
  const toggle = (v: string) => {
    const ex = filters.find((f) => f.col === col.key && f.op === op);
    if (!ex) return onFilters([...filters, { id: Math.random().toString(36).slice(2, 8), col: col.key, op, values: [v] }]);
    const values = ex.values.includes(v) ? ex.values.filter((x) => x !== v) : [...ex.values, v];
    onFilters(values.length ? filters.map((f) => (f.id === ex.id ? { ...f, values } : f)) : filters.filter((f) => f.id !== ex.id));
  };

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Options de la colonne ${col.title}`}
          className="shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-200 data-[state=open]:bg-gray-200 data-[state=open]:text-gray-900"
        >
          <MoreHorizontal size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={`w-64 p-1.5 ${POP}`}>
        {panel === "" && (
          <>
            <Entry icon={Settings} label="Paramètres" more onClick={() => setPanel("settings")} />
            <Sep />
            <Entry icon={Filter} label="Filtre" more disabled={["files", "autodate"].includes(col.type)} onClick={() => setPanel("filter")} />
            <Entry icon={ArrowDownUp} label="Trier" more disabled={col.type === "files"} onClick={() => setPanel("sort")} />
            <Entry icon={ChevronsLeftRight} label={col.collapsed ? "Étendre" : "Réduire"} onClick={() => { close(); api.setCollapsed(col.key, !col.collapsed); }} />
            <Entry icon={WrapText} label="Retour à la ligne" checked={!!col.wrap} onClick={() => api.setWrap(col.key, !col.wrap)} />
            <Entry icon={Layers} label="Grouper par" disabled={!groupable} onClick={() => { close(); onGroupBy(groupBy === col.key ? "" : col.key); }} checked={groupBy === col.key} />
            <Sep />
            <Entry icon={ArrowLeft} label="Déplacer à gauche" disabled={col.key === "name"} onClick={() => api.moveBy(col.key, -1)} />
            <Entry icon={ArrowRight} label="Déplacer à droite" disabled={col.key === "name"} onClick={() => api.moveBy(col.key, 1)} />
            <Sep />
            <Entry icon={Copy} label="Dupliquer la colonne" disabled={!duplicable} onClick={() => { close(); onDuplicate(col); }} />
            <Entry icon={Plus} label="Ajouter une colonne à droite" more onClick={() => setPanel("add")} />
            <Entry icon={Repeat} label="Changer le type de colonne" more disabled={!col.custom} onClick={() => setPanel("type")} />
            <Sep />
            <Entry icon={Pencil} label="Renommer" onClick={() => { setTitle(col.title); setPanel("rename"); }} />
            <Entry
              icon={Archive}
              label="Archiver la colonne (gardée 60 jours)"
              disabled={col.key === "name"}
              onClick={() => {
                if (confirm(`Archiver la colonne « ${col.title} » ? Elle disparaît du tableau mais reste 60 jours dans la Corbeille : vous pourrez la réactiver avec toutes ses valeurs.`)) {
                  close();
                  api.remove(col.key, "archive");
                }
              }}
            />
            <Entry
              icon={Trash2}
              label="Supprimer (corbeille 30 jours)"
              danger
              disabled={col.key === "name"}
              onClick={() => {
                if (confirm(`Supprimer la colonne « ${col.title} » ? Elle va dans la Corbeille pendant 30 jours : vous pourrez la réactiver avec toutes ses valeurs.`)) {
                  close();
                  api.remove(col.key, "delete");
                }
              }}
            />
          </>
        )}

        {panel === "settings" && (
          <div className="p-2 space-y-3">
            <p className="text-sm font-bold">Paramètres de la colonne</p>
            {col.custom && col.type === "status" && (
              <div>
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Étiquettes</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {(col.options ?? []).map((o, i) => (
                    <div key={o.key} className="flex items-center gap-1.5">
                      <select
                        value={o.hex}
                        onChange={(e) => api.setOptions(col.key, (col.options ?? []).map((x, k) => (k === i ? { ...x, hex: e.target.value } : x)))}
                        className="w-9 h-7 rounded border border-gray-200 text-transparent"
                        style={{ background: o.hex }}
                      >
                        {GROUP_COLORS.map((c) => (
                          <option key={c} value={c} style={{ background: c }}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <input
                        value={o.label}
                        onChange={(e) => api.setOptions(col.key, (col.options ?? []).map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))}
                        className="flex-1 min-w-0 text-sm border border-gray-200 rounded-md px-2 py-1"
                      />
                      <button onClick={() => api.setOptions(col.key, (col.options ?? []).filter((_, k) => k !== i))} aria-label="Retirer" className="text-gray-400 hover:text-red-600">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => api.setOptions(col.key, [...(col.options ?? []), { key: `o_${Math.random().toString(36).slice(2, 6)}`, label: "Nouvelle étiquette", hex: GROUP_COLORS[(col.options?.length ?? 0) % GROUP_COLORS.length] }])}
                  className="mt-2 text-xs font-bold text-[#0073ea] inline-flex items-center gap-1"
                >
                  <Plus size={12} /> Ajouter une étiquette
                </button>
              </div>
            )}
            <p className="text-[11px] text-gray-400">
              {col.custom ? "Colonne ajoutée par l'équipe." : "Colonne d'origine (reprise de Monday)."} Type : {ADD_TYPES.find((t) => t.type === col.type)?.label ?? col.type}.
            </p>
          </div>
        )}

        {panel === "filter" && (
          <div className="p-1">
            <p className="text-sm font-bold px-1.5 py-1">Filtrer « {col.title.replace(/^\S+\s/, "")} »</p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filterItems().map((it) => (
                <button
                  key={it.value || "__empty"}
                  onClick={() => toggle(it.value)}
                  className={`w-full flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md text-left ${selected.includes(it.value) ? "bg-[#cce5ff] text-[#0a3d7a] font-semibold" : "bg-gray-100 hover:bg-gray-200"}`}
                >
                  {it.hex && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.hex }} />}
                  <span className="truncate flex-1">{it.label}</span>
                  <span className="text-gray-400">{it.count}</span>
                </button>
              ))}
            </div>
            {selected.length > 0 && (
              <button onClick={() => onFilters(filters.filter((f) => !(f.col === col.key && f.op === op)))} className="mt-2 text-xs font-semibold text-gray-500 px-1.5">
                Effacer ce filtre
              </button>
            )}
          </div>
        )}

        {panel === "sort" && (
          <>
            <Entry icon={ArrowDownAZ} label="Croissant (A → Z)" checked={sortNow === "asc"} onClick={() => { close(); onSorts([{ col: col.key, dir: "asc" }]); }} />
            <Entry icon={ArrowUpAZ} label="Décroissant (Z → A)" checked={sortNow === "desc"} onClick={() => { close(); onSorts([{ col: col.key, dir: "desc" }]); }} />
            <Entry icon={X} label="Aucun tri" disabled={!sortNow} onClick={() => { close(); onSorts(sorts.filter((s) => s.col !== col.key)); }} />
          </>
        )}

        {panel === "add" && (
          <>
            <p className="text-[11px] font-semibold text-gray-400 px-2.5 py-1">Ajouter une colonne à droite</p>
            <AddTypeList onPick={(t) => { close(); api.addAfter(col.key, t); }} />
          </>
        )}

        {panel === "type" && (
          <>
            <p className="text-[11px] font-semibold text-gray-400 px-2.5 py-1">Changer le type</p>
            {ADD_TYPES.filter((t) => CUSTOM_TYPES.includes(t.type)).map((t) => (
              <button key={t.type} onClick={() => { close(); api.setType(col.key, t.type); }} className="w-full flex items-center gap-2.5 text-sm px-2.5 py-1.5 rounded-md hover:bg-gray-100">
                <span className="w-5 h-5 rounded text-white text-[11px] font-bold flex items-center justify-center" style={{ background: t.color }}>
                  {t.letter}
                </span>
                <span className="flex-1 text-left">{t.label}</span>
                {col.type === t.type && <Check size={14} className="text-[#0073ea]" />}
              </button>
            ))}
          </>
        )}

        {panel === "rename" && (
          <div className="p-2">
            <span className="block text-[11px] font-semibold text-gray-500 mb-1">Nom de la colonne</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) {
                  api.rename(col.key, title.trim());
                  close();
                }
              }}
              className="w-full text-sm border-2 border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#0073ea]"
            />
            <button
              onClick={() => {
                if (title.trim()) api.rename(col.key, title.trim());
                close();
              }}
              className="mt-2 w-full text-sm font-bold text-white bg-[#0073ea] rounded-lg py-1.5"
            >
              Renommer
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
