import { statusInfo, type Lead } from "@/lib/crm";

// ─────────────────────────────────────────────────────────────────────────
// Barème des clients signés, partagé par « Rentabilité Meta » et « Planning chantiers ».
// ─────────────────────────────────────────────────────────────────────────
// Marge d'un signé — barème donné par Alexis (12/11/2026) :
//   CEE touchée : H1 bleu 8 517 €, H1 jaune/violet 4 580 € ; H2 bleu 7 080 €, H2 jaune/violet 3 822 €.
//   MaPrimeRénov' : bleu 5 000 €, jaune 4 000 €, violet (classique) 3 000 €.
//   Frais Praimy : bleu 600 €, jaune 500 €, violet 400 €.
//   Fourni-posé : Praimy 5 800 €, Georges 5 300 € (colonne « Poseur »).
// Marge = CEE + MaPrimeRénov' − frais Praimy − fourni-posé, au moins 2 500 € (reste à charge client).
// « 💵 Marge nette » saisie sur la fiche prend le pas sur ce calcul.
export const MARGE_MIN = 2500;
export const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
export const CEE_IP5: Record<string, number> = {
  "H1 bleu": 8517, "H1 jaune": 4580, "H1 classique": 4580,
  "H2 bleu": 7080, "H2 jaune": 3822, "H2 classique": 3822,
};
export const MPR_PROFIL: Record<string, number> = { bleu: 5000, jaune: 4000, classique: 3000 };
export const FRAIS_PRAIMY: Record<string, number> = { bleu: 600, jaune: 500, classique: 400 };
export const POSE = { praimy: 5800, georges: 5300 };
export const profilOf = (l: Lead) => String(l.fields.zoneProfil ?? "").split(" ")[1] ?? "";
export const estGeorges = (l: Lead) => /georges/i.test(String(l.fields.poseur ?? ""));
export const ceeIp5 = (l: Lead): number | null => CEE_IP5[String(l.fields.zoneProfil ?? "")] ?? num(l.fields.primeCee);
export const mprOf = (l: Lead): number | null => MPR_PROFIL[profilOf(l)] ?? num(l.fields.mprPraimy);
export const fraisOf = (l: Lead): number => (estGeorges(l) ? 0 : FRAIS_PRAIMY[profilOf(l)] ?? 0);
export const poseOf = (l: Lead): number => (estGeorges(l) ? POSE.georges : POSE.praimy);
// Ce qu'on touche avec la CEE seule (versée ~1 semaine après la pose) : CEE − fourni-posé.
// Négatif = la CEE ne couvre pas la pose : on attend l'octroi MaPrimeRénov' avant d'installer (on n'avance rien).
export const mprRecue = (l: Lead) => l.fields.mprRecue === "oui";
export const ceeSeule = (l: Lead): number | null => {
  const cee = ceeIp5(l);
  return cee === null ? null : cee - poseOf(l);
};
export function margeOf(l: Lead): { marge: number | null; calc: boolean } {
  const saisie = num(l.fields.margeNette);
  if (saisie !== null) return { marge: saisie, calc: false };
  const cee = ceeIp5(l);
  const mpr = mprOf(l);
  if (cee === null && mpr === null) return { marge: null, calc: true };
  return { marge: Math.max(MARGE_MIN, (cee ?? 0) + (mpr ?? 0) - fraisOf(l) - poseOf(l)), calc: true };
}
// Client signé : étiquettes « Signé en octobre / novembre… » (ajoutées dans le CRM, clés o_…).
export const isSigne = (l: Lead) => (l.status as string) === "o_yt99h" || /^sign/i.test(String(statusInfo(l.status).label ?? "").trim());
export const moisSigne = (l: Lead) => String(statusInfo(l.status).label ?? "").match(/sign[ée]\s+en\s+(\S+)/i)?.[1] ?? "—";
