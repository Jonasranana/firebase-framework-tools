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
  | "accueil"
  | "leads"
  | "artisans"
  | "stats"
  | "documents"
  | "doublons"
  | "corbeille"
  | "equipe"
  | "devis"
  | "marges"
  | "gonflage"
  | "clients"
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
  view?: BoardView;
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
      id: "f_crm",
      title: "CRM IP5",
      color: "#fb275d",
      items: [
        item("accueil", "Accueil"),
        item("leads", "Leads"),
        item("artisans", "Artisans"),
        item("documents", "Documents"),
        item("stats", "Statistiques"),
        item("doublons", "Doublons"),
        item("corbeille", "Corbeille"),
        item("equipe", "Équipe"),
      ],
    },
    { id: "f_pac", title: "Outils pompe à chaleur", color: "#fdab3d", items: [item("devis", "Devis PAC"), item("marges", "Marges Prémi")] },
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
  const folders: SideFolder[] = c.folders.map((f) => ({ ...f, items: Array.isArray(f.items) ? f.items : [] }));
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
    workspaceName: c.workspaceName || DEFAULT_SIDEBAR.workspaceName,
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
