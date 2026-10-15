import { useEffect, useState } from "react";
import { crmFirestore } from "@/lib/crmDb";
import type { LeadFilter, LeadSort } from "@/lib/crmFilters";

// ─────────────────────────────────────────────────────────────────────────
// Menu de gauche modifiable (façon Monday) : un espace de travail (nom
// modifiable), des dossiers (nom, couleur, ordre) et des tableaux/outils
// (renommer, déplacer, favoris, dupliquer, archiver, supprimer). La
// configuration est partagée par toute l'équipe : Firestore crm_boards/sidebar.
// ─────────────────────────────────────────────────────────────────────────
export type AdminPageKey =
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
  | "archives";

// Définition d'un tableau « vue » : un tableau de leads avec ses propres
// filtres, tri, groupement et colonnes (enregistrés dans le tableau).
export type BoardView = {
  filters: LeadFilter[];
  sorts: LeadSort[];
  groupBy: string;
  personKey: string;
  visible: string[];
};

export type SideItem = {
  id: string;
  kind: "page" | "view";
  // Page d'origine (les tableaux « vue » affichent la page Leads).
  page: AdminPageKey;
  title: string;
  // Éléments d'origine : ne peuvent pas être supprimés, seulement archivés.
  core?: boolean;
  archived?: boolean;
  // Mis à la corbeille le (ISO) : caché du menu, restaurable pendant 30 jours.
  deletedAt?: string;
  view?: BoardView;
  // Tableau de leads à part (créé depuis le menu) : identifiant du tableau, ses leads et ses groupes lui sont propres.
  board?: string;
};

export type SideFolder = {
  id: string;
  title: string;
  color: string;
  collapsed?: boolean;
  items: SideItem[];
};

export type SideConfig = {
  workspaceName: string;
  folders: SideFolder[];
  favorites: string[];
};

const item = (page: AdminPageKey, title: string): SideItem => ({ id: `p_${page}`, kind: "page", page, title, core: true });

export const DEFAULT_SIDEBAR: SideConfig = {
  workspaceName: "IP5 Énergie",
  favorites: [],
  folders: [
    {
      id: "f_tableau",
      title: "Tableau IP5",
      color: "#579bfc",
      items: [item("leads", "Pac Pac"), item("artisans", "Artisans")],
    },
    {
      id: "f_crm",
      title: "CRM IP5",
      color: "#fb275d",
      items: [item("documents", "Documents"), item("stats", "Statistiques"), item("bareme", "Barème"), item("corbeille", "Corbeille et doublons")],
    },
    { id: "f_pac", title: "Outils pompe à chaleur", color: "#fdab3d", items: [item("marges", "Marges Prémi"), item("praimy", "Dossiers Prémi")] },
    { id: "f_autres", title: "Autres métiers", color: "#9d50dd", items: [item("gonflage", "Station de gonflage")] },
    { id: "f_archives", title: "Archives Monday", color: "#7f8794", items: [item("archives", "Archives Monday"), item("clients", "Clients (copie Monday)")] },
  ],
};

export const FOLDER_COLORS = [
  "#fb275d", "#ff642e", "#fdab3d", "#cab641", "#00c875", "#037f4c",
  "#66ccff", "#579bfc", "#9d50dd", "#ff5ac4", "#7f8794", "#333333",
];

export const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

// Complète une configuration enregistrée avec les éléments d'origine ajoutés
// depuis (une nouvelle page du CRM apparaît seule dans son dossier d'origine).
export function normalizeConfig(c: Partial<SideConfig> | null | undefined): SideConfig {
  if (!c || !Array.isArray(c.folders) || c.folders.length === 0) return DEFAULT_SIDEBAR;
  // Pages retirées du menu (l'équipe est dans la pastille en haut à droite, doublons dans la corbeille, devis PAC retiré).
  const REMOVED = ["accueil", "doublons", "equipe", "devis"];
  const folders: SideFolder[] = c.folders.map((f) => ({
    ...f,
    items: (Array.isArray(f.items) ? f.items : [])
      .filter((i) => !(i.core && REMOVED.includes(i.page as string)))
      // Anciens « Nouveau tableau » (créés avant que chaque tableau ait ses propres leads) : ils deviennent de vrais tableaux vides.
      .map((i) =>
        i.kind === "view" && !i.board && !i.core && !(i.view?.filters?.length || i.view?.sorts?.length || i.view?.groupBy)
          ? { ...i, board: `board_${i.id}` }
          : i,
      )
      // Corbeille : un tableau supprimé depuis plus de 30 jours quitte définitivement le menu (ses leads ne sont jamais effacés).
      .filter((i) => i.core || !i.deletedAt || Date.now() - new Date(i.deletedAt).getTime() < 30 * 86400000)
      .map((i) => (i.core && i.page === "corbeille" && i.title === "Corbeille" ? { ...i, title: "Corbeille et doublons" } : i)),
  }));
  // Migration : « Pac Pac » (ex-Leads) et « Artisans » vivent dans le dossier « Tableau IP5 ».
  if (!folders.some((f) => f.id === "f_tableau")) {
    const moved: SideItem[] = [];
    for (const f of folders) {
      f.items = f.items.filter((i) => {
        if (i.core && (i.page === "leads" || i.page === "artisans")) {
          moved.push(i.page === "leads" && i.title === "Leads" ? { ...i, title: "Pac Pac" } : i);
          return false;
        }
        return true;
      });
    }
    const def = DEFAULT_SIDEBAR.folders.find((f) => f.id === "f_tableau")!;
    folders.unshift({ ...def, items: moved.length ? moved : def.items });
  }
  // Les demandes incomplètes sont désormais un groupe de Pac Pac : l'ancien tableau séparé disparaît du menu.
  for (const f of folders) f.items = f.items.filter((i) => i.board !== "board_incomplets");
  const present = new Set(folders.flatMap((f) => f.items.filter((i) => i.core).map((i) => i.page)));
  for (const df of DEFAULT_SIDEBAR.folders) {
    for (const di of df.items) {
      if (!present.has(di.page)) {
        const target = folders.find((f) => f.id === df.id) ?? folders[0];
        target.items.push(di);
      }
    }
  }
  return {
    workspaceName: c.workspaceName === "IP5 Energy" || !c.workspaceName ? DEFAULT_SIDEBAR.workspaceName : c.workspaceName,
    folders,
    favorites: Array.isArray(c.favorites) ? c.favorites : [],
  };
}

export const allItems = (c: SideConfig) => c.folders.flatMap((f) => f.items);

// ── Hook : lecture en direct + enregistrement partagé ──────────────────────
export function useSidebar(email: string) {
  const [config, setConfig] = useState<SideConfig>(DEFAULT_SIDEBAR);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { m, db } = await crmFirestore();
        unsub = m.onSnapshot(
          m.doc(db, "crm_boards", "sidebar"),
          (snap) => {
            if (cancelled) return;
            setConfig(normalizeConfig(snap.data()?.config as SideConfig | undefined));
            setLoaded(true);
          },
          () => !cancelled && setLoaded(true),
        );
      } catch {
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const save = async (next: SideConfig) => {
    const previous = config;
    setConfig(next); // affichage immédiat
    try {
      const { m, db } = await crmFirestore();
      await m.setDoc(m.doc(db, "crm_boards", "sidebar"), { config: next, updatedAt: m.serverTimestamp(), updatedBy: email });
      setError("");
    } catch (e) {
      console.error(e);
      setConfig(previous);
      setError("Impossible d'enregistrer le menu (règle Firestore crm_boards ?).");
    }
  };

  return { config, save, loaded, error };
}
