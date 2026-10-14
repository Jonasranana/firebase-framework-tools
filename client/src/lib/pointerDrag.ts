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
  // Zone qui défile toute seule (vite, de plus en plus vite près du bord) quand on en approche.
  scrollEl?: HTMLElement | null;
  // Largeur à gauche occupée par une colonne figée (le défilement à gauche commence après elle).
  leftInset?: () => number;
};

export function startPointerDrag(e: { clientX: number; clientY: number; button: number }, opts: PointerDragOptions) {
  if (e.button !== 0) return;
  const sx = e.clientX;
  const sy = e.clientY;
  let started = false;
  let ghost: HTMLDivElement | null = null;
  let over: string | null = null;
  let px = sx;
  let py = sy;
  let raf = 0;
  let last = 0;

  // Défilement continu : une image sur deux, vitesse proportionnelle à la proximité du bord.
  const tick = (now: number) => {
    raf = 0;
    // Vitesse en pixels par seconde (indépendante de la fluidité de l'écran).
    const dt = Math.min(120, last ? now - last : 16) / 1000;
    last = now;
    const sc = opts.scrollEl;
    if (!started || !sc) return;
    const r = sc.getBoundingClientRect();
    const inset = opts.leftInset?.() ?? 0;
    const zone = 140;
    const leftEdge = r.left + inset;
    let dx = 0;
    let dy = 0;
    if (px < leftEdge + zone) dx = -Math.min(1, (leftEdge + zone - px) / zone) * 3600 * dt;
    else if (px > r.right - zone) dx = Math.min(1, (px - (r.right - zone)) / zone) * 3600 * dt;
    if (py < r.top + 60) dy = -Math.min(1, (r.top + 60 - py) / 60) * 1800 * dt;
    else if (py > r.bottom - 60) dy = Math.min(1, (py - (r.bottom - 60)) / 60) * 1800 * dt;
    if (dx || dy) {
      sc.scrollLeft += dx;
      sc.scrollTop += dy;
      const key = opts.hit(document.elementFromPoint(px, py));
      if (key !== over) {
        over = key;
        opts.onHover(key);
      }
      raf = requestAnimationFrame(tick);
    } else last = 0;
  };

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
    px = ev.clientX;
    py = ev.clientY;
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const up = () => {
    window.removeEventListener("mousemove", move, true);
    window.removeEventListener("mouseup", up, true);
    if (raf) cancelAnimationFrame(raf);
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
