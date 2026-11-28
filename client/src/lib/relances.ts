// ─────────────────────────────────────────────────────────────────────────
// Relances à faire (Pac Pac) : les leads qu'on risque de perdre.
//  - NRP : rappeler 4 h après un premier NRP, 24 h après un « NRP 2 » (pendant 14 jours).
//  - Proposition envoyée sans nouvelles : relancer à J+3, puis J+7 (pendant 30 jours).
// Rien n'est enregistré ni envoyé automatiquement : la liste se recalcule toute seule,
// et une fiche sort de la liste dès qu'on note quelque chose ou qu'on change son statut.
// Un rappel programmé (colonne Rappel) dans le futur passe avant : la fiche n'apparaît pas.
// ─────────────────────────────────────────────────────────────────────────
import { statusInfo, type Lead } from "@/lib/crm";

export type Relance = { lead: Lead; type: "nrp" | "propal"; motif: string; depuis: number };

const H = 3600000;
const J = 24 * H;

// Dernière action de l'équipe sur la fiche : changement de statut ou note d'un membre (adresse e-mail).
export const derniereAction = (l: Lead) => {
  const notes = (l.notes ?? []).filter((n) => /@/.test(n.by ?? "")).map((n) => Date.parse(n.at)).filter((t) => !Number.isNaN(t));
  return Math.max(Date.parse(l.statusChangedAt || l.updatedAt || l.createdAt || "") || 0, ...notes);
};

const duree = (ms: number) => {
  const h = Math.floor(ms / H);
  return h < 24 ? `${Math.max(1, h)} h` : `${Math.floor(h / 24)} j`;
};

export function relancesAFaire(leads: Lead[], now = Date.now()): Relance[] {
  const out: Relance[] = [];
  for (const l of leads) {
    if (l.deletedAt) continue;
    if (l.rappelLe && Date.parse(l.rappelLe) > now) continue;
    const label = String(statusInfo(l.status).label ?? "");
    const depuis = now - derniereAction(l);
    if (/nrp/i.test(label) || /^nrp/.test(l.status)) {
      const second = /2|deux/i.test(label);
      const attente = second ? 24 * H : 4 * H;
      if (depuis >= attente && depuis < 14 * J) out.push({ lead: l, type: "nrp", motif: `${second ? "NRP 2" : "NRP"} depuis ${duree(depuis)}`, depuis });
    } else if (/propal|proposition/i.test(label) && !/faire/i.test(label)) {
      if (depuis >= 3 * J && depuis < 30 * J) out.push({ lead: l, type: "propal", motif: `Proposition sans nouvelles depuis ${duree(depuis)}`, depuis });
    }
  }
  // Propositions d'abord (de l'argent sur la table), puis les plus récentes en premier : ce sont les plus « chaudes ».
  return out.sort((a, b) => (a.type === b.type ? a.depuis - b.depuis : a.type === "propal" ? -1 : 1));
}

// Prénom de la personne qui relance (pour signer le SMS).
export function prenomEquipe(nom: string) {
  const base = nom.includes("@") ? nom.split("@")[0] : nom;
  if (/^meba/i.test(base)) return "Mebarek";
  const p = base.split(/[\s._-]+/)[0].replace(/\d+/g, "");
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : "";
}

export const TEL_IP5 = "07 49 52 52 67";

export function smsRelance(r: Relance, moi: string) {
  const prenom = String(r.lead.name ?? "").trim().split(/\s+/)[0] ?? "";
  const bonjour = prenom ? `Bonjour ${prenom[0].toUpperCase()}${prenom.slice(1).toLowerCase()}` : "Bonjour";
  const qui = moi ? `ici ${moi} d'IP5 Énergie` : "ici IP5 Énergie";
  return r.type === "nrp"
    ? `${bonjour}, ${qui}. J'ai essayé de vous joindre au sujet de vos aides pour la pompe à chaleur. Quand puis-je vous rappeler ? Vous pouvez aussi me joindre au ${TEL_IP5}.`
    : `${bonjour}, ${qui}. Avez-vous pu regarder la proposition pour votre pompe à chaleur ? Je reste disponible pour en parler, au ${TEL_IP5}.`;
}

// Lien SMS : ouvre l'application Messages du téléphone avec le texte déjà écrit (rien n'est envoyé sans vous).
export const lienSms = (tel: string, texte: string) => {
  const n = String(tel ?? "").replace(/[^\d+]/g, "");
  const ios = typeof navigator !== "undefined" && /iPhone|iPad|Mac/i.test(navigator.userAgent);
  return `sms:${n}${ios ? "&" : "?"}body=${encodeURIComponent(texte)}`;
};
