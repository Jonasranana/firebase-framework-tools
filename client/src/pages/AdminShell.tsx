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
  | "equipe"
  | "devis"
  | "marges"
  | "gonflage"
  | "clients";

type NavItem = {
  key: AdminPage | "solaire";
  label: string;
  icon: typeof Users;
  soon?: boolean;
};

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "CRM IP5",
    items: [
      { key: "leads", label: "Leads", icon: Users },
      { key: "artisans", label: "Artisans", icon: HardHat },
      { key: "documents", label: "Documents", icon: FolderOpen },
      { key: "stats", label: "Statistiques", icon: BarChart3 },
      { key: "equipe", label: "Équipe", icon: UserPlus },
    ],
  },
  {
    title: "Outils pompe à chaleur",
    items: [
      { key: "devis", label: "Devis PAC", icon: Calculator },
      { key: "marges", label: "Marges Prémi", icon: Percent },
    ],
  },
  {
    title: "Autres métiers",
    items: [
      { key: "gonflage", label: "Station de gonflage", icon: Gauge },
      { key: "solaire", label: "Solaire", icon: Sun, soon: true },
    ],
  },
  {
    title: "Archives Monday",
    items: [{ key: "clients", label: "Clients (copie Monday)", icon: Archive }],
  },
];

export const PAGE_TITLES: Record<AdminPage, string> = {
  leads: "Leads",
  artisans: "Artisans",
  stats: "Statistiques",
  documents: "Documents",
  equipe: "Équipe",
  devis: "Devis PAC",
  marges: "Marges Prémi",
  gonflage: "Station de gonflage",
  clients: "Clients (copie Monday)",
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

export function rememberPage(p: AdminPage) {
  try {
    localStorage.setItem("admin-page", p);
    window.history.replaceState(null, "", `#${p}`);
  } catch {
    /* non essentiel */
  }
}

const Menu_ = ({
  page,
  onNavigate,
  compact,
  email,
  onSignOut,
}: {
  page: AdminPage;
  onNavigate: (p: AdminPage) => void;
  compact: boolean;
  email: string;
  onSignOut: () => void;
}) => {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((g) => (
          <div key={g.title} className="mb-3">
            {!compact && (
              <button
                onClick={() => setClosed((c) => ({ ...c, [g.title]: !c[g.title] }))}
                className="w-full flex items-center gap-1 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600"
              >
                {closed[g.title] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {g.title}
              </button>
            )}
            {(compact || !closed[g.title]) && (
              <ul className="mt-0.5 px-2 space-y-0.5">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  const active = it.key === page;
                  return (
                    <li key={it.key}>
                      <button
                        disabled={it.soon}
                        onClick={() => it.key !== "solaire" && onNavigate(it.key)}
                        title={compact ? it.label : undefined}
                        className={`w-full flex items-center gap-3 rounded-lg text-sm font-semibold transition-colors ${
                          compact ? "justify-center px-0 py-2.5" : "px-3 py-2"
                        } ${
                          active
                            ? "bg-[#e5efff] text-[#1f4f8f]"
                            : it.soon
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <Icon size={18} className="shrink-0" />
                        {!compact && (
                          <>
                            <span className="truncate text-left">{it.label}</span>
                            {it.soon && (
                              <span className="ml-auto text-[10px] font-bold text-gray-300">bientôt</span>
                            )}
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-2 space-y-0.5">
        <a
          href="/"
          title="Voir le site"
          className={`flex items-center gap-3 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-100 ${
            compact ? "justify-center py-2.5" : "px-3 py-2"
          }`}
        >
          <Globe size={18} className="shrink-0" />
          {!compact && "Voir le site"}
        </a>
        <button
          onClick={onSignOut}
          title="Se déconnecter"
          className={`w-full flex items-center gap-3 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-100 ${
            compact ? "justify-center py-2.5" : "px-3 py-2"
          }`}
        >
          <LogOut size={18} className="shrink-0" />
          {!compact && "Se déconnecter"}
        </button>
        {!compact && <p className="px-3 pt-1 text-[11px] text-gray-400 truncate">{email}</p>}
      </div>
    </div>
  );
};

// Pastille « Connecté en tant que … » (barre du haut) : photo de profil, nom,
// poste, et menu (modifier mon profil, équipe et accès, déconnexion).
const UserChip = ({ name, email, onNavigate, onSignOut }: { name: string; email: string; onNavigate: (p: AdminPage) => void; onSignOut: () => void }) => {
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

export default function AdminShell({
  email,
  userName,
  page,
  onNavigate,
  onSignOut,
  children,
}: {
  email: string;
  userName: string;
  page: AdminPage;
  onNavigate: (p: AdminPage) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem("admin-menu-compact") === "1";
    } catch {
      return false;
    }
  });
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem("admin-menu-compact", compact ? "1" : "0");
    } catch {
      /* non essentiel */
    }
  }, [compact]);

  const go = (p: AdminPage) => {
    setDrawer(false);
    onNavigate(p);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="ltr">
      {/* Menu fixe (ordinateur) */}
      <aside
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-white border-r border-gray-100 transition-[width] ${
          compact ? "w-16" : "w-64"
        }`}
      >
        <div className={`flex items-center h-14 border-b border-gray-100 ${compact ? "justify-center" : "px-4 justify-between"}`}>
          {!compact && <LogoIP5 className="h-8" />}
          <button
            onClick={() => setCompact((v) => !v)}
            aria-label={compact ? "Agrandir le menu" : "Réduire le menu"}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded"
          >
            {compact ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <Menu_ page={page} onNavigate={go} compact={compact} email={email} onSignOut={onSignOut} />
        </div>
      </aside>

      {/* Menu tiroir (téléphone) */}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-72 p-0" dir="ltr">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="h-14 flex items-center px-4 border-b border-gray-100">
            <LogoIP5 className="h-8" />
          </div>
          <div className="h-[calc(100%-3.5rem)]">
            <Menu_ page={page} onNavigate={go} compact={false} email={email} onSignOut={onSignOut} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-14 bg-white border-b border-gray-100 flex items-center gap-3 px-4">
          <button
            onClick={() => setDrawer(true)}
            aria-label="Ouvrir le menu"
            className="md:hidden p-1.5 -ml-1.5 text-gray-500"
          >
            <Menu size={22} />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{PAGE_TITLES[page]}</h1>
          <MailSyncStatus email={email} />
          <UserChip name={userName || email} email={email} onNavigate={onNavigate} onSignOut={onSignOut} />
        </header>
        <main className="flex-1 min-w-0 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
