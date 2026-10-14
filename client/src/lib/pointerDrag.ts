// Glisser-déposer à la souris (colonnes, groupes) : plus fiable que le glisser-déposer
// natif du navigateur, qui s'annule dès que l'écran se redessine. Un simple clic (sans
// déplacement) n'est pas pris pour un glissement.
export type PointerDragOptions = {
  label: string;
  color?: string;
  // Élément survolé → clé de la cible (ou null si ce n'en est pas une).
  hit: (el: Element | null) => string | null;
  onStart?: () => void;
  onHover: (key: string | null) => void;
  onDrop: (key: string) => void;
  onEnd: () => void;
  // Zone qui défile toute seule quand on approche de son bord.
  scrollEl?: HTMLElement | null;
};

export function startPointerDrag(e: { clientX: number; clientY: number; button: number }, opts: PointerDragOptions) {
  if (e.button !== 0) return;
  const sx = e.clientX;
  const sy = e.clientY;
  let started = false;
  let ghost: HTMLDivElement | null = null;
  let over: string | null = null;

  const move = (ev: MouseEvent) => {
    if (!started) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      started = true;
      ghost = document.createElement("div");
      ghost.textContent = opts.label;
      Object.assign(ghost.style, {
        position: "fixed",
        zIndex: "100000",
        pointerEvents: "none",
        padding: "6px 14px",
        borderRadius: "8px",
        background: opts.color ?? "#0073ea",
        color: "#fff",
        font: "600 13px Inter, system-ui, sans-serif",
        boxShadow: "0 8px 24px rgba(0,0,0,.28)",
        maxWidth: "260px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: "grabbing",
      } as Partial<CSSStyleDeclaration>);
      document.body.appendChild(ghost);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      opts.onStart?.();
    }
    if (ghost) {
      ghost.style.left = `${ev.clientX + 14}px`;
      ghost.style.top = `${ev.clientY + 10}px`;
    }
    const key = opts.hit(document.elementFromPoint(ev.clientX, ev.clientY));
    if (key !== over) {
      over = key;
      opts.onHover(key);
    }
    const sc = opts.scrollEl;
    if (sc) {
      const r = sc.getBoundingClientRect();
      if (ev.clientX < r.left + 70) sc.scrollLeft -= 22;
      else if (ev.clientX > r.right - 70) sc.scrollLeft += 22;
      if (ev.clientY < r.top + 50) sc.scrollTop -= 18;
      else if (ev.clientY > r.bottom - 50) sc.scrollTop += 18;
    }
  };

  const up = () => {
    window.removeEventListener("mousemove", move, true);
    window.removeEventListener("mouseup", up, true);
    if (!started) return;
    ghost?.remove();
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    // Le clic qui suit le relâchement ne doit rien déclencher (ex. renommer la colonne).
    const swallow = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    if (over) opts.onDrop(over);
    opts.onHover(null);
    opts.onEnd();
  };

  window.addEventListener("mousemove", move, true);
  window.addEventListener("mouseup", up, true);
}
