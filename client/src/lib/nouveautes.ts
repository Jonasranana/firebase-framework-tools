// ─────────────────────────────────────────────────────────────────────────
// « Quoi de neuf dans le CRM » : fenêtre affichée une seule fois à chaque
// personne après une mise en ligne (voir components/Nouveautes.tsx).
// À CHAQUE MISE EN LIGNE QUI CHANGE LE CRM OU LE SITE : ajouter une entrée EN
// HAUT de la liste (id unique, date, titre, points en français simple).
// `pour` = liste d'e-mails qui la voient (absent = toute l'équipe).
// ─────────────────────────────────────────────────────────────────────────
import { NEWS_VIEWERS, RENTA_VIEWERS, TOTALS_VIEWERS } from "@/lib/crm";
import { ROOT_ADMINS } from "@/lib/crmTeam";

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
    id: "2026-11-26-une-seule-apparence",
    date: "2026-11-26",
    emoji: "🎨",
    titre: "Toutes les pages du CRM aux couleurs de Pac Pac",
    points: [
      "Statistiques, Planning, Équipe, Dossiers PRAIMY et BETS, Artisans, Simulateur… : même bleu, mêmes cartes, mêmes boutons que Pac Pac.",
      "L'orange reste pour les alertes (rappels du jour, fiches qui attendent). Rien ne change dans le fonctionnement des pages.",
    ],
  },
  {
    id: "2026-11-26-ia-fiches-interrupteur",
    date: "2026-11-26",
    emoji: "🤖",
    titre: "Assistant IA des fiches mis en pause",
    points: [
      "Le bouton « Analyser et planifier la relance » sous les messages est coupé pour l'instant. Les propositions déjà faites par l'IA restent dans les fiches.",
      "Pour le rallumer : cloche 🔔 en haut à droite → « ⚙️ Réglages » → « Assistant IA dans les fiches ».",
    ],
    pour: NEWS_VIEWERS,
  },
  {
    id: "2026-11-26-nouveau-design",
    date: "2026-11-26",
    emoji: "🎨",
    titre: "Nouveau look pour le CRM",
    points: [
      "Couleurs plus douces (bleu) et tableau plus clair. Les lignes gardent leur couleur selon l'âge de la fiche (vert, orange, rouge).",
      "Les statuts sont des étiquettes douces avec un point de couleur. Tout se modifie comme avant, en un clic.",
      "En haut de Pac Pac : « À appeler », « Rappels en retard », intéressés et nouveaux leads de la semaine. Cliquez sur les deux premiers pour filtrer.",
      "Vous préférez l'ancien ? Interrupteur « Nouveau design » en bas du menu.",
    ],
  },
  {
    id: "2026-11-26-crm-plus-rapide",
    date: "2026-11-26",
    emoji: "⚡",
    titre: "Le CRM est beaucoup plus rapide",
    points: [
      "Le tableau Pac Pac s'affiche environ 3 fois plus vite : seules les lignes proches de l'écran sont dessinées, les autres apparaissent quand vous descendez.",
      "Modifier un statut ou une fiche est plus fluide, et la recherche ne bloque plus la frappe.",
      "Rien ne change dans vos habitudes : mêmes colonnes, mêmes groupes, mêmes boutons.",
    ],
  },
  {
    id: "2026-11-25-simulateur-marge",
    date: "2026-11-25",
    emoji: "🧮",
    titre: "Nouveau simulateur de marge (règles du 16 novembre)",
    points: [
      "La page « Marges PRAIMY » devient le simulateur de marge d'une pompe à chaleur vendue et posée par nous : CEE + Coup de pouce + MaPrimeRénov', par zone (H1, H2, H3) et par couleur.",
      "Depuis le 16 novembre : Coup de pouce ×3 pour les Jaunes (×5 si le devis a été signé avant). Une case permet de comparer.",
      "Prix de vente, matériel, pose, valorisation des CEE et reste à charge visé se règlent en haut de page, pour toute l'équipe.",
      "Tournées Loan utilise ce simulateur pour la marge de chaque dossier (couleur, zone, surface et date de signature du fichier), et compte Loan à 1 200 € par pose.",
    ],
    pour: TOTALS_VIEWERS,
  },
  {
    id: "2026-11-25-tournees-loan-aix-500km",
    date: "2026-11-25",
    emoji: "📍",
    titre: "Tournées Loan : départ d'Aix et règle des 500 km",
    points: [
      "Les tournées partent maintenant d'Aix-en-Provence (Marseille reste au choix, à côté de « Premier jour »).",
      "On ne va pas à plus de 500 km d'Aix, sauf s'il y a au moins 2 poses à moins de 100 km les unes des autres (3 poses au-delà de 700 km). Les chiffres se modifient au-dessus du planning.",
      "Les clients trop loin pour l'instant sont listés à part (en orange sur la carte) et entrent dans le planning dès qu'il y a assez de poses dans leur coin.",
      "Les repas ne sont plus comptés dans le coût (ils sont à la charge de l'équipe).",
    ],
    pour: TOTALS_VIEWERS,
  },
  {
    id: "2026-11-25-equipe-fiche-personne",
    date: "2026-11-25",
    emoji: "👥",
    titre: "Page « Équipe » : la fiche de chaque personne",
    points: [
      "Cliquez sur une personne : ce qu'elle voit dans le CRM (pages, montants, actions permises), en ✅ / ❌.",
      "Son activité : fiches travaillées, statuts changés, notes, jours actifs (aujourd'hui, 7 jours, 30 jours) et un graphique des 14 derniers jours.",
      "Ses leads attribués par statut, dont ceux jamais touchés, et ses 25 dernières actions (cliquez pour ouvrir la fiche).",
    ],
    pour: Object.keys(ROOT_ADMINS),
  },
  {
    id: "2026-11-25-tournees-loan",
    date: "2026-11-25",
    emoji: "🚐",
    titre: "Nouvelle page « Tournées Loan »",
    points: [
      "Dans le menu (dossier CRM) : le plan des installations de l'équipe de Loan, au départ de Marseille, tournée par tournée et jour par jour.",
      "Importez le fichier Excel des dossiers : les « Signé » et « Audit » sont mis dans le plan, cochez ou décochez les autres.",
      "Pour chaque tournée : la route, où dormir (hôtel ou Airbnb), le coût complet (équipe, gazole, péages, logement, repas) et la marge nette de chaque dossier.",
      "Tous les prix se modifient en bas de page, et un tableau compare « rentrer chaque week-end » et « rester sur place ».",
    ],
    pour: TOTALS_VIEWERS,
  },
  {
    id: "2026-11-25-article-radiateurs",
    date: "2026-11-25",
    emoji: "📰",
    titre: "Nouvel article sur le site : pompe à chaleur et radiateurs",
    points: [
      "Dans « Conseils & actus » : peut-on garder ses radiateurs avec une pompe à chaleur ? Dans la plupart des maisons, oui. Tout dépend de la température d'eau nécessaire.",
      "Utile à envoyer à un client qui hésite parce qu'il pense devoir changer tous ses radiateurs.",
    ],
  },
  {
    id: "2026-11-20-lien-whatsapp",
    date: "2026-11-20",
    emoji: "💬",
    titre: "Lien du simulateur pour les clients WhatsApp",
    points: [
      "Envoyez ip5energie.fr/mon-projet (ou ip5energie.fr/pac-whatsapp) aux clients qui vous écrivent sur WhatsApp : ils remplissent le simulateur pendant l'appel.",
      "La fiche arrive dans Pac Pac comme une demande du site, avec la source « whatsapp-pac ».",
      "Ces clients ne sont pas comptés comme venus des pubs Facebook (page « Rentabilité Meta » et pixel inchangés).",
    ],
  },
  {
    id: "2026-11-20-suivi-praimy-bets-nrp",
    date: "2026-11-20",
    emoji: "🗂️",
    titre: "Dossiers Praimy plus clairs, page BETS et rappel des NRP",
    points: [
      "Dossiers PRAIMY : téléphone du client, « À faire chez Praimy » dans sa propre colonne, dates de pré-visite et d'installation.",
      "Nouvelle colonne « Notre suivi » : nos étapes (1. Propal envoyée → 8. Installé). Plusieurs étiquettes possibles en même temps : cliquez pour cocher ou décocher.",
      "« Prochaine étape (nous) » dit ce qu'il reste à faire, et « Dernière action » passe en orange (6 jours) puis en rouge (15 jours) pour ne rater personne.",
      "Nouvelle page « Dossiers BETS » : les clients envoyés chez Betsalel (statut « En cours chez BETS » dans Pac Pac).",
      "Chaque matin à 9 h, un mail liste les NRP d'il y a 2 jours à rappeler.",
    ],
  },
  {
    id: "2026-11-18-page-notifs",
    date: "2026-11-18",
    emoji: "🔔",
    titre: "Historique des notifications",
    points: [
      "Sur téléphone : nouvel onglet « 🔔 Notifs » (l'onglet des rappels s'appelle maintenant « ⏰ Rappels »). Sur ordinateur : clic sur la cloche en haut à droite.",
      "Chaque notification avec l'heure exacte et la photo de la personne qui a écrit ; les non lues sont en bleu, avec un compteur rouge.",
      "Un clic ouvre directement la fiche du client dans Pac Pac (sur la discussion pour un message).",
    ],
  },
  {
    id: "2026-11-17-notif-messages",
    date: "2026-11-17",
    emoji: "💬",
    titre: "Notifications : les messages des bulles, en entier",
    points: [
      "Chaque nouveau message écrit dans la bulle d'une fiche arrive en notification sur votre téléphone, avec le nom de la personne, le client et le texte complet (glisser vers le bas pour tout lire).",
      "Vous ne recevez pas vos propres messages. À couper dans 🔔 → « 💬 Messages dans les bulles » si c'est trop.",
    ],
  },
  {
    id: "2026-11-17-notifications",
    date: "2026-11-17",
    emoji: "🔔",
    titre: "Notifications sur votre téléphone",
    points: [
      "Nouvelle cloche 🔔 en haut à droite du CRM : « Activer les notifications » sur cet appareil.",
      "Au choix : 📥 nouveaux leads, ⏰ rappels (20 min avant), 💬 quand on vous tague avec @, 🗓️ planning du lendemain (19 h).",
      "Sur Android : installez le CRM depuis Chrome (menu ⋮ → « Installer l'application »). Sur iPhone : depuis Safari, Partager → « Sur l'écran d'accueil », puis activez la cloche depuis l'icône.",
    ],
  },
  {
    id: "2026-11-16-planning-complet",
    date: "2026-11-16",
    emoji: "🗓️",
    titre: "Planning chantiers : heures, dépôt MPR, vue semaine",
    points: [
      "Menu CRM IP5 → « Planning chantiers » : tous les clients signés dans un calendrier (mois ou semaine), avec « Aujourd'hui » et « Demain » en haut.",
      "Pré-visites et poses avec leur heure, dépôts du dossier MaPrimeRénov' ; filtre par poseur ; glissez un client sur un jour pour lui donner une date.",
      "Nouvelles colonnes dans Pac Pac, reliées au planning : 🕘 Heure VT, 🕘 Heure Pose, 📨 Dépôt MPR et ✅ MPR reçue.",
    ],
    pour: NEWS_VIEWERS,
  },
  {
    id: "2026-11-16-planning-chantiers",
    date: "2026-11-16",
    emoji: "🗓️",
    titre: "Nouvelle page « Planning chantiers »",
    points: [
      "Menu CRM IP5 → « Planning chantiers » : tous les clients signés, avec un calendrier du mois.",
      "Les pré-visites (🗓 Date VT) et les poses (🔧 Date Pose) du tableau Pac Pac s'y affichent ; glissez un client sur un jour pour lui donner une date.",
      "Colonnes « Pré-visite à caler », « Attend MaPrimeRénov' », « Prêt à poser », « Pose programmée » ; une pose prévue alors que la MPR n'est pas reçue apparaît en rouge.",
    ],
    pour: RENTA_VIEWERS,
  },
  {
    id: "2026-11-15-pac-grand-ecran",
    date: "2026-11-15",
    emoji: "🖥️",
    titre: "La page des pubs (/pac) prend toute la largeur sur grand écran",
    points: [
      "Sur un grand écran d'ordinateur, la page /pac et le menu du site sont plus larges, avec un titre plus gros.",
      "Rien ne change sur téléphone.",
    ],
  },
  {
    id: "2026-11-12-bareme-praimy",
    date: "2026-11-12",
    emoji: "🧮",
    titre: "Nouveau barème dans « Marges PRAIMY » et « Rentabilité Meta »",
    points: [
      "CEE : H1 bleu 8 517 €, jaune/violet 4 580 € · H2 bleu 7 080 €, jaune/violet 3 822 €.",
      "MaPrimeRénov' : bleu 5 000 €, jaune 4 000 €, violet 3 000 € ; frais Praimy 600 / 500 / 400 €.",
      "Fourni-posé : Praimy 5 800 €, Georges 5 300 € (sans frais Praimy).",
    ],
    pour: RENTA_VIEWERS,
  },
  {
    id: "2026-11-12-rentabilite-meta",
    date: "2026-11-12",
    emoji: "💰",
    titre: "Nouvelle page « Rentabilité Meta »",
    points: [
      "Menu CRM IP5 → « Rentabilité Meta » (visible seulement par Jonas et Alexis).",
      "Pour la période choisie : dépense pub Meta, leads du site et du formulaire Facebook, coût par lead, clients signés et bénéfice net après pub.",
      "La marge d'un signé se calcule avec les montants Praimy (CEE + MaPrimeRénov') ; la nouvelle colonne « 💵 Marge nette » permet de la corriger à la main.",
    ],
    pour: RENTA_VIEWERS,
  },
  {
    id: "2026-11-11-ref-praimy",
    date: "2026-11-11",
    emoji: "🔗",
    titre: "Nouvelle colonne « 🔗 Réf Praimy »",
    points: [
      "Elle montre à quel dossier Praimy la fiche est reliée (ex. #IC-2026-10-0039).",
      "Si « Zone + Profil » reste vide alors que le client est chez Praimy (nom écrit différemment) : tapez sa référence Praimy dans cette colonne. Le lendemain matin, la zone, le profil et les montants se remplissent tout seuls.",
    ],
  },
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
