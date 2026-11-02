// Données de la rubrique « Conseils & actus » d'IP5 Énergie (/conseils et /conseils/:slug).
// Les anciennes adresses /articles et /articles/:slug redirigent vers la nouvelle rubrique.
//
// FORMAT : chaque article est un objet Article (voir le type ci-dessous), écrit comme un article
// de presse : un chapeau (`excerpt`), « L'essentiel » en 3 points (`keyPoints`), puis des blocs
// simples — "p" paragraphe, "h2" intertitre, "list" liste à puces, "box" encadré à puces,
// "tip" encadré « Bon à savoir », "faq" questions / réponses (reprises aussi pour Google).
//
// RÈGLES DE FOND (à respecter pour tout nouvel article) :
// - Informations générales et publiques uniquement (fonctionnement technique, dispositifs
//   d'aide, réglementation) : jamais de montant d'aide présenté comme garanti pour un cas
//   personnel, jamais de ville/client/chantier/témoignage/citation inventé. Les vrais chiffres
//   du barème MaPrimeRénov' vivent dans IP5Energie.tsx (MPR_PLAFONDS) : renvoyer vers le
//   simulateur plutôt que de dupliquer des seuils qui peuvent changer.
// - Terminer chaque article par une invitation au simulateur ou au 07 49 52 52 67.
// - `slug` unique, format kebab-case, jamais réutilisé pour un autre sujet.
// - `date` au format ISO (YYYY-MM-DD), `readMinutes` une estimation honnête.
// - `image` : photo de couverture en 16:9 dans client/public/images/articles/<slug>.jpg —
//   photo réelle d'IP5 Énergie, photo fournie par le propriétaire, ou illustration dessinée.
//   `imageCredit` dit honnêtement ce que c'est (« Photo IP5 Énergie », « Illustration »…).
//   Jamais une image prise sur internet sans licence.
// - Catégories : « Actualités », « Aides & subventions », « Pompe à chaleur », « Solaire »,
//   « Certification & confiance ». Une actualité peut citer des chiffres publics officiels
//   (ex. prix repère de la CRE) à condition d'en indiquer la source en fin d'article.

export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "box"; title: string; items: string[] }
  | { type: "tip"; title?: string; text: string }
  | { type: "faq"; items: { q: string; a: string }[] };

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readMinutes: number;
  image?: string;
  imageAlt?: string;
  imageCredit?: string;
  keyPoints?: string[];
  content: ContentBlock[];
};

const img = (slug: string) => `/images/articles/${slug}.jpg`;

