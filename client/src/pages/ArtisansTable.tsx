import { useState } from "react";
import { ChevronDown, ChevronRight, GripVertical, MessageCircle, Phone, Plus } from "lucide-react";
import {
  ARTISAN_STATUSES,
  formatShortDate,
  telHref,
  todayYmd,
  whatsappHref,
  type Artisan,
  type ArtisanStatus,
} from "@/lib/crm";
import { EditableCell, StatusCell } from "./LeadsTable";

// Vue « Tableau » façon Monday pour les artisans : même principe que
// LeadsTable (groupes par étape, cellules modifiables, glisser-déposer).

const COLS = "minmax(230px,2.2fr) 170px 175px 220px 130px 140px 60px 130px 100px";
const HEADERS = ["Nom", "Étape", "Téléphone", "E-mail", "Ville", "Zone", "RGE", "Relance", "Ajouté le"];
const GROUP_PAGE = 40;

export default function ArtisansTable({
  artisans,
  onOpen,
  onStatus,
  onPatch,
  onCreate,
}: {
  artisans: Artisan[];
  onOpen: (id: string) => void;
  onStatus: (id: string, status: ArtisanStatus) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
  onCreate: (status: ArtisanStatus, name: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [dropOver, setDropOver] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const today = todayYmd();

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[1385px] space-y-6">
        {ARTISAN_STATUSES.map((st) => {
          const rows = artisans.filter((a) => a.status === st.key);
          const isCollapsed = collapsed[st.key];
          const limit = limits[st.key] ?? GROUP_PAGE;
          return (
            <section
              key={st.key}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes("text/artisan-id")) return;
                e.preventDefault();
                setDropOver(st.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDropOver(null);
                const id = e.dataTransfer.getData("text/artisan-id");
                if (id) onStatus(id, st.key);
              }}
              className={`rounded-lg transition-colors ${dropOver === st.key ? "bg-blue-50 ring-2 ring-[#579bfc]" : ""}`}
            >
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [st.key]: !c[st.key] }))}
                className="flex items-center gap-2 mb-1 px-1"
                style={{ color: st.hex }}
              >
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                <span className="text-lg font-bold">{st.label}</span>
                <span className="text-xs font-normal text-gray-400">
                  {rows.length} artisan{rows.length > 1 ? "s" : ""}
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
                        className={`px-2 border-l border-gray-100 first:border-l-0 ${i === 0 ? "sticky left-0 z-10 bg-white" : ""}`}
                        style={i === 0 ? { borderLeft: `6px solid ${st.hex}` } : undefined}
                      >
                        {h}
                      </div>
                    ))}
                  </div>

                  {rows.slice(0, limit).map((a) => (
                    <div
                      key={a.id}
                      className="group grid items-stretch border-b border-gray-100 h-9 hover:bg-gray-50"
                      style={{ gridTemplateColumns: COLS }}
                    >
                      <div
                        className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 flex items-center gap-1 pr-1"
                        style={{ borderLeft: `6px solid ${st.hex}` }}
                      >
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/artisan-id", a.id);
                            e.dataTransfer.effectAllowed = "move";
                            const row = (e.currentTarget as HTMLElement).closest(".group");
                            if (row) e.dataTransfer.setDragImage(row, 20, 16);
                          }}
                          title="Glisser vers une autre étape"
                          className="shrink-0 cursor-grab text-gray-300 hover:text-gray-500 pl-0.5"
                        >
                          <GripVertical size={14} />
                        </span>
                        <div className="flex-1 min-w-0 h-full">
                          <EditableCell value={a.name} placeholder="Sans nom" onSave={(v) => onPatch(a.id, { name: v })} />
                        </div>
                        <button
                          onClick={() => onOpen(a.id)}
                          className="shrink-0 text-[11px] font-semibold text-[#579bfc] border border-[#579bfc]/40 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          Ouvrir
                        </button>
                      </div>
                      <div className="border-l border-gray-100">
                        <StatusCell status={a.status} options={ARTISAN_STATUSES} onChange={(s) => onStatus(a.id, s as ArtisanStatus)} />
                      </div>
                      <div className="border-l border-gray-100 flex items-center min-w-0">
                        <div className="flex-1 min-w-0 h-full">
                          <EditableCell value={a.telephone} type="tel" onSave={(v) => onPatch(a.id, { telephone: v })} />
                        </div>
                        {telHref(a.telephone) && (
                          <span className="flex gap-1 pr-1 shrink-0 opacity-0 group-hover:opacity-100">
                            <a href={telHref(a.telephone)} aria-label="Appeler" className="text-[#2b5a8f]">
                              <Phone size={14} />
                            </a>
                            <a href={whatsappHref(a.telephone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="text-green-600">
                              <MessageCircle size={14} />
                            </a>
                          </span>
                        )}
                      </div>
                      <div className="border-l border-gray-100">
                        <EditableCell value={a.email} type="email" onSave={(v) => onPatch(a.id, { email: v.toLowerCase() })} />
                      </div>
                      <div className="border-l border-gray-100">
                        <EditableCell value={a.ville} onSave={(v) => onPatch(a.id, { ville: v })} />
                      </div>
                      <div className="border-l border-gray-100">
                        <EditableCell value={a.zone} onSave={(v) => onPatch(a.id, { zone: v })} />
                      </div>
                      <div className="border-l border-gray-100 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={a.rgeVerifie}
                          onChange={(e) => onPatch(a.id, { rgeVerifie: e.target.checked })}
                          title="RGE + décennale vérifiés"
                        />
                      </div>
                      <div className="border-l border-gray-100">
                        <input
                          type="date"
                          value={a.relanceLe}
                          onChange={(e) => onPatch(a.id, { relanceLe: e.target.value })}
                          className={`w-full h-full px-2 text-xs bg-transparent outline-none cursor-pointer ${
                            !a.relanceLe
                              ? "text-transparent hover:text-gray-400 focus:text-gray-600"
                              : a.relanceLe <= today && !["signe", "dead"].includes(a.status)
                                ? "text-red-600 font-semibold"
                                : "text-gray-600"
                          }`}
                        />
                      </div>
                      <div className="border-l border-gray-100 flex items-center px-2 text-xs text-gray-500">
                        {formatShortDate(a.createdAt)}
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

                  <div className="grid items-stretch border-t border-gray-100 h-9" style={{ gridTemplateColumns: COLS }}>
                    <div
                      className="sticky left-0 z-10 bg-white flex items-center gap-2 px-2"
                      style={{ borderLeft: `6px solid ${st.hex}` }}
                    >
                      <Plus size={14} className="text-gray-400 shrink-0" />
                      <input
                        value={adding[st.key] ?? ""}
                        onChange={(e) => setAdding((m) => ({ ...m, [st.key]: e.target.value }))}
                        onKeyDown={(e) => {
                          const v = (adding[st.key] ?? "").trim();
                          if (e.key === "Enter" && v) {
                            onCreate(st.key, v);
                            setAdding((m) => ({ ...m, [st.key]: "" }));
                          }
                        }}
                        placeholder="Ajouter un artisan (nom + Entrée)"
                        className="w-full text-sm bg-transparent outline-none placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

