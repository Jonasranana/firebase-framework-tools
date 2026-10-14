import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsDownUp,
  ChevronsUp,
  ChevronsUpDown,
  Columns3,
  Copy,
  EyeOff,
  FolderPlus,
  MessageSquare,
  MoveVertical,
  Palette,
  Pencil,
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

const AddRow = ({ color, onAdd, focus }: { color: string; onAdd: (name: string) => void; focus?: boolean }) => {
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <div className="border-t border-gray-100 h-9 flex">
      <div className="sticky left-0 z-10 bg-white flex items-center gap-2 px-2" style={{ borderLeft: `6px solid ${color}`, width: 300 }}>
        <Plus size={14} className="text-gray-400 shrink-0" />
        <input
          ref={ref}
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

// Menu d'un groupe (les trois petits points), comme dans Monday : ajouter un
// lead, réduire, ajouter/dupliquer/déplacer/renommer/colorer/supprimer/archiver.
const GroupMenu = ({
  group,
  index,
  total,
  count,
  collapsed,
  onToggle,
  onCollapseAll,
  onExpandAll,
  onAddLead,
  onAddGroup,
  onDuplicate,
  onChange,
  onMove,
  onDelete,
  onArchive,
}: {
  group: LeadGroup;
  index: number;
  total: number;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onAddLead: () => void;
  onAddGroup: () => void;
  onDuplicate: () => void;
  onChange: (patch: Partial<LeadGroup>) => void;
  onMove: (to: "top" | "up" | "down" | "bottom") => void;
  onDelete: () => void;
  onArchive: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"" | "rename" | "color" | "move">("");
  const [title, setTitle] = useState(group.title);
  useEffect(() => setTitle(group.title), [group.title]);
  const close = () => {
    setOpen(false);
    setPanel("");
  };
  const Item = ({ icon: Icon, label, onClick, danger, disabled }: { icon: any; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) => (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 text-left text-sm px-2.5 py-1.5 rounded-md disabled:opacity-30 ${
        danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <Icon size={15} className="shrink-0" /> {label}
    </button>
  );
  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          aria-label="Options du groupe"
          className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 opacity-0 group-hover/head:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5 bg-white text-gray-900 border border-gray-200 shadow-xl" align="start">
        {panel === "" && (
          <>
            <Item icon={Plus} label="Ajouter un lead au groupe" onClick={() => { close(); onAddLead(); }} />
            <Item icon={collapsed ? ChevronDown : ChevronRight} label={collapsed ? "Développer ce groupe" : "Réduire ce groupe"} onClick={() => { close(); onToggle(); }} />
            <Item icon={ChevronsDownUp} label="Réduire tous les groupes" onClick={() => { close(); onCollapseAll(); }} />
            <Item icon={ChevronsUpDown} label="Développer tous les groupes" onClick={() => { close(); onExpandAll(); }} />
            <div className="my-1 border-t border-gray-100" />
            <Item icon={FolderPlus} label="Ajouter un groupe" onClick={() => { close(); onAddGroup(); }} />
            <Item icon={Copy} label="Dupliquer ce groupe" onClick={() => { close(); onDuplicate(); }} />
            <Item icon={MoveVertical} label="Déplacer ce groupe" onClick={() => setPanel("move")} />
            <Item icon={Pencil} label="Renommer ce groupe" onClick={() => setPanel("rename")} />
            <Item icon={Palette} label="Modifier la couleur du groupe" onClick={() => setPanel("color")} />
            <div className="my-1 border-t border-gray-100" />
            <Item icon={Archive} label="Archiver ce groupe" onClick={() => { close(); onArchive(); }} disabled={total <= 1} />
            <Item
              icon={Trash2}
              label="Supprimer ce groupe"
              danger
              disabled={total <= 1}
              onClick={() => {
                const msg = count
                  ? `Supprimer « ${group.title} » ? Ses ${count} lead${count > 1 ? "s" : ""} passeront dans le premier groupe.`
                  : `Supprimer le groupe « ${group.title} » ?`;
                if (confirm(msg)) {
                  close();
                  onDelete();
                }
              }}
            />
          </>
        )}
        {panel === "rename" && (
          <div className="p-1.5">
            <span className="block text-[11px] font-semibold text-gray-500 mb-1">Nom du groupe</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) {
                  onChange({ title: title.trim() });
                  close();
                }
              }}
              className="w-full text-sm bg-white text-gray-900 border-2 border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#579bfc]"
            />
            <button
              onClick={() => {
                if (title.trim()) onChange({ title: title.trim() });
                close();
              }}
              className="mt-2 w-full text-sm font-bold text-white bg-[#2b5a8f] rounded-lg py-1.5"
            >
              Renommer
            </button>
          </div>
        )}
        {panel === "color" && (
          <div className="p-1.5">
            <span className="block text-[11px] font-semibold text-gray-500 mb-1">Couleur du groupe</span>
            <div className="grid grid-cols-6 gap-1.5">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    onChange({ color: c });
                    close();
                  }}
                  aria-label={`Couleur ${c}`}
                  className={`h-6 rounded ${group.color === c ? "ring-2 ring-offset-1 ring-gray-700" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        )}
        {panel === "move" && (
          <div className="p-1">
            <Item icon={ChevronsUp} label="Tout en haut" disabled={index === 0} onClick={() => { close(); onMove("top"); }} />
            <Item icon={ArrowUp} label="Monter d'un cran" disabled={index === 0} onClick={() => { close(); onMove("up"); }} />
            <Item icon={ArrowDown} label="Descendre d'un cran" disabled={index === total - 1} onClick={() => { close(); onMove("down"); }} />
            <Item icon={ChevronsDown} label="Tout en bas" disabled={index === total - 1} onClick={() => { close(); onMove("bottom"); }} />
          </div>
        )}
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
      <button
        className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1.5 rounded-md hover:bg-gray-100 data-[state=open]:bg-gray-100 ${
          visible.length < LEAD_COLUMNS.length ? "bg-[#e5efff] text-[#1f4f8f]" : "text-gray-700"
        }`}
      >
        <EyeOff size={15} /> Masquer{visible.length < LEAD_COLUMNS.length ? ` / ${LEAD_COLUMNS.length - visible.length}` : ""}
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
  onDuplicateLeads,
  groupKeyOf,
  readOnlyGroups,
  visible,
  setVisible,
}: {
  // Groupement automatique par une colonne (sinon : groupes personnalisés).
  groupKeyOf?: (l: Lead) => string;
  readOnlyGroups?: boolean;
  leads: Lead[];
  groups: LeadGroup[];
  onGroupsChange: (groups: LeadGroup[]) => void;
  onOpen: (id: string, focus?: "updates") => void;
  onStatus: (id: string, status: any) => void;
  onGroup: (id: string, groupId: string) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onCreate: (groupId: string, name: string) => void;
  // Copie les leads d'un groupe dans un autre (duplication d'un groupe).
  onDuplicateLeads: (fromGroupId: string, toGroupId: string) => void;
  visible: string[];
  setVisible: (v: string[]) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [dropOver, setDropOver] = useState<string | null>(null);

  const cols = useMemo(() => LEAD_COLUMNS.filter((c) => visible.includes(c.key)), [visible]);
  const template = colsTemplate(cols);
  const totalWidth = cols.reduce((n, c) => n + c.width, 0) + 8;

  const [focusAdd, setFocusAdd] = useState<string | null>(null);
  const visibleGroups = groups.filter((g) => !g.archived);
  const archived = groups.filter((g) => g.archived);

  const patchGroup = (id: string, patch: Partial<LeadGroup>) =>
    onGroupsChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const moveGroup = (id: string, to: "top" | "up" | "down" | "bottom") => {
    const vis = groups.filter((g) => !g.archived).map((g) => g.id);
    const pos = vis.indexOf(id);
    if (pos < 0) return;
    const rest = vis.filter((x) => x !== id);
    const dest = to === "top" ? 0 : to === "bottom" ? rest.length : to === "up" ? Math.max(0, pos - 1) : Math.min(rest.length, pos + 1);
    rest.splice(dest, 0, id);
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
    onGroupsChange([...rest.map((x) => byId[x]), ...groups.filter((g) => g.archived)]);
  };

  const addGroupAfter = (id: string) => {
    const i = groups.findIndex((g) => g.id === id);
    const g: LeadGroup = { id: newGroupId(), title: "Nouveau groupe", color: GROUP_COLORS[groups.length % GROUP_COLORS.length] };
    const next = [...groups];
    next.splice(i + 1, 0, g);
    onGroupsChange(next);
  };

  const duplicateGroup = (src: LeadGroup, count: number) => {
    const copyLeads = count > 0 && confirm(`Dupliquer aussi les ${count} lead${count > 1 ? "s" : ""} de « ${src.title} » ?\n\nOK = avec les leads, Annuler = groupe vide.`);
    const copy: LeadGroup = { id: newGroupId(), title: `${src.title} (copie)`, color: src.color };
    const i = groups.findIndex((g) => g.id === src.id);
    const next = [...groups];
    next.splice(i + 1, 0, copy);
    onGroupsChange(next);
    if (copyLeads) onDuplicateLeads(src.id, copy.id);
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div style={{ minWidth: totalWidth }} className="space-y-6">
        <div className="sticky left-0 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCollapsed(Object.fromEntries(groups.map((g) => [g.id, true])))}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border bg-white text-gray-600 border-gray-200"
          >
            <ChevronsDownUp size={13} /> Réduire tous les groupes
          </button>
          <button
            onClick={() => setCollapsed({})}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border bg-white text-gray-600 border-gray-200"
          >
            <ChevronsUpDown size={13} /> Développer tout
          </button>
          {archived.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border bg-white text-gray-600 border-gray-200">
                  <Archive size={13} /> Groupes archivés ({archived.length})
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-2 bg-white text-gray-900 border border-gray-200 shadow-xl">
                {archived.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 px-1.5 py-1.5">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: g.color }} />
                    <span className="flex-1 text-sm truncate">{g.title}</span>
                    <button
                      onClick={() => patchGroup(g.id, { archived: false })}
                      className="text-xs font-bold text-[#2b5a8f]"
                    >
                      Restaurer
                    </button>
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>
        {visibleGroups.map((st, gi) => {
          const rows = leads.filter((l) => (groupKeyOf ? groupKeyOf(l) : groupOf(l, groups).id) === st.id);
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
                {!readOnlyGroups && (
                <GroupMenu
                  group={st}
                  index={gi}
                  total={visibleGroups.length}
                  count={rows.length}
                  collapsed={!!isCollapsed}
                  onToggle={() => setCollapsed((c) => ({ ...c, [st.id]: !c[st.id] }))}
                  onCollapseAll={() => setCollapsed(Object.fromEntries(groups.map((g) => [g.id, true])))}
                  onExpandAll={() => setCollapsed({})}
                  onAddLead={() => {
                    setCollapsed((c) => ({ ...c, [st.id]: false }));
                    setFocusAdd(null);
                    setTimeout(() => setFocusAdd(st.id), 50);
                  }}
                  onAddGroup={() => addGroupAfter(st.id)}
                  onDuplicate={() => duplicateGroup(st, rows.length)}
                  onChange={(patch) => patchGroup(st.id, patch)}
                  onMove={(to) => moveGroup(st.id, to)}
                  onDelete={() => onGroupsChange(groups.filter((g) => g.id !== st.id))}
                  onArchive={() => patchGroup(st.id, { archived: true })}
                />
                )}
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
                              draggable={!readOnlyGroups}
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
                            {(() => {
                              const n = l.notes.filter((x) => x.kind === "note" || x.kind === "mail").length;
                              return (
                                <button
                                  onClick={() => onOpen(l.id, "updates")}
                                  title={n ? `${n} mise${n > 1 ? "s" : ""} à jour : cliquez pour lire ou écrire` : "Ajouter une mise à jour"}
                                  className={`shrink-0 relative p-1 rounded ${n ? "text-[#579bfc]" : "text-gray-300 hover:text-gray-500"}`}
                                >
                                  <MessageSquare size={16} fill={n ? "currentColor" : "none"} />
                                  {n > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-[#ff5ac4] text-white text-[9px] font-bold flex items-center justify-center">
                                      {n > 99 ? "99+" : n}
                                    </span>
                                  )}
                                </button>
                              );
                            })()}
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

                  {!readOnlyGroups && <AddRow color={st.color} focus={focusAdd === st.id} onAdd={(name) => onCreate(st.id, name)} />}
                </div>
              )}
            </section>
          );
        })}

        {!readOnlyGroups && (
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
        )}
      </div>
    </div>
  );
}

export { useVisibleColumns };
