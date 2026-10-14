import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import StatusLabelEditor from "./StatusLabelEditor";
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
import { LEAD_STATUSES } from "@/lib/crm";
import { useTeam } from "@/lib/crmTeam";
import { AddTypeList } from "./ColumnMenu";
import type { ColType } from "@/lib/crmColumns";
import Avatar from "@/components/Avatar";
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

const GROUP_PAGE = 100;
const COLS_STORAGE = "crm-leads-columns";

// Cellule texte : s'édite au clic, Entrée ou clic ailleurs enregistre, Échap annule.
export const EditableCell = ({
  value,
  onSave,
  type = "text",
  placeholder = "",
  wrap = false,
}: {
  value: string;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
  wrap?: boolean;
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
      className={`w-full h-full px-2 py-1 text-left text-sm text-gray-700 hover:bg-gray-100 ${wrap ? "whitespace-normal break-words" : "truncate"}`}
      title={value}
    >
      {value || <span className="text-gray-300">{placeholder}</span>}
    </button>
  );
};

export type StatusOption = { key: string; label: string; hex: string };

// Permet à la cellule de statut d'ouvrir l'éditeur d'étiquettes de sa colonne
// (fourni par la page Leads ; absent = pas de bouton « Modifier les étiquettes »).
export const StatusEditContext = createContext<((colKey: string, options: StatusOption[]) => void) | null>(null);

