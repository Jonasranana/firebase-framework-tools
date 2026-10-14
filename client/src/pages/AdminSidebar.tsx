import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowRight,
  BarChart3,
  Calculator,
  ChevronsDownUp,
  Copy,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  Gauge,
  Layers,
  MoreHorizontal,
  Palette,
  Pencil,
  PanelTop,
  Percent,
  Plus,
  Repeat,
  Settings2,
  Star,
  Table2,
  Trash2,
  UserPlus,
  Users,
  ArrowUp,
  ArrowDown,
  Save,
  Check,
  Home,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  FOLDER_COLORS,
  allItems,
  newId,
  type AdminPageKey,
  type SideConfig,
  type SideFolder,
  type SideItem,
} from "@/lib/crmSidebar";

// Menu de gauche façon Monday : espace de travail, favoris, dossiers colorés,
// tableaux. Chaque dossier et chaque tableau a son menu « ⋯ ».
const ICONS: Record<AdminPageKey, typeof Table2> = {
  leads: Table2,
  artisans: Table2,
  documents: FolderOpen,
  corbeille: Trash2,
  bareme: Percent,
  stats: BarChart3,
  equipe: UserPlus,
  devis: Calculator,
  marges: Percent,
  gonflage: Gauge,
  clients: Archive,
  archives: Archive,
};

const POP = "bg-white text-gray-900 border border-gray-200 shadow-xl";