export const ARTICLES: Article[] = [
  {
    slug: "hausse-prix-gaz-chauffage-novembre-2026",
    title: "Gaz : +52 % en un an ! Quel impact sur la facture de chauffage de votre maison ?",
    excerpt:
      "Au 1er novembre 2026, le prix repère du gaz pour le chauffage atteint 0,1576 € le kWh, contre 0,1035 € un an plus tôt. Pour une maison chauffée au gaz, la facture annuelle peut augmenter de plusieurs centaines d'euros. Voici nos calculs et les solutions pour reprendre la main.",
    category: "Actualités",
    date: "2026-11-01",
    readMinutes: 5,
    image: img("hausse-prix-gaz-chauffage-novembre-2026"),
    imageAlt: "Flammes bleues d'un brûleur à gaz",
    imageCredit: "Photo libre de droits",
    keyPoints: [
      "Le prix repère du gaz « chauffage » passe à 0,1576 € le kWh TTC au 1er novembre 2026 (+8,3 % en un mois, +52 % en un an).",
      "Pour une maison consommant 12 000 kWh par an, le budget gaz passerait d'environ 1 572 € à 2 252 € sur un an : 680 € de plus.",
      "Seuls les contrats indexés sur le prix repère suivent cette hausse ; à long terme, la pompe à chaleur divise la quantité d'énergie achetée.",
    ],
    content: [
      { type: "p", text: "La saison de chauffe commence mal pour les foyers chauffés au gaz. Au 1er novembre 2026, le prix repère publié chaque mois par la Commission de régulation de l'énergie (CRE) fixe le kWh de gaz destiné au chauffage à 0,1576 € toutes taxes comprises. C'est 8,3 % de plus qu'en octobre, et surtout environ 52 % de plus qu'en novembre 2025, quand ce même kWh s'affichait autour de 0,1035 €." },
      { type: "p", text: "Le prix repère sert de référence à de nombreuses offres du marché : les contrats « indexés » le suivent mois après mois. La hausse tombe au pire moment, au début des mois les plus froids, quand la chaudière tourne le plus." },
      { type: "h2", text: "Notre calcul pour une maison de 12 000 kWh par an" },
      { type: "p", text: "Prenons une maison individuelle chauffée au gaz qui consomme 12 000 kWh par an, un niveau courant pour une maison familiale. Nous avons appliqué les prix repère de novembre 2025 et de novembre 2026 comme s'ils restaient valables toute l'année. C'est un ordre de grandeur, pas une prévision : le prix repère change chaque mois." },
      { type: "box", title: "Budget gaz sur un an, au prix repère « chauffage »", items: [
        "Novembre 2025 : 12 000 kWh × 0,1035 € ≈ 1 241 €, plus l'abonnement (≈ 331 €), soit environ 1 572 € par an.",
        "Novembre 2026 : 12 000 kWh × 0,1576 € ≈ 1 891 €, plus l'abonnement (≈ 361 €), soit environ 2 252 € par an.",
        "Écart : environ 680 € de plus sur l'année, soit +43 % sur le budget total.",
      ] },
      { type: "p", text: "Le budget total augmente un peu moins vite que le prix du kWh, car l'abonnement, lui, a moins progressé. Pour estimer votre propre cas, une règle simple : comptez environ 54 € de plus par tranche de 1 000 kWh consommés, auxquels s'ajoutent une trentaine d'euros d'abonnement." },
      { type: "tip", title: "Qui est concerné ?", text: "Seules les offres indexées sur le prix repère, ou qui évoluent avec lui, répercutent cette hausse. Les offres à prix fixe ne bougent pas pendant leur durée, même si les taxes et le coût d'acheminement peuvent, eux, évoluer. Votre dernière facture indique le type de contrat et votre consommation annuelle." },
      { type: "h2", text: "Cet hiver : limiter la hausse" },
      { type: "list", items: [
        "Faire entretenir sa chaudière : c'est obligatoire chaque année, et une chaudière bien réglée consomme moins.",
        "Baisser la consigne : chaque degré en moins sur le thermostat réduit sensiblement la consommation de chauffage.",
        "Programmer le chauffage en fonction des heures de présence et des pièces réellement occupées.",
        "Vérifier son contrat et comparer, en gardant en tête qu'un prix fixe protège de la hausse mais pas d'une éventuelle baisse.",
      ] },
      { type: "h2", text: "Sur le long terme : la pompe à chaleur change la donne" },
      { type: "p", text: "Ces gestes limitent la facture, mais ne changent pas le fond du problème : une chaudière gaz restera exposée aux variations du marché. Une pompe à chaleur air/eau fonctionne autrement. Elle ne brûle rien : elle capte les calories de l'air extérieur et restitue en moyenne 3 à 4 kWh de chaleur pour 1 kWh d'électricité consommé." },
      { type: "p", text: "Concrètement, pour notre maison de 12 000 kWh de gaz, la chaleur réellement utile tourne autour de 10 800 kWh, en tenant compte du rendement d'une chaudière. Une pompe à chaleur bien dimensionnée fournirait cette même chaleur avec environ 2 700 à 3 600 kWh d'électricité. La quantité d'énergie achetée est donc divisée par trois à quatre. L'économie exacte dépend ensuite du prix de votre électricité, de l'isolation et du réglage de l'installation." },
      { type: "tip", title: "Les aides réduisent la facture d'installation", text: "Remplacer une chaudière gaz par une pompe à chaleur peut ouvrir droit à MaPrimeRénov' (selon vos revenus) et aux primes CEE, cumulables, à condition de passer par un installateur certifié RGE. Une nouvelle chaudière gaz, elle, n'est plus aidée par l'État." },
      { type: "faq", items: [
        { q: "Pourquoi le prix du gaz augmente-t-il autant ?", a: "Le prix repère suit les prix du gaz sur les marchés de gros, qui varient selon la demande, la saison et le contexte international. Il est mis à jour chaque mois par la CRE." },
        { q: "Ma facture va-t-elle augmenter de 52 % ?", a: "Non : ce chiffre concerne le prix du kWh sur un an. Votre facture dépend de votre type de contrat (indexé ou fixe), de votre consommation et de l'abonnement. Dans notre exemple, le budget total augmente d'environ 43 %." },
        { q: "Une pompe à chaleur convient-elle à ma maison chauffée au gaz ?", a: "Dans la plupart des cas, oui : elle se raccorde souvent aux radiateurs existants. Une étude gratuite sur place permet de le vérifier et de chiffrer le projet aides déduites." },
      ] },
      { type: "p", text: "Votre maison est chauffée au gaz et la facture vous inquiète ? Calculez en 30 secondes les aides auxquelles vous avez droit pour passer à la pompe à chaleur avec notre simulateur, ou appelez un conseiller IP5 Énergie au 07 49 52 52 67. L'étude est gratuite et sans engagement." },
      { type: "p", text: "Source des prix : prix repère de vente de gaz naturel, usage chauffage, TTC, publiés par la Commission de régulation de l'énergie (CRE). Calculs IP5 Énergie, arrondis à l'euro." },
    ],
  },
  {
    slug: "maprimerenov-2026-quatre-profils",
    title: "MaPrimeRénov' : bleu, jaune, violet ou rose, quel profil êtes-vous ?",
    excerpt:
      "Derrière les quatre couleurs de MaPrimeRénov' se cache une règle simple : votre revenu fiscal de référence. Comprendre son profil, c'est savoir en quelques minutes à quel niveau d'aide prétendre pour une pompe à chaleur.",
    category: "Aides & subventions",
    date: "2026-06-01",
    readMinutes: 5,
    image: img("maprimerenov-2026-quatre-profils"),
    imageAlt: "Un couple étudie ses documents administratifs à la table de la cuisine",
    imageCredit: "Photo libre de droits",
    keyPoints: [
      "Votre profil dépend du revenu fiscal de référence du foyer, pas du salaire.",
      "Quatre profils : Bleu, Jaune, Violet et Rose, du plus aidé au moins aidé.",
      "Les plafonds changent selon la région (Île-de-France ou non) et la taille du foyer.",
    ],
    content: [
      { type: "p", text: "C'est souvent la première question posée lorsqu'un foyer envisage de changer de chauffage : « À combien d'aide ai-je droit ? » Pour MaPrimeRénov', l'aide phare de l'État en matière de rénovation énergétique, la réponse commence toujours par une couleur. Bleu, Jaune, Violet ou Rose : ce code, devenu familier, classe chaque foyer selon ses ressources et détermine le niveau de soutien public." },
      { type: "h2", text: "Tout part de l'avis d'imposition" },
      { type: "p", text: "Le critère décisif n'est ni le salaire mensuel ni le patrimoine, mais le revenu fiscal de référence (RFR). Ce montant figure en première page de l'avis d'imposition et concerne l'ensemble du foyer fiscal. Il est ensuite rapporté au nombre de personnes qui composent le foyer et au lieu de résidence." },
      { type: "box", title: "Les quatre profils en un coup d'œil", items: [
        "Bleu — revenus très modestes : le niveau d'aide le plus élevé.",
        "Jaune — revenus modestes : une aide élevée, cumulable avec les primes CEE.",
        "Violet — revenus intermédiaires : une aide intermédiaire, elle aussi cumulable avec les CEE.",
        "Rose — revenus supérieurs : pas de MaPrimeRénov' pour une pompe à chaleur, mais les primes CEE restent accessibles.",
      ] },
      { type: "h2", text: "Île-de-France ou province : des seuils différents" },
      { type: "p", text: "Les plafonds de revenus ne sont pas identiques sur tout le territoire. Ils sont plus élevés en Île-de-France, où le coût de la vie est supérieur, et augmentent avec chaque personne supplémentaire dans le foyer. Deux familles aux revenus identiques peuvent donc se retrouver dans deux profils différents selon leur adresse." },
      { type: "tip", title: "Bon à savoir", text: "Le profil se calcule sur l'avis d'imposition le plus récent disponible au moment de la demande. Un changement de situation (naissance, départ d'un enfant, baisse de revenus) peut faire changer de couleur." },
      { type: "h2", text: "Comment connaître son profil sans se perdre dans les tableaux" },
      { type: "p", text: "Les barèmes officiels se présentent sous forme de tableaux à double entrée, peu lisibles. Notre simulateur en ligne fait le calcul à votre place en tenant compte de votre département et de la taille de votre foyer, en une trentaine de secondes. Le montant précis de l'aide est ensuite confirmé lors de l'étude gratuite réalisée par un conseiller IP5 Énergie." },
      { type: "faq", items: [
        { q: "Mon profil peut-il changer d'une année à l'autre ?", a: "Oui. Il dépend de votre revenu fiscal de référence et de la composition du foyer, qui évoluent d'une année sur l'autre." },
        { q: "Le profil Rose donne-t-il droit à une aide pour une pompe à chaleur ?", a: "Pas à MaPrimeRénov' pour une pompe à chaleur seule, mais les primes CEE restent accessibles quel que soit le niveau de revenus." },
      ] },
      { type: "p", text: "Vous voulez connaître votre couleur ? Testez notre simulateur gratuit ou appelez-nous au 07 49 52 52 67." },
    ],
  },
  {
    slug: "certificats-economie-energie-cee-fonctionnement",
    title: "Primes CEE : ces aides financées par les fournisseurs d'énergie",
    excerpt:
      "Moins connues que MaPrimeRénov', les primes liées aux Certificats d'Économie d'Énergie financent pourtant une part importante des pompes à chaleur installées en France. Elles ne viennent pas de l'État, mais des fournisseurs d'énergie eux-mêmes.",
    category: "Aides & subventions",
    date: "2026-06-08",
    readMinutes: 4,
    image: img("certificats-economie-energie-cee-fonctionnement"),
    imageAlt: "Une conseillère présente un projet de rénovation à un propriétaire, dans sa maison",
    imageCredit: "Photo libre de droits",
    keyPoints: [
      "Les primes CEE sont financées par les fournisseurs d'énergie, pas par l'État.",
      "Elles se cumulent dans la plupart des cas avec MaPrimeRénov'.",
      "Tous les profils de revenus y ont accès, y compris les foyers « Rose ».",
    ],
    content: [
      { type: "p", text: "Le mécanisme est méconnu du grand public, et pourtant il pèse lourd dans le financement des travaux de rénovation. Les Certificats d'Économie d'Énergie (CEE) reposent sur une obligation légale imposée aux fournisseurs d'électricité, de gaz et de carburants : faire réaliser chaque année un volume donné d'économies d'énergie chez leurs clients." },
      { type: "h2", text: "Une obligation qui se transforme en prime" },
      { type: "p", text: "Pour remplir cette obligation, et éviter des pénalités financières, les fournisseurs d'énergie financent une partie des travaux qui réduisent la consommation des ménages. Le remplacement d'une vieille chaudière par une pompe à chaleur fait partie des opérations les plus encouragées." },
      { type: "box", title: "Ce qu'il faut retenir des primes CEE", items: [
        "Elles se cumulent dans la majorité des cas avec MaPrimeRénov'.",
        "Leur montant dépend aussi des revenus, selon un barème propre au dispositif.",
        "Les foyers aux revenus supérieurs (profil Rose) y restent éligibles.",
        "La prime est le plus souvent déduite directement du devis, sans avance de frais.",
      ] },
      { type: "h2", text: "Qui s'occupe du dossier ?" },
      { type: "p", text: "La demande doit être engagée avant la signature du devis, et les travaux réalisés par une entreprise certifiée RGE. En pratique, un installateur comme IP5 Énergie monte le dossier CEE en parallèle de la demande MaPrimeRénov', afin que les deux aides apparaissent sur la facture finale." },
      { type: "tip", title: "Attention à l'ordre des étapes", text: "Signer un devis avant que la demande de prime ne soit enregistrée peut faire perdre le droit à l'aide. C'est l'une des erreurs les plus fréquentes : mieux vaut se faire accompagner dès le départ." },
      { type: "faq", items: [
        { q: "Les primes CEE sont-elles imposables ?", a: "Pour un particulier, les primes CEE liées à des travaux sur sa résidence principale ne sont pas considérées comme un revenu imposable." },
        { q: "Faut-il avancer l'argent ?", a: "Dans la plupart des cas, non : la prime est déduite directement du montant à payer." },
      ] },
      { type: "p", text: "Pour savoir ce que les CEE pourraient représenter dans votre projet, utilisez notre simulateur ou contactez-nous au 07 49 52 52 67." },
    ],
  },
  {
    slug: "pompe-a-chaleur-air-eau-fonctionnement",
    title: "Pompe à chaleur air/eau : comment elle chauffe une maison avec l'air extérieur",
    excerpt:
      "Elle ne brûle rien et chauffe pourtant toute la maison. La pompe à chaleur air/eau puise les calories de l'air, même en hiver, pour alimenter radiateurs et plancher chauffant. Explications sur une technologie devenue incontournable.",
    category: "Pompe à chaleur",
    date: "2026-06-15",
    readMinutes: 6,
    image: img("pompe-a-chaleur-air-eau-fonctionnement"),
    imageAlt: "Unité extérieure d'une pompe à chaleur air/eau devant une maison, en hiver dans la neige",
    imageCredit: "Photo libre de droits",
    keyPoints: [
      "La pompe à chaleur déplace la chaleur de l'air vers l'eau du chauffage, sans combustion.",
      "Pour 1 kWh d'électricité, elle restitue en moyenne 3 à 4 kWh de chaleur.",
      "Le prix dépend de la maison : seule une étude sur place permet un chiffre fiable.",
    ],
    content: [
      { type: "p", text: "Le principe a de quoi surprendre : chauffer une maison en hiver grâce à l'air extérieur. C'est pourtant ce que font chaque jour des centaines de milliers de pompes à chaleur en France. Contrairement à une chaudière, l'appareil ne produit pas de chaleur en brûlant un combustible : il la récupère dehors et la transporte à l'intérieur." },
      { type: "h2", text: "Un réfrigérateur qui fonctionnerait à l'envers" },
      { type: "p", text: "Un fluide frigorigène circule en circuit fermé entre l'unité extérieure et le module installé dans la maison. Il capte les calories présentes dans l'air, même par temps froid. Un compresseur élève ensuite sa température, et cette chaleur est transmise à l'eau qui circule dans les radiateurs ou le plancher chauffant. C'est le principe du réfrigérateur, utilisé dans l'autre sens." },
      { type: "h2", text: "Le COP, l'indicateur à surveiller" },
      { type: "p", text: "Le coefficient de performance (COP) mesure l'efficacité de l'appareil. Pour 1 kWh d'électricité consommé par le compresseur, une pompe à chaleur air/eau restitue en moyenne 3 à 4 kWh de chaleur. C'est ce rapport qui explique la baisse de la facture par rapport à un chauffage électrique classique ou à une vieille chaudière." },
      { type: "box", title: "Les éléments d'une installation", items: [
        "L'unité extérieure, posée sur un socle contre la maison, qui capte les calories de l'air.",
        "Le module hydraulique intérieur, qui transmet la chaleur au circuit d'eau.",
        "Le ballon d'eau chaude, souvent couplé pour l'eau chaude sanitaire.",
        "Un tableau électrique dédié, indispensable pour une installation aux normes.",
      ] },
      { type: "tip", title: "Bon à savoir", text: "Une pompe à chaleur air/eau peut le plus souvent se raccorder aux radiateurs existants. Le plancher chauffant, qui fonctionne à plus basse température, permet d'en tirer le meilleur rendement." },
      { type: "h2", text: "Combien ça coûte ?" },
      { type: "p", text: "Le prix varie fortement selon la puissance nécessaire, la surface à chauffer, l'isolation et la configuration du logement. Ces éléments, propres à chaque maison, ne peuvent être évalués sérieusement qu'après une visite. C'est pourquoi IP5 Énergie réalise une étude gratuite avant tout devis, en tenant compte des aides auxquelles le foyer a droit." },
      { type: "faq", items: [
        { q: "Une pompe à chaleur fonctionne-t-elle quand il gèle ?", a: "Oui. Les modèles actuels continuent de chauffer par temps froid ; leur rendement baisse quand la température extérieure chute, d'où l'importance d'un bon dimensionnement." },
        { q: "Peut-on garder ses radiateurs ?", a: "Dans la plupart des cas, oui. L'étude sur place permet de vérifier qu'ils sont adaptés." },
      ] },
      { type: "p", text: "Envie d'une première estimation ? Notre simulateur en ligne vous donne un ordre de grandeur des économies possibles en 30 secondes, ou appelez le 07 49 52 52 67." },
    ],
  },
  {
    slug: "fioul-gaz-ou-pompe-a-chaleur-comparatif",
    title: "Fioul, gaz ou pompe à chaleur : quel chauffage choisir en 2026 ?",
    excerpt:
      "Changer de chauffage engage pour quinze à vingt ans. Entre la fin programmée du fioul, un gaz qui n'est plus aidé et une pompe à chaleur largement subventionnée, le comparatif s'impose avant de décider.",
    category: "Pompe à chaleur",
    date: "2026-06-22",
    readMinutes: 5,
    image: img("fioul-gaz-ou-pompe-a-chaleur-comparatif"),
    imageAlt: "Ancienne chaudière au fioul et ballon d'eau chaude dans une chaufferie, avant remplacement",
    imageCredit: "Photo IP5 Énergie — avant travaux",
    keyPoints: [
      "Les chaudières neuves au fioul ne peuvent plus être installées en France depuis 2022.",
      "Le gaz reste répandu, mais une nouvelle chaudière gaz n'est plus aidée par l'État.",
      "La pompe à chaleur cumule rendement élevé et aides publiques.",
    ],
    content: [
      { type: "p", text: "Dans de nombreuses maisons, la question revient au moment où la vieille chaudière montre des signes de fatigue : faut-il la remplacer à l'identique ou changer d'énergie ? Les règles ont beaucoup évolué ces dernières années, et le choix d'hier n'est plus forcément celui d'aujourd'hui." },
      { type: "h2", text: "Le fioul, une filière en fin de parcours" },
      { type: "p", text: "Depuis 2022, il n'est plus possible d'installer une chaudière neuve au fioul, que ce soit dans le neuf ou en remplacement. Les appareils existants peuvent continuer à fonctionner, mais leur remplacement devra se faire vers une autre énergie. Le prix du fioul, lié aux cours du pétrole, reste par ailleurs difficile à anticiper." },
      { type: "h2", text: "Le gaz, un confort connu mais plus d'aide" },
      { type: "p", text: "Le gaz reste un mode de chauffage courant. Mais l'installation d'une nouvelle chaudière gaz n'ouvre plus droit aux aides de l'État à la rénovation énergétique. Son coût dépend, lui aussi, des marchés de l'énergie." },
      { type: "box", title: "La pompe à chaleur en quatre arguments", items: [
        "Aucune combustion, donc pas d'émissions directes de CO2 dans la maison.",
        "Un rendement de 3 à 4 kWh de chaleur pour 1 kWh d'électricité consommé.",
        "La seule des trois solutions éligible à MaPrimeRénov' pour un remplacement.",
        "Des primes CEE accessibles quel que soit le niveau de revenus.",
      ] },
      { type: "tip", title: "Le bon réflexe", text: "Le meilleur choix dépend avant tout du logement : surface, isolation, radiateurs ou plancher chauffant existants. Une étude gratuite permet de comparer ce que chaque option coûterait réellement chez vous." },
      { type: "faq", items: [
        { q: "Puis-je garder ma chaudière fioul actuelle ?", a: "Oui, une chaudière fioul existante peut continuer à fonctionner et être entretenue. C'est son remplacement par une chaudière fioul neuve qui n'est plus possible." },
        { q: "La pompe à chaleur convient-elle à une vieille maison ?", a: "Souvent, oui, à condition d'être bien dimensionnée. L'étude sur place vérifie l'isolation et les émetteurs de chaleur." },
      ] },
      { type: "p", text: "Pour une estimation personnalisée, utilisez notre simulateur ou appelez le 07 49 52 52 67." },
    ],
  },
  {
    slug: "rge-qualipac-pourquoi-choisir-installateur-certifie",
    title: "RGE QualiPAC : pourquoi le choix de l'installateur change tout",
    excerpt:
      "Sans certification RGE, pas d'aides de l'État. Derrière ce sigle se cachent aussi des compétences vérifiées et des contrôles réguliers, dans un secteur où les pratiques douteuses n'ont pas disparu.",
    category: "Certification & confiance",
    date: "2026-06-29",
    readMinutes: 4,
    image: img("rge-qualipac-pourquoi-choisir-installateur-certifie"),
    imageAlt: "Un technicien chauffagiste intervient sur le module d'une installation de chauffage",
    imageCredit: "Photo libre de droits",
    keyPoints: [
      "RGE veut dire « Reconnu Garant de l'Environnement » : une qualification contrôlée.",
      "Sans entreprise RGE, ni MaPrimeRénov' ni primes CEE.",
      "La certification se vérifie gratuitement sur france-renov.gouv.fr.",
    ],
    content: [
      { type: "p", text: "Avant de comparer les marques ou les prix, une vérification s'impose : l'entreprise est-elle certifiée RGE ? Cette mention, pour « Reconnu Garant de l'Environnement », est délivrée par des organismes indépendants. Pour les pompes à chaleur, la qualification s'appelle QualiPAC et elle est attribuée par Qualit'EnR." },
      { type: "h2", text: "La condition pour toucher les aides" },
      { type: "p", text: "C'est la règle la plus importante : MaPrimeRénov' et les primes CEE exigent que les travaux soient réalisés par une entreprise certifiée RGE pour le type de travaux concerné. Une pompe à chaleur posée par une entreprise non certifiée, même de bonne qualité, fait perdre le droit à ces aides." },
      { type: "h2", text: "Un garde-fou dans un secteur sensible" },
      { type: "p", text: "La rénovation énergétique attire régulièrement des démarchages agressifs, des devis gonflés ou des installations bâclées. La certification ne règle pas tout, mais elle impose une formation, un audit des compétences et des contrôles de chantiers par l'organisme certificateur." },
      { type: "box", title: "Les bons réflexes avant de signer", items: [
        "Vérifier la certification RGE sur l'annuaire officiel france-renov.gouv.fr.",
        "Contrôler que la qualification correspond bien aux travaux (QualiPAC pour une pompe à chaleur).",
        "Se méfier des offres pressantes au téléphone ou au porte-à-porte.",
        "Ne rien signer le jour même d'un démarchage.",
      ] },
      { type: "tip", title: "Notre engagement", text: "IP5 Énergie est certifiée RGE QualiPAC : nos installations ouvrent droit aux aides de l'État et nous nous chargeons de tout le dossier administratif." },
      { type: "p", text: "Pour vérifier votre éligibilité, appelez le 07 49 52 52 67 ou utilisez notre simulateur." },
    ],
  },
  {
    slug: "aides-cumulables-renovation-energetique-france",
    title: "Rénovation énergétique : comment cumuler les aides en France",
    excerpt:
      "MaPrimeRénov', primes CEE, éco-prêt à taux zéro, TVA réduite… Bien combinés, ces dispositifs peuvent réduire fortement le reste à payer d'une pompe à chaleur. Encore faut-il savoir comment ils s'articulent.",
    category: "Aides & subventions",
    date: "2026-07-06",
    readMinutes: 5,
    image: img("aides-cumulables-renovation-energetique-france"),
    imageAlt: "Calculatrice et billets en euros pour estimer le financement d'un projet",
    imageCredit: "Photo libre de droits",
    keyPoints: [
      "Quatre dispositifs nationaux se combinent : MaPrimeRénov', CEE, éco-PTZ et TVA à 5,5 %.",
      "Des aides locales s'ajoutent parfois, selon la région ou le département.",
      "Chaque aide a ses propres conditions : une vérification au cas par cas s'impose.",
    ],
    content: [
      { type: "p", text: "Le paysage des aides à la rénovation énergétique a la réputation d'être complexe. Il l'est, en partie. Mais derrière la multiplication des sigles, une logique simple se dessine : la plupart des dispositifs nationaux ont été conçus pour se compléter sur un même projet." },
      { type: "box", title: "Les quatre dispositifs principaux", items: [
        "MaPrimeRénov' : aide directe de l'État, calculée selon les revenus et le type de travaux.",
        "Les primes CEE : financées par les fournisseurs d'énergie, cumulables avec MaPrimeRénov'.",
        "L'éco-prêt à taux zéro (éco-PTZ) : un prêt sans intérêts pour financer le reste à charge.",
        "La TVA à 5,5 % : appliquée directement sur la facture des travaux au lieu de 20 %.",
      ] },
      { type: "h2", text: "Des coups de pouce locaux" },
      { type: "p", text: "Certaines régions, départements ou intercommunalités proposent des aides complémentaires. Leur existence, leurs montants et leurs critères varient d'un territoire à l'autre, et peuvent changer d'une année sur l'autre." },
      { type: "h2", text: "Le cumul, mode d'emploi" },
      { type: "p", text: "MaPrimeRénov', les CEE, l'éco-PTZ et la TVA réduite peuvent se combiner sur un même projet de pompe à chaleur. Chacun conserve pourtant ses propres critères : revenus, ancienneté du logement, nature des travaux. Un dossier mal monté peut faire perdre une partie des aides." },
      { type: "tip", title: "Bon à savoir", text: "Les aides se demandent avant la signature du devis. Commencer les travaux trop tôt est l'erreur la plus coûteuse." },
      { type: "faq", items: [
        { q: "Les aides peuvent-elles couvrir 100 % des travaux ?", a: "Cela dépend des revenus, du projet et des règles en vigueur : seul un calcul sur votre situation permet de le dire." },
        { q: "Qui monte le dossier ?", a: "Un installateur RGE peut s'en charger. Chez IP5 Énergie, le dossier d'aides est préparé de A à Z." },
      ] },
      { type: "p", text: "IP5 Énergie calcule vos droits réels et monte l'ensemble du dossier. Testez notre simulateur ou appelez le 07 49 52 52 67." },
    ],
  },
  {
    slug: "chauffe-eau-solaire-individuel-fonctionnement",
    title: "Chauffe-eau solaire : produire son eau chaude grâce au soleil",
    excerpt:
      "L'eau chaude pèse lourd dans la facture d'un foyer. Le chauffe-eau solaire individuel (CESI) capte la chaleur du soleil pour en couvrir une grande partie, avec un appoint qui prend le relais les jours gris.",
    category: "Solaire",
    date: "2026-08-17",
    readMinutes: 5,
    image: img("chauffe-eau-solaire-individuel-fonctionnement"),
    imageAlt: "Chauffe-eau solaire à tubes sous vide surmonté de son ballon de stockage",
    imageCredit: "Photo libre de droits",
    keyPoints: [
      "Le chauffe-eau solaire capte la chaleur du soleil, pas sa lumière.",
      "Un ballon stocke l'eau chaude ; un appoint prend le relais en hiver.",
      "L'installation peut être aidée par MaPrimeRénov' et les primes CEE.",
    ],
    content: [
      { type: "p", text: "Douches, vaisselle, lessive : la production d'eau chaude représente une part importante de la consommation d'énergie d'un foyer. Le chauffe-eau solaire individuel, ou CESI, propose une réponse simple et éprouvée : utiliser la chaleur gratuite du soleil pour la produire." },
      { type: "h2", text: "Capter la chaleur, pas la lumière" },
      { type: "p", text: "Des capteurs solaires thermiques posés sur le toit absorbent le rayonnement du soleil et réchauffent un liquide qui circule à l'intérieur. Ce liquide transporte la chaleur jusqu'à un ballon de stockage, où elle est transmise à l'eau sanitaire. Contrairement aux panneaux photovoltaïques, aucun courant électrique n'est produit." },
      { type: "box", title: "Les éléments d'une installation", items: [
        "Des capteurs thermiques sur une toiture bien exposée.",
        "Un liquide caloporteur en circuit fermé, qui résiste au gel.",
        "Un ballon de stockage à échangeur qui garde l'eau chaude disponible.",
        "Un appoint (électrique, chaudière ou pompe à chaleur) pour les jours peu ensoleillés.",
      ] },
      { type: "h2", text: "Quelle part de l'eau chaude est couverte ?" },
      { type: "p", text: "Un chauffe-eau solaire bien dimensionné couvre une grande partie des besoins annuels en eau chaude. La proportion dépend de la région, de l'ensoleillement et de la taille du foyer. En hiver, l'appoint prend automatiquement le relais pour garantir de l'eau chaude toute l'année." },
      { type: "tip", title: "Bon à savoir", text: "L'orientation et l'inclinaison du toit jouent beaucoup. Une étude sur place vérifie l'exposition et l'absence d'ombre avant tout projet." },
      { type: "p", text: "Envie de savoir si votre maison s'y prête ? Utilisez notre simulateur ou appelez le 07 49 52 52 67 pour une étude gratuite." },
    ],
  },
  {
    slug: "panneaux-solaires-thermiques-ou-photovoltaiques",
    title: "Solaire thermique ou photovoltaïque : ne plus confondre les deux",
    excerpt:
      "Sur les toits, ils se ressemblent. Pourtant, les uns produisent de la chaleur et les autres de l'électricité. Avant d'investir, mieux vaut savoir quelle technologie répond vraiment à votre besoin.",
    category: "Solaire",
    date: "2026-08-24",
    readMinutes: 4,
    image: img("panneaux-solaires-thermiques-ou-photovoltaiques"),
    imageAlt: "Panneaux solaires photovoltaïques sur un toit en tuiles",
    imageCredit: "Photo libre de droits",
    keyPoints: [
      "Le thermique produit de la chaleur : eau chaude et chauffage.",
      "Le photovoltaïque produit de l'électricité.",
      "Les deux peuvent cohabiter sur un même toit.",
    ],
    content: [
      { type: "p", text: "« Mettre des panneaux solaires » : l'expression revient souvent, mais elle recouvre deux technologies très différentes. Les confondre, c'est risquer d'investir dans un équipement qui ne répond pas à son besoin." },
      { type: "h2", text: "Le thermique, pour la chaleur" },
      { type: "p", text: "Les capteurs solaires thermiques transforment le rayonnement du soleil en chaleur. Celle-ci sert à produire l'eau chaude sanitaire et, dans certains systèmes, à participer au chauffage de la maison. C'est la solution la plus directe pour réduire la facture liée à l'eau chaude." },
      { type: "h2", text: "Le photovoltaïque, pour l'électricité" },
      { type: "p", text: "Les panneaux photovoltaïques convertissent la lumière en électricité grâce à des cellules en silicium. Cette électricité peut être consommée sur place ou revendue. Ils ne produisent pas d'eau chaude directement." },
      { type: "box", title: "Lequel choisir ?", items: [
        "Besoin d'eau chaude ou de chauffage : le solaire thermique est la réponse la plus efficace.",
        "Besoin de réduire sa facture d'électricité : le photovoltaïque est adapté.",
        "Les deux technologies peuvent coexister selon la place disponible sur le toit.",
      ] },
      { type: "tip", title: "Bon à savoir", text: "Les aides ne sont pas les mêmes : le solaire thermique peut être financé par MaPrimeRénov' et les primes CEE, ce qui n'est pas le cas du photovoltaïque." },
      { type: "p", text: "IP5 Énergie installe des solutions solaires thermiques pour l'eau chaude et le chauffage. Pour savoir ce qui convient à votre logement, testez notre simulateur ou appelez le 07 49 52 52 67." },
    ],
  },
  {
    slug: "systeme-solaire-combine-chauffage-eau-chaude",
    title: "Système solaire combiné : quand le soleil chauffe aussi la maison",
    excerpt:
      "Plus ambitieux que le chauffe-eau solaire, le système solaire combiné (SSC) produit l'eau chaude et participe au chauffage. Une solution intéressante dans les maisons bien exposées, à condition d'être bien dimensionnée.",
    category: "Solaire",
    date: "2026-08-31",
    readMinutes: 5,
    image: img("systeme-solaire-combine-chauffage-eau-chaude"),
    imageAlt: "Maison individuelle équipée de panneaux solaires sur le toit",
    imageCredit: "Photo libre de droits",
    keyPoints: [
      "Le SSC chauffe l'eau sanitaire et participe au chauffage.",
      "Il s'appuie sur un ballon tampon et un appoint pour les jours sans soleil.",
      "Il est idéal avec un plancher chauffant et une toiture bien orientée.",
    ],
    content: [
      { type: "p", text: "Le système solaire combiné, ou SSC, pousse plus loin la logique du chauffe-eau solaire. En plus de l'eau chaude, la même surface de capteurs contribue au chauffage du logement. Une façon de valoriser au maximum l'énergie gratuite du soleil." },
      { type: "h2", text: "Comment ça marche" },
      { type: "p", text: "Des capteurs thermiques, en surface plus importante que pour un simple chauffe-eau, réchauffent un liquide relié à un ballon tampon. Ce ballon alimente à la fois l'eau chaude sanitaire et le circuit de chauffage. Un appoint complète la production quand l'ensoleillement ne suffit pas." },
      { type: "h2", text: "Quelle part du chauffage ?" },
      { type: "p", text: "Un SSC couvre une partie des besoins de chauffage sur l'année. La proportion dépend fortement de la région, de l'isolation et du type d'émetteurs. Il ne remplace généralement pas tout le chauffage, mais réduit d'autant la consommation du système d'appoint." },
      { type: "box", title: "Les maisons qui en tirent le meilleur parti", items: [
        "Celles équipées d'émetteurs basse température, comme un plancher chauffant.",
        "Une toiture bien exposée, idéalement plein sud, sans ombre importante.",
        "Une surface de toit suffisante pour accueillir les capteurs.",
      ] },
      { type: "tip", title: "Bon à savoir", text: "Un SSC mal dimensionné peut surchauffer en été et manquer de puissance en hiver. L'étude préalable est indispensable." },
      { type: "p", text: "Seule une étude sur place permet de dire si un SSC est pertinent chez vous. Pour une première estimation, utilisez notre simulateur ou appelez le 07 49 52 52 67." },
    ],
  },
  {
    slug: "aides-solaire-thermique-maprimerenov-cee",
    title: "Solaire thermique : quelles aides pour financer son installation ?",
    excerpt:
      "Chauffe-eau solaire et système solaire combiné ouvrent droit, sous conditions, à MaPrimeRénov' et aux primes CEE. Mode d'emploi pour ne pas passer à côté.",
    category: "Aides & subventions",
    date: "2026-09-05",
    readMinutes: 5,
    image: img("aides-solaire-thermique-maprimerenov-cee"),
    imageAlt: "Panneaux solaires installés sur le toit en tuiles d'une maison",
    imageCredit: "Photo libre de droits",
    keyPoints: [
      "Le solaire thermique est éligible à MaPrimeRénov' et aux primes CEE.",
      "L'installateur doit être certifié RGE QualiSol.",
      "Aucun montant n'est garanti à l'avance : il dépend de votre foyer et du projet.",
    ],
    content: [
      { type: "p", text: "Un chauffe-eau solaire ou un système solaire combiné représente un investissement. Mais comme pour une pompe à chaleur, plusieurs dispositifs publics peuvent en prendre en charge une partie, dans le cadre de la politique de réduction des énergies fossiles." },
      { type: "h2", text: "MaPrimeRénov' et CEE, aussi pour le solaire" },
      { type: "p", text: "Le solaire thermique fait partie des travaux éligibles à MaPrimeRénov' et aux primes CEE. Ces deux aides, souvent cumulables, suivent la même logique que pour une pompe à chaleur : leur montant dépend des revenus, de la composition du foyer et du type d'installation." },
      { type: "h2", text: "La condition : un installateur RGE QualiSol" },
      { type: "p", text: "Pour ouvrir droit aux aides, les travaux doivent être réalisés par une entreprise certifiée RGE pour le solaire thermique, avec la qualification QualiSol. La vérification se fait gratuitement sur l'annuaire officiel france-renov.gouv.fr." },
      { type: "box", title: "Les étapes dans le bon ordre", items: [
        "Faire étudier son projet et vérifier son éligibilité.",
        "Déposer les demandes d'aides avant de signer le devis.",
        "Faire réaliser les travaux par une entreprise RGE.",
        "Recevoir les aides, souvent déduites directement de la facture.",
      ] },
      { type: "tip", title: "Bon à savoir", text: "Méfiez-vous des montants « garantis » vus en ligne : chaque aide se calcule sur votre revenu fiscal de référence et votre projet précis." },
      { type: "p", text: "IP5 Énergie évalue vos droits et prépare votre dossier d'aides de A à Z. Estimez votre situation avec notre simulateur ou appelez le 07 49 52 52 67." },
    ],
  },
];
