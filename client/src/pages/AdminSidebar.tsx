import { useState } from "react";
import {
  Archive,
  BarChart3,
  CalendarDays,
  ChevronDown,
  FileCheck2,
  FolderOpen,
  Gauge,
  MoreHorizontal,
  Newspaper,
  PanelLeft as BoardIcon,
  Pencil,
  Percent,
  PiggyBank,
  Plus,
  Settings,
  Trash2,
  Truck,
  UserPlus,
  Calculator,
  ExternalLink,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { allItems, newId, type AdminPageKey, type SideConfig, type SideFolder, type SideItem } from "@/lib/crmSidebar";

// ─────────────────────────────────────────────────────────────────────────
// Menu de gauche, pensé pour la PAC : des groupes fixes, rangés selon l'usage
// (Tableau, PRAIMY, Loan · Chantiers, Pub & aides, LED), et en bas « Paramètres »
// (documents, corbeille, archives…). On ne crée plus de tableaux partout :
// seul le bouton du haut « Nouveau groupe » crée un groupe avec son tableau
// (comme Pac Pac). La configuration reste partagée (crm_boards/sidebar) :
// noms des pages, tableaux ajoutés, groupes créés.
// ─────────────────────────────────────────────────────────────────────────
const ICONS: Record<AdminPageKey, typeof BoardIcon> = {
  leads: BoardIcon,
  artisans: BoardIcon,
  documents: FolderOpen,
  corbeille: Trash2,
  bareme: Percent,
  stats: BarChart3,
  equipe: UserPlus,
  devis: Calculator,
  marges: Percent,
  gonflage: Gauge,
  clients: Archive,
  praimy: FileCheck2,
  archives: Archive,
  actus: Newspaper,
  renta: PiggyBank,
  planning: CalendarDays,
  bets: FileCheck2,
  loan: Truck,
  pacarchive: Archive,
};

// Groupes fixes du menu, dans l'ordre d'usage.
const GROUPES: { id: string; titre: string; couleur: string; pages: AdminPageKey[] }[] = [
  { id: "g_tableau", titre: "Tableau", couleur: "#1f4b7f", pages: ["leads", "bets"] },
  { id: "g_praimy", titre: "PRAIMY", couleur: "#7c3aed", pages: ["praimy", "marges", "bareme"] },
  { id: "g_loan", titre: "Loan · Chantiers", couleur: "#0891b2", pages: ["planning", "loan"] },
  { id: "g_renta", titre: "Rentabilité", couleur: "#db2777", pages: ["renta", "stats"] },
  // Tableaux de l'activité LED (ex. « Tableau pour Dépôt ») : les tableaux ajoutés avant le nouveau menu.
  { id: "g_led", titre: "LED", couleur: "#eab308", pages: [] },
];
// Rangé dans « Paramètres » (en bas à gauche).
const PARAMETRES: AdminPageKey[] = ["actus", "documents", "corbeille", "pacarchive", "archives", "clients", "gonflage", "artisans"];
const COULEURS_GROUPES = ["#0ea5e9", "#6366f1", "#c026d3", "#0e7490", "#475569"]; // jamais vert, ambre ni rouge (réservés aux statuts)

const POP = "bg-white text-gray-900 border border-gray-200 shadow-xl";
const visible = (i: SideItem, hidden: string[]) => !i.archived && !i.deletedAt && !hidden.includes(i.page);

const replie = (id: string) => {
  try {
    return localStorage.getItem(`menu-replie-${id}`) === "1";
  } catch {
    return false;
  }
};

export default function AdminSidebar({
  config,
  save,
  activeId,
  onSelect,
  onOverlay,
  compact,
  hiddenPages = [],
}: {
  hiddenPages?: string[];
  config: SideConfig;
  save: (c: SideConfig) => void;
  activeId: string;
  onSelect: (item: SideItem) => void;
  onOverlay: (item: SideItem) => void;
  compact: boolean;
  onManage: () => void;
}) {
  const items = allItems(config);
  const page = (p: AdminPageKey) => items.find((i) => i.core && i.page === p && visible(i, hiddenPages));
  const persos = config.folders.filter((f) => f.perso);
  const dansPerso = new Set(persos.flatMap((f) => f.items.map((i) => i.id)));
  // Tableaux ajoutés avant (ex. « Tableau pour Dépôt », activité LED) : rangés dans le groupe LED.
  const anciensTableaux = items.filter((i) => !i.core && !dansPerso.has(i.id) && visible(i, hiddenPages));

  const groupes = [
    ...GROUPES.map((g) => ({
      id: g.id,
      titre: g.titre,
      couleur: g.couleur,
      perso: null as SideFolder | null,
      items: [...g.pages.map(page).filter((i): i is SideItem => !!i), ...(g.id === "g_led" ? anciensTableaux : [])],
    })),
    ...persos.map((f) => ({ id: f.id, titre: f.title, couleur: f.color, perso: f, items: f.items.filter((i) => visible(i, hiddenPages)) })),
  ].filter((g) => g.items.length > 0);
  const rangees = new Set(groupes.flatMap((g) => g.items.map((i) => i.id)));
  // Paramètres : la liste prévue, puis toute page d'origine qui n'a pas trouvé de groupe.
  const parametres = [
    ...PARAMETRES.map(page),
    ...items.filter((i) => i.core && visible(i, hiddenPages) && !PARAMETRES.includes(i.page) && !rangees.has(i.id)),
  ].filter((i, n, a): i is SideItem => !!i && a.indexOf(i) === n);

  const [ferme, setFerme] = useState<Record<string, boolean>>(() => Object.fromEntries(groupes.map((g) => [g.id, replie(g.id)])));
  const basculer = (id: string) =>
    setFerme((m) => {
      const v = !m[id];
      try {
        localStorage.setItem(`menu-replie-${id}`, v ? "1" : "0");
      } catch {
        /* non essentiel */
      }
      return { ...m, [id]: v };
    });

  // ── Groupes créés par l'équipe ──
  const creerGroupe = (titre: string) => {
    const id = newId("i");
    const it: SideItem = { id, kind: "view", page: "leads", title: titre, board: `board_${id}`, view: { filters: [], sorts: [], groupBy: "", personKey: "", visible: [] } };
    const f: SideFolder = { id: newId("f"), title: titre, color: COULEURS_GROUPES[persos.length % COULEURS_GROUPES.length], perso: true, items: [it] };
    save({ ...config, folders: [...config.folders, f] });
    onSelect(it);
  };
  const renommer = (folderId: string | null, itemId: string, titre: string) =>
    save({
      ...config,
      folders: config.folders.map((f) => ({
        ...f,
        title: f.id === folderId ? titre : f.title,
        items: f.items.map((i) => (i.id === itemId ? { ...i, title: titre } : i)),
      })),
    });
  // Suppression douce : le tableau va dans la Corbeille (30 jours), ses fiches ne sont jamais effacées.
  const supprimer = (itemIds: string[]) =>
    save({
      ...config,
      favorites: config.favorites.filter((x) => !itemIds.includes(x)),
      folders: config.folders.map((f) => ({ ...f, items: f.items.map((i) => (itemIds.includes(i.id) ? { ...i, deletedAt: new Date().toISOString() } : i)) })),
    });

  const url = (it: SideItem) => `${window.location.origin}/admin#${it.kind === "view" ? `view-${it.id}` : it.page}`;
  const Icone = (it: SideItem) => (it.kind === "view" ? BoardIcon : ICONS[it.page] ?? BoardIcon);

  const Ligne = ({ it, menu }: { it: SideItem; menu?: React.ReactNode }) => {
    const Icon = Icone(it);
    const actif = it.id === activeId;
    return (
      <li className="group/item relative">
        <div className={`flex items-center rounded-lg ${actif ? "bg-[#fff0e6] shadow-[inset_3px_0_0_#ff6a1a]" : "hover:bg-orange-50"}`}>
          <a
            href={url(it)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
              e.preventDefault();
              onSelect(it);
            }}
            className={`flex-1 min-w-0 flex items-center gap-2.5 text-[13.5px] font-semibold pl-3 pr-2 py-[7px] ${actif ? "text-[#c2410c]" : "text-gray-700"}`}
          >
            <Icon size={17} className={`shrink-0 ${actif ? "" : "text-gray-400"}`} />
            <span className="truncate">{it.title}</span>
          </a>
          {menu}
        </div>
      </li>
    );
  };

  if (compact) {
    return (
      <div className="flex flex-col h-full">
        <nav className="crm-scroll flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {groupes.map((g, n) => (
            <div key={g.id} className={n ? "pt-2 mt-2 border-t border-gray-100" : ""}>
              {g.items.map((it) => {
                const Icon = Icone(it);
                return (
                  <button
                    key={it.id}
                    onClick={() => onSelect(it)}
                    title={`${g.titre} · ${it.title}`}
                    className={`w-full flex justify-center py-2.5 rounded-md ${it.id === activeId ? "bg-[#fff0e6] text-[#c2410c]" : "text-gray-500 hover:bg-orange-50"}`}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-100">
          <Parametres items={parametres} activeId={activeId} onSelect={onSelect} compact />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2">
        <NouveauGroupe onCreate={creerGroupe} />
      </div>
      <nav className="crm-scroll flex-1 min-h-0 overflow-y-auto px-2 pb-3 space-y-3">
        {groupes.map((g) => (
          <section key={g.id}>
            <div className="group/head flex items-center gap-1 px-1.5">
              <button onClick={() => basculer(g.id)} className="flex-1 min-w-0 flex items-center gap-2 py-1 text-left">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.couleur }} />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 truncate">{g.titre}</span>
                <ChevronDown size={13} className={`shrink-0 text-gray-400 transition-transform ${ferme[g.id] ? "-rotate-90" : ""}`} />
              </button>
              {g.perso && (
                <MenuPerso
                  titre={g.titre}
                  onRename={(t) => renommer(g.perso!.id, g.items[0]?.id ?? "", t)}
                  onDelete={() => supprimer(g.items.map((i) => i.id))}
                  onOverlay={g.items[0] ? () => onOverlay(g.items[0]) : undefined}
                  confirmation={`Supprimer le groupe « ${g.titre} » ? Il va dans la Corbeille (Paramètres) pendant 30 jours ; ses fiches ne sont pas effacées.`}
                />
              )}
            </div>
            {!ferme[g.id] && (
              <ul className="mt-0.5 space-y-px">
                {g.items.map((it) => (
                  <Ligne
                    key={it.id}
                    it={it}
                    menu={
                      !it.core && !g.perso ? (
                        <MenuPerso
                          titre={it.title}
                          onRename={(t) => renommer(null, it.id, t)}
                          onDelete={() => supprimer([it.id])}
                          onOverlay={() => onOverlay(it)}
                          confirmation={`Supprimer le tableau « ${it.title} » ? Il va dans la Corbeille (Paramètres) pendant 30 jours ; ses fiches ne sont pas effacées.`}
                        />
                      ) : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </nav>
      <div className="px-2 py-1.5 border-t border-gray-100">
        <Parametres items={parametres} activeId={activeId} onSelect={onSelect} />
      </div>
    </div>
  );
}

// Bouton du haut : créer un groupe (avec son tableau, comme Pac Pac).
function NouveauGroupe({ onCreate }: { onCreate: (titre: string) => void }) {
  const [open, setOpen] = useState(false);
  const [titre, setTitre] = useState("");
  const valider = () => {
    const t = titre.trim();
    if (!t) return;
    onCreate(t);
    setTitre("");
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white rounded-lg px-3 py-2 shadow-sm hover:brightness-105 active:scale-[0.99] transition"
          style={{ background: "var(--brand-grad-120)" }}
        >
          <Plus size={16} strokeWidth={3} /> Nouveau groupe
        </button>
      </PopoverTrigger>
      <PopoverContent dir="ltr" align="start" side="right" className={`w-72 p-3 ${POP}`}>
        <p className="text-sm font-bold text-gray-900">Nouveau groupe</p>
        <input
          autoFocus
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && valider()}
          placeholder="Nom du groupe (ex. Clim, Solaire…)"
          className="mt-2 w-full text-sm bg-white text-gray-900 border border-gray-300 rounded-lg px-2.5 py-2 outline-none focus:border-[#1f4b7f]"
        />
        <p className="mt-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Type</p>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border-2 border-[#1f4b7f] bg-[#edf2f8] px-2.5 py-2">
            <p className="text-sm font-bold text-[#173a5e] flex items-center gap-1.5">
              <BoardIcon size={14} /> Tableau
            </p>
            <p className="text-[11px] text-gray-500 leading-snug">comme Pac Pac : fiches, étiquettes, groupes</p>
          </div>
          <div className="rounded-lg border border-dashed border-gray-300 px-2.5 py-2 opacity-60" title="Bientôt">
            <p className="text-sm font-bold text-gray-500">Autre</p>
            <p className="text-[11px] text-gray-400 leading-snug">bientôt</p>
          </div>
        </div>
        <button
          onClick={valider}
          disabled={!titre.trim()}
          className="mt-3 w-full text-sm font-bold text-white bg-[#1f4b7f] hover:bg-[#173a5e] disabled:opacity-40 rounded-lg py-2"
        >
          Créer le groupe
        </button>
      </PopoverContent>
    </Popover>
  );
}

// « ⋯ » d'un groupe ou d'un tableau ajouté : renommer, ouvrir ailleurs, supprimer (corbeille 30 jours).
function MenuPerso({
  titre,
  onRename,
  onDelete,
  onOverlay,
  confirmation,
}: {
  titre: string;
  onRename: (t: string) => void;
  onDelete: () => void;
  onOverlay?: () => void;
  confirmation: string;
}) {
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState<string | null>(null);
  const fermer = () => {
    setOpen(false);
    setNom(null);
  };
  const L = "w-full flex items-center gap-2.5 text-left text-sm px-2.5 py-1.5 rounded-md";
  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : fermer())}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Options de ${titre}`}
          className="mr-1 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 opacity-0 group-hover/item:opacity-100 group-hover/head:opacity-100 data-[state=open]:opacity-100 focus:opacity-100"
        >
          <MoreHorizontal size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent dir="ltr" side="right" align="start" className={`w-60 p-1.5 ${POP}`}>
        {nom !== null ? (
          <div className="p-1">
            <input
              autoFocus
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nom.trim()) {
                  onRename(nom.trim());
                  fermer();
                }
                if (e.key === "Escape") fermer();
              }}
              className="w-full text-sm bg-white text-gray-900 border border-gray-300 rounded-md px-2 py-1.5 outline-none focus:border-[#1f4b7f]"
            />
            <p className="mt-1 text-[11px] text-gray-400">Entrée pour enregistrer</p>
          </div>
        ) : (
          <>
            <button className={`${L} text-gray-700 hover:bg-gray-100`} onClick={() => setNom(titre)}>
              <Pencil size={15} /> Renommer
            </button>
            {onOverlay && (
              <button
                className={`${L} text-gray-700 hover:bg-gray-100`}
                onClick={() => {
                  fermer();
                  onOverlay();
                }}
              >
                <ExternalLink size={15} /> Ouvrir en superposition
              </button>
            )}
            <div className="my-1 border-t border-gray-100" />
            <button
              className={`${L} text-red-600 hover:bg-red-50`}
              onClick={() => {
                fermer();
                if (confirm(confirmation)) onDelete();
              }}
            >
              <Trash2 size={15} /> Supprimer
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// « Paramètres » en bas à gauche : documents, corbeille, archives…
function Parametres({
  items,
  activeId,
  onSelect,
  compact,
}: {
  items: SideItem[];
  activeId: string;
  onSelect: (it: SideItem) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dedans = items.some((i) => i.id === activeId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          title="Paramètres"
          className={`w-full flex items-center gap-2.5 rounded-lg text-sm font-semibold ${compact ? "justify-center py-2.5" : "px-3 py-2"} ${
            dedans ? "bg-[#fff0e6] text-[#c2410c]" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Settings size={18} className="shrink-0" />
          {!compact && <span className="flex-1 text-left">Paramètres</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent dir="ltr" side="right" align="end" className={`w-64 p-1.5 ${POP}`}>
        <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-gray-400">Paramètres</p>
        {items.map((it) => {
          const Icon = it.kind === "view" ? BoardIcon : ICONS[it.page] ?? BoardIcon;
          const actif = it.id === activeId;
          return (
            <button
              key={it.id}
              onClick={() => {
                setOpen(false);
                onSelect(it);
              }}
              className={`w-full flex items-center gap-2.5 text-left text-sm font-semibold px-2.5 py-1.5 rounded-md ${actif ? "bg-[#fff0e6] text-[#c2410c]" : "text-gray-700 hover:bg-gray-100"}`}
            >
              <Icon size={16} className="shrink-0 text-gray-400" />
              <span className="truncate">{it.title}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