const Entry = ({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
  more,
}: {
  icon: any;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  more?: boolean;
}) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 text-left text-sm px-2.5 py-1.5 rounded-md disabled:opacity-35 disabled:cursor-not-allowed ${
      danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-100"
    }`}
  >
    <Icon size={15} className="shrink-0" />
    <span className="flex-1">{label}</span>
    {more && <ArrowRight size={13} className="text-gray-400" />}
  </button>
);

const Sep = () => <div className="my-1 border-t border-gray-100" />;

type Ctx = {
  config: SideConfig;
  activeId: string;
  renaming: string | null;
  draft: string;
  setDraft: (v: string) => void;
  commit: () => void;
  setRenaming: (v: string | null) => void;
  start: (id: string, current: string) => void;
  onSelect: (item: SideItem) => void;
  onOverlay: (item: SideItem) => void;
  patchItem: (id: string, p: Partial<SideItem>) => void;
  patchFolder: (id: string, p: Partial<SideFolder>) => void;
  toggleFav: (id: string) => void;
  duplicateItem: (it: SideItem) => void;
  deleteItem: (id: string) => void;
  moveItem: (id: string, toFolder: string) => void;
  moveFolder: (id: string, to: "top" | "up" | "down" | "bottom") => void;
  addBoard: (folderId: string) => void;
  addFolder: (afterId?: string) => void;
  deleteFolder: (id: string) => void;
  collapseAll: (collapsed: boolean) => void;
  url: (it: SideItem) => string;
};

const ItemRow = ({ it, inFav, ctx }: { it: SideItem; inFav?: boolean; ctx: Ctx }) => {
  const { activeId, renaming, draft, setDraft, commit, setRenaming, onSelect } = ctx;
    const Icon = it.kind === "view" ? Table2 : ICONS[it.page];
    const active = it.id === activeId;
    return (
      <li className="group/item relative">
        {renaming === it.id ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setRenaming(null);
            }}
            className="w-full text-sm bg-white text-gray-900 border-2 border-[#0073ea] rounded-md px-2 py-1.5 outline-none"
          />
        ) : (
          <div
            className={`flex items-center rounded-md ${active ? "bg-[#e5efff]" : "hover:bg-gray-100"}`}
          >
            <button
              onClick={() => onSelect(it)}
              className={`flex-1 min-w-0 flex items-center gap-2.5 text-sm font-semibold px-2.5 py-1.5 text-left ${active ? "text-[#1f4f8f]" : "text-gray-600"}`}
            >
              {inFav ? <Star size={15} className="shrink-0 text-amber-400" fill="currentColor" /> : <Icon size={16} className="shrink-0" />}
              <span className="truncate">{it.title}</span>
            </button>
            <ItemMenu it={it} ctx={ctx} />
          </div>
        )}
      </li>
    );
  };

const ItemMenu = ({ it, ctx }: { it: SideItem; ctx: Ctx }) => {
  const { config, start, onOverlay, toggleFav, duplicateItem, deleteItem, patchItem, moveItem, url } = ctx;
    const [open, setOpen] = useState(false);
    const [panel, setPanel] = useState<"" | "move">("");
    const close = () => {
      setOpen(false);
      setPanel("");
    };
    const isFav = config.favorites.includes(it.id);
    return (
      <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <PopoverTrigger asChild>
          <button
            aria-label={`Options de ${it.title}`}
            className="mr-1 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100 focus:opacity-100"
          >
            <MoreHorizontal size={15} />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className={`w-64 p-1.5 ${POP}`}>
          {panel === "" ? (
            <>
              <Entry icon={PanelTop} label="Ouvrir en superposition" onClick={() => { close(); onOverlay(it); }} />
              <Entry icon={ExternalLink} label="Ouvrir dans un nouvel onglet" onClick={() => { close(); window.open(url(it), "_blank"); }} />
              <Sep />
              <Entry icon={Pencil} label="Renommer" onClick={() => { close(); start(it.id, it.title); }} />
              <Entry icon={ArrowRight} label="Déplacer vers" more onClick={() => setPanel("move")} />
              <Entry icon={Repeat} label="Changer le type" disabled />
              <Entry icon={Star} label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={() => { close(); toggleFav(it.id); }} />
              <Entry icon={Copy} label="Dupliquer" onClick={() => { close(); duplicateItem(it); }} />
              <Entry icon={Save} label="Enregistrer en tant que modèle" disabled />
              <Sep />
              <Entry
                icon={Trash2}
                label="Supprimer"
                disabled={!!it.core}
                onClick={() => {
                  if (confirm(`Supprimer « ${it.title} » ?`)) {
                    close();
                    deleteItem(it.id);
                  }
                }}
              />
              <Entry icon={Archive} label="Archiver" onClick={() => { close(); patchItem(it.id, { archived: true }); }} />
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold text-gray-400 px-2.5 py-1">Déplacer vers le dossier…</p>
              {config.folders.map((f) => {
                const here = f.items.some((i) => i.id === it.id);
                return (
                  <button
                    key={f.id}
                    disabled={here}
                    onClick={() => { close(); moveItem(it.id, f.id); }}
                    className="w-full flex items-center gap-2 text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"
                  >
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: f.color }} />
                    <span className="truncate flex-1">{f.title}</span>
                    {here && <Check size={13} />}
                  </button>
                );
              })}
            </>
          )}
        </PopoverContent>
      </Popover>
    );
  };

const FolderMenu = ({ f, index, ctx }: { f: SideFolder; index: number; ctx: Ctx }) => {
  const { config, start, patchFolder, moveFolder, addBoard, addFolder, collapseAll, deleteFolder } = ctx;
    const [open, setOpen] = useState(false);
    const [panel, setPanel] = useState<"" | "color" | "move" | "create">("");
    const close = () => {
      setOpen(false);
      setPanel("");
    };
    return (
      <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <PopoverTrigger asChild>
          <button
            aria-label={`Options du dossier ${f.title}`}
            className="mr-1 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 opacity-0 group-hover/folder:opacity-100 data-[state=open]:opacity-100 focus:opacity-100"
          >
            <MoreHorizontal size={15} />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className={`w-60 p-1.5 ${POP}`}>
          {panel === "" && (
            <>
              <Entry icon={Pencil} label="Renommer" onClick={() => { close(); start(f.id, f.title); }} />
              <Entry icon={Palette} label="Modifier la couleur" more onClick={() => setPanel("color")} />
              <Sep />
              <Entry icon={ArrowRight} label="Déplacer vers" more onClick={() => setPanel("move")} />
              <Entry icon={Plus} label="Créer dans un dossier" more onClick={() => setPanel("create")} />
              <Sep />
              <Entry icon={ChevronsDownUp} label="Réduire tous les dossiers" onClick={() => { close(); collapseAll(true); }} />
              <Entry
                icon={Trash2}
                label="Supprimer"
                disabled={f.items.length > 0}
                onClick={() => {
                  if (confirm(`Supprimer le dossier « ${f.title} » ?`)) {
                    close();
                    deleteFolder(f.id);
                  }
                }}
              />
            </>
          )}
          {panel === "color" && (
            <div className="p-2">
              <p className="text-[11px] font-semibold text-gray-400 mb-1.5">Couleur du dossier</p>
              <div className="grid grid-cols-6 gap-1.5">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { close(); patchFolder(f.id, { color: c }); }}
                    aria-label={`Couleur ${c}`}
                    className={`h-6 rounded ${f.color === c ? "ring-2 ring-offset-1 ring-gray-700" : ""}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          )}
          {panel === "move" && (
            <>
              <Entry icon={ArrowUp} label="Tout en haut" disabled={index === 0} onClick={() => { close(); moveFolder(f.id, "top"); }} />
              <Entry icon={ArrowUp} label="Monter d'un cran" disabled={index === 0} onClick={() => { close(); moveFolder(f.id, "up"); }} />
              <Entry icon={ArrowDown} label="Descendre d'un cran" disabled={index === config.folders.length - 1} onClick={() => { close(); moveFolder(f.id, "down"); }} />
              <Entry icon={ArrowDown} label="Tout en bas" disabled={index === config.folders.length - 1} onClick={() => { close(); moveFolder(f.id, "bottom"); }} />
            </>
          )}
          {panel === "create" && (
            <>
              <Entry icon={Table2} label="Nouveau tableau de leads" onClick={() => { close(); addBoard(f.id); }} />
              <Entry icon={FolderPlus} label="Nouveau dossier (en dessous)" onClick={() => { close(); addFolder(f.id); }} />
            </>
          )}
        </PopoverContent>
      </Popover>
    );
  };


