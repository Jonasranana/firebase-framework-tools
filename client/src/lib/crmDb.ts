import { getEspaceProApp } from "@/lib/espacePro";

// ─────────────────────────────────────────────────────────────────────────
// Accès Firestore partagé par tout le CRM (/admin). Le cache local persistant
// (IndexedDB) garde les leads et artisans sur l'appareil : à la réouverture
// l'écran s'affiche tout de suite et Firestore n'envoie que ce qui a changé
// (moins de lecture, donc plus rapide et moins coûteux). Si le navigateur ne
// le permet pas (navigation privée…), on retombe sur le mode normal.
// ─────────────────────────────────────────────────────────────────────────
let dbPromise: Promise<{ m: typeof import("firebase/firestore"); db: any }> | null = null;

export function crmFirestore() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const app = await getEspaceProApp();
      const m = await import("firebase/firestore");
      let db: any;
      try {
        db = m.initializeFirestore(app, {
          localCache: m.persistentLocalCache({
            tabManager: m.persistentMultipleTabManager(),
          }),
        });
      } catch {
        // Déjà initialisé ailleurs (ou cache indisponible) : instance existante.
        db = m.getFirestore(app);
      }
      return { m, db };
    })();
  }
  return dbPromise;
}
