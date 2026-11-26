// ─────────────────────────────────────────────────────────────────────────
// D'où vient le visiteur ? On garde les paramètres de la pub présents dans le lien
// (utm_source / utm_campaign / utm_content / utm_term, ou fbclid de Facebook)
// pendant 30 jours sur l'appareil, pour les joindre à sa demande. Rien n'est
// visible pour le visiteur. Dans Meta (Gestionnaire de publicités → Paramètres d'URL) :
//   utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}
// ─────────────────────────────────────────────────────────────────────────
const CLE = "ip5-pub";
const DUREE = 30 * 86400000;
export type PubOrigine = { source: string; campagne: string; annonce: string; ensemble: string; page: string };

const net = (v: string | null) => String(v ?? "").trim().slice(0, 120);

export function notePub() {
  try {
    const q = new URLSearchParams(window.location.search);
    const source = net(q.get("utm_source")) || (q.get("fbclid") ? "facebook" : "");
    const campagne = net(q.get("utm_campaign"));
    const annonce = net(q.get("utm_content"));
    const ensemble = net(q.get("utm_term"));
    if (!source && !campagne && !annonce) return;
    localStorage.setItem(CLE, JSON.stringify({ source, campagne, annonce, ensemble, page: window.location.pathname.slice(0, 60), at: Date.now() }));
  } catch {
    /* jamais bloquant */
  }
}

export function pubOrigine(): PubOrigine | null {
  try {
    const p = JSON.parse(localStorage.getItem(CLE) || "null");
    if (!p || typeof p.at !== "number" || Date.now() - p.at > DUREE) return null;
    return { source: net(p.source), campagne: net(p.campagne), annonce: net(p.annonce), ensemble: net(p.ensemble), page: net(p.page) };
  } catch {
    return null;
  }
}