export default function AdminSidebar({
  config,
  save,
  activeId,
  onSelect,
  onOverlay,
  compact,
  onManage,
}: {
  config: SideConfig;
  save: (c: SideConfig) => void;
  activeId: string;
  onSelect: (item: SideItem) => void;
  onOverlay: (item: SideItem) => void;
  compact: boolean;
  onManage: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null); // id d'un élément ou d'un dossier, ou "ws"
  const [draft, setDraft] = useState("");
  const items = allItems(config);

  const start = (id: string, current: string) => {
    setRenaming(id);
    setDraft(current);
  };
  const commit = () => {
    const t = draft.trim();
    const id = renaming;
    setRenaming(null);
    if (!id || !t) return;
    if (id === "ws") return save({ ...config, workspaceName: t });
    save({
      ...config,
      folders: config.folders.map((f) =>
        f.id === id
          ? { ...f, title: t }
          : { ...f, items: f.items.map((i) => (i.id === id ? { ...i, title: t } : i)) },
      ),
    });
  };

  const patchFolder = (id: string, p: Partial<SideFolder>) =>
    save({ ...config, folders: config.folders.map((f) => (f.id === id ? { ...f, ...p } : f)) });
  const patchItem = (id: string, p: Partial<SideItem>) =>
    save({ ...config, folders: config.folders.map((f) => ({ ...f, items: f.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })) });
  const collapseAll = (collapsed: boolean) => save({ ...config, folders: config.folders.map((f) => ({ ...f, collapsed })) });

  const moveItem = (id: string, toFolder: string) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    save({
      ...config,
      folders: config.folders.map((f) => {
        const without = f.items.filter((i) => i.id !== id);
        return f.id === toFolder ? { ...f, items: [...without, it], collapsed: false } : { ...f, items: without };
      }),
    });
  };
  const moveFolder = (id: string, to: "top" | "up" | "down" | "bottom") => {
    const list = [...config.folders];
    const i = list.findIndex((f) => f.id === id);
    const [f] = list.splice(i, 1);
    const dest = to === "top" ? 0 : to === "bottom" ? list.length : to === "up" ? Math.max(0, i - 1) : Math.min(list.length, i + 1);
    list.splice(dest, 0, f);
    save({ ...config, folders: list });
  };
  const duplicateItem = (it: SideItem) => {
    const copy: SideItem =
      it.page === "leads" && it.kind === "page"
        ? { id: newId("i"), kind: "view", page: "leads", title: `${it.title} (copie)`, view: { filters: [], sorts: [], groupBy: "", personKey: "", visible: [] } }
        : { ...it, id: newId("i"), title: `${it.title} (copie)`, core: false, archived: false, view: it.view ? JSON.parse(JSON.stringify(it.view)) : undefined };
    save({
      ...config,
      folders: config.folders.map((f) => {
        const idx = f.items.findIndex((i) => i.id === it.id);
        if (idx < 0) return f;
        const next = [...f.items];
        next.splice(idx + 1, 0, copy);
        return { ...f, items: next };
      }),
    });
  };
  const deleteItem = (id: string) =>
    save({
      ...config,
      favorites: config.favorites.filter((x) => x !== id),
      folders: config.folders.map((f) => ({ ...f, items: f.items.filter((i) => i.id !== id) })),
    });
  const toggleFav = (id: string) =>
    save({ ...config, favorites: config.favorites.includes(id) ? config.favorites.filter((x) => x !== id) : [...config.favorites, id] });
  const addBoard = (folderId: string) => {
    const it: SideItem = { id: newId("i"), kind: "view", page: "leads", title: "Nouveau tableau", view: { filters: [], sorts: [], groupBy: "", personKey: "", visible: [] } };
    save({ ...config, folders: config.folders.map((f) => (f.id === folderId ? { ...f, collapsed: false, items: [...f.items, it] } : f)) });
    start(it.id, it.title);
  };
  const addFolder = (afterId?: string) => {
    const f: SideFolder = { id: newId("f"), title: "Nouveau dossier", color: FOLDER_COLORS[config.folders.length % FOLDER_COLORS.length], items: [] };
    const list = [...config.folders];
    const i = afterId ? list.findIndex((x) => x.id === afterId) : list.length - 1;
    list.splice(i + 1, 0, f);
    save({ ...config, folders: list });
    start(f.id, f.title);
  };
  const deleteFolder = (id: string) => save({ ...config, folders: config.folders.filter((f) => f.id !== id) });

  const url = (it: SideItem) => `${window.location.origin}/admin#${it.kind === "view" ? `view-${it.id}` : it.page}`;
  const archived = items.filter((i) => i.archived);
  const favItems = config.favorites.map((id) => items.find((i) => i.id === id)).filter((i): i is SideItem => !!i && !i.archived);

  const ctx: Ctx = {
    config, activeId, renaming, draft, setDraft, commit, setRenaming, start, onSelect, onOverlay,
    patchItem, patchFolder, toggleFav, duplicateItem, deleteItem, moveItem, moveFolder, addBoard,
    addFolder, deleteFolder, collapseAll, url,
  };

  // Mode réduit (icônes seules) : liste à plat des éléments.
  if (compact) {
    return (
      <nav className="py-3 px-2 space-y-0.5 overflow-y-auto h-full">
        {config.folders.flatMap((f) =>
          f.items
            .filter((i) => !i.archived)
            .map((it) => {
              const Icon = it.kind === "view" ? Table2 : ICONS[it.page];
              return (
                <button
                  key={it.id}
                  onClick={() => onSelect(it)}
                  title={it.title}
                  className={`w-full flex justify-center py-2.5 rounded-md ${it.id === activeId ? "bg-[#e5efff] text-[#1f4f8f]" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  <Icon size={18} />
                </button>
              );
            }),
        )}
      </nav>
    );
  }

  return (
    <nav className="py-2 overflow-y-auto h-full">
      {/* Espace de travail */}
      <div className="px-2 mb-1">
        <div className="group/item flex items-center gap-2 px-2 py-1.5">
          <span
            className="w-7 h-7 rounded-lg text-white text-[11px] font-extrabold flex items-center justify-center shrink-0 shadow-sm"
            style={{ background: "linear-gradient(135deg,#2b5a8f,#3f8be0)" }}
          >
            IP5
          </span>
          {renaming === "ws" ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setRenaming(null);
              }}
              className="flex-1 min-w-0 text-sm font-bold bg-white text-gray-900 border-2 border-[#0073ea] rounded-md px-2 py-0.5 outline-none"
            />
          ) : (
            <span className="flex-1 min-w-0 truncate text-sm font-bold text-gray-800">{config.workspaceName}</span>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button aria-label="Options de l'espace de travail" className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200">
                <MoreHorizontal size={15} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className={`w-64 p-1.5 ${POP}`}>
              <Entry icon={Pencil} label="Renommer l'espace de travail" onClick={() => start("ws", config.workspaceName)} />
              <Entry icon={FolderPlus} label="Ajouter un dossier" onClick={() => addFolder()} />
              <Entry icon={ChevronsDownUp} label="Réduire tous les dossiers" onClick={() => collapseAll(true)} />
              <Entry icon={Layers} label="Développer tous les dossiers" onClick={() => collapseAll(false)} />
              {archived.length > 0 && (
                <>
                  <Sep />
                  <p className="text-[11px] font-semibold text-gray-400 px-2.5 py-1">Éléments archivés ({archived.length})</p>
                  {archived.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => patchItem(a.id, { archived: false })}
                      className="w-full flex items-center gap-2 text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-gray-100"
                    >
                      <Archive size={14} className="shrink-0 text-gray-400" />
                      <span className="truncate flex-1">{a.title}</span>
                      <span className="text-xs font-bold text-[#0073ea]">Restaurer</span>
                    </button>
                  ))}
                </>
              )}
            </PopoverContent>
          </Popover>
        </div>
        <button
          onClick={onManage}
          className="w-full flex items-center gap-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-md px-2.5 py-1.5"
        >
          <Settings2 size={16} className="shrink-0" /> Gérer l'espace de travail
        </button>
      </div>

      <div className="mx-3 my-2 border-t border-gray-100" />

      {/* Favoris */}
      {favItems.length > 0 && (
        <div className="px-2 mb-2">
          <p className="px-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Favoris</p>
          <ul className="space-y-0.5">
            {favItems.map((it) => (
              <ItemRow key={`fav-${it.id}`} it={it} inFav ctx={ctx} />
            ))}
          </ul>
        </div>
      )}

      {/* Dossiers */}
      {config.folders.map((f, fi) => {
        const visible = f.items.filter((i) => !i.archived);
        return (
          <div key={f.id} className="px-2 mb-1.5">
            <div className="group/folder flex items-center">
              {renaming === f.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="flex-1 min-w-0 text-sm font-bold bg-white text-gray-900 border-2 border-[#0073ea] rounded-md px-2 py-1 outline-none"
                />
              ) : (
                <button
                  onClick={() => patchFolder(f.id, { collapsed: !f.collapsed })}
                  className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-gray-100 text-left"
                >
                  <span className="text-[10px] shrink-0 transition-transform" style={{ color: f.color, transform: f.collapsed ? "rotate(-90deg)" : "none" }}>
                    ▼
                  </span>
                  <span className="truncate text-sm font-bold uppercase tracking-wide" style={{ color: f.color }}>
                    {f.title}
                  </span>
                </button>
              )}
              <FolderMenu f={f} index={fi} ctx={ctx} />
            </div>
            {!f.collapsed && (
              <ul className="space-y-0.5 mt-0.5 pl-3 border-l-2 ml-3.5" style={{ borderColor: `${f.color}55` }}>
                {visible.map((it) => (
                  <ItemRow key={it.id} it={it} ctx={ctx} />
                ))}
                {visible.length === 0 && <li className="text-xs text-gray-400 px-2.5 py-1">Dossier vide</li>}
              </ul>
            )}
          </div>
        );
      })}

      <div className="px-2 mt-2">
        <button
          onClick={() => addFolder()}
          className="w-full flex items-center gap-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-md px-2.5 py-1.5"
        >
          <FolderPlus size={15} /> Ajouter un dossier
        </button>
      </div>
    </nav>
  );
}
