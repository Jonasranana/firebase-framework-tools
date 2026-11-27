import { useSyncExternalStore } from "react";
import {
  CRM_ARTISANS_COLLECTION,
  CRM_LEADS_COLLECTION,
  artisanFromDoc,
  leadFromDoc,
  type Artisan,
  type Lead,
} from "@/lib/crm";
import { crmFirestore } from "@/lib/crmDb";
import { chrono } from "@/lib/chrono";

// ─────────────────────────────────────────────────────────────────────────
// Magasin de données partagé : une seule écoute Firestore par collection,
// quel que soit le nombre d'onglets du CRM qui l'utilisent (Leads, Stats…).
// L'écoute reste active tant qu'au moins un écran s'en sert, puis s'arrête
// juste après (pas de lecture inutile quand on quitte le CRM).
// ─────────────────────────────────────────────────────────────────────────
// partiel : seules les fiches les plus récentes sont arrivées (premier chargement sans cache), la suite arrive.
type State<T> = { data: T[] | null; error: string; partiel?: boolean };

function createStore<T>(collectionName: string, map: (id: string, d: Record<string, any>) => T, premiers = 0) {
  let state: State<T> = { data: null, error: "" };
  const listeners = new Set<() => void>();
  let cache = new Map<string, T>();
  let unsub: (() => void) | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = (next: State<T>) => {
    state = next;
    listeners.forEach((l) => l());
  };

  const start = async () => {
    try {
      const { m, db } = await crmFirestore();
      if (!listeners.size) return; // plus personne n'écoute entre-temps
      const tEcoute = performance.now();
      let premiereReponse = true;
      // Affichage tout de suite : si la liste complète tarde (téléphone sans cache), on montre d'abord
      // les « premiers » documents les plus récents, puis tout le reste dès qu'il arrive.
      let complet = false;
      let stopPartiel: (() => void) | null = null;
      if (premiers > 0) {
        stopPartiel = m.onSnapshot(
          m.query(m.collection(db, collectionName), m.orderBy("createdAt", "desc"), m.limit(premiers)),
          (snap) => {
            if (complet || snap.empty) return;
            emit({ data: snap.docs.map((d) => map(d.id, d.data())), error: "", partiel: true });
            if (collectionName === CRM_LEADS_COLLECTION) chrono.depuisOuverture("fiches-premieres", snap.size);
          },
          () => {},
        );
      }
      const unsubComplet = m.onSnapshot(
        m.query(m.collection(db, collectionName), m.orderBy("createdAt", "desc")),
        (snap) => {
          // On ne retraduit que les documents modifiés : les autres gardent le même objet,
          // ce qui évite de redessiner des milliers de lignes à chaque modification.
          const changed = new Set(snap.docChanges().map((c) => c.doc.id));
          const next = new Map<string, T>();
          const list = snap.docs.map((d) => {
            const old = cache.get(d.id);
            const item = old !== undefined && !changed.has(d.id) ? old : map(d.id, d.data());
            next.set(d.id, item);
            return item;
          });
          cache = next;
          if (premiereReponse && collectionName === CRM_LEADS_COLLECTION) {
            // Chronomètre : temps entre le début de l'écoute et la 1re réponse (depuis la mémoire de l'appareil ou le serveur).
            premiereReponse = false;
            chrono.noter("ecoute-reponse", performance.now() - tEcoute, snap.metadata.fromCache ? "memoire" : "serveur");
          }
          if (!complet) {
            complet = true;
            stopPartiel?.();
            stopPartiel = null;
          }
          emit({ data: list, error: "" });
          // Chronomètre invisible : arrivée des fiches (depuis le cache de l'appareil, puis depuis le serveur).
          if (collectionName === CRM_LEADS_COLLECTION) {
            chrono.depuisOuverture("fiches-arrivees", list.length);
            if (!snap.metadata.fromCache) chrono.depuisOuverture("fiches-serveur", list.length);
          }
        },
        (e) => {
          console.error(e);
          emit({ data: state.data, error: "Impossible de charger les données. Vérifiez que vous êtes autorisé, puis rechargez la page." });
        },
      );
      unsub = () => {
        unsubComplet();
        stopPartiel?.();
      };
    } catch (e) {
      console.error(e);
      emit({ data: null, error: "Impossible de se connecter à la base de données." });
    }
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (stopTimer) {
        clearTimeout(stopTimer);
        stopTimer = null;
      }
      if (!unsub && listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          stopTimer = setTimeout(() => {
            unsub?.();
            unsub = null;
          }, 30_000);
        }
      };
    },
    getSnapshot: () => state,
  };
}

const leadsStore = createStore<Lead>(CRM_LEADS_COLLECTION, leadFromDoc, 300);
const artisansStore = createStore<Artisan>(CRM_ARTISANS_COLLECTION, artisanFromDoc);

// Fiches actives / fiches à la corbeille, dérivées du même flux (mises en cache
// tant que le flux ne change pas, pour garder une référence stable).
let lastRaw: State<Lead> | null = null;
let lastActive: State<Lead> = { data: null, error: "" };
let lastTrash: State<Lead> = { data: null, error: "" };
const derive = () => {
  const raw = leadsStore.getSnapshot();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastActive = { data: raw.data ? raw.data.filter((l) => !l.deletedAt) : null, error: raw.error, partiel: raw.partiel };
    lastTrash = { data: raw.data ? raw.data.filter((l) => !!l.deletedAt) : null, error: raw.error };
  }
};
export const useLeads = () =>
  useSyncExternalStore(leadsStore.subscribe, () => (derive(), lastActive));
export const useTrashedLeads = () =>
  useSyncExternalStore(leadsStore.subscribe, () => (derive(), lastTrash));
export const useArtisans = () => useSyncExternalStore(artisansStore.subscribe, artisansStore.getSnapshot);
