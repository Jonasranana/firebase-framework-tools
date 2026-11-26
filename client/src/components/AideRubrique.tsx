import { useState } from "react";
import { Info, X } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// Petit bloc d'explication en haut de chaque rubrique du CRM (bleu nuit).
// En quelques lignes simples : à quoi sert la page et comment s'en servir.
// « Masquer » le range sur cet appareil ; le bouton « ⓘ » le fait revenir.
// ─────────────────────────────────────────────────────────────────────────
const TEXTES: Record<string, { titre: string; lignes: string[] }> = {
  leads: {
    titre: "Pac Pac : tous nos clients pompe à chaleur",
    lignes: [
      "Une ligne = un client. Touchez le nom pour ouvrir sa fiche, l'étiquette pour changer son statut.",
      "La couleur de la ligne dit depuis quand rien n'a bougé : vert moins de 6 jours, orange 6 à 14 jours, rouge 15 jours et plus.",
    ],
  },
  view: {
    titre: "Un tableau comme Pac Pac",
    lignes: ["Ce tableau marche exactement comme Pac Pac, avec ses propres clients et ses propres groupes."],
  },
  bets: {
    titre: "Dossiers BETS",
    lignes: ["Les clients envoyés chez BETS, notre installateur partenaire : de l'envoi du dossier jusqu'à la pose."],
  },
  stats: {
    titre: "Statistiques",
    lignes: ["Combien de leads arrivent, d'où ils viennent, combien on rappelle et combien signent.", "Choisissez la période en haut de la page."],
  },
  praimy: {
    titre: "Dossiers PRAIMY",
    lignes: ["Les dossiers chez PRAIMY, à jour avec leur plateforme : étape, reste à charge du client, et ce qu'ils attendent de nous (en rouge)."],
  },
  marges: {
    titre: "Simulateur de marge",
    lignes: ["Choisissez la zone et le profil du client : le simulateur calcule ce qu'il nous reste après le matériel, la pose et les primes."],
  },
  bareme: {
    titre: "Barème des aides",
    lignes: ["Les plafonds de revenus pour savoir si un client est bleu, jaune, violet ou rose (ce qui fixe ses aides).", "Renseignez la région et le nombre de personnes du foyer."],
  },
  planning: {
    titre: "Planning chantiers",
    lignes: ["Les clients signés : pré-visites et poses à caler.", "Touchez un client pour fixer les dates, l'heure et le poseur."],
  },
  loan: {
    titre: "Tournées Loan",
    lignes: ["Importez le fichier Excel des dossiers : le CRM organise les poses semaine par semaine, avec la route, les nuits et ce qu'il nous reste."],
  },
  renta: {
    titre: "Rentabilité Meta",
    lignes: ["Ce que rapporte la pub Facebook / Instagram : argent dépensé, leads reçus, clients signés et bénéfice."],
  },
  actus: {
    titre: "Actualités des aides",
    lignes: ["Chaque soir, le CRM résume les nouveautés MaPrimeRénov', CEE et pompe à chaleur, avec les sources."],
  },
  documents: {
    titre: "Documents",
    lignes: ["Tous les fichiers des clients (devis, avis d'imposition, photos…) au même endroit, avec une recherche."],
  },
  corbeille: {
    titre: "Corbeille et doublons",
    lignes: ["Les fiches supprimées restent ici 30 jours : vous pouvez les restaurer.", "L'onglet Doublons repère les clients en double pour les fusionner."],
  },
  pacarchive: {
    titre: "Les archives de Pac Pac",
    lignes: ["Les colonnes rangées de Pac Pac, avec toutes leurs valeurs. Réactivez-en une pour la remettre dans Pac Pac."],
  },
  archives: {
    titre: "Archives Monday",
    lignes: ["La copie de l'ancien tableau Monday, en lecture seule, pour retrouver un ancien client."],
  },
  clients: {
    titre: "Clients (copie Monday)",
    lignes: ["La copie des clients de Monday, en lecture seule."],
  },
  equipe: {
    titre: "Équipe",
    lignes: ["Qui a accès au CRM, et ce que chacun voit et peut faire."],
  },
};

const cle = (page: string) => `crm-aide-masquee-${page}`;

export default function AideRubrique({ page }: { page: string }) {
  const t = TEXTES[page];
  const [masquee, setMasquee] = useState(() => {
    try {
      return localStorage.getItem(cle(page)) === "1";
    } catch {
      return false;
    }
  });
  if (!t) return null;
  const changer = (v: boolean) => {
    setMasquee(v);
    try {
      localStorage.setItem(cle(page), v ? "1" : "0");
    } catch {
      /* non essentiel */
    }
  };
  if (masquee)
    return (
      <div className="flex justify-end -mb-1">
        <button
          onClick={() => changer(false)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1f4b7f] hover:underline"
          title="Afficher l'explication de cette page"
        >
          <Info size={13} /> À quoi sert cette page ?
        </button>
      </div>
    );
  return (
    <div className="relative mb-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#173a5e] to-[#2b5a8f] px-4 py-3 pr-10 text-white shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200">En bref</p>
      <p className="mt-0.5 text-[15px] font-extrabold leading-snug">{t.titre}</p>
      <ul className="mt-1 space-y-0.5">
        {t.lignes.map((l) => (
          <li key={l} className="text-[13px] leading-snug text-white/90">
            {l}
          </li>
        ))}
      </ul>
      <button onClick={() => changer(true)} aria-label="Masquer l'explication" className="absolute right-2 top-2 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
        <X size={16} />
      </button>
    </div>
  );
}
