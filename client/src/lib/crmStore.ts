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

// ─────────────────────────────────────────────────────────────────────────
// Magasin de données partagé : une seule écoute Firestore par collection,
// quel que soit le nombre d'onglets du CRM qui l'utilisent (Leads, Stats…).
// L'écoute reste active tant qu'au moins un écran s'en sert, puis s'arrête
// juste après (pas de lecture inutile quand on quitte le CRM).
// ─────────────────────────────────────────────────────────────────────────
type State<T> = { data: T[] | null; error: string };

function createStore<T>(collectionName: string, map: (id: string, d: Record<string, any>) => T) {
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
      unsub = m.onSnapshot(
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
          emit({ data: list, error: "" });
        },
        (e) => {
          console.error(e);
          emit({ data: state.data, error: "Impossible de charger les données. Vérifiez que vous êtes autorisé, puis rechargez la page." });
        },
      );
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

const leadsStore = createStore<Lead>(CRM_LEADS_COLLECTION, leadFromDoc);
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
    lastActive = { data: raw.data ? raw.data.filter((l) => !l.deletedAt) : null, error: raw.error };
    lastTrash = { data: raw.data ? raw.data.filter((l) => !!l.deletedAt) : null, error: raw.error };
  }
};
export const useLeads = () =>
  useSyncExternalStore(leadsStore.subscribe, () => (derive(), lastActive));
export const useTrashedLeads = () =>
  useSyncExternalStore(leadsStore.subscribe, () => (derive(), lastTrash));
export const useArtisans = () => useSyncExternalStore(artisansStore.subscribe, artisansStore.getSnapshot);
