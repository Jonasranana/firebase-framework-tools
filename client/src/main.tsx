import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Après une mise en ligne, un visiteur dont la page était déjà ouverte peut
// demander un morceau de code qui n'existe plus (nom changé) : la page
// resterait blanche. On recharge alors une seule fois pour récupérer la
// nouvelle version (garde-fou de 30 s contre une boucle de rechargement).
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem("ip5-reload-at") || 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem("ip5-reload-at", String(Date.now()));
  } catch {
    /* stockage indisponible : on recharge quand même */
  }
  event.preventDefault();
  window.location.reload();
});

// Visiteur arrivé par une pub Google (identifiant de clic gclid/gbraid/wbraid
// ou utm_source=google) : on le retient pour toute la visite, afin que sa
// demande arrive étiquetée « google » dans le CRM.
try {
  const q = new URLSearchParams(window.location.search);
  if (q.get("gclid") || q.get("gbraid") || q.get("wbraid") || /google/i.test(q.get("utm_source") ?? ""))
    sessionStorage.setItem("ip5-from", "google");
} catch {
  /* stockage indisponible : pas d'étiquette, la demande arrive quand même */
}

createRoot(document.getElementById("root")!).render(<App />);
