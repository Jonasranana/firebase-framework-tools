// ─────────────────────────────────────────────────────────────────────────
// « Quoi de neuf dans le CRM » : fenêtre affichée une seule fois à chaque
// personne après une mise en ligne (voir components/Nouveautes.tsx).
// À CHAQUE MISE EN LIGNE QUI CHANGE LE CRM OU LE SITE : ajouter une entrée EN
// HAUT de la liste (id unique, date, titre, points en français simple).
// `pour` = liste d'e-mails qui la voient (absent = toute l'équipe).
// ─────────────────────────────────────────────────────────────────────────
import { NEWS_VIEWERS } from "@/lib/crm";

export type Nouveaute = {
  id: string;
  date: string; // AAAA-MM-JJ
  titre: string;
  emoji: string;
  points: string[];
  pour?: string[];
};

export const NOUVEAUTES: Nouveaute[] = [
  {
    id: "2026-11-04-facebook",
    date: "2026-11-04",
    emoji: "📘",
    titre: "Prospects du formulaire Facebook : colonnes remplies",
    points: [
      "Les prospects du formulaire Facebook remplissent maintenant les colonnes « 🔥 Chauffage (Site) » et « Date 1er contact », comme ceux du site.",
      "Nouvelle étiquette « 📘 Formulaire Facebook » dans « 📥 Type de demande » : on voit tout de suite d'où vient le prospect.",
      "Pastille bleue « 💰 Revenu à demander » sur les prospects Facebook : Facebook ne nous donne pas leurs revenus. Demandez le revenu fiscal au premier appel et tapez-le dans « 💰 Revenu fiscal (Calcul) » : la couleur des aides s'affiche toute seule et la pastille disparaît.",
    ],
  },
  {
    id: "2026-11-04-relance",
    date: "2026-11-04",
    emoji: "🤖",
    titre: "Assistant de relance : l'IA planifie la suite de chaque appel",
    pour: NEWS_VIEWERS,
    points: [
      "Rien ne change pour écrire : après un appel, mettez votre résumé dans la bulle de discussion du client et envoyez-le comme d'habitude. L'équipe reçoit toujours le mail.",
      "Sous chaque message, un bouton violet « 🤖 Analyser et planifier la relance » apparaît. Appuyez dessus sur le message de votre choix.",
      "En 10 à 30 secondes, l'IA écrit sa proposition juste en dessous, dans la discussion, toujours dans le même ordre : le résumé, la fiche « Infos client » (logement, chauffage, foyer et revenus, projet, freins, disponibilités, documents), ce qui a été négocié, ce que le client et IP5 doivent faire, la prochaine action, le jour et l'heure du rappel, l'étiquette et l'étape du dossier.",
      "« ✏️ Modifier » pour changer une date ou une étiquette, puis « ✅ Valider » : le rappel arrive dans « À rappeler », l'étiquette et l'étape changent, et le dossier bouge tout seul dans « Suivi des dossiers ».",
      "Un message de relance est souvent proposé : « 📋 Copier » ou « WhatsApp » pour l'envoyer au client.",
      "Réservé à Jonas, Alexis et Carole (et au compte contact@).",
    ],
  },
  {
    id: "2026-11-04-actus",
    date: "2026-11-04",
    emoji: "📰",
    titre: "Nouvelle page « Actualités aides », chaque soir à 20 h",
    pour: NEWS_VIEWERS,
    points: [
      "Tous les soirs vers 20 h, le point sur MaPrimeRénov', les primes CEE, la fiche pompe à chaleur et la réglementation, avec les sources.",
      "Pour chaque nouvelle : « Pour IP5 », ce que ça change concrètement pour nous. ⚠️ = important.",
      "Ordinateur : menu de gauche, « Actualités aides ». Téléphone : onglet « 📰 Actus », avec une pastille rouge quand il y a du nouveau.",
    ],
  },
  {
    id: "2026-11-03-site",
    date: "2026-11-03",
    emoji: "🏠",
    titre: "Fiches du site plus complètes et mieux filtrées",
    points: [
      "Quand le client donne son adresse dans le simulateur, l'adresse complète et l'étiquette énergie de sa maison (DPE) arrivent dans la fiche.",
      "Les personnes en appartement ne sont plus enregistrées : la pompe à chaleur est réservée aux maisons.",
      "Les locataires peuvent envoyer un message tout prêt à leur propriétaire, ou continuer la simulation.",
    ],
  },
];

export const nouveautesPour = (email: string) =>
  NOUVEAUTES.filter((n) => !n.pour || n.pour.includes(email.toLowerCase()));
