import { TOTALS_VIEWERS, NEWS_VIEWERS, RENTA_VIEWERS, STATS_VIEWERS } from "@/lib/crm";
import { useEffect, useState } from "react";
import {
  Archive,
  Camera,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  FolderOpen,
  Gauge,
  Globe,
  HardHat,
  UserPlus,
  LogOut,
  Menu,
  Percent,
  Users,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LogoIP5 } from "./site-chrome";
import BrandLoader from "@/components/BrandLoader";
import { LOGO_FULL_D } from "./ip5-logo";

// Petit logo : seulement les vagues (sans le texte), pour le menu réduit.
const LogoMark = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 352 387" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="IP5 Énergie">
    <defs>
      <clipPath id="ip5-mark">
        <polygon points="0,0 352,0 352,200 318,200 318,387 0,387" />
      </clipPath>
    </defs>
    <path d={LOGO_FULL_D} fill="currentColor" fillRule="evenodd" clipPath="url(#ip5-mark)" />
  </svg>
);
import MailSyncStatus from "./MailSyncStatus";
import PushBell from "@/components/PushBell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTeam } from "@/lib/crmTeam";
import Avatar from "@/components/Avatar";
import ProfileDialog from "./ProfileDialog";
import AdminSidebar from "./AdminSidebar";
import AideRubrique from "@/components/AideRubrique";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminTheme } from "@/lib/crmTheme";
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
  | "praimy"
  | "archives"
  | "actus"
  | "renta"
  | "planning"
  | "bets"
  | "loan"
  | "pacarchive"
  | "activite";

