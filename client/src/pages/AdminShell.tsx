import { useEffect, useState } from "react";
import {
  Archive,
  Camera,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Gauge,
  Globe,
  HardHat,
  UserPlus,
  LogOut,
  Menu,
  Percent,
  Sun,
  Users,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LogoIP5 } from "./site-chrome";
import MailSyncStatus from "./MailSyncStatus";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTeam } from "@/lib/crmTeam";
import Avatar from "@/components/Avatar";
import ProfileDialog from "./ProfileDialog";
import AdminSidebar from "./AdminSidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { allItems, useSidebar, type SideConfig, type SideItem } from "@/lib/crmSidebar";

// ─────────────────────────────────────────────────────────────────────────
// Coquille de /admin façon Monday : menu à gauche (groupes repliables, un
// élément par tableau ou outil), barre de titre, contenu à droite. Pour
// ajouter un tableau ou un outil au menu : une ligne dans NAV ci-dessous,
// puis le brancher dans OutilDevis.tsx (switch sur `page`).
// ─────────────────────────────────────────────────────────────────────────

export type AdminPage =
  | "leads"
  | "artisans"
  | "stats"
  | "documents"
  | "corbeille"
  | "bareme"
  | "equipe"
  | "devis"
  | "marges"
  | "gonflage"
  | "clients"
  | "archives";

export const PAGE_TITLES: Record<AdminPage, string> = {
  leads: "Pac Pac",
  artisans: "Artisans",
  stats: "Statistiques",
  documents: "Documents",
  corbeille: "Corbeille et doublons",
  bareme: "Barème",
  equipe: "Équipe",
  devis: "Devis PAC",
  marges: "Marges Prémi",
  gonflage: "Station de gonflage",
  clients: "Clients (copie Monday)",
  archives: "Archives Monday",
};

const PAGES = Object.keys(PAGE_TITLES) as AdminPage[];

// Page de départ : celle du lien (#leads…), sinon la dernière visitée, sinon Leads.
export function initialPage(): AdminPage {
  try {
    const h = window.location.hash.replace("#", "");
    if ((PAGES as string[]).includes(h)) return h as AdminPage;
    const s = localStorage.getItem("admin-page");
    if ((PAGES as string[]).includes(s ?? "")) return s as AdminPage;
  } catch {
    /* stockage indisponible : on retombe sur Leads */
  }
  return "leads";
}

export function rememberPage(p: AdminPage, item?: SideItem | null) {
  try {
    localStorage.setItem("admin-page", p);
    window.history.replaceState(null, "", item?.kind === "view" ? `#view-${item.id}` : `#${p}`);
  } catch {
    /* non essentiel */
  }
}

// Pastille « Connecté en tant que … » (barre du haut) : photo de profil, nom,
// poste, et menu (modifier mon profil, équipe et accès, déconnexion).
const UserChip = ({ name, email, onNavigate, onSignOut }: { name: string; email: string; onNavigate: (p: AdminPage, item?: SideItem) => void; onSignOut: () => void }) => {
  const team = useTeam();
  const me = team?.find((m) => m.email === email.toLowerCase());
  const shownName = me?.name || name;
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full border border-gray-200 bg-white hover:bg-gray-50">
            <Avatar name={shownName} photoUrl={me?.photoUrl} size={34} />
            <span className="hidden md:block text-left leading-tight max-w-[11rem]">
              <span className="block text-[10px] text-gray-400">Connecté en tant que</span>
              <span className="block text-sm font-bold text-gray-800 truncate">{shownName}</span>
              {me?.title && <span className="block text-[10px] text-gray-500 truncate">{me.title}</span>}
            </span>
            <ChevronDown size={14} className="text-gray-400 hidden md:block" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0 bg-white text-gray-900 border border-gray-200 shadow-xl overflow-hidden">
          <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
            <Avatar name={shownName} photoUrl={me?.photoUrl} size={56} />
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400">Vous êtes connecté en tant que</p>
              <p className="text-sm font-bold text-gray-900 truncate">{shownName}</p>
              {me?.title && <p className="text-xs text-gray-600 truncate">{me.title}</p>}
              <p className="text-xs text-gray-500 truncate">{email}</p>
              {me?.phone && <p className="text-xs text-gray-500">{me.phone}</p>}
            </div>
          </div>
          <div className="p-1.5">
            <button
              onClick={() => setEditing(true)}
              disabled={!me}
              className="w-full flex items-center gap-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg px-2.5 py-2 disabled:opacity-40"
            >
              <Camera size={15} /> Modifier mon profil et ma photo
            </button>
            <button
              onClick={() => onNavigate("equipe")}
              className="w-full flex items-center gap-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg px-2.5 py-2"
            >
              <UserPlus size={15} /> Équipe et accès
            </button>
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg px-2.5 py-2"
            >
              <LogOut size={15} /> Se déconnecter
            </button>
          </div>
        </PopoverContent>
      </Popover>
      {editing && me && <ProfileDialog key={me.email} member={me} open onClose={() => setEditing(false)} />}
    </>
  );
};

