// Équipe du CRM : les trois administrateurs d'origine (identiques à la liste
// des règles Firestore/Storage et de functions/index.js) + les personnes
// ajoutées depuis la page « Équipe » (Firestore crm_team, accès par claim).
export const ROOT_ADMINS: Record<string, string> = {
  "jonassitbon8@gmail.com": "Jonas Sitbon",
  "alexis.sitbon@gmail.com": "Alexis Sitbon",
  "carol.sitbon05@gmail.com": "Carole Sitbon",
};

export const isRootAdmin = (email: string) => email.toLowerCase() in ROOT_ADMINS;

export const memberName = (email: string, fallback = "") =>
  ROOT_ADMINS[email.toLowerCase()] ?? (fallback || email);

export const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export type TeamMember = { email: string; name: string; root: boolean; addedBy: string };
