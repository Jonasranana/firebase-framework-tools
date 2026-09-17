// Pile de navigation interne partagée : chaque niveau ouvert (onglet,
// modale...) pousse une entrée d'historique du navigateur, pour que le
// bouton "précédent" ferme ce niveau au lieu de quitter la page. Un seul
// écouteur popstate global dépile toujours le niveau le plus récent, même
// quand plusieurs niveaux sont ouverts en même temps (ex. modale au-dessus
// d'un onglet). Utilisé via le hook useBrowserBackLevel.

type Handler = () => void;

const stack: Handler[] = [];
let installed = false;

function install() {
  if (installed) return;
  installed = true;
  window.addEventListener("popstate", () => {
    const handler = stack.pop();
    handler?.();
  });
}

// Ouvre un niveau : pousse une entrée d'historique et enregistre le
// gestionnaire à appeler si le bouton "précédent" du navigateur le ferme.
// Retourne une fonction à appeler quand ce niveau se ferme depuis l'app
// (pas depuis le bouton précédent, qui a déjà dépilé son entrée) : elle
// consomme l'entrée d'historique correspondante pour rester synchronisée.
export function pushBackLevel(onBack: Handler): () => void {
  install();
  history.pushState({ ip5BackLevel: stack.length + 1 }, "");
  stack.push(onBack);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const idx = stack.lastIndexOf(onBack);
    if (idx === -1) return; // déjà dépilé par le bouton précédent
    const wasTop = idx === stack.length - 1;
    stack.splice(idx, 1);
    if (wasTop) history.back();
  };
}