export const StatusCell = ({
  status,
  options,
  onChange,
  clearable,
  onEditLabels,
}: {
  status: string;
  options: readonly StatusOption[];
  onChange: (s: string) => void;
  clearable?: boolean;
  onEditLabels?: (next: StatusOption[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
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
      <PopoverContent
        className={`p-2.5 max-h-96 overflow-y-auto bg-white text-gray-900 border border-gray-200 shadow-xl ${options.length > 8 ? "w-[min(640px,92vw)]" : "w-56"}`}
        align="start"
      >
        <div className="grid gap-1.5" style={{ gridTemplateColumns: options.length > 8 ? "repeat(auto-fill, minmax(140px, 1fr))" : "1fr" }}>
        {options
          .filter((o) => o.label !== "")
          .map((o) => (
            <button
              key={o.key}
              onClick={() => {
                setOpen(false);
                onChange(o.key);
              }}
              className="w-full text-sm font-semibold text-white py-1.5 px-2 rounded truncate hover:brightness-95"
              style={{ background: o.hex }}
              title={o.label}
            >
              {o.label}
            </button>
          ))}
        </div>
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
        {onEditLabels && (
          <button
            onClick={() => {
              setOpen(false);
              setEditing(true);
            }}
            className="w-full mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 py-2 border-t border-gray-100 hover:bg-gray-50"
          >
            <Pencil size={12} /> Modifier les étiquettes
          </button>
        )}
      </PopoverContent>
      {editing && onEditLabels && <StatusLabelEditor options={options} onApply={onEditLabels} onClose={() => setEditing(false)} />}
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


// ── Types de colonnes ajoutées : Personnes, Échéances, Hashtags ───────────
const PeopleCell = ({ value, onSave }: { value: string; onSave: (v: string) => void }) => {
  const team = useTeam();
  const names = Array.from(new Set([...(team ?? []).map((m) => m.name), "Mebarek", "Julien"]));
  const selected = value ? value.split(",").map((x) => x.trim()).filter(Boolean) : [];
  const toggle = (n: string) =>
    onSave((selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n]).join(", "));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full h-full px-2 flex items-center gap-1 hover:bg-gray-100 overflow-hidden">
          {selected.length === 0 && <span className="text-gray-300 text-sm">—</span>}
          {selected.slice(0, 3).map((n) => (
            <Avatar key={n} name={n} photoUrl={team?.find((m) => m.name === n)?.photoUrl} size={22} />
          ))}
          {selected.length > 3 && <span className="text-xs text-gray-500">+{selected.length - 3}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5 bg-white text-gray-900 border border-gray-200 shadow-xl">
        {names.map((n) => (
          <button key={n} onClick={() => toggle(n)} className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded-md hover:bg-gray-100">
            <Avatar name={n} photoUrl={team?.find((m) => m.name === n)?.photoUrl} size={22} />
            <span className="flex-1 text-left truncate">{n}</span>
            {selected.includes(n) && <span className="text-[#0073ea] text-xs font-bold">✓</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

// Échéance : deux dates « du … au … » stockées « AAAA-MM-JJ/AAAA-MM-JJ ».
const TimelineCell = ({ value, onSave }: { value: string; onSave: (v: string) => void }) => {
  const [from = "", to = ""] = value.split("/");
  const set = (f: string, t: string) => onSave(f || t ? `${f}/${t}` : "");
  const label = from || to ? `${formatShortDate(from)}${to ? ` → ${formatShortDate(to)}` : ""}` : "";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full h-full px-2 text-left text-sm hover:bg-gray-100 truncate">
          {label ? (
            <span className="inline-block bg-[#9d50dd] text-white text-xs font-semibold px-2 py-0.5 rounded-full">{label}</span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-3 space-y-2 bg-white text-gray-900 border border-gray-200 shadow-xl">
        <label className="block text-xs font-semibold text-gray-500">
          Début
          <input type="date" value={from} onChange={(e) => set(e.target.value, to)} className="mt-1 w-full text-sm border border-gray-200 rounded-md px-2 py-1" />
        </label>
        <label className="block text-xs font-semibold text-gray-500">
          Fin
          <input type="date" value={to} onChange={(e) => set(from, e.target.value)} className="mt-1 w-full text-sm border border-gray-200 rounded-md px-2 py-1" />
        </label>
        {(from || to) && (
          <button onClick={() => onSave("")} className="text-xs font-semibold text-gray-500 hover:text-red-600">
            Effacer
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};

// Hashtags : mots séparés par des espaces ou des virgules, affichés en pastilles.
const TagsCell = ({ value, onSave }: { value: string; onSave: (v: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const tags = value.split(/[\s,]+/).filter(Boolean);
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const clean = draft.split(/[\s,]+/).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
          if (clean !== value) onSave(clean);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="#mot #autre"
        className="w-full h-full px-2 text-sm bg-white outline outline-2 outline-[#579bfc] rounded-sm"
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)} className="w-full h-full px-2 flex items-center gap-1 hover:bg-gray-100 overflow-hidden">
      {tags.length === 0 && <span className="text-gray-300 text-sm">—</span>}
      {tags.map((t) => (
        <span key={t} className="shrink-0 bg-[#00c875]/15 text-[#037f4c] text-xs font-semibold px-1.5 py-0.5 rounded">
          {t}
        </span>
      ))}
    </button>
  );
};

const colsTemplate = (cols: LeadColumn[]) => cols.map((c) => `${c.width}px`).join(" ");

// Colonnes masquées : choix mémorisé sur l'appareil. On retient les colonnes
// MASQUÉES (et non les affichées) : une colonne ajoutée plus tard apparaît seule.
function useVisibleColumns(version = 0) {
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(COLS_STORAGE) ?? "null");
      if (v && Array.isArray(v.hidden)) return v.hidden;
      // Ancien format : liste des colonnes affichées.
      if (Array.isArray(v)) return LEAD_COLUMNS.map((c) => c.key).filter((k) => !v.includes(k));
    } catch {
      /* préférence non essentielle */
    }
    return [];
  });
  const visible = useMemo(
    () => LEAD_COLUMNS.map((c) => c.key).filter((k) => k === "name" || !hidden.includes(k)),
    [hidden, version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const set = (v: string[]) => {
    const h = LEAD_COLUMNS.map((c) => c.key).filter((k) => k !== "name" && !v.includes(k));
    setHidden(h);
    try {
      localStorage.setItem(COLS_STORAGE, JSON.stringify({ hidden: h }));
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
        <button onClick={() => onChange(LEAD_COLUMNS.map((c) => c.key))} className="flex-1 text-xs font-semibold border border-gray-200 rounded py-1">
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

// Bandeau bien visible sous les lignes d'un groupe : il reste des leads à afficher.
// Les lignes suivantes se chargent aussi toutes seules quand on arrive en bas.
const MoreRows = ({
  shown,
  total,
  color,
  onMore,
  onAll,
}: {
  shown: number;
  total: number;
  color: string;
  onMore: () => void;
  onAll: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && onMore(), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      ref={ref}
      className="sticky left-0 flex flex-wrap items-center justify-center gap-3 px-3 py-3 border-y-2"
      style={{ background: `${color}22`, borderColor: color }}
    >
      <span className="text-sm font-bold text-gray-900">
        ⬇ {shown} leads affichés sur {total} — il en reste {total - shown} dans ce groupe
      </span>
      <button onClick={onMore} className="text-sm font-bold text-white rounded-md px-4 py-1.5 shadow-sm hover:brightness-95" style={{ background: color }}>
        Afficher 300 de plus
      </button>
      <button onClick={onAll} className="text-sm font-bold rounded-md px-4 py-1.5 bg-white border-2 hover:bg-gray-50" style={{ color, borderColor: color }}>
        Tout afficher ({total})
      </button>
    </div>
  );
};

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
  const editLabels = useContext(StatusEditContext);
  const save = (val: string) => onPatch(lead.id, cellPatch(col, val));
  switch (col.type) {
    case "status":
      return (
        <StatusCell
          onEditLabels={editLabels ? (next) => editLabels(col.key, next) : undefined}
          status={v}
          options={col.options ?? []}
          clearable={col.key !== "status"}
          onChange={(k) => (col.key === "status" ? onStatus(lead.id, k) : save(k))}
        />
      );
    case "text":
      return <EditableCell value={v} onSave={save} wrap={col.wrap} />;
    case "longtext":
      return <LongTextCell value={v} onSave={save} />;
    case "people":
      return <PeopleCell value={v} onSave={save} />;
    case "timeline":
      return <TimelineCell value={v} onSave={save} />;
    case "tags":
      return <TagsCell value={v} onSave={save} />;
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
  columnMenu,
  onAddColumn,
  columnsVersion,
  visible,
  setVisible,
  bulk,
}: {
  // Actions groupées sur les lignes cochées (barre en bas).
  bulk?: {
    setStatus: (ids: string[], status: string) => void;
    moveGroup: (ids: string[], groupId: string) => void;
    remove: (ids: string[]) => void;
    exportCsv: (ids: string[]) => void;
  };
  // Menu « ⋯ » du titre de chaque colonne, et ajout d'une colonne à droite.
  columnMenu?: (col: LeadColumn) => React.ReactNode;
  onAddColumn?: (type: ColType) => void;
  columnsVersion?: number;
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
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggleSel = (ids: string[], on: boolean) =>
    setSel((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  const selIds = Array.from(sel).filter((id) => leads.some((l) => l.id === id));

  const cols = useMemo(() => LEAD_COLUMNS.filter((c) => visible.includes(c.key)), [visible, columnsVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const template = `${colsTemplate(cols)} 44px`;
  const totalWidth = cols.reduce((n, c) => n + c.width, 0) + 52;

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
                        className={`group/col px-2 border-l border-gray-100 flex items-center gap-1 min-w-0 ${i === 0 ? "sticky left-0 z-10 bg-white" : ""}`}
                        style={i === 0 ? { borderLeft: `6px solid ${st.color}` } : undefined}
                        title={c.title}
                      >
                        {i === 0 && bulk && (
                          <input
                            type="checkbox"
                            aria-label="Tout sélectionner dans ce groupe"
                            className="h-3.5 w-3.5 shrink-0 cursor-pointer"
                            checked={rows.length > 0 && rows.every((r) => sel.has(r.id))}
                            onChange={(e) => toggleSel(rows.map((r) => r.id), e.target.checked)}
                          />
                        )}
                        <span className="truncate flex-1">{c.title}</span>
                        {columnMenu?.(c)}
                      </div>
                    ))}
                    <div className="border-l border-gray-100 flex items-center justify-center">
                      {onAddColumn && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button aria-label="Ajouter une colonne" className="p-1 rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100">
                              <Plus size={15} />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-56 p-1.5 bg-white text-gray-900 border border-gray-200 shadow-xl">
                            <p className="text-[11px] font-semibold text-gray-400 px-2.5 py-1">Ajout de colonnes</p>
                            <AddTypeList onPick={onAddColumn} />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>

                  {rows.slice(0, limit).map((l) => (
                    <div
                      key={l.id}
                      className={`group grid items-stretch border-b border-gray-100 min-h-[36px] ${sel.has(l.id) ? "bg-blue-50" : "hover:bg-gray-50"}`}
                      style={{ gridTemplateColumns: template }}
                    >
                      {cols.map((c, i) =>
                        c.type === "name" ? (
                          <div
                            key={c.key}
                            className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 flex items-center gap-1 pr-1"
                            style={{ borderLeft: `6px solid ${st.color}` }}
                          >
                            {bulk && (
                              <input
                                type="checkbox"
                                aria-label="Sélectionner"
                                className={`h-3.5 w-3.5 shrink-0 cursor-pointer ${sel.has(l.id) ? "" : "opacity-0 group-hover:opacity-100"}`}
                                checked={sel.has(l.id)}
                                onChange={(e) => toggleSel([l.id], e.target.checked)}
                              />
                            )}
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
                      <div className="border-l border-gray-100" />
                    </div>
                  ))}

                  {rows.length > limit && (
                    <MoreRows
                      shown={limit}
                      total={rows.length}
                      color={st.color}
                      onMore={() => setLimits((m) => ({ ...m, [st.id]: limit + 300 }))}
                      onAll={() => setLimits((m) => ({ ...m, [st.id]: rows.length }))}
                    />
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
      {bulk && selIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-2 rounded-xl bg-white text-gray-900 border border-gray-200 shadow-2xl px-4 py-2.5 max-w-[95vw]">
          <span className="text-sm font-bold">{selIds.length} sélectionné{selIds.length > 1 ? "s" : ""}</span>
          <select
            className="text-sm bg-white border border-gray-300 rounded-md px-2 py-1"
            value=""
            onChange={(e) => {
              if (e.target.value) bulk.setStatus(selIds, e.target.value);
            }}
          >
            <option value="">Changer le statut…</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className="text-sm bg-white border border-gray-300 rounded-md px-2 py-1"
            value=""
            onChange={(e) => {
              if (e.target.value) bulk.moveGroup(selIds, e.target.value);
            }}
          >
            <option value="">Déplacer vers…</option>
            {visibleGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <button onClick={() => bulk.exportCsv(selIds)} className="text-sm font-semibold border border-gray-300 rounded-md px-2.5 py-1 hover:bg-gray-100">
            Exporter
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Mettre ${selIds.length} lead${selIds.length > 1 ? "s" : ""} à la corbeille ? (récupérables pendant 30 jours)`)) {
                bulk.remove(selIds);
                setSel(new Set());
              }
            }}
            className="text-sm font-semibold text-red-600 border border-red-200 rounded-md px-2.5 py-1 hover:bg-red-50"
          >
            Corbeille
          </button>
          <button onClick={() => setSel(new Set())} className="text-sm text-gray-500 px-1" aria-label="Désélectionner">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export { useVisibleColumns };
