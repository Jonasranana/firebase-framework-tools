import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Columns3,
  GripVertical,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
import { REQUIRED_LEAD_DOCS } from "@/lib/crmDocs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  GROUP_COLORS,
  groupOf,
  type LeadGroup,
  formatShortDate,
  isClosedStatus,
  telHref,
  todayYmd,
  whatsappHref,
  type Lead,
} from "@/lib/crm";
import {
  DEFAULT_VISIBLE,
  LEAD_COLUMNS,
  cellPatch,
  cellValue,
  formulaValue,
  type LeadColumn,
} from "@/lib/crmColumns";

// ─────────────────────────────────────────────────────────────────────────
// Vue « Tableau » façon Monday : mêmes colonnes que le tableau « Pac Pac »
// (voir lib/crmColumns.ts), groupes repliables, cellules modifiables en un
// clic, statuts en pastilles pleines, ligne « + Ajouter un lead », menu
// « Colonnes » pour afficher/masquer. Le nom reste collé à gauche.
// ─────────────────────────────────────────────────────────────────────────

const GROUP_PAGE = 40;
const COLS_STORAGE = "crm-leads-columns";

// Cellule texte : s'édite au clic, Entrée ou clic ailleurs enregistre, Échap annule.
export const EditableCell = ({
  value,
  onSave,
  type = "text",
  placeholder = "",
}: {
  value: string;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };
  if (editing) {
    return (
      <input
        ref={ref}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="w-full h-full px-2 text-sm bg-white outline outline-2 outline-[#579bfc] rounded-sm"
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full h-full px-2 text-left text-sm text-gray-700 truncate hover:bg-gray-100"
      title={value}
    >
      {value || <span className="text-gray-300">{placeholder}</span>}
    </button>
  );
};

export type StatusOption = { key: string; label: string; hex: string };

export const StatusCell = ({
  status,
  options,
  onChange,
  clearable,
}: {
  status: string;
  options: readonly StatusOption[];
  onChange: (s: string) => void;
  clearable?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const s = options.find((o) => o.key === status);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-full h-full text-sm font-semibold text-white truncate px-2 hover:brightness-95"
          style={{ background: s ? s.hex : "#c4c4c4" }}
        >
          {s?.label ?? ""}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2 space-y-1.5 max-h-80 overflow-y-auto bg-white text-gray-900 border border-gray-200 shadow-xl" align="start">
        {options
          .filter((o) => o.label !== "")
          .map((o) => (
            <button
              key={o.key}
              onClick={() => {
                setOpen(false);
                onChange(o.key);
              }}
              className="w-full text-sm font-semibold text-white py-1.5 rounded hover:brightness-95"
              style={{ background: o.hex }}
            >
              {o.label}
            </button>
          ))}
        {(clearable || options.some((o) => o.label === "")) && (
          <button
            onClick={() => {
              setOpen(false);
              onChange(options.find((o) => o.label === "")?.key ?? "");
            }}
            className="w-full text-xs font-semibold text-gray-500 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
          >
            Vider
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};

// Texte long (résumé d'appel…) : s'affiche sur une ligne, s'édite dans une fenêtre.
const LongTextCell = ({ value, onSave }: { value: string; onSave: (v: string) => void }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Popover onOpenChange={(o) => !o && draft.trim() !== value && onSave(draft.trim())}>
      <PopoverTrigger asChild>
        <button className="w-full h-full px-2 text-left text-sm text-gray-700 truncate hover:bg-gray-100" title={value}>
          {value}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-2 bg-white text-gray-900 border border-gray-200 shadow-xl" align="start">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          className="w-full text-sm bg-white text-gray-900 border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-[#579bfc]"
        />
      </PopoverContent>
    </Popover>
  );
};

const AddRow = ({ color, onAdd }: { color: string; onAdd: (name: string) => void }) => {
  const [v, setV] = useState("");
  return (
    <div className="border-t border-gray-100 h-9 flex">
      <div className="sticky left-0 z-10 bg-white flex items-center gap-2 px-2" style={{ borderLeft: `6px solid ${color}`, width: 300 }}>
        <Plus size={14} className="text-gray-400 shrink-0" />
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && v.trim()) {
              onAdd(v.trim());
              setV("");
            }
          }}
          placeholder="Ajouter un lead (nom + Entrée)"
          className="w-full text-sm bg-transparent outline-none placeholder:text-gray-400"
        />
      </div>
    </div>
  );
};

const newGroupId = () => `g_${Math.random().toString(36).slice(2, 8)}`;

// Menu d'un groupe : renommer, colorer, déplacer, supprimer.
const GroupMenu = ({
  group,
  index,
  total,
  count,
  onChange,
  onMove,
  onDelete,
}: {
  group: LeadGroup;
  index: number;
  total: number;
  count: number;
  onChange: (patch: Partial<LeadGroup>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) => {
  const [title, setTitle] = useState(group.title);
  useEffect(() => setTitle(group.title), [group.title]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Options du groupe"
          className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 opacity-0 group-hover/head:opacity-100 focus:opacity-100"
        >
          <MoreHorizontal size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3 space-y-3 bg-white text-gray-900 border border-gray-200 shadow-xl" align="start">
        <div>
          <span className="block text-[11px] font-semibold text-gray-500 mb-1">Nom du groupe</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== group.title && onChange({ title: title.trim() })}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-full text-sm bg-white text-gray-900 border-2 border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#579bfc]"
          />
        </div>
        <div>
          <span className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur</span>
          <div className="grid grid-cols-6 gap-1.5">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ color: c })}
                aria-label={`Couleur ${c}`}
                className={`h-6 rounded ${group.color === c ? "ring-2 ring-offset-1 ring-gray-700" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold bg-white text-gray-700 border border-gray-200 rounded-lg py-1.5 disabled:opacity-30"
          >
            <ArrowUp size={13} /> Monter
          </button>
          <button
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold bg-white text-gray-700 border border-gray-200 rounded-lg py-1.5 disabled:opacity-30"
          >
            <ArrowDown size={13} /> Descendre
          </button>
        </div>
        <button
          disabled={total <= 1}
          onClick={() => {
            const msg = count
              ? `Supprimer « ${group.title} » ? Ses ${count} lead${count > 1 ? "s" : ""} passeront dans le premier groupe.`
              : `Supprimer le groupe « ${group.title} » ?`;
            if (confirm(msg)) onDelete();
          }}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-white text-red-600 border border-red-200 rounded-lg py-1.5 disabled:opacity-30"
        >
          <Trash2 size={13} /> Supprimer le groupe
        </button>
      </PopoverContent>
    </Popover>
  );
};


const colsTemplate = (cols: LeadColumn[]) => cols.map((c) => `${c.width}px`).join(" ");

// Colonnes affichées : choix mémorisé sur l'appareil.
function useVisibleColumns() {
  const [visible, setVisible] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(COLS_STORAGE) ?? "null");
      if (Array.isArray(v) && v.includes("name")) return v;
    } catch {
      /* préférence non essentielle */
    }
    return DEFAULT_VISIBLE;
  });
  const set = (v: string[]) => {
    setVisible(v);
    try {
      localStorage.setItem(COLS_STORAGE, JSON.stringify(v));
    } catch {
      /* non essentiel */
    }
  };
  return [visible, set] as const;
}

export const ColumnsMenu = ({ visible, onChange }: { visible: string[]; onChange: (v: string[]) => void }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border bg-white text-gray-600 border-gray-200">
        <Columns3 size={13} /> Colonnes ({visible.length}/{LEAD_COLUMNS.length})
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-64 p-2 max-h-96 overflow-y-auto bg-white text-gray-900 border border-gray-200 shadow-xl" align="start">
      <div className="flex gap-2 mb-2">
        <button onClick={() => onChange(DEFAULT_VISIBLE)} className="flex-1 text-xs font-semibold border border-gray-200 rounded py-1">
          Tout afficher
        </button>
        <button
          onClick={() => onChange(["name", "status", "rappel", "commercial", "phone", "email", "cp", "docs"])}
          className="flex-1 text-xs font-semibold border border-gray-200 rounded py-1"
        >
          Essentiel
        </button>
      </div>
      {LEAD_COLUMNS.map((c) => (
        <label key={c.key} className="flex items-center gap-2 text-xs py-1 px-1 hover:bg-gray-50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={visible.includes(c.key)}
            disabled={c.key === "name"}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? LEAD_COLUMNS.map((x) => x.key).filter((k) => visible.includes(k) || k === c.key)
                  : visible.filter((k) => k !== c.key),
              )
            }
          />
          {c.title}
        </label>
      ))}
    </PopoverContent>
  </Popover>
);

const today = todayYmd();

function Cell({
  lead,
  col,
  onPatch,
  onStatus,
}: {
  lead: Lead;
  col: LeadColumn;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onStatus: (id: string, status: string) => void;
}) {
  const v = cellValue(lead, col);
  const save = (val: string) => onPatch(lead.id, cellPatch(col, val));
  switch (col.type) {
    case "status":
      return (
        <StatusCell
          status={v}
          options={col.options ?? []}
          clearable={col.key !== "status"}
          onChange={(k) => (col.key === "status" ? onStatus(lead.id, k) : save(k))}
        />
      );
    case "text":
      return <EditableCell value={v} onSave={save} />;
    case "longtext":
      return <LongTextCell value={v} onSave={save} />;
    case "email":
      return <EditableCell value={v} type="email" onSave={(x) => save(x.toLowerCase())} />;
    case "number":
      return (
        <div className="flex items-center h-full">
          <div className="flex-1 min-w-0 h-full">
            <EditableCell value={v} type="number" onSave={save} />
          </div>
          {v && col.unit && <span className="pr-2 text-xs text-gray-400">{col.unit}</span>}
        </div>
      );
    case "date": {
      const overdue = col.key === "rappel" && v && v <= today && !isClosedStatus(lead.status);
      return (
        <input
          type="date"
          value={v}
          onChange={(e) => save(e.target.value)}
          className={`w-full h-full px-2 text-xs bg-transparent outline-none cursor-pointer ${
            !v
              ? "text-transparent hover:text-gray-400 focus:text-gray-600"
              : overdue
                ? "text-red-600 font-semibold"
                : "text-gray-600"
          }`}
        />
      );
    }
    case "formula": {
      const f = formulaValue(lead, col);
      return (
        <div className={`flex items-center h-full px-2 text-sm truncate ${f.startsWith("🔥") ? "font-bold text-orange-600" : "text-gray-700"}`} title={f}>
          {f}
        </div>
      );
    }
    case "files":
      return (
        <div className="flex items-center h-full px-2 text-xs" title={lead.docCats.join(", ") || "Aucun document"}>
          {lead.docCount > 0 ? (
            <span
              className={`inline-flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded-full ${
                REQUIRED_LEAD_DOCS.every((c) => lead.docCats.includes(c)) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              <Paperclip size={11} /> {lead.docCount}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </div>
      );
    case "autodate":
      return (
        <div className="flex items-center h-full px-2 text-xs text-gray-500">
          {formatShortDate(col.key === "creation" ? lead.createdAt : lead.updatedAt)}
        </div>
      );
    default:
      return null;
  }
}

