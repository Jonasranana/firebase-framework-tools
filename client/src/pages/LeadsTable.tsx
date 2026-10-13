import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, MessageCircle, Phone, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  LEAD_STATUSES,
  LEAD_TYPES,
  TYPE_BADGE,
  formatPhone,
  formatShortDate,
  isoToYmd,
  statusInfo,
  telHref,
  todayYmd,
  whatsappHref,
  type Lead,
  type LeadStatus,
} from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// Vue « Tableau » façon Monday : un groupe replié/déplié par statut, une
// ligne par lead, cellules modifiables en un clic, statut en pastille
// colorée, ligne « + Ajouter un lead » en bas de chaque groupe.
// ─────────────────────────────────────────────────────────────────────────

const COLS =
  "minmax(230px,2.2fr) 150px 175px 220px 90px 110px 150px 130px 100px";
const HEADERS = ["Nom", "Statut", "Téléphone", "E-mail", "CP", "Type", "Source", "Rappel", "Reçu le"];
const GROUP_PAGE = 40;

// Cellule texte : s'édite au clic, Entrée ou clic ailleurs enregistre, Échap annule.
const EditableCell = ({
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

const StatusCell = ({ status, onChange }: { status: LeadStatus; onChange: (s: LeadStatus) => void }) => {
  const [open, setOpen] = useState(false);
  const s = statusInfo(status);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-full h-full text-sm font-semibold text-white truncate px-2 hover:brightness-95"
          style={{ background: s.hex }}
        >
          {s.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-2 space-y-1.5" align="start">
        {LEAD_STATUSES.map((o) => (
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
      </PopoverContent>
    </Popover>
  );
};

const TypeCell = ({ type, onChange }: { type: Lead["type"]; onChange: (t: Lead["type"]) => void }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button className="w-full h-full flex items-center px-2 hover:bg-gray-100">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[type] ?? TYPE_BADGE.Autre}`}>
          {type}
        </span>
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-36 p-2 space-y-1" align="start">
      {LEAD_TYPES.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`w-full text-xs font-semibold py-1.5 rounded ${TYPE_BADGE[t]}`}
        >
          {t}
        </button>
      ))}
    </PopoverContent>
  </Popover>
);

const AddRow = ({ color, onAdd }: { color: string; onAdd: (name: string) => void }) => {
  const [v, setV] = useState("");
  return (
    <div className="grid items-stretch border-t border-gray-100 h-9" style={{ gridTemplateColumns: COLS }}>
      <div className="sticky left-0 z-10 bg-white flex items-center gap-2 px-2" style={{ borderLeft: `6px solid ${color}` }}>
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

export default function LeadsTable({
  leads,
  onOpen,
  onStatus,
  onPatch,
  onCreate,
}: {
  leads: Lead[];
  onOpen: (id: string) => void;
  onStatus: (id: string, status: LeadStatus) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onCreate: (status: LeadStatus, name: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});
  const today = todayYmd();

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[1255px] space-y-6">
        {LEAD_STATUSES.map((st) => {
          const rows = leads.filter((l) => l.status === st.key);
          const isCollapsed = collapsed[st.key];
          const limit = limits[st.key] ?? GROUP_PAGE;
          return (
            <section key={st.key}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [st.key]: !c[st.key] }))}
                className="flex items-center gap-2 mb-1 px-1"
                style={{ color: st.hex }}
              >
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                <span className="text-lg font-bold">{st.label}</span>
                <span className="text-xs font-normal text-gray-400">
                  {rows.length} lead{rows.length > 1 ? "s" : ""}
                </span>
              </button>

              {!isCollapsed && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div
                    className="grid text-xs font-semibold text-gray-500 bg-white border-b border-gray-200 h-8 items-center"
                    style={{ gridTemplateColumns: COLS }}
                  >
                    {HEADERS.map((h, i) => (
                      <div
                        key={h}
                        className={`px-2 border-l border-gray-100 first:border-l-0 ${
                          i === 0 ? "sticky left-0 z-10 bg-white" : ""
                        }`}
                        style={i === 0 ? { borderLeft: `6px solid ${st.hex}` } : undefined}
                      >
                        {h}
                      </div>
                    ))}
                  </div>

                  {rows.slice(0, limit).map((l) => (
                    <div
                      key={l.id}
                      className="group grid items-stretch border-b border-gray-100 h-9 hover:bg-gray-50"
                      style={{ gridTemplateColumns: COLS }}
                    >
                      <div
                        className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 flex items-center gap-1 pr-1"
                        style={{ borderLeft: `6px solid ${st.hex}` }}
                      >
                        <div className="flex-1 min-w-0 h-full">
                          <EditableCell value={l.name} placeholder="Sans nom" onSave={(v) => onPatch(l.id, { name: v })} />
                        </div>
                        <button
                          onClick={() => onOpen(l.id)}
                          className="shrink-0 text-[11px] font-semibold text-[#579bfc] border border-[#579bfc]/40 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          Ouvrir
                        </button>
                      </div>
                      <div className="border-l border-gray-100">
                        <StatusCell status={l.status} onChange={(s) => onStatus(l.id, s)} />
                      </div>
                      <div className="border-l border-gray-100 flex items-center min-w-0">
                        <div className="flex-1 min-w-0 h-full">
                          <EditableCell
                            value={l.phone}
                            type="tel"
                            onSave={(v) => onPatch(l.id, { phone: v })}
                          />
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
                      <div className="border-l border-gray-100">
                        <EditableCell value={l.email} type="email" onSave={(v) => onPatch(l.id, { email: v })} />
                      </div>
                      <div className="border-l border-gray-100">
                        <EditableCell value={l.postalCode} onSave={(v) => onPatch(l.id, { postalCode: v })} />
                      </div>
                      <div className="border-l border-gray-100">
                        <TypeCell type={l.type} onChange={(t) => onPatch(l.id, { type: t })} />
                      </div>
                      <div className="border-l border-gray-100 flex items-center px-2 text-xs text-gray-500 truncate" title={l.source}>
                        {l.source}
                      </div>
                      <div className="border-l border-gray-100">
                        <input
                          type="date"
                          value={l.rappelLe}
                          onChange={(e) => onPatch(l.id, { rappelLe: e.target.value })}
                          className={`w-full h-full px-2 text-xs bg-transparent outline-none cursor-pointer ${
                            !l.rappelLe
                              ? "text-transparent hover:text-gray-400 focus:text-gray-600"
                              : l.rappelLe <= today && !["gagne", "perdu"].includes(l.status)
                                ? "text-red-600 font-semibold"
                                : "text-gray-600"
                          }`}
                        />
                      </div>
                      <div className="border-l border-gray-100 flex items-center px-2 text-xs text-gray-500">
                        {formatShortDate(l.createdAt || isoToYmd(l.updatedAt))}
                      </div>
                    </div>
                  ))}

                  {rows.length > limit && (
                    <button
                      onClick={() => setLimits((m) => ({ ...m, [st.key]: limit + GROUP_PAGE }))}
                      className="w-full text-xs font-semibold text-[#579bfc] py-2 border-b border-gray-100"
                    >
                      Afficher plus ({rows.length - limit} restants)
                    </button>
                  )}

                  <AddRow color={st.hex} onAdd={(name) => onCreate(st.key, name)} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
