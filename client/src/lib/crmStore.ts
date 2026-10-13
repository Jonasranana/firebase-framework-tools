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
        (snap) => emit({ data: snap.docs.map((d) => map(d.id, d.data())), error: "" }),
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

export const useLeads = () => useSyncExternalStore(leadsStore.subscribe, leadsStore.getSnapshot);
export const useArtisans = () => useSyncExternalStore(artisansStore.subscribe, artisansStore.getSnapshot);