export type PageTools = { updateItem: (id: string, patch: Partial<SideItem>) => void };

// Corps du menu de gauche : espace de travail, dossiers, pied de page.
const SidebarBody = ({
  config,
  save,
  error,
  activeId,
  onSelect,
  onOverlay,
  onManage,
  compact,
  email,
  onSignOut,
}: {
  config: SideConfig;
  save: (c: SideConfig) => void;
  error: string;
  activeId: string;
  onSelect: (it: SideItem) => void;
  onOverlay: (it: SideItem) => void;
  onManage: () => void;
  compact: boolean;
  email: string;
  onSignOut: () => void;
}) => (
  <div className="flex flex-col h-full">
    <div className="flex-1 min-h-0">
      <AdminSidebar config={config} save={save} activeId={activeId} onSelect={onSelect} onOverlay={onOverlay} compact={compact} onManage={onManage} />
    </div>
    {error && !compact && <p className="px-3 py-1 text-[11px] text-red-600">{error}</p>}
    <div className="border-t border-gray-100 p-2 space-y-0.5">
      <a
        href="/"
        title="Voir le site"
        className={`flex items-center gap-3 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-100 ${compact ? "justify-center py-2.5" : "px-3 py-2"}`}
      >
        <Globe size={18} className="shrink-0" />
        {!compact && "Voir le site"}
      </a>
      <button
        onClick={onSignOut}
        title="Se déconnecter"
        className={`w-full flex items-center gap-3 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-100 ${compact ? "justify-center py-2.5" : "px-3 py-2"}`}
      >
        <LogOut size={18} className="shrink-0" />
        {!compact && "Se déconnecter"}
      </button>
      {!compact && <p className="px-3 pt-1 text-[11px] text-gray-400 truncate">{email}</p>}
    </div>
  </div>
);

