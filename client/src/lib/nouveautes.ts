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
    id: "2026-11-11-praimy-zone-profil",
    date: "2026-11-11",
    emoji: "🔗",
    titre: "Zone + Profil et montants repris de Praimy",
    points: [
      "Chaque matin, le CRM remplit tout seul « 🧮 Zone + Profil » pour les clients qui ont un dossier Praimy (zone d'après la ville, profil d'après MaPrimeRénov').",
      "Deux nouvelles colonnes à côté : « 💶 Prime CEE (Praimy) » et « 💶 MaPrimeRénov' (Praimy) », pour vos calculs.",
      "La page « Dossiers PRAIMY » affiche maintenant tous les dossiers (avant, seulement les 50 premiers).",
    ],
  },
  {
    id: "2026-11-11-zone-profil",
    date: "2026-11-11",
    emoji: "🧮",
    titre: "Nouvelle colonne « Zone + Profil (CEE / MPR) »",
    points: [
      "Dans le tableau des leads, juste après « Rappel » : choisissez la zone (H1, H2, H3) et le profil du client (🔵 Grand précaire, 🟡 Précaire, 🟣 Classique) dans une seule case.",
      "À remplir surtout pour les clients « Signé en octobre » et « Signé en novembre » : ça sert à calculer ce qu'on va toucher en CEE et en MaPrimeRénov'.",
    ],
  },
  {
    id: "2026-11-10-mail-bienvenue-urgence",
    date: "2026-11-10",
    emoji: "⏳",
    titre: "Mail de bienvenue des prospects : nouveau texte",
    points: [
      "Le mail envoyé automatiquement aux prospects du site remercie le client et lui dit qu'il a bien fait de nous contacter maintenant.",
      "Nouvel encadré « Pourquoi il faut agir maintenant » : MaPrimeRénov' (souvent près de la moitié de l'aide) devrait s'arrêter fin décembre pour les pompes à chaleur, et un dossier prend plusieurs semaines.",
    ],
  },
  {
    id: "2026-11-09-article-demarchage",
    date: "2026-11-09",
    emoji: "📰",
    titre: "Nouvel article sur le site : démarchage et bons réflexes",
    points: [
      "Dans « Conseils & actus » : ce que la loi interdit depuis juillet 2025 (appels, SMS, réseaux sociaux non demandés) et les droits du client (14 jours de rétractation).",
      "Utile à envoyer à un client méfiant : il explique que nous ne rappelons que les personnes qui l'ont demandé.",
    ],
  },
  {
    id: "2026-11-06-ajout-client",
    date: "2026-11-06",
    emoji: "➕",
    titre: "Ajouter un client, aussi sur téléphone",
    points: [
      "Version simple du téléphone : nouveau bouton « ➕ Nouveau client » en haut de la liste Clients.",
      "Après « Créer le lead », la fiche du nouveau client s'ouvre directement : vous voyez qu'il est bien enregistré.",
      "Sur ordinateur, la ligne « + Ajouter un lead » reste disponible même quand le tableau est groupé par une colonne (le client part dans « Nouveaux leads »).",
      "Il faut au moins un nom ou un téléphone pour créer un client.",
    ],
  },
  {
    id: "2026-11-06-etiquettes-visibles",
    date: "2026-11-06",
    emoji: "🏷️",
    titre: "Les étiquettes ne s'affichent plus vides",
    points: [
      "Certaines étiquettes (« Lead pas bon », « Prospe pas bon »…) pouvaient apparaître vides alors qu'elles étaient bien enregistrées : c'est corrigé, rien n'avait été perdu.",
      "Les fiches qui portent une ancienne étiquette retirée de la liste (ex. « manque les info ») affichent de nouveau son nom.",
      "Si une étiquette vous paraît vide, rechargez la page avant de la retaper.",
    ],
  },
  {
    id: "2026-11-04-actus-jours",
    date: "2026-11-04",
    emoji: "📰",
    titre: "Actualités aides : choisissez le jour",
    points: [
      "En haut de la page Actualités, une pastille par jour (avec le nombre d'actus) : touchez un jour pour voir ses actus, ou « Tout voir ».",
      "Les actus de la première veille (rattrapage des dernières semaines) sont de retour sur le 3 novembre.",
    ],
    pour: NEWS_VIEWERS,
  },
  {
    id: "2026-11-04-rappel-heure-obligatoire",
    date: "2026-11-04",
    emoji: "🔔",
    titre: "Rappel : heure obligatoire et mail 20 min avant",
    points: [
      "Dans « 🔔 Rappel », le bouton Valider reste grisé tant que vous n'avez pas choisi une heure.",
      "Le mail de rappel part maintenant 20 minutes avant, avec en titre « À rappeler dans 20 min à 15h : nom du client (par …) ».",
    ],
  },
  {
    id: "2026-11-04-rappel-mail",
    date: "2026-11-04",
    emoji: "⏰",
    titre: "Un mail avant chaque rappel",
    points: [
      "Quand un rappel a un jour ET une heure, un mail part avant l'heure du rappel : nom du client, téléphone (cliquable), dernier message et surtout QUI doit rappeler.",
      "La personne est celle de « 🎯 Attribué à », sinon celle de « 👤 Commercial ». Elle reçoit le mail sur sa boîte perso, et une copie arrive sur contact@.",
      "Un rappel sans heure ne déclenche pas de mail : pensez à mettre l'heure.",
    ],
  },
  {
    id: "2026-11-04-facebook",
    date: "2026-11-04",
    emoji: "📘",
    titre: "Prospects du formulaire Facebook : colonnes remplies",
    points: [
      "Les prospects du formulaire Facebook remplissent maintenant les colonnes « 🔥 Chauffage (Site) » et « Date 1er contact », comme ceux du site.",
      "Nouvelle étiquette « 📘 Formulaire Facebook » dans « 📥 Type de demande » : on voit tout de suite d'où vient le prospect.",
      "Petit 💰 bleu à côté du nom des prospects Facebook (« Revenu à demander ») : Facebook ne nous donne pas leurs revenus. Demandez le revenu fiscal au premier appel et tapez-le dans « 💰 Revenu fiscal (Calcul) » : la couleur des aides s'affiche toute seule et la pastille disparaît.",
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
