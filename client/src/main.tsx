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

createRoot(document.getElementById("root")!).render(<App />);
