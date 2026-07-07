// Données des articles du blog IP5 Énergie (/articles et /articles/:slug).
//
// FORMAT : chaque article est un objet Article (voir le type ci-dessous).
// Le contenu est une liste de blocs simples ("p" un paragraphe, "h2" un
// sous-titre, "list" une liste à puces) — volontairement plus simple que du
// Markdown pour rester facile à générer et à relire.
//
// RÈGLES DE FOND (à respecter pour tout nouvel article, y compris ceux
// ajoutés automatiquement chaque semaine) :
// - Informations générales et publiques uniquement (fonctionnement technique,
//   dispositifs d'aide, réglementation) : jamais de montant d'aide présenté
//   comme garanti pour un cas personnel, jamais de ville/client/chantier
//   inventé. Les vrais chiffres du barème MaPrimeRénov' vivent déjà dans
//   IP5Energie.tsx (MPR_PLAFONDS) : renvoyer vers le simulateur plutôt que
//   de dupliquer des seuils précis qui peuvent changer.
// - Terminer chaque article par une invitation à utiliser le simulateur
//   (/#avantages ou la page d'accueil) ou à appeler le 07 49 52 52 67.
// - `slug` unique, format kebab-case, jamais réutilisé pour un autre sujet.
// - `date` au format ISO (YYYY-MM-DD), `readMinutes` une estimation honnête.
// - Avant d'ajouter un article, vérifier qu'aucun `slug`/sujet existant ne
//   fait déjà doublon.
// - `image` (optionnel) : chemin vers une illustration dans
//   client/public/images/articles/. Si l'article ne correspond à aucune
//   image existante, laisser `image` absent — la page affiche alors un
//   bandeau de secours généré à partir de la catégorie (voir Articles.tsx),
//   plutôt que de générer une nouvelle image (pipeline non disponible pour
//   une exécution automatisée standard).

export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] };

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readMinutes: number;
  image?: string;
  content: ContentBlock[];
};