export default function AdminShell({
  email,
  userName,
  page,
  activeItem,
  onNavigate,
  onSignOut,
  renderPage,
  headerExtra,
}: {
  email: string;
  userName: string;
  page: AdminPage;
  activeItem: SideItem | null;
  onNavigate: (p: AdminPage, item?: SideItem) => void;
  onSignOut: () => void;
  renderPage: (page: AdminPage, item: SideItem | null, tools: PageTools) => React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem("admin-menu-compact") === "1";
    } catch {
      return false;
    }
  });
  const [drawer, setDrawer] = useState(false);
  const [overlay, setOverlay] = useState<SideItem | null>(null);
  const { config, save, loaded, error } = useSidebar(email);
  useEffect(() => {
    try {
      localStorage.setItem("admin-menu-compact", compact ? "1" : "0");
    } catch {
      /* non essentiel */
    }
  }, [compact]);

  const items = allItems(config);
  // Outils donnés aux pages : un tableau « vue » enregistre ses filtres/tri/groupement dans le menu.
  const tools: PageTools = {
    updateItem: (id, patch) =>
      save({ ...config, folders: config.folders.map((f) => ({ ...f, items: f.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })) }),
  };
  const activeId = activeItem?.id ?? items.find((i) => i.kind === "page" && i.page === page)?.id ?? "";
  const title = activeItem?.title ?? items.find((i) => i.kind === "page" && i.page === page)?.title ?? PAGE_TITLES[page];

  // Lien direct vers un tableau « vue » (#view-<id>) : ouvert quand le menu est chargé.
  useEffect(() => {
    if (!loaded) return;
    const h = window.location.hash;
    if (h.startsWith("#view-")) {
      const it = items.find((i) => i.id === h.slice(6));
      if (it && it.id !== activeItem?.id) onNavigate(it.page, it);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const select = (it: SideItem) => {
    setDrawer(false);
    onNavigate(it.page, it);
  };
  const body = (c: boolean) => (
    <SidebarBody
      config={config}
      save={save}
      error={error}
      activeId={activeId}
      onSelect={select}
      onOverlay={(it) => {
        setDrawer(false);
        setOverlay(it);
      }}
      onManage={() => {
        setDrawer(false);
        onNavigate("equipe");
      }}
      compact={c}
      email={email}
      onSignOut={onSignOut}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="ltr">
      {/* Menu fixe (ordinateur) */}
      <aside
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-white border-r border-gray-100 transition-[width] ${
          compact ? "w-16" : "w-64"
        }`}
      >
        {/* Bouton rond sur le bord du menu : réduire / agrandir, bien visible dans les deux états. */}
        <button
          onClick={() => setCompact((v) => !v)}
          aria-label={compact ? "Agrandir le menu" : "Réduire le menu"}
          title={compact ? "Agrandir le menu" : "Réduire le menu"}
          className="absolute -right-3.5 top-[26px] z-30 w-7 h-7 rounded-full bg-white text-[#1f4f8f] border border-gray-200 shadow-md flex items-center justify-center hover:bg-[#1f4f8f] hover:text-white transition-colors"
        >
          {compact ? <ChevronRight size={16} strokeWidth={2.5} /> : <ChevronLeft size={16} strokeWidth={2.5} />}
        </button>
        {/* En-tête de marque : logo IP5 Énergie en blanc sur un bandeau dégradé (comme Monday). */}
        <div
          className={`relative flex items-center h-20 text-white overflow-hidden ${compact ? "justify-center" : "pl-5 pr-2 justify-between"}`}
          style={{ background: "linear-gradient(120deg,#16396a 0%,#1f4f8f 40%,#2f7fd6 100%)" }}
        >
          <span className="pointer-events-none absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute right-10 -bottom-12 w-24 h-24 rounded-full bg-white/[0.07]" />
          {!compact ? (
            <div className="relative flex items-center gap-2.5 min-w-0">
              <LogoIP5 className="!h-12 !text-white drop-shadow-sm" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/90 bg-white/15 rounded-full px-2 py-0.5">CRM</span>
            </div>
          ) : (
            <button onClick={() => setCompact(false)} aria-label="Agrandir le menu" className="relative w-10 h-10 rounded-xl bg-white/15 text-white text-sm font-extrabold tracking-tight flex items-center justify-center">
              IP5
            </button>
          )}
          <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: "linear-gradient(90deg,#ff9f1c,#ff5ac4,#9d50dd,#579bfc)" }} />
        </div>
        <div className="flex-1 min-h-0">{body(compact)}</div>
      </aside>

      {/* Menu tiroir (téléphone) */}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-72 p-0" dir="ltr">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="relative h-20 flex items-center gap-2.5 px-5 text-white overflow-hidden" style={{ background: "linear-gradient(120deg,#16396a 0%,#1f4f8f 40%,#2f7fd6 100%)" }}>
            <LogoIP5 className="!h-12 !text-white" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/90 bg-white/15 rounded-full px-2 py-0.5">CRM</span>
            <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: "linear-gradient(90deg,#ff9f1c,#ff5ac4,#9d50dd,#579bfc)" }} />
          </div>
          <div className="h-[calc(100%-5rem)]">{body(false)}</div>
        </SheetContent>
      </Sheet>

      {/* Ouverture « en superposition » d'un tableau */}
      <Dialog open={!!overlay} onOpenChange={(o) => !o && setOverlay(null)}>
        <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] overflow-auto bg-gray-50 text-gray-900 p-4 sm:rounded-xl" dir="ltr">
          <DialogHeader>
            <DialogTitle>{overlay?.title}</DialogTitle>
          </DialogHeader>
          {overlay && renderPage(overlay.page, overlay, tools)}
        </DialogContent>
      </Dialog>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-14 bg-white border-b border-gray-100 flex items-center gap-3 px-4">
          <button
            onClick={() => setDrawer(true)}
            aria-label="Ouvrir le menu"
            className="md:hidden p-1.5 -ml-1.5 text-gray-500"
          >
            <Menu size={22} />
          </button>
          <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            {headerExtra}
            <MailSyncStatus email={email} />
            <UserChip name={userName || email} email={email} onNavigate={onNavigate} onSignOut={onSignOut} />
          </div>
        </header>
        <main className="flex-1 min-w-0 p-4 md:p-6">{renderPage(page, activeItem, tools)}</main>
      </div>
    </div>
  );
}
