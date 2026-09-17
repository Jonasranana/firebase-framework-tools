import { FIREBASE_CONFIG } from "@/pages/site-chrome";

// ─────────────────────────────────────────────────────────────────────────
// Instance Firebase partagée par les onglets de l'Espace Pro (Devis, Marges
// Prémi, Clients). authDomain = domaine du site public, pour que la
// connexion Google se fasse en même origine et que la session soit
// réutilisable pour lire Firestore (règles basées sur request.auth).
// ─────────────────────────────────────────────────────────────────────────
const APP_NAME = "espace-pro";

export async function getEspaceProApp() {
  const { initializeApp, getApps } = await import("firebase/app");
  return (
    getApps().find((a) => a.name === APP_NAME) ??
    initializeApp(
      { ...FIREBASE_CONFIG, authDomain: "ip5-energie.web.app" },
      APP_NAME,
    )
  );
}