export const PAGE_TITLES: Record<AdminPage, string> = {
  leads: "Pac Pac",
  artisans: "Artisans",
  stats: "Équipe & leads",
  documents: "Documents",
  corbeille: "Corbeille et doublons",
  bareme: "Barème",
  equipe: "Équipe",
  devis: "Devis PAC",
  marges: "Marges PRAIMY",
  gonflage: "Station de gonflage",
  clients: "Clients (copie Monday)",
  praimy: "Dossiers PRAIMY",
  archives: "Archives Monday",
  actus: "Actualités aides",
  renta: "Pub Meta",
  planning: "Planning chantiers",
  bets: "Dossiers BETS",
  loan: "Tournées Loan",
  pacarchive: "Les archives de Pac Pac",
  activite: "Activité de l'équipe",
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
    localStorage.setItem("admin-view", item?.kind === "view" ? item.id : "");
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
          <button className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border border-orange-200 bg-orange-50/60 hover:bg-orange-100 hover:border-orange-300 transition-colors data-[state=open]:bg-orange-100">
            <span className="rounded-full ring-2 ring-white shadow-sm"><Avatar name={shownName} photoUrl={me?.photoUrl} size={32} /></span>
            <span className="hidden md:block text-left leading-tight max-w-[11rem]">
              <span className="block text-sm font-bold text-gray-900 truncate">{shownName}</span>
              <span className="block text-[11px] text-[#c2410c] truncate">{me?.title || "Équipe IP5"}</span>
            </span>
            <ChevronDown size={14} className="text-[#c2410c] hidden md:block" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0 bg-white text-gray-900 border border-gray-200 shadow-xl overflow-hidden">
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-pink-50 border-b border-orange-100">
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
      <AdminSidebar config={config} save={save} activeId={activeId} onSelect={onSelect} onOverlay={onOverlay} compact={compact} onManage={onManage} hiddenPages={[...(TOTALS_VIEWERS.includes(email.toLowerCase()) ? [] : ["marges", "loan"]), ...(NEWS_VIEWERS.includes(email.toLowerCase()) ? [] : ["actus", "planning"]), ...(RENTA_VIEWERS.includes(email.toLowerCase()) ? [] : ["renta"]), ...(STATS_VIEWERS.includes(email.toLowerCase()) ? [] : ["stats"]), ...(email.toLowerCase() === "jonassitbon8@gmail.com" ? [] : ["activite"])]} />
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
  // Largeur du menu ouvert : on tire son bord droit pour l'élargir ou le rétrécir (mémorisée sur l'appareil).
  const [menuW, setMenuW] = useState(() => {
    try {
      const v = Number(localStorage.getItem("admin-menu-width"));
      return v >= 200 && v <= 520 ? v : 256;
    } catch {
      return 256;
    }
  });
  const [resizing, setResizing] = useState(false);
  const startMenuResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = menuW;
    let w = w0;
    setResizing(true);
    const move = (ev: PointerEvent) => {
      w = Math.max(200, Math.min(520, Math.round(w0 + ev.clientX - x0)));
      setMenuW(w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setResizing(false);
      try {
        localStorage.setItem("admin-menu-width", String(w));
      } catch {
        /* non essentiel */
      }
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  useAdminTheme();
  // Design du CRM (pour tout le monde) : classe .crm-v2 sur la page, styles dans index.css.
  useEffect(() => {
    document.documentElement.classList.add("crm-v2");
    return () => document.documentElement.classList.remove("crm-v2");
  }, []);
  const [drawer, setDrawer] = useState(false);
  // Activité de l'équipe : on note la page affichée (temps passé par page).
  useEffect(() => {
    import("@/lib/activite").then(({ activitePage }) => activitePage(activeItem?.kind === "view" ? "tableau" : page)).catch(() => {});
  }, [page, activeItem?.id]);
  // La bulle « menu » devient plus transparente dès qu'on descend dans la page.
  const [defile, setDefile] = useState(false);
  useEffect(() => {
    const f = () => setDefile(window.scrollY > 30);
    f();
    addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  // Téléphone, comme une appli : le menu s'ouvre tout seul à l'arrivée (une fois par visite, sauf lien direct
  // vers une page), et un glissement du doigt depuis le bord gauche l'ouvre à tout moment.
  useEffect(() => {
    if (window.innerWidth >= 768) return;
    try {
      const h = window.location.hash.replace("#", "");
      if (!sessionStorage.getItem("crm-menu-auto") && (!h || h === "leads")) {
        sessionStorage.setItem("crm-menu-auto", "1");
        setDrawer(true);
      }
    } catch {
      /* non essentiel */
    }
    let x0 = -1;
    let y0 = 0;
    const debut = (e: TouchEvent) => {
      const t = e.touches[0];
      x0 = t && t.clientX < 22 ? t.clientX : -1;
      y0 = t?.clientY ?? 0;
    };
    const glisse = (e: TouchEvent) => {
      if (x0 < 0) return;
      const t = e.touches[0];
      if (t && t.clientX - x0 > 55 && Math.abs(t.clientY - y0) < 45) {
        x0 = -1;
        setDrawer(true);
      }
    };
    addEventListener("touchstart", debut, { passive: true });
    addEventListener("touchmove", glisse, { passive: true });
    return () => {
      removeEventListener("touchstart", debut);
      removeEventListener("touchmove", glisse);
    };
  }, []);
  const [overlay, setOverlay] = useState<SideItem | null>(null);
  const { config, save, loaded, error } = useSidebar(email);
  // Tableau à rouvrir : celui du lien (#view-…), sinon le dernier tableau visité. On attend que le menu soit chargé
  // (écran de chargement) au lieu d'afficher d'abord Pac Pac puis de basculer.
  const [wantedView] = useState(() => {
    try {
      const h = window.location.hash;
      if (h.startsWith("#view-")) return h.slice(6);
      if (!h || h === "#") return localStorage.getItem("admin-view") || "";
    } catch {
      /* stockage indisponible */
    }
    return "";
  });
  const waitingView = !!wantedView && !loaded && !activeItem;
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
    if (wantedView) {
      const it = items.find((i) => i.id === wantedView && !i.deletedAt && !i.archived);
      if (it && it.id !== activeItem?.id) onNavigate(it.page, it);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const select = (it: SideItem) => {
    import("@/lib/chrono").then(({ chrono }) => chrono.debut("changement-page"));
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
    <div className={`min-h-screen flex bg-[#f6f7fb]`} dir="ltr">
      {/* Menu fixe (ordinateur) */}
      <aside
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-white border-r border-gray-100 ${resizing ? "" : "transition-[width]"} ${
          compact ? "w-16" : ""
        }`}
        style={compact ? undefined : { width: menuW }}
      >
        {/* Poignée pour élargir / rétrécir le menu (double-clic : largeur d'origine). */}
        {!compact && (
          <div
            onPointerDown={startMenuResize}
            onDoubleClick={() => {
              setMenuW(256);
              try {
                localStorage.setItem("admin-menu-width", "256");
              } catch {
                /* non essentiel */
              }
            }}
            title="Tirez pour changer la largeur du menu"
            className="absolute right-0 top-0 z-40 h-full w-1.5 -mr-0.5 cursor-col-resize hover:bg-[#579bfc]/60 active:bg-[#579bfc]"
          />
        )}
        {/* En-tête de marque : logo IP5 Énergie en blanc sur un bandeau dégradé (comme Monday). */}
        {/* En-tête de marque orange (gardé aussi avec le nouveau design, à la demande d'Alexis). */}
        <div
          className={`relative flex items-center h-20 text-white overflow-hidden ${compact ? "justify-center" : "pl-5 pr-2 justify-between"}`}
          style={{ background: "linear-gradient(120deg,#173a5e 0%,#2b5a8f 100%)" }}
        >
          <span className="pointer-events-none absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute right-10 -bottom-12 w-24 h-24 rounded-full bg-white/[0.07]" />
          {!compact ? (
            <div className="relative flex items-center gap-2.5 min-w-0">
              <LogoIP5 className="!h-12 !text-white drop-shadow-sm" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/90 bg-white/15 rounded-full px-2 py-0.5">CRM</span>
            </div>
          ) : (
            <a href="/admin" aria-label="IP5 Énergie" className="relative flex items-center justify-center">
              <LogoMark className="h-11 w-auto text-white drop-shadow-sm" />
            </a>
          )}
          <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: "linear-gradient(90deg,#ffd166,#ffffff80,#ffd166)" }} />
        </div>
        {/* Réduire / agrandir : grand bouton franc, bien visible dans les deux états. */}
        <button
          onClick={() => setCompact((v) => !v)}
          aria-label={compact ? "Agrandir le menu" : "Réduire le menu"}
          title={compact ? "Agrandir le menu" : "Réduire le menu"}
          className={`shrink-0 flex items-center gap-2 border-b border-gray-100 font-bold text-xs transition-colors text-gray-500 hover:bg-gray-50 ${
            compact ? "justify-center h-11" : "px-4 h-10"
          }`}
        >
          {compact ? (
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm bg-[#edf2f8] text-[#1f4b7f]`}>
              <ChevronsRight size={18} strokeWidth={2.5} />
            </span>
          ) : (
            <>
              <ChevronsLeft size={18} strokeWidth={2.5} /> Réduire le menu
            </>
          )}
        </button>
        <div className="flex-1 min-h-0">{body(compact)}</div>
      </aside>

      {/* Menu tiroir (téléphone) */}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-72 p-0" dir="ltr">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="relative h-20 flex items-center gap-2.5 px-5 text-white overflow-hidden" style={{ background: "linear-gradient(120deg,#173a5e 0%,#2b5a8f 100%)" }}>
            <LogoIP5 className="!h-12 !text-white" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/90 bg-white/15 rounded-full px-2 py-0.5">CRM</span>
            <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: "linear-gradient(90deg,#ffd166,#ffffff80,#ffd166)" }} />
          </div>
          <div className="h-[calc(100%-5rem)]">{body(false)}</div>
        </SheetContent>
      </Sheet>

      {/* Téléphone : bulle ronde « menu » en haut à gauche, toujours là ; plus transparente quand on descend. */}
      {!drawer && (
        <button
          onClick={() => setDrawer(true)}
          aria-label="Ouvrir le menu"
          className="md:hidden fixed left-2.5 top-2 z-[45] w-10 h-10 rounded-full text-white flex items-center justify-center backdrop-blur-sm shadow-md transition-[background-color,box-shadow] duration-300 active:scale-95"
          style={{ background: defile ? "rgba(23,58,94,0.32)" : "rgba(23,58,94,0.72)", boxShadow: defile ? "0 1px 4px rgba(0,0,0,0.08)" : undefined }}
        >
          <Menu size={20} />
        </button>
      )}

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
        <header className={`sticky top-0 z-20 h-14 bg-white flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 border-b border-[#eceef3]`}>
          {/* Téléphone : place de la bulle « menu » (fixe, en haut à gauche). */}
          <span aria-hidden className="md:hidden w-10 shrink-0" />
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight truncate text-[#1f2430]">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            {headerExtra}
            <AideRubrique page={activeItem?.kind === "view" ? "view" : page} />
            <MailSyncStatus email={email} />
            <PushBell email={email} onNavigate={(p) => onNavigate(p as AdminPage)} />
            <UserChip name={userName || email} email={email} onNavigate={onNavigate} onSignOut={onSignOut} />
          </div>
        </header>
        <main className={`flex-1 min-w-0 p-2 sm:p-4 ${page === "leads" ? "md:px-5 md:pt-3 md:pb-5" : "md:p-6"}`}>{waitingView ? (
            <BrandLoader />
          ) : (
            <>
              {renderPage(page, activeItem, tools)}
            </>
          )}</main>
      </div>
    </div>
  );
}
