import { NEWS_VIEWERS, RENTA_VIEWERS, STATS_VIEWERS, TOTALS_VIEWERS } from "@/lib/crm";
import { isRootAdmin } from "@/lib/crmTeam";

// ─────────────────────────────────────────────────────────────────────────
// Ce que chaque compte peut voir et faire dans le CRM, d'après les listes
// d'accès du code (TOTALS_VIEWERS, NEWS_VIEWERS, RENTA_VIEWERS, administrateurs).
// Sert à la page « Équipe ». Si une liste d'accès change ailleurs, cette page
// suit toute seule.
// ─────────────────────────────────────────────────────────────────────────
export type Acces = { label: string; ok: boolean; detail?: string };
export type GroupeAcces = { titre: string; items: Acces[] };

export function accesDe(email: string): GroupeAcces[] {
  const e = email.toLowerCase();
  const argent = TOTALS_VIEWERS.includes(e);
  const direction = NEWS_VIEWERS.includes(e);
  const renta = RENTA_VIEWERS.includes(e);
  const admin = isRootAdmin(e);
  return [
    {
      titre: "Tableaux et pages",
      items: [
        { label: "Pac Pac (tous les leads)", ok: true, detail: "voit toutes les fiches, pas seulement les siennes" },
        { label: "Dossiers PRAIMY", ok: true },
        { label: "Dossiers BETS", ok: true },
        { label: "Devis PAC", ok: true },
        { label: "Artisans", ok: true },
        { label: "Documents", ok: true },
        { label: "Équipe & leads (statistiques)", ok: STATS_VIEWERS.includes(e), detail: STATS_VIEWERS.includes(e) ? (argent ? "avec les montants" : "sans les montants") : undefined },
        { label: "Barème", ok: true },
        { label: "Corbeille et doublons", ok: true },
        { label: "Archives Monday et clients (copie Monday)", ok: true },
        { label: "Marges PRAIMY", ok: argent },
        { label: "Tournées Loan", ok: argent },
        { label: "Planning chantiers", ok: direction },
        { label: "Actualités aides", ok: direction },
        { label: "Pub Meta (rentabilité)", ok: renta },
      ],
    },
    {
      titre: "Argent",
      items: [
        { label: "Colonnes montants, marges, primes CEE / MPR", ok: argent },
        { label: "Totaux en bas des groupes", ok: argent },
        { label: "Montants dans les statistiques", ok: argent && STATS_VIEWERS.includes(e) },
      ],
    },
    {
      titre: "Actions",
      items: [
        { label: "Modifier les fiches, statuts, groupes, notes", ok: true },
        { label: "Envoyer des SMS / e-mails depuis une fiche", ok: true },
        { label: "Mettre une fiche à la corbeille", ok: true },
        { label: "Ajouter, renommer ou supprimer des colonnes", ok: true },
        { label: "Relance et réponses par IA", ok: direction },
        { label: "Ajouter ou retirer des personnes de l'équipe", ok: admin },
        { label: "Modifier le profil des autres", ok: admin, detail: admin ? undefined : "seulement le sien" },
      ],
    },
  ];
}