export default function LeadsTable({
  leads,
  groups,
  onGroupsChange,
  onOpen,
  onStatus,
  onGroup,
  onPatch,
  onCreate,
  visible,
  setVisible,
}: {
  leads: Lead[];
  groups: LeadGroup[];
  onGroupsChange: (groups: LeadGroup[]) => void;
  onOpen: (id: string) => void;
  onStatus: (id: string, status: any) => void;
  onGroup: (id: string, groupId: string) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onCreate: (groupId: string, name: string) => void;
  visible: string[];
  setVisible: (v: string[]) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [dropOver, setDropOver] = useState<string | null>(null);

  const cols = useMemo(() => LEAD_COLUMNS.filter((c) => visible.includes(c.key)), [visible]);
  const template = colsTemplate(cols);
  const totalWidth = cols.reduce((n, c) => n + c.width, 0) + 8;

  const patchGroup = (id: string, patch: Partial<LeadGroup>) =>
    onGroupsChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const moveGroup = (i: number, dir: -1 | 1) => {
    const next = [...groups];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onGroupsChange(next);
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div style={{ minWidth: totalWidth }} className="space-y-6">
        {groups.map((st, gi) => {
          const rows = leads.filter((l) => groupOf(l, groups).id === st.id);
          const isCollapsed = collapsed[st.id];
          const limit = limits[st.id] ?? GROUP_PAGE;
          return (
            <section
              key={st.id}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes("text/lead-id")) return;
                e.preventDefault();
                setDropOver(st.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDropOver(null);
                const id = e.dataTransfer.getData("text/lead-id");
                if (id) onGroup(id, st.id);
              }}
              className={`rounded-lg transition-colors ${dropOver === st.id ? "bg-blue-50 ring-2 ring-[#579bfc]" : ""}`}
            >
              <div className="group/head flex items-center gap-1 mb-1 px-1 sticky left-0">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [st.id]: !c[st.id] }))}
                  className="flex items-center gap-2"
                  style={{ color: st.color }}
                >
                  {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  <span className="text-lg font-bold">{st.title}</span>
                  <span className="text-xs font-normal text-gray-400">
                    {rows.length} lead{rows.length > 1 ? "s" : ""}
                  </span>
                </button>
                <GroupMenu
                  group={st}
                  index={gi}
                  total={groups.length}
                  count={rows.length}
                  onChange={(patch) => patchGroup(st.id, patch)}
                  onMove={(dir) => moveGroup(gi, dir)}
                  onDelete={() => onGroupsChange(groups.filter((g) => g.id !== st.id))}
                />
              </div>

              {!isCollapsed && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div
                    className="grid text-xs font-semibold text-gray-500 bg-white border-b border-gray-200 h-8 items-center"
                    style={{ gridTemplateColumns: template }}
                  >
                    {cols.map((c, i) => (
                      <div
                        key={c.key}
                        className={`px-2 border-l border-gray-100 truncate ${i === 0 ? "sticky left-0 z-10 bg-white" : ""}`}
                        style={i === 0 ? { borderLeft: `6px solid ${st.color}` } : undefined}
                        title={c.title}
                      >
                        {c.title}
                      </div>
                    ))}
                  </div>

                  {rows.slice(0, limit).map((l) => (
                    <div
                      key={l.id}
                      className="group grid items-stretch border-b border-gray-100 h-9 hover:bg-gray-50"
                      style={{ gridTemplateColumns: template }}
                    >
                      {cols.map((c, i) =>
                        c.type === "name" ? (
                          <div
                            key={c.key}
                            className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 flex items-center gap-1 pr-1"
                            style={{ borderLeft: `6px solid ${st.color}` }}
                          >
                            <span
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/lead-id", l.id);
                                e.dataTransfer.effectAllowed = "move";
                                const row = (e.currentTarget as HTMLElement).closest(".group");
                                if (row) e.dataTransfer.setDragImage(row, 20, 16);
                              }}
                              title="Glisser vers un autre groupe"
                              className="shrink-0 cursor-grab text-gray-300 hover:text-gray-500 pl-0.5"
                            >
                              <GripVertical size={14} />
                            </span>
                            <div className="flex-1 min-w-0 h-full">
                              <EditableCell value={l.name} placeholder="Sans nom" onSave={(v) => onPatch(l.id, { name: v })} />
                            </div>
                            {l.mailNonLu && (
                              <button
                                onClick={() => onOpen(l.id)}
                                title="Le client a répondu par mail : cliquez pour lire"
                                className="shrink-0 text-[#579bfc]"
                              >
                                <Mail size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => onOpen(l.id)}
                              className="shrink-0 text-[11px] font-semibold text-[#579bfc] border border-[#579bfc]/40 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              Ouvrir
                            </button>
                          </div>
                        ) : c.type === "phone" ? (
                          <div key={c.key} className="border-l border-gray-100 flex items-center min-w-0">
                            <div className="flex-1 min-w-0 h-full">
                              <EditableCell value={l.phone} type="tel" onSave={(v) => onPatch(l.id, { phone: v })} />
                            </div>
                            {telHref(l.phone) && (
                              <span className="flex gap-1 pr-1 shrink-0 opacity-0 group-hover:opacity-100">
                                <a href={telHref(l.phone)} aria-label="Appeler" className="text-[#2b5a8f]">
                                  <Phone size={14} />
                                </a>
                                <a href={whatsappHref(l.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="text-green-600">
                                  <MessageCircle size={14} />
                                </a>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div key={c.key} className={`${i === 0 ? "" : "border-l"} border-gray-100 min-w-0`}>
                            <Cell lead={l} col={c} onPatch={onPatch} onStatus={onStatus} />
                          </div>
                        ),
                      )}
                    </div>
                  ))}

                  {rows.length > limit && (
                    <button
                      onClick={() => setLimits((m) => ({ ...m, [st.id]: limit + GROUP_PAGE }))}
                      className="w-full text-xs font-semibold text-[#579bfc] py-2 border-b border-gray-100 sticky left-0"
                    >
                      Afficher plus ({rows.length - limit} restants)
                    </button>
                  )}

                  <AddRow color={st.color} onAdd={(name) => onCreate(st.id, name)} />
                </div>
              )}
            </section>
          );
        })}

        <button
          onClick={() =>
            onGroupsChange([
              ...groups,
              { id: newGroupId(), title: "Nouveau groupe", color: GROUP_COLORS[groups.length % GROUP_COLORS.length] },
            ])
          }
          className="sticky left-0 inline-flex items-center gap-1.5 text-sm font-bold text-[#579bfc] border-2 border-dashed border-[#579bfc]/40 rounded-lg px-4 py-2 hover:bg-blue-50"
        >
          <Plus size={16} /> Ajouter un groupe
        </button>
      </div>
    </div>
  );
}

export { useVisibleColumns };
