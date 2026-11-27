import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ─────────────────────────────────────────────────────────────────────────
// Petit bloc d'explication en haut de chaque rubrique du CRM (bleu nuit).
// En quelques lignes simples : à quoi sert la page et comment s'en servir.
// Affiché sous forme de petit « ⓘ » dans l'en-tête, en haut à droite.
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
    titre: "Équipe & leads",
    lignes: ["Combien de leads arrivent, à quelle vitesse on les rappelle, combien avancent, et qui a quoi dans son portefeuille.", "Le reste (profil des leads, horaires…) est dans « Voir plus de détails », en bas."],
  },
  praimy: {
    titre: "Nos clients PRAIMY",
    lignes: ["Les clients signés chez PRAIMY. Pour chacun : où on en est (les 8 points d'avancement, cliquez quand une étape est faite), la prochaine action, les dates.", "En rouge : ce que PRAIMY attend de nous."],
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
    titre: "Pub Meta",
    lignes: ["Ce que rapporte la pub Facebook / Instagram : argent dépensé, clients signés et bénéfice.", "Plus bas : quelle annonce marche, et où les visiteurs quittent le formulaire du site."],
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
  activite: {
    titre: "Activité de l'équipe",
    lignes: ["Qui se connecte au CRM, combien de temps, sur ordinateur ou téléphone, sur quelles pages, et combien d'actions sur les fiches.", "Visible seulement par Jonas."],
  },
  equipe: {
    titre: "Équipe",
    lignes: ["Qui a accès au CRM, et ce que chacun voit et peut faire."],
  },
};

// Petit « ⓘ » rond en haut à droite (dans l'en-tête) : un toucher affiche à quoi sert la page.
export default function AideRubrique({ page }: { page: string }) {
  const t = TEXTES[page];
  if (!t) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="À quoi sert cette page ?"
          title="À quoi sert cette page ?"
          className="w-8 h-8 shrink-0 rounded-full border border-[#dde6f1] bg-[#edf2f8] text-[#1f4b7f] flex items-center justify-center hover:bg-[#dde6f1] transition"
        >
          <Info size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent dir="ltr" align="end" className="w-80 p-0 overflow-hidden border-0 shadow-xl">
        <div className="bg-gradient-to-r from-[#173a5e] to-[#2b5a8f] px-4 py-3 text-white">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200">En bref</p>
          <p className="mt-0.5 text-[15px] font-extrabold leading-snug">{t.titre}</p>
          <ul className="mt-1 space-y-0.5">
            {t.lignes.map((l) => (
              <li key={l} className="text-[13px] leading-snug text-white/90">
                {l}
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