export const ARTICLES: Article[] = [
  {
    slug: "maprimerenov-2026-quatre-profils",
    image: "/images/articles/maprimerenov-2026-quatre-profils.jpg",
    title: "MaPrimeRénov' : comprendre les 4 profils et vos aides",
    excerpt:
      "Bleu, Jaune, Violet, Rose : comment l'État classe les foyers pour calculer le montant de vos aides à la rénovation énergétique.",
    category: "Aides & subventions",
    date: "2026-06-01",
    readMinutes: 5,
    content: [
      {
        type: "p",
        text: "MaPrimeRénov' est l'aide phare de l'État pour financer les travaux de rénovation énergétique, dont l'installation d'une pompe à chaleur. Son montant ne dépend pas d'un barème unique : il varie selon votre revenu fiscal de référence (RFR), la taille de votre foyer et votre lieu de résidence.",
      },
      {
        type: "h2",
        text: "Le revenu fiscal de référence, la clé du calcul",
      },
      {
        type: "p",
        text: "Le RFR figure sur votre avis d'imposition de l'année précédente. C'est ce chiffre — et non votre salaire brut — qui détermine votre profil MaPrimeRénov'. Il est calculé par foyer fiscal, pas par personne.",
      },
      {
        type: "h2",
        text: "Quatre profils, quatre niveaux d'aide",
      },
      {
        type: "list",
        items: [
          "Bleu — revenus très modestes : le niveau d'aide le plus élevé",
          "Jaune — revenus modestes : aide élevée, cumulable avec les primes CEE",
          "Violet — revenus intermédiaires : aide intermédiaire, cumulable avec les primes CEE",
          "Rose — revenus supérieurs : pas d'aide MaPrimeRénov' pour une pompe à chaleur, mais les primes CEE restent accessibles",
        ],
      },
      {
        type: "p",
        text: "Les plafonds de revenus qui séparent ces profils ne sont pas les mêmes partout : ils sont plus élevés en Île-de-France qu'en province, et augmentent avec le nombre de personnes du foyer.",
      },
      {
        type: "h2",
        text: "Comment connaître votre profil rapidement",
      },
      {
        type: "p",
        text: "Plutôt que de chercher le barème officiel dans un tableau à double entrée, notre simulateur en ligne calcule votre profil en tenant compte de votre département et de la taille de votre foyer, en une trentaine de secondes. Le montant exact de votre aide est ensuite confirmé lors de l'étude gratuite avec un conseiller IP5 Énergie.",
      },
      {
        type: "p",
        text: "Vous avez une question sur votre situation ? Testez notre simulateur ou appelez-nous au 07 49 52 52 67.",
      },
    ],
  },
  {
    slug: "certificats-economie-energie-cee-fonctionnement",
    image: "/images/articles/certificats-economie-energie-cee-fonctionnement.jpg",
    title: "Certificats d'Économie d'Énergie (CEE) : comment ça marche ?",
    excerpt:
      "Une prime financée par les fournisseurs d'énergie, cumulable avec MaPrimeRénov', pour financer votre pompe à chaleur.",
    category: "Aides & subventions",
    date: "2026-06-08",
    readMinutes: 4,
    content: [
      {
        type: "p",
        text: "Les Certificats d'Économie d'Énergie (CEE) forment un dispositif méconnu mais souvent tout aussi précieux que MaPrimeRénov'. Contrairement à une idée reçue, ce n'est pas l'État qui les finance directement : ce sont les fournisseurs d'énergie (électricité, gaz, carburants) eux-mêmes.",
      },
      {
        type: "h2",
        text: "Pourquoi les fournisseurs d'énergie financent vos travaux",
      },
      {
        type: "p",
        text: "La loi impose aux gros fournisseurs d'énergie de faire réaliser un certain volume d'économies d'énergie chez leurs clients, sous peine de pénalités financières. Pour remplir cette obligation, ils financent une partie des travaux de rénovation énergétique des particuliers, notamment le remplacement d'un chauffage ancien par une pompe à chaleur.",
      },
      {
        type: "h2",
        text: "Une prime cumulable, avec ses propres règles",
      },
      {
        type: "list",
        items: [
          "La prime CEE peut se cumuler avec MaPrimeRénov' dans la majorité des cas",
          "Son montant dépend aussi de vos revenus, mais selon un barème propre au dispositif CEE",
          "Contrairement à MaPrimeRénov', les foyers aux revenus plus élevés (profil Rose) y restent éligibles",
          "Elle est le plus souvent déduite directement du devis, sans avance de frais",
        ],
      },
      {
        type: "p",
        text: "En pratique, un installateur RGE comme IP5 Énergie s'occupe de monter le dossier CEE en parallèle de votre demande MaPrimeRénov', pour que les deux aides soient déduites de votre facture finale.",
      },
      {
        type: "p",
        text: "Pour savoir ce que vous pourriez toucher au titre des CEE, utilisez notre simulateur ou contactez-nous au 07 49 52 52 67.",
      },
    ],
  },
  {
    slug: "pompe-a-chaleur-air-eau-fonctionnement",
    image: "/images/articles/pompe-a-chaleur-air-eau-fonctionnement.jpg",
    title: "Pompe à chaleur air/eau : fonctionnement, avantages et prix",
    excerpt:
      "Comment une pompe à chaleur capte les calories de l'air extérieur pour chauffer votre logement, et pourquoi son rendement change tout.",
    category: "Pompe à chaleur",
    date: "2026-06-15",
    readMinutes: 6,
    content: [
      {
        type: "p",
        text: "Une pompe à chaleur air/eau ne « fabrique » pas de chaleur comme une chaudière : elle la déplace. Elle capte les calories présentes dans l'air extérieur — même par temps froid — et les transfère à l'eau qui circule dans vos radiateurs ou votre plancher chauffant.",
      },
      {
        type: "h2",
        text: "Le principe : un cycle thermodynamique",
      },
      {
        type: "p",
        text: "Un fluide frigorigène circule en circuit fermé entre l'unité extérieure et le module intérieur. Il absorbe la chaleur de l'air dehors, un compresseur augmente sa température, puis cette chaleur est restituée à l'eau du circuit de chauffage. C'est le même principe qu'un réfrigérateur, mais utilisé à l'envers.",
      },
      {
        type: "h2",
        text: "Le COP, l'indicateur qui fait la différence",
      },
      {
        type: "p",
        text: "Le coefficient de performance (COP) mesure ce rendement : pour 1 kWh d'électricité consommé par le compresseur, une pompe à chaleur restitue en moyenne 3 à 4 kWh de chaleur. C'est ce ratio qui explique la baisse de facture par rapport à un chauffage électrique classique ou une chaudière.",
      },
      {
        type: "h2",
        text: "Les composants d'une installation",
      },
      {
        type: "list",
        items: [
          "L'unité extérieure : capte les calories de l'air, posée sur un plot béton contre la maison",
          "Le module hydraulique intérieur : transfère la chaleur au circuit d'eau",
          "Le ballon d'eau chaude : souvent couplé, pour la production d'eau chaude sanitaire",
          "Un tableau électrique dédié : indispensable pour une installation aux normes",
        ],
      },
      {
        type: "h2",
        text: "Quel budget prévoir ?",
      },
      {
        type: "p",
        text: "Le prix d'une pompe à chaleur air/eau varie fortement selon la puissance nécessaire, la surface à chauffer, l'état de l'isolation et la configuration du logement. Ces informations, propres à chaque maison, ne peuvent être données de façon fiable qu'après une étude sur place — c'est pourquoi IP5 Énergie propose une étude gratuite avant tout devis.",
      },
      {
        type: "p",
        text: "Envie d'une première estimation ? Notre simulateur en ligne vous donne un ordre de grandeur des économies possibles en 30 secondes.",
      },
    ],
  },
  {
    slug: "fioul-gaz-ou-pompe-a-chaleur-comparatif",
    image: "/images/articles/fioul-gaz-ou-pompe-a-chaleur-comparatif.jpg",
    title: "Fioul, gaz ou pompe à chaleur : quel chauffage choisir en 2026 ?",
    excerpt:
      "Comparatif honnête des systèmes de chauffage les plus courants en maison individuelle : coût, écologie, confort, aides disponibles.",
    category: "Pompe à chaleur",
    date: "2026-06-22",
    readMinutes: 5,
    content: [
      {
        type: "p",
        text: "Remplacer son chauffage est une décision qui engage pour quinze à vingt ans. Voici un comparatif sans parti pris entre les trois solutions les plus répandues en maison individuelle.",
      },
      {
        type: "h2",
        text: "Le fioul : une filière en déclin réglementaire",
      },
      {
        type: "p",
        text: "Depuis 2022, l'installation d'une nouvelle chaudière au fioul est interdite en France dans le neuf comme en remplacement à l'identique. Les chaudières fioul existantes peuvent continuer à fonctionner, mais leur remplacement futur devra se tourner vers une autre énergie. Le prix du fioul suit par ailleurs les cours du pétrole, donc difficile à anticiper.",
      },
      {
        type: "h2",
        text: "Le gaz : encore courant, mais sans aide sur le neuf",
      },
      {
        type: "p",
        text: "Le gaz reste un chauffage répandu, avec un confort connu. Contrairement à la pompe à chaleur, l'installation d'une nouvelle chaudière gaz n'ouvre plus droit aux aides de rénovation énergétique de l'État. Son prix, comme celui du fioul, dépend des marchés de l'énergie.",
      },
      {
        type: "h2",
        text: "La pompe à chaleur : rendement et aides cumulées",
      },
      {
        type: "list",
        items: [
          "Pas de combustion, donc pas d'émissions directes de CO2 chez vous",
          "Rendement de 3 à 4 kWh de chaleur pour 1 kWh d'électricité consommé",
          "Seule solution parmi les trois éligible à MaPrimeRénov' pour un remplacement",
          "Reste cumulable avec les primes CEE, quel que soit le profil de revenus",
        ],
      },
      {
        type: "p",
        text: "Le bon choix dépend surtout de votre logement : surface, isolation, type d'émetteurs de chaleur déjà en place. Une étude gratuite permet de comparer objectivement ce que chaque option coûterait chez vous, avant toute décision.",
      },
      {
        type: "p",
        text: "Pour une estimation personnalisée, utilisez notre simulateur ou appelez le 07 49 52 52 67.",
      },
    ],
  },
  {
    slug: "rge-qualipac-pourquoi-choisir-installateur-certifie",
    image: "/images/articles/rge-qualipac-pourquoi-choisir-installateur-certifie.jpg",
    title: "RGE QualiPAC : pourquoi choisir un installateur certifié ?",
    excerpt:
      "La certification RGE n'est pas qu'un label : c'est la condition obligatoire pour toucher les aides de l'État sur votre pompe à chaleur.",
    category: "Certification & confiance",
    date: "2026-06-29",
    readMinutes: 4,
    content: [
      {
        type: "p",
        text: "RGE signifie « Reconnu Garant de l'Environnement ». C'est une qualification délivrée par des organismes indépendants (comme Qualit'EnR pour la qualification QualiPAC), qui atteste qu'une entreprise a suivi une formation spécifique et a été auditée sur ses compétences techniques.",
      },
      {
        type: "h2",
        text: "Sans RGE, pas d'aides de l'État",
      },
      {
        type: "p",
        text: "C'est la règle la plus importante à connaître : MaPrimeRénov' et les Certificats d'Économie d'Énergie exigent que les travaux soient réalisés par une entreprise certifiée RGE pour le type de travaux concerné. Faire installer sa pompe à chaleur par une entreprise non certifiée fait perdre le droit à toutes ces aides, même si l'équipement est de bonne qualité.",
      },
      {
        type: "h2",
        text: "Un gage de sérieux dans un secteur qui attire les arnaques",
      },
      {
        type: "p",
        text: "La rénovation énergétique est un secteur régulièrement ciblé par des pratiques commerciales douteuses (démarchage agressif, devis gonflés, installations bâclées). La certification RGE ne garantit pas tout, mais elle impose un minimum de compétences vérifiées et un dispositif de contrôle par l'organisme certificateur.",
      },
      {
        type: "h2",
        text: "Comment vérifier la certification d'une entreprise",
      },
      {
        type: "p",
        text: "L'annuaire officiel France Rénov (france-renov.gouv.fr) permet de vérifier gratuitement si une entreprise est bien certifiée RGE, et pour quels types de travaux précisément. Un réflexe simple avant de signer un devis.",
      },
      {
        type: "p",
        text: "IP5 Énergie est certifiée RGE QualiPAC : nos installations sont éligibles aux aides de l'État, et nous nous chargeons de tout le dossier administratif. Pour vérifier votre éligibilité, appelez le 07 49 52 52 67 ou utilisez notre simulateur.",
      },
    ],
  },
  {
    slug: "aides-cumulables-renovation-energetique-france",
    image: "/images/articles/aides-cumulables-renovation-energetique-france.jpg",
    title: "Rénovation énergétique : quelles aides sont cumulables en France ?",
    excerpt:
      "MaPrimeRénov', CEE, éco-PTZ, TVA réduite... le point sur les dispositifs qui peuvent se combiner pour financer votre pompe à chaleur.",
    category: "Aides & subventions",
    date: "2026-07-06",
    readMinutes: 5,
    content: [
      {
        type: "p",
        text: "Entre MaPrimeRénov', les CEE, l'éco-PTZ ou encore la TVA réduite, il est facile de se perdre dans les dispositifs d'aide à la rénovation énergétique. Voici comment ils s'articulent.",
      },
      {
        type: "h2",
        text: "Les quatre principaux dispositifs",
      },
      {
        type: "list",
        items: [
          "MaPrimeRénov' : aide directe de l'État, calculée selon vos revenus et le type de travaux",
          "Les Certificats d'Économie d'Énergie (CEE) : prime financée par les fournisseurs d'énergie, cumulable avec MaPrimeRénov'",
          "L'éco-prêt à taux zéro (éco-PTZ) : un prêt sans intérêts pour financer le reste à charge, remboursable sur plusieurs années",
          "La TVA à taux réduit (5,5 %) : appliquée automatiquement par l'entreprise sur la facture des travaux de rénovation énergétique, au lieu du taux normal de 20 %",
        ],
      },
      {
        type: "h2",
        text: "Des aides locales parfois disponibles",
      },
      {
        type: "p",
        text: "Certaines régions, départements ou collectivités proposent des aides complémentaires à la rénovation énergétique, avec des conditions et montants propres à chaque territoire. Leur existence et leurs critères varient d'un endroit à l'autre.",
      },
      {
        type: "h2",
        text: "Cumul : la règle générale",
      },
      {
        type: "p",
        text: "MaPrimeRénov', les CEE, l'éco-PTZ et la TVA réduite sont conçus pour se cumuler entre eux sur un même projet de pompe à chaleur. Chaque dispositif a cependant ses propres critères d'éligibilité (revenus, ancienneté du logement, type de travaux), d'où l'intérêt de faire vérifier sa situation par un professionnel avant de s'engager.",
      },
      {
        type: "p",
        text: "IP5 Énergie calcule vos droits réels et monte l'ensemble du dossier administratif pour vous. Testez notre simulateur ou appelez le 07 49 52 52 67 pour un point complet sur votre situation.",
      },
    ],
  },
];
