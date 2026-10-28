// Vitesse de connexion de l'appareil : sert à alléger le CRM (moins de préchargement, listes plus courtes)
// quand la connexion est lente ou en économie de données. Prudent : si le navigateur ne dit rien, on suppose « rapide ».
type Conn = { saveData?: boolean; effectiveType?: string; downlink?: number };
const conn = (): Conn | undefined => (typeof navigator !== "undefined" ? ((navigator as any).connection as Conn | undefined) : undefined);

export const isSlowConnection = () => {
  const c = conn();
  if (!c) return false;
  return !!c.saveData || c.effectiveType === "slow-2g" || c.effectiveType === "2g" || c.effectiveType === "3g" || (typeof c.downlink === "number" && c.downlink > 0 && c.downlink < 1.5);
};

// Exécute une tâche quand le navigateur est au repos (ou presque), jamais sur connexion lente.
export const whenIdle = (task: () => void, timeout = 2500) => {
  if (isSlowConnection()) return;
  const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => void) | undefined;
  if (ric) ric(task, { timeout });
  else setTimeout(task, 800);
};
