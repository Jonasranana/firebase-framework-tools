import React, { useEffect, useRef, useState } from "react";
import {
  Leaf,
  PiggyBank,
  ShieldCheck,
  CheckCircle2,
  Home,
  Building,
  Zap,
  Flame,
  Droplets,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Users,
  Star,
  KeyRound,
  CalendarClock,
  Clock,
  Search,
  PartyPopper,
  Quote,
  Award,
  FileCheck2,
  HandCoins,
  BadgeCheck,
  Sparkles,
  Play,
  Film,
  Lock,
  Check,
  HelpCircle,
  UserRound,
  Gift,
} from "lucide-react";
import {
  FIREBASE_CONFIG,
  SiteHeader,
  SiteFooter,
  WhatsAppButton,
  AIChatWidget,
  useFrenchPageMeta,
} from "./site-chrome";
import {
  StepIllustration,
  CalculatingScene,
  IllustrationStyles,
} from "./simulator-illustrations";

// Bibliothèque partagée des sections du site IP5 Énergie. Chaque page
// (accueil, pompe à chaleur, aides, réalisations, contact) compose ces blocs,
// pour garder une identité visuelle homogène et un seul endroit à maintenir.

// --- COMPONENTS DE BASE ---

type ButtonVariant = "primary" | "secondary" | "outline" | "success";

export const Button = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) => {
  const baseStyle =
    "px-6 py-3 rounded-full font-semibold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2b5a8f]";
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-[#2b5a8f] text-white hover:bg-blue-800 shadow-lg hover:shadow-blue-500/30",
    secondary:
      "bg-white text-[#2b5a8f] border-2 border-[#2b5a8f] hover:bg-blue-50",
    outline:
      "bg-transparent text-gray-700 border border-gray-300 hover:border-[#2b5a8f] hover:text-[#2b5a8f]",
    success:
      "bg-green-500 text-white hover:bg-green-600 shadow-lg hover:shadow-green-500/30",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// Petite étiquette au-dessus des titres : un trait et un mot, sobre et identique partout.
export const Kicker = ({
  children,
  onDark = false,
}: {
  icon?: React.ElementType;
  children: React.ReactNode;
  onDark?: boolean;
}) => (
  <span
    className={`inline-flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.18em] mb-4 ${
      onDark ? "text-amber-200" : "text-[#2b5a8f] dark:text-blue-300"
    }`}
  >
    <span className="w-6 h-px bg-current opacity-70" aria-hidden="true"></span>
    {children}
  </span>
);

// En-tête de section commun à tout le site : étiquette, titre, sous-titre.
export const SectionHead = ({
  kicker,
  title,
  subtitle,
  onDark = false,
  align = "center",
}: {
  kicker: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onDark?: boolean;
  align?: "center" | "left";
}) => (
  <div className={`${align === "center" ? "text-center mx-auto" : ""} max-w-3xl mb-10 md:mb-14`}>
    <Kicker onDark={onDark}>{kicker}</Kicker>
    <h2 className={`text-[28px] md:text-[2.5rem] leading-[1.15] font-extrabold tracking-tight ${onDark ? "text-white" : "text-[#0f2a47] dark:text-white"}`}>
      {title}
    </h2>
    {subtitle && (
      <p className={`mt-3 text-base md:text-lg leading-relaxed ${align === "center" ? "mx-auto" : ""} max-w-2xl ${onDark ? "text-blue-100/80" : "text-slate-500 dark:text-slate-400"}`}>
        {subtitle}
      </p>
    )}
  </div>
);

// Révèle son contenu en fondu + léger glissement vers le haut lorsqu'il entre
// dans l'écran. Donne au site un rythme moderne « au défilement », sans
// bibliothèque. Respecte le réglage système « animations réduites » (dans ce
// cas le contenu s'affiche immédiatement, sans animation).
export const Reveal = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
};

const DEPARTMENTS = [
  "01 - Ain", "02 - Aisne", "03 - Allier", "04 - Alpes-de-Haute-Provence", "05 - Hautes-Alpes",
  "06 - Alpes-Maritimes", "07 - Ardèche", "08 - Ardennes", "09 - Ariège", "10 - Aube",
  "11 - Aude", "12 - Aveyron", "13 - Bouches-du-Rhône", "14 - Calvados", "15 - Cantal",
  "16 - Charente", "17 - Charente-Maritime", "18 - Cher", "19 - Corrèze", "2A - Corse-du-Sud",
  "2B - Haute-Corse", "21 - Côte-d'Or", "22 - Côtes-d'Armor", "23 - Creuse", "24 - Dordogne",
  "25 - Doubs", "26 - Drôme", "27 - Eure", "28 - Eure-et-Loir", "29 - Finistère",
  "30 - Gard", "31 - Haute-Garonne", "32 - Gers", "33 - Gironde", "34 - Hérault",
  "35 - Ille-et-Vilaine", "36 - Indre", "37 - Indre-et-Loire", "38 - Isère", "39 - Jura",
  "40 - Landes", "41 - Loir-et-Cher", "42 - Loire", "43 - Haute-Loire", "44 - Loire-Atlantique",
  "45 - Loiret", "46 - Lot", "47 - Lot-et-Garonne", "48 - Lozère", "49 - Maine-et-Loire",
  "50 - Manche", "51 - Marne", "52 - Haute-Marne", "53 - Mayenne", "54 - Meurthe-et-Moselle",
  "55 - Meuse", "56 - Morbihan", "57 - Moselle", "58 - Nièvre", "59 - Nord",
  "60 - Oise", "61 - Orne", "62 - Pas-de-Calais", "63 - Puy-de-Dôme", "64 - Pyrénées-Atlantiques",
  "65 - Hautes-Pyrénées", "66 - Pyrénées-Orientales", "67 - Bas-Rhin", "68 - Haut-Rhin", "69 - Rhône",
  "70 - Haute-Saône", "71 - Saône-et-Loire", "72 - Sarthe", "73 - Savoie", "74 - Haute-Savoie",
  "75 - Paris", "76 - Seine-Maritime", "77 - Seine-et-Marne", "78 - Yvelines", "79 - Deux-Sèvres",
  "80 - Somme", "81 - Tarn", "82 - Tarn-et-Garonne", "83 - Var", "84 - Vaucluse",
  "85 - Vendée", "86 - Vienne", "87 - Haute-Vienne", "88 - Vosges", "89 - Yonne",
  "90 - Territoire de Belfort", "91 - Essonne", "92 - Hauts-de-Seine", "93 - Seine-Saint-Denis", "94 - Val-de-Marne",
  "95 - Val-d'Oise",
];

export const REVIEWS = [
  {
    name: "Martine D.",
    location: "44 - Loire-Atlantique",
    text: "Passée du fioul à la pompe à chaleur en janvier. Facture divisée par deux dès le premier hiver, et IP5 a géré toutes les démarches MaPrimeRénov' pour nous.",
  },
  {
    name: "Karim B.",
    location: "69 - Rhône",
    text: "Installation propre et rapide, techniciens ponctuels. On sent une vraie différence de confort, la chaleur est beaucoup plus homogène qu'avec nos anciens radiateurs.",
  },
  {
    name: "Sophie & Laurent P.",
    location: "33 - Gironde",
    text: "Nous hésitions à cause du coût, mais avec les aides déduites du devis, le reste à charge était bien plus bas que prévu. Suivi sérieux du début à la fin.",
  },
];

// Les 6 modèles de pompes à chaleur air/eau installés par IP5 Énergie.
// Caractéristiques reprises des fiches techniques constructeur ; le modèle
// exact est choisi avec le client selon son logement et son projet.
export const PAC_MODELS: {
  brand: string;
  logo: string;
  photo: string;
  model: string;
  desc: string;
  specs: string[];
  featured?: boolean;
}[] = [
  // Marques mises en avant (partenaires principaux) : affichées en grand.
  {
    brand: "Chappée",
    logo: "chappee.png",
    photo: "chappee.jpg",
    model: "Eria-N Duo",
    desc: "Pompe à chaleur air/eau split réversible : chauffage l'hiver, rafraîchissement l'été. Une marque française historique du chauffage.",
    specs: ["Air/eau réversible", "Split Inverter", "Marque française"],
    featured: true,
  },
  {
    brand: "Atlantic",
    logo: "atlantic.png",
    photo: "atlantic.jpg",
    model: "Alféa Excellia S",
    desc: "Pompe à chaleur air/eau idéale en rénovation, silencieuse et fiable, pilotable depuis votre téléphone.",
    specs: ["Air/eau", "Fabrication française", "Connectée"],
    featured: true,
  },
  {
    brand: "Daikin",
    logo: "daikin.png",
    photo: "daikin.jpg",
    model: "Altherma 3 R",
    desc: "Pompe à chaleur air/eau haute performance, eau chaude jusqu'à 60 °C.",
    specs: ["Air/eau", "11 · 14 · 16 kW", "Fluide R-32"],
  },
  {
    brand: "De Dietrich",
    logo: "dedietrich.png",
    photo: "dedietrich.jpg",
    model: "Alezio S",
    desc: "PAC air/eau réversible « Split Inverter » : chauffage et rafraîchissement.",
    specs: ["Air/eau réversible", "4,6 à 14,6 kW", "Inverter"],
  },
  {
    brand: "TCL",
    logo: "tcl.png",
    photo: "tcl.jpg",
    model: "Bibloc R32",
    desc: "Bibloc air/eau : chauffage, rafraîchissement et eau chaude sanitaire.",
    specs: ["Air/eau", "4 à 16 kW", "Classe A+++"],
  },
  {
    brand: "Blaupunkt",
    logo: "blaupunkt.png",
    photo: "blaupunkt.jpg",
    model: "Monobloc",
    desc: "Solution complète chauffage, rafraîchissement et eau chaude sanitaire.",
    specs: ["Air/eau", "Monobloc", "Chaud + froid + ECS"],
  },
  {
    brand: "AUX",
    logo: "aux.png",
    photo: "aux.jpg",
    model: "Titan R290",
    desc: "Pompe à chaleur monobloc au fluide écologique R-290.",
    specs: ["Air/eau", "Fluide R-290", "Garantie 10 ans"],
  },
];

const TOTAL_QUESTIONS = 8;
// Les coordonnées sont demandées après cette question (et non plus seulement à la fin) :
// un visiteur qui abandonne ensuite reste joignable (fiche « Demande incomplète » dans les nouveaux leads de Pac Pac).
const CONTACT_AFTER = 3;

type SimulatorData = {
  housingType: string;
  ownerStatus: string;
  surface: number;
  currentHeating: string;
  department: string;
  householdSize: string;
  incomeBracket: string;
  projectTiming: string;
  // Produit qui intéresse le prospect : « Pompe à chaleur », « Panneaux
  // solaires » ou « Les deux ». Un seul formulaire couvre les deux offres
  // (mêmes critères d'aides).
  projectType: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  consent: boolean;
  company: string; // honeypot anti-spam : doit rester vide
};

const INITIAL_DATA: SimulatorData = {
  housingType: "",
  ownerStatus: "",
  surface: 100,
  currentHeating: "",
  department: "",
  householdSize: "",
  incomeBracket: "",
  projectTiming: "",
  projectType: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  consent: false,
  company: "",
};

// Petit message de "récompense" affiché en haut de l'étape suivante après
// chaque réponse : entretient la motivation sans rien promettre de ferme
// (les montants exacts dépendent toujours de l'éligibilité).
function rewardFor(key: keyof SimulatorData, value: string): string | null {
  switch (key) {
    case "housingType":
      return value === "Maison"
        ? "Parfait ! Les maisons sont idéales pour ce type d'installation."
        : "C'est noté ! Des solutions existent aussi en appartement.";
    case "ownerStatus":
      if (value === "Propriétaire")
        return "Top ! Les propriétaires peuvent cumuler l'ensemble des aides.";
      if (value === "Bientôt propriétaire")
        return "Bien vu d'anticiper : les aides se préparent dès l'achat.";
      return "C'est noté — nous vous expliquerons les options possibles avec votre propriétaire.";
    case "currentHeating":
      if (value === "Fioul")
        return "Bonne nouvelle : quand on chauffe au fioul, les travaux sont souvent parmi les mieux subventionnés !";
      if (value === "Gaz")
        return "Bonne nouvelle : quand on chauffe au gaz, on peut ouvrir droit à de belles aides, selon éligibilité.";
      if (value === "Electrique")
        return "C'est noté ! De belles économies sont souvent possibles grâce aux aides, selon éligibilité.";
      return "C'est noté, nos experts sauront s'adapter à votre installation.";
    case "department":
      return "C'est noté ! Nous appliquons le barème d'aides de votre département.";
    case "householdSize":
      return "Merci ! Plus que 2 petites questions.";
    case "incomeBracket":
      return value.includes("rose")
        ? "C'est noté : les primes CEE restent accessibles à tous les profils."
        : "Bonne nouvelle : votre profil correspond aux aides MaPrimeRénov', selon éligibilité.";
    default:
      return null;
  }
}

// Compteur animé (0 -> value) pour révéler l'estimation d'économies.
const AnimatedEuros = ({ value }: { value: number }) => {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutCubic : démarre vite, ralentit à la fin
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toLocaleString("fr-FR")} € / an</>;
};

// Barème MaPrimeRénov' — plafonds de ressources 2026 (revenu fiscal de
// référence, avis d'imposition). Plafonds "très modeste (bleu)" /
// "modeste (jaune)" / "intermédiaire (violet)" par taille de foyer (1 à 5
// personnes) ; au-delà du dernier plafond : profil aisé (rose).
// Pour "5+" on applique la ligne 5 (prudent : le barème officiel ajoute
// +7 116/+8 663/+12 257 € par personne supplémentaire en IdF, et
// +5 151/+6 598/+9 357 € hors IdF — confirmé lors de l'appel).
const MPR_PLAFONDS = {
  idf: [
    [24031, 29253, 40851],
    [35270, 42933, 60051],
    [42357, 51564, 71846],
    [49455, 60208, 84562],
    [56580, 68877, 96817],
  ],
  province: [
    [17363, 22259, 31185],
    [25393, 32553, 45842],
    [30540, 39148, 55196],
    [35676, 45735, 64550],
    [40835, 52348, 73907],
  ],
};

const IDF_PREFIXES = ["75", "77", "78", "91", "92", "93", "94", "95"];

// Zones climatiques officielles (H1 par défaut) : servent au barème du
// résultat de simulation ci-dessous.
const ZONE_H3 = ["06", "11", "13", "2A", "2B", "30", "34", "66", "83"];
const ZONE_H2 = [
  "04", "07", "09", "12", "16", "17", "18", "22", "24", "26", "28", "29", "31",
  "32", "33", "35", "36", "37", "40", "41", "44", "46", "47", "48", "49", "50",
  "53", "56", "61", "64", "65", "72", "79", "81", "82", "84", "85", "86",
];
const climateZone = (department: string) => {
  const code = department.slice(0, 2).toUpperCase();
  return ZONE_H3.includes(code) ? "H3" : ZONE_H2.includes(code) ? "H2" : "H1";
};

// Reste à charge indicatif par profil et par zone (barème IP5, validé par
// l'équipe). Montrés en petit : le montant exact dépend de l'avis
// d'imposition et du logement, et c'est le conseiller qui le confirme.
const RESTE_A_CHARGE: Record<string, Record<"H1" | "H2", number>> = {
  Bleu: { H1: 0, H2: 0 },
  Jaune: { H1: 0, H2: 1600 },
  Violet: { H1: 1100, H2: 2400 },
};

export type SimulationResult =
  | { kind: "zero"; profile: string; zone: string }
  | { kind: "rac"; profile: string; zone: string; amount: number }
  | { kind: "rose"; zone: string }
  | { kind: "h3" }
  | { kind: "locataire" }
  | { kind: "etude" };

export function computeSimulationResult(d: {
  department: string;
  incomeBracket: string;
  ownerStatus: string;
  housingType: string;
  currentHeating: string;
}): SimulationResult {
  const zone = climateZone(d.department);
  if (zone === "H3") return { kind: "h3" };
  if (d.ownerStatus === "Locataire") return { kind: "locataire" };
  if (d.housingType === "Appartement" || !["Fioul", "Gaz"].includes(d.currentHeating))
    return { kind: "etude" };
  const bracket = d.incomeBracket.toLowerCase();
  const profile = ["Bleu", "Jaune", "Violet"].find((p) => bracket.includes(p.toLowerCase()));
  if (!profile) return { kind: "rose", zone };
  const amount = RESTE_A_CHARGE[profile][zone as "H1" | "H2"];
  return amount === 0 ? { kind: "zero", profile, zone } : { kind: "rac", profile, zone, amount };
}

// Résumé enregistré avec le lead : le conseiller sait ce que le client a vu.
export function describeSimulationResult(r: SimulationResult): string {
  switch (r.kind) {
    case "zero":
      return `${r.profile} ${r.zone} — 0 € de reste à charge annoncé`;
    case "rac":
      return `${r.profile} ${r.zone} — reste à charge annoncé ~${r.amount.toLocaleString("fr-FR")} €`;
    case "rose":
      return `Rose ${r.zone} — CEE seule, reste à charge à prévoir`;
    case "h3":
      return "Zone H3 — « nous n'intervenons pas encore dans votre zone »";
    case "locataire":
      return "Locataire — orienté vers son propriétaire";
    case "etude":
      return "Cas à étudier (appartement ou chauffage hors fioul/gaz)";
  }
}

const euros = (n: number) => `${n.toLocaleString("fr-FR")} €`;

// Les 4 profils MaPrimeRénov', avec les tranches adaptées au département
// (Île-de-France ou province) et à la taille du foyer déjà renseignés.
function getIncomeBrackets(department: string, householdSize: string) {
  const isIdf = IDF_PREFIXES.includes(department.slice(0, 2));
  const sizeIndex = Math.min(parseInt(householdSize, 10) || 1, 5) - 1;
  const [t1, t2, t3] = MPR_PLAFONDS[isIdf ? "idf" : "province"][sizeIndex];
  return [
    { value: "Très modeste (bleu)", profile: "Bleu", dot: "bg-blue-600", label: "Revenus très modestes", range: `Moins de ${euros(t1)}` },
    { value: "Modeste (jaune)", profile: "Jaune", dot: "bg-yellow-400", label: "Revenus modestes", range: `De ${euros(t1)} à ${euros(t2)}` },
    { value: "Intermédiaire (violet)", profile: "Violet", dot: "bg-violet-500", label: "Revenus intermédiaires", range: `De ${euros(t2)} à ${euros(t3)}` },
    { value: "Supérieur (rose)", profile: "Rose", dot: "bg-pink-500", label: "Revenus supérieurs", range: `Plus de ${euros(t3)}` },
  ];
}

// Numéros FR : 0X XX XX XX XX ou +33 X XX XX XX XX, séparateurs tolérés.
// Exporté : réutilisé par les formulaires pro (ex. landing Station de
// gonflage) qui ne passent pas par le composant Simulator.
export const FRENCH_PHONE_REGEX = /^(?:\+33|0)\s*[1-9](?:[\s.\-]*\d{2}){4}$/;

// Enregistre le lead dans Firestore (projet Firebase du site, collection
// "ip5_leads"). Le SDK est chargé à la volée depuis le CDN pour ne pas
// alourdir le bundle. Le honeypot est vérifié avant l'appel.
// Les règles Firestore doivent autoriser la création sur ip5_leads :
//   match /ip5_leads/{doc} { allow create: if true; allow read: if false; }
async function submitLead(
  data: SimulatorData,
  source = "simulateur-landing",
  extra: Record<string, string> = {},
): Promise<void> {
  if (data.company) return; // bot détecté, on ignore silencieusement
  const [appMod, fsMod]: any[] = await Promise.all([
    // Imports CDN à l'exécution (hors bundle), pas de types disponibles.
    // @ts-ignore
    import(/* @vite-ignore */ "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"),
    // @ts-ignore
    import(/* @vite-ignore */ "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"),
  ]);
  const app = appMod.getApps().length
    ? appMod.getApp()
    : appMod.initializeApp(FIREBASE_CONFIG);
  const db = fsMod.getFirestore(app);
  const { company, firstName, lastName, ...lead } = data;
  await fsMod.addDoc(fsMod.collection(db, "ip5_leads"), {
    ...lead,
    // Recombiné en un seul champ « Prénom Nom » : c'est le format attendu par
    // tout le reste du pipeline (extraction du prénom pour les e-mails et la
    // colonne Monday "🙋 Prénom (Auto)"), et un formulaire à 2 champs garantit
    // un format propre plutôt qu'un nom complet tapé n'importe comment.
    name: `${firstName.trim()} ${lastName.trim()}`.trim(),
    // « source » identifie l'origine du lead : « simulateur-landing » pour
    // l'accueil, « landing-pac-meta » pour la campagne publicitaire Meta.
    // Utile pour mesurer le retour sur investissement des pubs.
    source,
    ...extra,
    createdAt: fsMod.serverTimestamp(),
    // Passe à true quand le robot de synchronisation a copié le lead dans
    // Monday (voir scripts/sync-leads-to-monday.mjs).
    mondaySynced: false,
  });

  // Conversion Meta Pixel : signale à Facebook/Instagram qu'un lead a été
  // capté, pour l'optimisation et la mesure des campagnes. Ne fait rien si le
  // Pixel n'est pas chargé (ID non renseigné dans index.html).
  try {
    // Les leads des campagnes de réactivation (mail/SMS) ne viennent pas
    // d'une pub : les compter fausserait l'optimisation des campagnes Meta.
    if (!source.startsWith("reactivation"))
      (window as any).fbq?.("track", "Lead", { content_category: source });
  } catch {
    /* le tracking ne doit jamais casser l'enregistrement du lead */
  }
}

// Demande de rappel express (landing PAC) : même collection et même circuit
// que le simulateur (Monday, notification interne, pixel Meta), avec
// seulement les champs utiles pour rappeler.
export type CallbackRequest = {
  firstName: string;
  lastName: string;
  phone: string;
  postalCode: string;
  currentHeating: string;
  company: string; // honeypot anti-spam : doit rester vide
};

export async function submitCallbackRequest(
  data: CallbackRequest,
  source: string,
): Promise<void> {
  if (data.company) return;
  const [appMod, fsMod]: any[] = await Promise.all([
    // @ts-ignore
    import(/* @vite-ignore */ "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"),
    // @ts-ignore
    import(/* @vite-ignore */ "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"),
  ]);
  const app = appMod.getApps().length
    ? appMod.getApp()
    : appMod.initializeApp(FIREBASE_CONFIG);
  const db = fsMod.getFirestore(app);
  await fsMod.addDoc(fsMod.collection(db, "ip5_leads"), {
    name: `${data.firstName.trim()} ${data.lastName.trim()}`.trim(),
    phone: data.phone.trim(),
    email: "",
    postalCode: data.postalCode.trim(),
    // Les formules Région/Zone du tableau Monday lisent les 2 premiers
    // caractères : le code postal complet convient aussi comme département.
    department: data.postalCode.trim(),
    currentHeating: data.currentHeating,
    requestType: "Demande de rappel",
    projectType: "Pompe à chaleur",
    consent: true,
    source,
    createdAt: fsMod.serverTimestamp(),
    mondaySynced: false,
  });
  try {
    if (!source.startsWith("reactivation"))
      (window as any).fbq?.("track", "Lead", { content_category: source });
  } catch {
    /* le tracking ne doit jamais casser l'enregistrement du lead */
  }
}

// Suivi des visites qui n'aboutissent pas : une fois les coordonnées données (avec l'accord d'être
// recontacté), chaque réponse est signalée au serveur, qui tient à jour une fiche dans les
// nouveaux leads de Pac Pac (message « Demande incomplète » dans la bulle). Sans coordonnées, rien n'est enregistré. Ne casse jamais le parcours.
const TRACK_URL = "https://europe-west9-kachoto-7554c.cloudfunctions.net/trackSimulatorStep";
export function getVisitId(): string {
  try {
    let id = sessionStorage.getItem("ip5-visit");
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)))
        .map((b) => b.toString(36).padStart(2, "0"))
        .join("")
        .slice(0, 24);
      sessionStorage.setItem("ip5-visit", id);
    }
    return id;
  } catch {
    return "";
  }
}
export function trackStep(source: string, step: number, answers: Record<string, unknown>) {
  try {
    if (source.startsWith("reactivation")) return;
    const sid = getVisitId();
    if (!sid) return;
    const body = JSON.stringify({ sid, source, step, answers });
    if (navigator.sendBeacon) navigator.sendBeacon(TRACK_URL, new Blob([body], { type: "text/plain" }));
    else fetch(TRACK_URL, { method: "POST", body, headers: { "Content-Type": "text/plain" }, keepalive: true, mode: "no-cors" }).catch(() => {});
  } catch {
    /* le suivi ne doit jamais gêner le visiteur */
  }
}

// --- Habillage du simulateur ---
// Chaque réponse a sa couleur : le parcours est plus vivant et plus lisible,
// comme un vrai tunnel de vente d'agence.
type Tint = "gold" | "blue" | "violet" | "amber" | "orange" | "yellow" | "slate" | "emerald" | "sky" | "pink";
// Palette du site : bleu nuit et doré seulement (pas d'arc-en-ciel).
// Les anciens noms de teinte restent pour ne pas toucher aux questions.
const TINTS: Record<Tint, { icon: string; ring: string; soft: string; dot: string }> = {
  gold: { icon: "from-amber-300 to-amber-500", ring: "ring-amber-400 border-amber-400", soft: "bg-amber-50", dot: "bg-amber-400" },
  amber: { icon: "from-amber-300 to-amber-500", ring: "ring-amber-400 border-amber-400", soft: "bg-amber-50", dot: "bg-amber-400" },
  yellow: { icon: "from-amber-300 to-amber-500", ring: "ring-amber-400 border-amber-400", soft: "bg-amber-50", dot: "bg-amber-400" },
  orange: { icon: "from-amber-300 to-amber-500", ring: "ring-amber-400 border-amber-400", soft: "bg-amber-50", dot: "bg-amber-400" },
  pink: { icon: "from-amber-300 to-amber-500", ring: "ring-amber-400 border-amber-400", soft: "bg-amber-50", dot: "bg-amber-400" },
  blue: { icon: "from-[#4a7fc1] to-[#1d4e89]", ring: "ring-[#2b5a8f] border-[#2b5a8f]", soft: "bg-blue-50", dot: "bg-[#2b5a8f]" },
  violet: { icon: "from-[#4a7fc1] to-[#1d4e89]", ring: "ring-[#2b5a8f] border-[#2b5a8f]", soft: "bg-blue-50", dot: "bg-[#2b5a8f]" },
  sky: { icon: "from-[#4a7fc1] to-[#1d4e89]", ring: "ring-[#2b5a8f] border-[#2b5a8f]", soft: "bg-blue-50", dot: "bg-[#2b5a8f]" },
  emerald: { icon: "from-[#4a7fc1] to-[#1d4e89]", ring: "ring-[#2b5a8f] border-[#2b5a8f]", soft: "bg-blue-50", dot: "bg-[#2b5a8f]" },
  slate: { icon: "from-slate-400 to-slate-600", ring: "ring-slate-500 border-slate-500", soft: "bg-slate-50", dot: "bg-slate-500" },
};

// Bouton de réponse : grande tuile (2 par ligne) ou ligne (liste). Quand on
// le touche, il s'allume (contour coloré + coche) une fraction de seconde
// avant de passer à la question suivante.
const Choice = ({
  onClick,
  picked,
  dimmed,
  tint,
  icon: Icon,
  title,
  hint,
  layout = "row",
  delay = 0,
  children,
}: {
  onClick: () => void;
  picked: boolean;
  dimmed: boolean;
  tint: Tint;
  icon?: React.ElementType;
  title: React.ReactNode;
  hint?: React.ReactNode;
  layout?: "tile" | "row" | "number";
  delay?: number;
  children?: React.ReactNode;
}) => {
  const t = TINTS[tint];
  const base =
    "group relative w-full bg-white border-2 touch-manipulation select-none transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2b5a8f] animate-in fade-in slide-in-from-bottom-1 active:scale-[0.98]";
  const state = picked
    ? `${t.ring} ring-2 ring-offset-0 ${t.soft} shadow-lg scale-[1.02]`
    : `border-slate-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 ${dimmed ? "opacity-50" : ""}`;
  const check = picked && (
    <span
      className={`absolute top-2 right-2 w-6 h-6 rounded-full bg-gradient-to-br ${t.icon} text-white flex items-center justify-center shadow`}
      style={{ animation: "ip5-pop .2s ease-out both" }}
    >
      <Check size={14} strokeWidth={3} />
    </span>
  );
  const style = { animationDelay: `${Math.round(delay / 3)}ms`, animationDuration: "220ms" };
  if (layout === "number")
    return (
      <button type="button" onClick={onClick} style={style} className={`${base} ${state} rounded-2xl py-5 flex flex-col items-center justify-center`}>
        <span className={`text-2xl font-extrabold ${picked ? "text-gray-900" : "text-gray-700"}`}>{title}</span>
        {hint && <span className="text-[10px] font-semibold text-gray-400 mt-0.5">{hint}</span>}
        {picked && <span className={`absolute inset-x-3 bottom-1.5 h-1 rounded-full bg-gradient-to-r ${t.icon}`}></span>}
      </button>
    );
  if (layout === "tile")
    return (
      <button type="button" onClick={onClick} style={style} className={`${base} ${state} rounded-2xl p-5 pt-6 flex flex-col items-center text-center`}>
        {check}
        {Icon && (
          <span className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${t.icon} text-white flex items-center justify-center shadow-md mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
            <Icon size={30} strokeWidth={1.9} />
          </span>
        )}
        {children}
        <span className="font-bold text-[17px] text-gray-800">{title}</span>
        {hint && <span className="text-xs text-gray-500 mt-0.5">{hint}</span>}
      </button>
    );
  return (
    <button type="button" onClick={onClick} style={style} className={`${base} ${state} rounded-2xl p-4 flex items-center gap-3.5 text-left`}>
      {check}
      {Icon ? (
        <span className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.icon} text-white flex items-center justify-center shadow-sm flex-shrink-0 transition-transform duration-300 group-hover:scale-110`}>
          <Icon size={22} strokeWidth={1.9} />
        </span>
      ) : (
        <span className={`w-2 self-stretch rounded-full ${t.dot} flex-shrink-0`} aria-hidden="true"></span>
      )}
      <span className="flex-1 pr-6">
        <span className="block font-bold text-gray-800 leading-snug">{title}</span>
        {hint && <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>}
      </span>
    </button>
  );
};

// Petits confettis (CSS seul) pour fêter un bon résultat.
const Confetti = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <style>{`@keyframes ip5-confetti { 0% { transform: translate3d(0,-20px,0) rotate(0); opacity: 0 } 10% { opacity: 1 } 100% { transform: translate3d(var(--x),260px,0) rotate(540deg); opacity: 0 } }`}</style>
    {Array.from({ length: 22 }, (_, i) => (
      <span
        key={i}
        className="ip5-anim absolute top-0 w-2 h-3 rounded-[2px]"
        style={{
          left: `${(i * 37) % 100}%`,
          background: ["#fcd34d", "#f59e0b", "#173a5e", "#2b5a8f", "#fde68a", "#93c5fd"][i % 6],
          ["--x" as any]: `${((i * 53) % 80) - 40}px`,
          animation: `ip5-confetti ${1.6 + (i % 5) * 0.25}s ease-out ${(i % 7) * 0.08}s both`,
        }}
      ></span>
    ))}
  </div>
);

// Habillage « verre dépoli » du simulateur : on éclaircit les textes et on
// rend les fonds translucides, sans toucher au contenu des étapes.
export const GLASS_CSS = String.raw`
.ip5-glass .bg-white{background-color:rgba(255,255,255,.07)!important}
.ip5-glass .bg-slate-50,.ip5-glass .bg-gray-50{background-color:rgba(255,255,255,.06)!important}
.ip5-glass .bg-blue-50,.ip5-glass .bg-amber-50,.ip5-glass .bg-slate-100{background-color:rgba(255,255,255,.14)!important}
.ip5-glass [class*="border-slate-"],.ip5-glass [class*="border-gray-"],.ip5-glass .border-amber-200{border-color:rgba(255,255,255,.18)!important}
.ip5-glass .text-gray-900,.ip5-glass .text-gray-800,.ip5-glass .text-gray-700,.ip5-glass .text-slate-700,.ip5-glass .text-slate-800,.ip5-glass .text-\[\#0f2a47\],.ip5-glass .text-\[\#173a5e\]{color:#fff!important}
.ip5-glass .text-gray-600,.ip5-glass .text-gray-500,.ip5-glass .text-slate-600,.ip5-glass .text-slate-500{color:rgba(255,255,255,.72)!important}
.ip5-glass .text-gray-400,.ip5-glass .text-slate-400{color:rgba(255,255,255,.55)!important}
.ip5-glass input,.ip5-glass select,.ip5-glass textarea{background-color:rgba(255,255,255,.08)!important;color:#fff!important;border-color:rgba(255,255,255,.22)!important}
.ip5-glass input::placeholder{color:rgba(255,255,255,.55)!important}
.ip5-glass option{color:#0b1a2c}
.ip5-glass .bg-clip-text{background-image:linear-gradient(90deg,#fcd34d,#fef3c7)!important}
.ip5-glass .text-red-600,.ip5-glass .text-red-700{color:#fca5a5!important}
.ip5-glass .bg-red-50{background-color:rgba(248,113,113,.12)!important}
.ip5-glass [class*="border-red-"]{border-color:rgba(248,113,113,.35)!important}
.ip5-glass button:disabled{background:rgba(255,255,255,.12)!important;color:rgba(255,255,255,.5)!important;box-shadow:none!important;opacity:1!important}
.ip5-glass .ip5-stage{background:rgba(255,255,255,.06)!important;border-color:rgba(255,255,255,.12)!important}
`;

export const Simulator = ({
  source = "simulateur-landing",
  tone = "default",
  initialHeating = "",
  glass = false,
}: {
  source?: string;
  // « glass » : bulle transparente (verre dépoli) pour les bandeaux bleu nuit.
  glass?: boolean;
  // Chauffage déjà choisi avant le simulateur (question rapide de /pac) : la question n'est pas reposée.
  initialHeating?: string;
  // « pro » : présentation plus sobre (page d'accueil) ; défaut : présentation d'origine des pages de campagne.
  tone?: "default" | "pro";
} = {}) => {
  const pro = tone === "pro";
  const [step, setStep] = useState(1);
  const [isCalculating, setIsCalculating] = useState(false);
  const [formData, setFormData] = useState<SimulatorData>({ ...INITIAL_DATA, currentHeating: initialHeating });
  const HEATING_STEP = 4;
  const heatingPreset = !!initialHeating;
  const [reward, setReward] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    consent?: string;
    submit?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Étape « coordonnées » intercalée après la question CONTACT_AFTER.
  const [earlyContact, setEarlyContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  // Réponse qui vient d'être touchée (s'allume avant de passer à la suite)
  // et sens de défilement des questions (avant / arrière).
  const [picked, setPicked] = useState<string | null>(null);
  const [goingBack, setGoingBack] = useState(false);
  const pickTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(pickTimer.current), []);

  // Source réelle du lead : un paramètre d'URL « ?src= » (ex. lien SMS)
  // prime sur la source de la page, pour mesurer les campagnes de réactivation.
  const effectiveSource = (() => {
    try {
      const p = new URLSearchParams(window.location.search).get("src");
      return p && p.trim() ? p.trim().slice(0, 40) : source;
    } catch {
      return source;
    }
  })();

  // Une fois les coordonnées données, chaque étape franchie met à jour la fiche « incomplète » du CRM.
  useEffect(() => {
    if (contactSaved && step >= 2 && step <= TOTAL_QUESTIONS + 1 && !isCalculating) trackStep(effectiveSource, step - 1, formData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Pré-sélection du projet selon l'origine : PAC sur la landing PAC, solaire
  // sur la landing solaire, « Les deux » sur le simulateur générique (site, SMS).
  useEffect(() => {
    const s = effectiveSource.toLowerCase();
    const def = s.includes("solaire")
      ? "Panneaux solaires"
      : s.includes("pac")
        ? "Pompe à chaleur"
        : "Les deux";
    setFormData((d) => (d.projectType ? d : { ...d, projectType: def }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToResults = (data: SimulatorData = formData) => {
    setReward(null);
    setIsCalculating(true);
    // Coordonnées déjà données en cours de route : la demande part directement, sans les redemander.
    const send = contactSaved ? sendLead(data) : Promise.resolve(false);
    Promise.all([send, new Promise((r) => setTimeout(r, 1400))]).then(([sent]) => {
      setIsCalculating(false);
      setStep(sent ? TOTAL_QUESTIONS + 2 : TOTAL_QUESTIONS + 1);
    });
  };

  // Avance d'une étape en affichant le message d'encouragement lié à la
  // réponse qui vient d'être donnée.
  const advance = (rewardMsg: string | null, data: SimulatorData = formData) => {
    setGoingBack(false);
    if (step === CONTACT_AFTER && !contactSaved) {
      setReward(rewardMsg);
      setEarlyContact(true);
    } else if (step === TOTAL_QUESTIONS) {
      goToResults(data);
    } else {
      setReward(rewardMsg);
      setStep(nextStep(step));
    }
  };

  const nextStep = (from: number) => (heatingPreset && from + 1 === HEATING_STEP ? from + 2 : from + 1);

  const prevStep = () => {
    window.clearTimeout(pickTimer.current);
    setPicked(null);
    setGoingBack(true);
    if (earlyContact) {
      setEarlyContact(false);
      setReward(null);
      return;
    }
    if (step > 1 && !isCalculating) {
      setReward(null);
      setStep(heatingPreset && step - 1 === HEATING_STEP ? step - 2 : step - 1);
    }
  };

  const choose = (key: keyof SimulatorData, value: string) => {
    if (picked) return; // une réponse est déjà en cours de validation
    const next = { ...formData, [key]: value };
    setFormData(next);
    setPicked(`${key}:${value}`);
    pickTimer.current = window.setTimeout(() => {
      setPicked(null);
      advance(rewardFor(key, value), next);
    }, 130);
  };
  const isPicked = (key: keyof SimulatorData, value: string) => picked === `${key}:${value}`;
  const pickProps = (key: keyof SimulatorData, value: string) => ({
    onClick: () => choose(key, value),
    picked: isPicked(key, value),
    dimmed: !!picked && !isPicked(key, value),
  });

  const validateContact = () => {
    const newErrors: typeof errors = {};
    if (formData.lastName.trim().length < 2) {
      newErrors.lastName = "Merci d'indiquer votre nom.";
    }
    if (formData.firstName.trim().length < 2) {
      newErrors.firstName = "Merci d'indiquer votre prénom.";
    }
    if (!FRENCH_PHONE_REGEX.test(formData.phone.trim())) {
      newErrors.phone = "Merci d'indiquer un numéro de téléphone français valide (ex : 06 12 34 56 78).";
    }
    const email = formData.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      newErrors.email = "Merci d'indiquer une adresse e-mail valide.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Coordonnées données en cours de simulation : la fiche est créée tout de suite dans le CRM.
  const saveEarlyContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.company || !validateContact()) return;
    // Accord donné en cliquant sur « Continuer » (mention affichée au-dessus du bouton).
    setFormData({ ...formData, consent: true });
    setContactSaved(true);
    setEarlyContact(false);
    setReward(null);
    setStep(nextStep(CONTACT_AFTER)); // la fiche est créée par l'effet de suivi des étapes
  };

  const sendLead = async (data: SimulatorData): Promise<boolean> => {
    try {
      // Sans réseau, l'envoi Firestore ne répond jamais : au bout de 20 s, le formulaire final prend le relais.
      await Promise.race([
        submitLead(data, effectiveSource, {
          simulationResult: describeSimulationResult(computeSimulationResult(data)),
          sessionId: getVisitId(),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("délai dépassé")), 20000)),
      ]);
      return true;
    } catch (err) {
      console.error("Échec de l'enregistrement du lead:", err);
      // Repli : le formulaire final (déjà rempli) s'affiche avec un message d'erreur.
      setErrors({ submit: "Une erreur est survenue lors de l'envoi. Réessayez, ou appelez-nous directement au 07 49 52 52 67." });
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateContact()) return;

    setIsSubmitting(true);
    try {
      const data = { ...formData, consent: true }; // accord donné en cliquant sur le bouton
      await submitLead(data, effectiveSource, {
        simulationResult: describeSimulationResult(computeSimulationResult(data)),
        sessionId: getVisitId(),
      });
      setStep(TOTAL_QUESTIONS + 2);
    } catch (err) {
      console.error("Échec de l'enregistrement du lead:", err);
      setErrors({
        submit:
          "Une erreur est survenue lors de l'envoi. Réessayez, ou appelez-nous directement au 07 49 52 52 67.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const restart = () => {
    setStep(1);
    setEarlyContact(false);
    setContactSaved(false);
    setErrors({});
    setFormData(INITIAL_DATA);
  };

  const savingsEstimate = () => {
    const baseMultiplier =
      formData.currentHeating === "Fioul"
        ? 22
        : formData.currentHeating === "Gaz"
          ? 15
          : 18;
    return Math.round(formData.surface * baseMultiplier);
  };

  const contactFields = () => (
    <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="lead-lastname" className="sr-only">
                    Nom
                  </label>
                  <input
                    id="lead-lastname"
                    type="text"
                    required
                    autoComplete="family-name"
                    placeholder="Nom"
                    value={formData.lastName}
                    aria-invalid={!!errors.lastName}
                    className={`w-full px-4 py-3.5 rounded-xl border-2 focus:ring-4 focus:ring-blue-100 focus:border-[#2b5a8f] outline-none bg-slate-50 focus:bg-white text-gray-900 placeholder-gray-400 transition-all ${errors.lastName ? "border-red-400" : "border-slate-200"}`}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                  />
                  {errors.lastName && (
                    <p className="text-red-600 text-xs mt-1">{errors.lastName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="lead-firstname" className="sr-only">
                    Prénom
                  </label>
                  <input
                    id="lead-firstname"
                    type="text"
                    required
                    autoComplete="given-name"
                    placeholder="Prénom"
                    value={formData.firstName}
                    aria-invalid={!!errors.firstName}
                    className={`w-full px-4 py-3.5 rounded-xl border-2 focus:ring-4 focus:ring-blue-100 focus:border-[#2b5a8f] outline-none bg-slate-50 focus:bg-white text-gray-900 placeholder-gray-400 transition-all ${errors.firstName ? "border-red-400" : "border-slate-200"}`}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                  />
                  {errors.firstName && (
                    <p className="text-red-600 text-xs mt-1">{errors.firstName}</p>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="lead-phone" className="sr-only">
                  Numéro de téléphone
                </label>
                <input
                  id="lead-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="Votre numéro de téléphone"
                  value={formData.phone}
                  aria-invalid={!!errors.phone}
                  className={`w-full px-4 py-3.5 rounded-xl border-2 focus:ring-4 focus:ring-blue-100 focus:border-[#2b5a8f] outline-none bg-slate-50 focus:bg-white text-gray-900 placeholder-gray-400 transition-all ${errors.phone ? "border-red-400" : "border-slate-200"}`}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
                {errors.phone && (
                  <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
                )}
              </div>
              <div>
                <label htmlFor="lead-email" className="sr-only">
                  Adresse e-mail
                </label>
                <input
                  id="lead-email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="Votre e-mail"
                  value={formData.email}
                  aria-invalid={!!errors.email}
                  className={`w-full px-4 py-3.5 rounded-xl border-2 focus:ring-4 focus:ring-blue-100 focus:border-[#2b5a8f] outline-none bg-slate-50 focus:bg-white text-gray-900 placeholder-gray-400 transition-all ${errors.email ? "border-red-400" : "border-slate-200"}`}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
                {errors.email && (
                  <p className="text-red-600 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* Honeypot anti-spam : caché aux humains, rempli par les bots */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="lead-company">Société</label>
                <input
                  id="lead-company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={formData.company}
                  onChange={(e) =>
                    setFormData({ ...formData, company: e.target.value })
                  }
                />
              </div>

              {/* Pas de case à cocher : l'accord est donné en cliquant sur le bouton (mention claire juste au-dessus). */}
              <p className="text-xs text-gray-500 leading-relaxed text-left">
                En cliquant ci-dessous, j'accepte d'être recontacté(e) par IP5 Énergie au sujet de ma
                demande de devis. Mes données ne sont jamais revendues et je peux exercer mes droits
                (accès, rectification, suppression) à tout moment.
              </p>
    </>
  );

  // Styles communs des questions.
  const Q = "text-[22px] md:text-[24px] leading-tight font-extrabold text-[#0f2a47] mb-1.5 text-center tracking-tight";
  const SUB = "text-slate-500 text-sm mb-5 text-center";
  const CTA = "!rounded-2xl py-4 !text-[#0b1a2c] font-bold text-[16px] bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200 shadow-lg shadow-amber-500/25 hover:brightness-105 active:scale-[0.99]";

  const renderStep = () => {
    if (earlyContact) {
      return (
        <div>
          <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-white flex items-center justify-center shadow-md" style={{ animation: "ip5-pop .5s ease-out both" }}>
            <Gift size={24} />
          </div>
          <h3 className={Q}>Où vous envoyer votre estimation&nbsp;?</h3>
          <p className={SUB}>
            Encore quelques questions rapides ensuite. Un conseiller pourra
            vous rappeler si besoin.
          </p>
          <form onSubmit={saveEarlyContact} className="space-y-3" noValidate>
            {contactFields()}
            <Button type="submit" className={`w-full ${CTA}`}>
              Continuer <ArrowRight size={18} />
            </Button>
          </form>
        </div>
      );
    }
    switch (step) {
      case 1:
        return (
          <div>
            <h3 className={Q}>Quel est votre type de logement&nbsp;?</h3>
            <p className={SUB}>Pour adapter les aides à votre logement.</p>
            <div className="grid grid-cols-2 gap-3">
              <Choice layout="tile" tint="gold" icon={Home} title="Maison" hint="Individuelle" {...pickProps("housingType", "Maison")} />
              <Choice layout="tile" tint="gold" icon={Building} title="Appartement" hint="En copropriété" delay={60} {...pickProps("housingType", "Appartement")} />
            </div>
          </div>
        );
      case 2:
        return (
          <div>
            <h3 className={Q}>Vous êtes…&nbsp;?</h3>
            <p className={SUB}>Les aides diffèrent selon votre situation.</p>
            <div className="space-y-2.5">
              {[
                { value: "Propriétaire", hint: "Vous habitez votre logement", tint: "emerald" as Tint, icon: KeyRound },
                { value: "Bientôt propriétaire", hint: "Achat en cours ou prévu", tint: "sky" as Tint, icon: Home },
                { value: "Locataire", hint: "Votre propriétaire décide des travaux", tint: "slate" as Tint, icon: UserRound },
              ].map((o, i) => (
                <Choice key={o.value} tint={o.tint} icon={o.icon} title={o.value} hint={o.hint} delay={i * 60} {...pickProps("ownerStatus", o.value)} />
              ))}
            </div>
          </div>
        );
      case 3: {
        const pct = ((formData.surface - 30) / (300 - 30)) * 100;
        return (
          <div className="text-center">
            <h3 className={Q}>Quelle est la surface à chauffer&nbsp;?</h3>
            <p className={SUB}>Une estimation suffit.</p>
            <div className="mb-6">
              <span key={formData.surface} className="inline-block text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#0f2b4a] to-[#2b5a8f] animate-in zoom-in-95 duration-150">
                {formData.surface}
              </span>
              <span className="text-2xl font-bold text-slate-400 ml-1">m²</span>
            </div>
            <input
              type="range"
              min="30"
              max="300"
              step="10"
              value={formData.surface}
              aria-label="Surface à chauffer en mètres carrés"
              onChange={(e) =>
                setFormData({ ...formData, surface: Number(e.target.value) })
              }
              className="ip5-range w-full mb-5"
              style={{ background: `linear-gradient(90deg, #2b5a8f 0%, #06b6d4 ${pct}%, #e2e8f0 ${pct}%)` }}
            />
            <div className="flex justify-center gap-2 mb-7">
              {[80, 100, 120, 150].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFormData({ ...formData, surface: m })}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${formData.surface === m ? "bg-[#173a5e] text-white border-[#173a5e]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
                >
                  {m} m²
                </button>
              ))}
            </div>
            <Button onClick={() => advance(`${formData.surface} m², c'est noté !`)} className={`w-full ${CTA}`}>
              Continuer <ArrowRight size={18} />
            </Button>
          </div>
        );
      }
      case 4:
        return (
          <div>
            <h3 className={Q}>Quel est votre chauffage actuel&nbsp;?</h3>
            <p className={SUB}>C'est lui qui détermine le montant de vos aides.</p>
            <div className="grid grid-cols-2 gap-3">
              <Choice layout="tile" tint="amber" icon={Droplets} title="Fioul" {...pickProps("currentHeating", "Fioul")} />
              <Choice layout="tile" tint="orange" icon={Flame} title="Gaz" delay={50} {...pickProps("currentHeating", "Gaz")} />
              <Choice layout="tile" tint="yellow" icon={Zap} title="Électrique" delay={100} {...pickProps("currentHeating", "Electrique")} />
              <Choice layout="tile" tint="slate" icon={HelpCircle} title="Autre" delay={150} {...pickProps("currentHeating", "Autre")} />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="text-center">
            <h3 className={Q}>Dans quel département se situe votre projet&nbsp;?</h3>
            <p className={SUB}>Les aides d'État (MaPrimeRénov') varient selon votre région.</p>

            <div className="relative mb-7 text-left">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-gradient-to-br from-[#2b5a8f] to-[#0f2b4a] text-white flex items-center justify-center shadow-sm pointer-events-none">
                <MapPin size={18} />
              </span>
              <select
                value={formData.department}
                aria-label="Département du projet"
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
                className={`w-full pl-16 pr-10 py-4 rounded-2xl border-2 outline-none appearance-none bg-white font-semibold text-gray-800 transition-all cursor-pointer focus:border-[#2b5a8f] focus:ring-4 focus:ring-blue-100 ${formData.department ? "border-[#2b5a8f]" : "border-slate-200"}`}
                required
              >
                <option value="" disabled>
                  Votre département…
                </option>
                {DEPARTMENTS.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowRight size={16} className="text-gray-400 rotate-90" />
              </div>
            </div>

            <Button
              onClick={() => advance(rewardFor("department", formData.department))}
              className={`w-full ${CTA}`}
              disabled={!formData.department}
            >
              Continuer <ArrowRight size={18} />
            </Button>
          </div>
        );
      case 6:
        return (
          <div className="text-center">
            <h3 className={Q}>Combien de personnes composent votre foyer&nbsp;?</h3>
            <p className={SUB}>Indispensable pour calculer vos subventions.</p>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {["1", "2", "3", "4", "5+"].map((num, i) => (
                <Choice
                  key={num}
                  layout="number"
                  tint="sky"
                  title={num}
                  hint="pers."
                  delay={i * 40}
                  {...pickProps("householdSize", num)}
                />
              ))}
            </div>
            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <Users size={13} /> Vous compris, enfants inclus
            </p>
          </div>
        );
      case 7: {
        const brackets = getIncomeBrackets(
          formData.department,
          formData.householdSize,
        );
        const tintOf: Record<string, Tint> = { Bleu: "blue", Jaune: "yellow", Violet: "violet", Rose: "pink" };
        return (
          <div className="text-center">
            <h3 className={Q}>Quel est le revenu fiscal de votre foyer&nbsp;?</h3>
            <p className={SUB}>
              Sur votre <b className="text-slate-700">avis d'imposition</b> (« revenu fiscal de
              référence »). Il détermine votre profil MaPrimeRénov'.
            </p>
            <div className="space-y-2.5 mb-2">
              {brackets.map((b, i) => (
                <Choice
                  key={b.value}
                  tint={tintOf[b.profile]}
                  title={b.range}
                  hint={<>{b.label} — profil {b.profile}</>}
                  delay={i * 50}
                  {...pickProps("incomeBracket", b.value)}
                />
              ))}
            </div>
            <p className="text-[11px] text-gray-400">
              Barème indicatif pour un foyer de {formData.householdSize}{" "}
              personne(s) dans votre département.
            </p>
          </div>
        );
      }
      case 8:
        return (
          <div>
            <h3 className={Q}>Dernière question : c'est pour quand&nbsp;?</h3>
            <p className={SUB}>Votre estimation est prête juste après 🎁</p>
            <div className="space-y-2.5">
              {[
                { value: "Dès que possible", hint: "Je veux avancer rapidement", icon: Zap, tint: "orange" as Tint },
                { value: "Dans les 6 mois", hint: "Je prépare mon projet", icon: CalendarClock, tint: "blue" as Tint },
                { value: "Je me renseigne", hint: "Je compare et je réfléchis", icon: Search, tint: "slate" as Tint },
              ].map((o, i) => (
                <Choice key={o.value} tint={o.tint} icon={o.icon} title={o.value} hint={o.hint} delay={i * 60} {...pickProps("projectTiming", o.value)} />
              ))}
            </div>
          </div>
        );
      case 9: {
        const savings = savingsEstimate();

        return (
          <div>
            <div className="relative rounded-3xl p-6 mb-6 text-center text-white overflow-hidden bg-gradient-to-br from-[#0b1a2c] via-[#0f2b4a] to-[#1d4e89] shadow-xl shadow-blue-950/25">
              <Confetti />
              <div className="absolute -top-6 -right-6 opacity-15">
                <PiggyBank size={120} />
              </div>
              <p className="relative font-bold mb-1 flex items-center justify-center gap-2 text-amber-200">
                <PartyPopper size={18} /> Excellente nouvelle !
              </p>
              <p className="relative text-white/85 text-sm mb-1">
                Vous pourriez économiser jusqu'à
              </p>
              <p className="relative text-[40px] leading-tight font-extrabold mb-3 drop-shadow-sm text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200">
                <AnimatedEuros value={savings} />
              </p>
              <div className="relative inline-flex items-center justify-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 px-3 py-1 rounded-full text-xs font-bold">
                <CheckCircle2 size={14} /> Votre résultat détaillé juste après
              </div>
              <p className="relative text-[10.5px] text-white/70 mt-3 leading-snug">
                Estimation indicative, non contractuelle, basée sur vos
                réponses. Le montant exact dépend de votre logement et de vos
                revenus.
              </p>
            </div>

            <h3 className="text-xl font-extrabold text-gray-900 mb-4 text-center tracking-tight">
              Recevez votre devis exact gratuit
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Choix du projet : un seul formulaire couvre PAC et solaire. */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2 text-center">
                  Votre projet
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {["Pompe à chaleur", "Panneaux solaires", "Les deux"].map(
                    (p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, projectType: p })
                        }
                        aria-pressed={formData.projectType === p}
                        className={`px-2 py-2.5 rounded-xl border-2 text-xs font-bold leading-tight transition-all ${
                          formData.projectType === p
                            ? "border-transparent bg-gradient-to-r from-[#173a5e] to-[#2b5a8f] text-white shadow-md scale-[1.03]"
                            : "border-slate-200 bg-white text-gray-700 hover:border-slate-400"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>
              </div>
              {contactFields()}

              {errors.submit && (
                <p className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {errors.submit}
                </p>
              )}
              <Button
                type="submit"
                variant="success"
                disabled={isSubmitting}
                className="w-full text-lg py-4 !rounded-2xl !text-[#0b1a2c] font-bold bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200 shadow-lg shadow-amber-500/25 hover:brightness-105"
              >
                {isSubmitting ? "Envoi en cours..." : "Voir mes résultats complets"}
              </Button>
            </form>
          </div>
        );
      }
      case 10: {
        const result = computeSimulationResult(formData);
        const prenom = formData.firstName.trim();
        const profil =
          result.kind === "zero" || result.kind === "rac"
            ? `profil ${result.profile} et votre département`
            : "";
        // Le résultat parle de l'équipement choisi (« Les deux » reste sur la pompe à chaleur).
        const equipement =
          formData.projectType === "Panneaux solaires" ? "votre chauffe-eau solaire" : "votre pompe à chaleur";
        const smallPrint =
          "Estimation indicative selon vos réponses, sous réserve d'éligibilité. Le montant exact dépend de votre avis d'imposition et de votre logement : votre conseiller le confirmera avec vous.";
        const box = (tone: string, title: string, body: React.ReactNode, note?: React.ReactNode) => (
          <div className={`relative rounded-2xl p-6 mb-6 border text-left overflow-hidden ${tone}`}>
            <p className="font-bold text-lg text-gray-900 mb-2">{title}</p>
            <div className="text-gray-700 text-sm leading-relaxed space-y-2">{body}</div>
            {note && <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">{note}</p>}
          </div>
        );
        let content: React.ReactNode;
        switch (result.kind) {
          case "zero":
            content = box(
              "bg-green-50 border-green-200",
              `Bonne nouvelle${prenom ? `, ${prenom}` : ""} ! 🎉`,
              <>
                <p>
                  Avec votre {profil}, les aides de l'État (MaPrimeRénov' et
                  prime CEE) peuvent financer {equipement}{" "}
                  <b>jusqu'à 100 %</b>.
                </p>
                <p className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                  <CheckCircle2 size={14} /> 0 € de reste à charge estimé
                </p>
              </>,
              smallPrint,
            );
            break;
          case "rac":
            content = box(
              "bg-blue-50 border-blue-100",
              `Bonne nouvelle${prenom ? `, ${prenom}` : ""} : vous avez droit aux aides ! 👍`,
              <>
                <p>
                  Avec votre {profil}, vous pouvez bénéficier de MaPrimeRénov'
                  et de la prime CEE pour {equipement}. Un reste à
                  charge est à prévoir.
                </p>
                <p>
                  Le plus simple : votre conseiller vous rappelle pour tout
                  vous expliquer et trouver la meilleure solution avec votre
                  avis d'imposition.
                </p>
              </>,
              <>
                À titre indicatif, environ {result.amount.toLocaleString("fr-FR")} €.{" "}
                {smallPrint}
              </>,
            );
            break;
          case "rose":
            content = box(
              "bg-blue-50 border-blue-100",
              `Merci${prenom ? ` ${prenom}` : ""}, votre demande est bien reçue`,
              <>
                <p>
                  Avec vos revenus, MaPrimeRénov' ne s'applique pas, mais vous
                  pouvez bénéficier de la prime CEE pour {equipement}.
                  Un reste à charge est à prévoir.
                </p>
                <p>
                  Votre conseiller vous rappelle pour chiffrer votre projet
                  avec vous.
                </p>
              </>,
              smallPrint,
            );
            break;
          case "h3":
            content = box(
              "bg-gray-50 border-gray-200",
              `Merci${prenom ? ` ${prenom}` : ""} pour votre demande`,
              <p>
                Nous n'intervenons pas encore dans votre zone. Nous avons bien
                noté votre demande et reviendrons vers vous si cela évolue.
              </p>,
            );
            break;
          case "locataire":
            content = box(
              "bg-gray-50 border-gray-200",
              `Merci${prenom ? ` ${prenom}` : ""} pour votre demande`,
              <p>
                Les aides pour {equipement} sont réservées au propriétaire du
                logement. Parlez-en à votre propriétaire : nous pouvons
                l'accompagner dans toutes les démarches. Un conseiller peut vous
                rappeler pour vous expliquer comment faire.
              </p>,
            );
            break;
          case "etude":
            content = box(
              "bg-blue-50 border-blue-100",
              `Merci${prenom ? ` ${prenom}` : ""}, votre demande est bien reçue`,
              <>
                <p>
                  Votre projet demande une petite étude : les aides concernent
                  surtout le remplacement d'une chaudière fioul ou gaz dans une
                  maison.
                </p>
                <p>
                  Votre conseiller vous rappelle pour vérifier avec vous ce à
                  quoi vous avez droit.
                </p>
              </>,
            );
            break;
        }
        return (
          <div className="relative py-2 animate-in zoom-in-95 fade-in duration-500">
            {(result.kind === "zero" || result.kind === "rac") && <Confetti />}
            <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30" style={{ animation: "ip5-pop .5s ease-out both" }}>
              <Check size={28} strokeWidth={3} />
            </div>
            <p className="text-center text-sm font-bold text-[#173a5e] mb-5">
              Demande envoyée
            </p>
            {content}
            <Button variant="outline" className="w-full" onClick={restart}>
              Faire une nouvelle simulation
            </Button>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const showProgress = step <= TOTAL_QUESTIONS + 1 && !isCalculating;
  const inQuestions = step <= TOTAL_QUESTIONS && !isCalculating;
  // Nombre d'étapes franchies (la saisie des coordonnées compte comme la question en cours).
  const done = isCalculating || step > TOTAL_QUESTIONS ? TOTAL_QUESTIONS : step - 1;
  const headerLabel = isCalculating
    ? "Analyse en cours"
    : step <= TOTAL_QUESTIONS
      ? earlyContact
        ? "Vos coordonnées"
        : step <= 2
          ? "C'est parti !"
          : step <= 5
            ? "Ça avance bien"
            : step < TOTAL_QUESTIONS
              ? "Presque fini"
              : "Dernière question"
      : step === TOTAL_QUESTIONS + 1
        ? "Votre estimation"
        : "Votre résultat";
  // Barre continue, sans nombre de questions : elle démarre déjà un peu
  // remplie et avance plus vite au début (on a l'impression d'être lancé,
  // donc on va plus souvent au bout).
  const ratio = Math.min((done + (earlyContact ? 0.5 : 0)) / TOTAL_QUESTIONS, 1);
  const progressPct = Math.round(12 + 88 * (1 - Math.pow(1 - ratio, 1.6)));
  const stepAnim = goingBack ? "slide-in-from-left-4" : "slide-in-from-right-4";

  return (
    <div
      className={`rounded-[1.75rem] max-w-md w-full mx-auto relative overflow-hidden ${
        glass
          ? "ip5-glass bg-gradient-to-b from-white/[0.14] to-[#0b1a2c]/40 backdrop-blur-2xl border border-white/20 text-white shadow-[0_30px_90px_-30px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.25)]"
          : "bg-white border border-slate-200/80 shadow-[0_28px_80px_-24px_rgba(11,26,44,0.55),0_10px_40px_-18px_rgba(251,191,36,0.35)]"
      }`}
    >
      {glass && <style>{GLASS_CSS}</style>}
      <style>{`
        .ip5-range { -webkit-appearance: none; appearance: none; height: 10px; border-radius: 999px; outline: none; cursor: pointer; }
        .ip5-range::-webkit-slider-thumb { -webkit-appearance: none; width: 30px; height: 30px; border-radius: 999px; background: #fff; border: 3px solid #2b5a8f; box-shadow: 0 4px 14px rgba(23,58,94,.35); transition: transform .15s; }
        .ip5-range::-webkit-slider-thumb:active { transform: scale(1.15); }
        .ip5-range::-moz-range-thumb { width: 26px; height: 26px; border-radius: 999px; background: #fff; border: 3px solid #2b5a8f; box-shadow: 0 4px 14px rgba(23,58,94,.35); }
        @keyframes ip5-shine { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }
      `}</style>

      {/* En-tête du simulateur : titre, étape et barre de progression en segments. */}
      <div className={`relative overflow-hidden px-5 pt-4 pb-4 text-white ${glass ? "bg-white/[0.06] border-b border-white/10" : "bg-gradient-to-br from-[#173a5e] via-[#1d4e89] to-[#2b5a8f]"}`}>
        <div className="absolute -bottom-12 -left-6 w-28 h-28 rounded-full bg-amber-300/15 blur-2xl" aria-hidden="true"></div>
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" aria-hidden="true"></div>
        <div className="relative flex items-center justify-between gap-3">
          {(step > 1 || earlyContact) && inQuestions ? (
            <button
              onClick={prevStep}
              className="flex items-center gap-1 text-[13px] font-semibold text-white/80 hover:text-white transition-colors -ml-1 px-1 py-0.5 rounded-lg"
            >
              <ArrowLeft size={16} /> Retour
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold whitespace-nowrap">
              <Sparkles size={16} className="text-amber-300" /> <span className="text-[14px]">Simulateur d'aides 2026</span>
            </span>
          )}
          <span className="text-[12px] font-semibold text-white/85 bg-white/10 border border-white/15 rounded-full px-2.5 py-0.5 whitespace-nowrap">
            {headerLabel}
          </span>
        </div>
        <div
          className="relative mt-3.5 h-2 rounded-full bg-white/20 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
          aria-label="Progression de la simulation"
        >
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-white transition-[width] duration-500 ease-out overflow-hidden shadow-[0_0_12px_rgba(252,211,77,0.75)]"
            style={{ width: `${progressPct}%` }}
          >
            {inQuestions && (
              <span className="ip5-anim absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/90 to-transparent" style={{ animation: "ip5-shine 1.6s ease-in-out infinite" }}></span>
            )}
          </div>
        </div>
        {step === 1 && inQuestions && !earlyContact && (
          <p className="relative mt-3 flex items-center gap-3 text-[11.5px] text-white/80">
            <span className="flex items-center gap-1"><Clock size={12} /> 2 minutes</span>
            <span className="flex items-center gap-1"><CheckCircle2 size={12} /> Gratuit</span>
            <span className="flex items-center gap-1"><ShieldCheck size={12} /> Sans engagement</span>
          </p>
        )}
      </div>

      <div className="p-5 pt-5 md:p-7">
        {!pro && inQuestions && !earlyContact && (
          <p className="text-center text-xs font-bold text-slate-400 -mt-1 mb-3">
            {step <= 2 ? "🚀 C'est parti !" : step <= 5 ? "💪 Vous êtes à mi-chemin" : "🏁 Dernière ligne droite"}
          </p>
        )}

        {reward && showProgress && step <= TOTAL_QUESTIONS && (
          <div
            key={`r-${step}-${earlyContact}`}
            className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 text-[#0f2a47] text-[13px] font-semibold rounded-2xl px-3 py-2.5 mb-4 animate-in fade-in slide-in-from-top-1 duration-200"
            role="status"
          >
            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm" style={{ animation: "ip5-pop .3s ease-out both" }}>
              <Check size={15} strokeWidth={3} />
            </span>
            <span className="leading-snug">{reward}</span>
          </div>
        )}

        <IllustrationStyles />

        {isCalculating ? (
          <div className="flex flex-col items-center justify-center py-2">
            <div className="w-full">
              <CalculatingScene />
            </div>
            <p className="text-[#0f2a47] font-extrabold text-lg text-center mt-1 mb-3">
              Calcul de vos droits en cours…
            </p>
            <style>{`@keyframes ip5-calc { from { width: 4% } to { width: 100% } }`}</style>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-4" aria-hidden="true">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400" style={{ animation: "ip5-calc 1.4s ease-out both" }}></div>
            </div>
            <ul className="w-full space-y-2 mb-3">
              {[
                `Barème MaPrimeRénov' 2026 · ${formData.department.split(" ")[0] || "votre département"}`,
                `Foyer de ${formData.householdSize} personne(s)`,
                "Primes CEE des fournisseurs d'énergie",
              ].map((line, i) => (
                <li
                  key={line}
                  className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-[13px] font-semibold text-slate-700 animate-in fade-in slide-in-from-left-4 fill-mode-both"
                  style={{ animationDelay: `${150 + i * 350}ms`, animationDuration: "300ms" }}
                >
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-white flex items-center justify-center flex-shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div key={`s-${step}-${earlyContact}`} className={`animate-in fade-in ${stepAnim} duration-200`}>
            {step !== TOTAL_QUESTIONS + 1 && !earlyContact && (
              <div className="[&>div]:h-28 [&>div]:mb-4 md:[&>div]:h-32">
                <StepIllustration step={step} surface={formData.surface} />
              </div>
            )}
            {renderStep()}
          </div>
        )}

        {inQuestions && (
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-4 text-[11px] font-semibold text-slate-400">
            <span className="flex items-center gap-1"><Lock size={12} /> Données protégées</span>
            <span className="flex items-center gap-1"><BadgeCheck size={12} /> Conseiller RGE</span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- MISE EN PAGE PARTAGÉE ---

// Enveloppe commune à toutes les pages IP5 Énergie : en-tête, pied de page,
// assistant IA et bouton WhatsApp, plus le titre d'onglet. Chaque page se
// contente de fournir son contenu.
// Masque les boutons flottants tant que l'élément `anchorId` est à l'écran :
// sur mobile, ils recouvraient les boutons du bloc de choix de la landing.
function useHiddenWhileVisible(anchorId?: string) {
  const [hidden, setHidden] = useState(Boolean(anchorId));
  useEffect(() => {
    if (!anchorId) return;
    const el = document.getElementById(anchorId);
    if (!el || typeof IntersectionObserver === "undefined") {
      setHidden(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [anchorId]);
  return hidden;
}

export const PageLayout = ({
  title,
  children,
  hideFloatingWhileVisible,
}: {
  title: string;
  children: React.ReactNode;
  hideFloatingWhileVisible?: string;
}) => {
  useFrenchPageMeta(title);
  const hideFloating = useHiddenWhileVisible(hideFloatingWhileVisible);
  return (
    <div dir="ltr" className="font-sans text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-950 min-h-screen">
      <SiteHeader />
      {children}
      <SiteFooter />
      <div className={hideFloating ? "hidden" : undefined}>
        <AIChatWidget />
        <WhatsAppButton />
      </div>
    </div>
  );
};

// En-tête compact des pages intérieures (pompe à chaleur, aides,
// réalisations, contact) : un bandeau bleu avec titre et sous-titre.
export const PageHero = ({
  kicker,
  kickerIcon,
  title,
  highlight,
  subtitle,
  image,
  imageAlt = "",
  imagePosition = "50% 50%",
}: {
  kicker: string;
  kickerIcon: React.ElementType;
  title: string;
  highlight?: string;
  subtitle: string;
  // Photo affichée à droite sur ordinateur (le téléphone garde le bandeau seul).
  image?: string;
  imageAlt?: string;
  imagePosition?: string;
}) => (
  <section className="relative pt-28 pb-12 lg:pt-36 lg:pb-20 bg-gradient-to-br from-[#0b1a2c] via-[#0f2b4a] to-[#173a5e] text-white overflow-hidden">
    <div className={`${image ? "max-w-7xl lg:grid lg:grid-cols-12 lg:gap-14 lg:items-center" : "max-w-4xl"} mx-auto px-4 sm:px-6 lg:px-8 relative z-10`}>
      <div className={image ? "lg:col-span-7 text-center lg:text-left" : "text-center"}>
        <Kicker icon={kickerIcon} onDark>
          {kicker}
        </Kicker>
        <h1 className={`text-3xl md:text-5xl ${image ? "lg:text-[3.4rem]" : ""} font-extrabold mb-5 leading-tight tracking-tight`}>
          {title}
          {highlight && (
            <>
              {" "}
              <span className="text-amber-200">{highlight}</span>
            </>
          )}
        </h1>
        <p className={`text-lg md:text-xl text-blue-100 max-w-2xl leading-relaxed ${image ? "mx-auto lg:mx-0" : "mx-auto"}`}>
          {subtitle}
        </p>
        {image && (
          <div className="hidden lg:flex mt-8 gap-3">
            <a
              href="/#simulateur"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-300 text-[#0b1a2c] px-6 py-3.5 font-bold shadow-lg hover:bg-amber-200 transition-colors"
            >
              Estimer mes aides gratuitement <ArrowRight size={18} />
            </a>
            <a
              href="tel:+33749525267"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 font-semibold hover:bg-white/20 transition-colors"
            >
              07 49 52 52 67
            </a>
          </div>
        )}
      </div>
      {image && (
        <div className="mt-8 lg:mt-0 lg:col-span-5">
          <div className="relative">
            <img
              src={image}
              alt={imageAlt}
              className="relative w-full h-56 sm:h-72 lg:h-[380px] object-cover rounded-[1.75rem] ring-1 ring-white/20 shadow-2xl"
              style={{ objectPosition: imagePosition }}
            />
            <span className="absolute -bottom-4 left-6 inline-flex items-center gap-2 rounded-2xl bg-white text-[#173a5e] px-4 py-2.5 text-sm font-bold shadow-xl">
              <ShieldCheck size={18} className="text-[#2b5a8f]" /> Installateur certifié RGE QualiPAC
            </span>
          </div>
        </div>
      )}
    </div>
  </section>
);

// Bande de confiance (4 gages), utilisée sur l'accueil.
export const TrustBar = () => (
  <div className="bg-white dark:bg-slate-900 border-y border-gray-100 dark:border-slate-800">
    <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-6 md:py-8 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5 md:gap-6">
      {[
        { icon: BadgeCheck, title: "Certifié RGE", sub: "QualiPAC" },
        { icon: FileCheck2, title: "Démarches gérées", sub: "de A à Z" },
        { icon: HandCoins, title: "Aides déduites", sub: "du devis final" },
        { icon: Users, title: "Entreprise familiale", sub: "un seul interlocuteur" },
      ].map((item) => (
        <div key={item.title} className="flex items-center gap-3 justify-start sm:justify-center lg:justify-start">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-[#173a5e] dark:text-blue-300 flex items-center justify-center flex-shrink-0">
            <item.icon size={22} />
          </div>
          <div className="leading-tight">
            <p className="font-bold text-gray-900 dark:text-white text-sm">{item.title}</p>
            <p className="text-gray-500 dark:text-slate-400 text-xs">{item.sub}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Section « avantages » : pourquoi choisir la pompe à chaleur (3 cartes).
export const AvantagesSection = () => (
  <section id="avantages" className="py-14 md:py-24 bg-[#0b1a2c] text-white">
    <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
      <SectionHead
        onDark
        kicker="Pourquoi la pompe à chaleur"
        title="Le chauffage le plus économique"
        subtitle="Elle puise la chaleur de l'air extérieur, même en hiver, pour chauffer toute la maison."
      />
      <dl className="grid md:grid-cols-3 md:divide-x divide-white/10 border-y border-white/10 md:border-y-0">
        {[
          { stat: "−70 %", title: "sur la facture de chauffage", text: "Comparé à une vieille chaudière fioul, selon votre logement." },
          { stat: "×4", title: "de chaleur pour 1 kWh consommé", text: "1 kWh d'électricité donne jusqu'à 4 kWh de chaleur (COP)." },
          { stat: "DPE", title: "un logement mieux classé", text: "Une meilleure étiquette énergie, une maison qui prend de la valeur." },
        ].map((a, i) => (
          <div
            key={a.stat}
            className={`flex md:flex-col items-center md:items-start gap-5 md:gap-3 py-6 md:py-2 md:px-10 md:first:pl-0 ${i > 0 ? "border-t border-white/10 md:border-t-0" : ""}`}
          >
            <dt className="text-[38px] md:text-6xl font-extrabold tracking-tight text-amber-200 leading-none w-[112px] md:w-auto flex-shrink-0 whitespace-nowrap">
              {a.stat}
            </dt>
            <dd>
              <p className="font-bold text-white text-lg leading-snug">{a.title}</p>
              <p className="text-blue-100/70 text-sm leading-relaxed mt-1">{a.text}</p>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  </section>
);

// Les vidéos pédagogiques de la page d'accueil. Faciles à remplacer : il
// suffit de changer l'identifiant YouTube (`id`) — la partie après « v= »
// dans l'URL de la vidéo.
const VIDEOS = [
  {
    id: "dZHY7DnotGA",
    title: "Comment fonctionne une pompe à chaleur ?",
    caption:
      "En quelques minutes : comment une pompe à chaleur capte les calories de l'air pour chauffer toute la maison, pour bien moins cher qu'une chaudière.",
  },
  {
    id: "ESQASfDrNDc",
    title: "Les aides de l'État : MaPrimeRénov' & CEE",
    caption:
      "MaPrimeRénov' et les Certificats d'Économie d'Énergie (financés par les fournisseurs d'énergie) peuvent couvrir une grande partie de votre installation.",
  },
  {
    // Format court (YouTube Shorts) : vignette 16:9 « maxresdefault ».
    id: "ozeySFh5Bnw",
    thumb: "maxresdefault",
    title: "La PAC air-eau en moins d'une minute",
    caption:
      "Le principe de la pompe à chaleur air-eau, expliqué très simplement en format court.",
  },
];

// Lecteur vidéo « respect de la vie privée » : on n'affiche qu'une vignette
// tant que le visiteur n'a pas cliqué. La vidéo YouTube (sans cookie) ne se
// charge qu'au clic, ce qui évite tout traceur avant consentement (RGPD).
const VideoCard = ({
  id,
  title,
  caption,
  thumb = "hqdefault",
}: {
  id: string;
  title: string;
  caption: string;
  thumb?: string;
}) => {
  const [play, setPlay] = useState(false);
  return (
    <figure className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:shadow-lg transition-shadow duration-300 overflow-hidden flex flex-col">
      <div className="relative aspect-video bg-gray-900">
        {play ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlay(true)}
            aria-label={`Lire la vidéo : ${title}`}
            className="absolute inset-0 w-full h-full"
          >
            <img
              src={`https://i.ytimg.com/vi/${id}/${thumb}.jpg`}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <span className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-16 h-16 rounded-full bg-white/95 text-[#173a5e] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                <Play size={26} className="ml-1" fill="currentColor" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="p-6 flex flex-col flex-1">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-slate-300 text-sm leading-relaxed">
          {caption}
        </p>
      </figcaption>
    </figure>
  );
};

// Section « Comprendre en vidéo » : explique la pompe à chaleur et les aides
// aux visiteurs qui découvrent le sujet.
export const VideoSection = () => (
  <section id="videos" className="py-14 md:py-24 bg-white dark:bg-slate-950">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHead
        kicker="Comprendre en vidéo"
        title="Tout devient clair en 3 vidéos"
        subtitle="La pompe à chaleur et les aides de l'État, expliquées simplement."
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
        {VIDEOS.map((v) => (
          <VideoCard key={v.id} {...v} />
        ))}
      </div>
    </div>
  </section>
);

// Section « nos pompes à chaleur » : les 6 modèles installés.
export const MarquesSection = () => {
  const featured = PAC_MODELS.filter((m) => m.featured);
  const others = PAC_MODELS.filter((m) => !m.featured);
  return (
    <section id="marques" className="py-14 md:py-24 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHead
          kicker="Nos pompes à chaleur"
          title={`Les ${PAC_MODELS.length} marques que nous installons`}
          subtitle="Les meilleures pompes à chaleur air/eau du marché. Le modèle est choisi avec vous, selon votre logement et votre budget."
        />

        {/* Marques partenaires : grandes cartes */}
        <div className="grid md:grid-cols-2 gap-5 md:gap-8">
          {featured.map((m) => (
            <div
              key={m.brand}
              className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col"
            >
              <div className="relative h-56 md:h-64 bg-slate-50 dark:bg-slate-800 overflow-hidden">
                <img
                  src={`/images/marques/produits/${m.photo}`}
                  alt={`Pompe à chaleur ${m.brand} ${m.model}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-amber-200 text-[#0b1a2c] text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow">
                  <Star size={12} className="fill-current" /> Marque partenaire
                </span>
              </div>
              <div className="p-6 md:p-8 flex flex-col flex-1">
                <div className="inline-flex items-center self-start h-12 mb-4 dark:bg-white dark:rounded-lg dark:px-3">
                  <img
                    src={`/images/marques/${m.logo}`}
                    alt={`Logo ${m.brand}`}
                    className="max-h-10 max-w-[180px] object-contain"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-xl font-bold text-[#0f2a47] dark:text-white">
                  {m.brand} <span className="text-[#2b5a8f] dark:text-blue-400">{m.model}</span>
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed mt-2 mb-5 flex-1">{m.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {m.specs.map((s) => (
                    <span
                      key={s}
                      className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2.5 py-1 rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Autres marques : cartes compactes */}
        <p className="mt-12 mb-5 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
          Et aussi
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-5">
          {others.map((m) => (
            <div
              key={m.brand}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col"
            >
              <div className="h-28 md:h-32 bg-slate-50 dark:bg-slate-800 overflow-hidden">
                <img
                  src={`/images/marques/produits/${m.photo}`}
                  alt={`Pompe à chaleur ${m.brand} ${m.model}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="inline-flex items-center self-start h-8 mb-2 dark:bg-white dark:rounded-md dark:px-2">
                  <img
                    src={`/images/marques/${m.logo}`}
                    alt={`Logo ${m.brand}`}
                    className="max-h-6 max-w-[110px] object-contain"
                    loading="lazy"
                  />
                </div>
                <h3 className="text-sm font-bold text-[#0f2a47] dark:text-white">
                  {m.brand} <span className="text-[#2b5a8f] dark:text-blue-400 font-semibold">{m.model}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-gray-400 dark:text-slate-500 mt-10 max-w-2xl mx-auto">
          Toutes nos pompes à chaleur sont installées par des techniciens
          certifiés RGE QualiPAC et éligibles aux aides MaPrimeRénov' et CEE,
          selon votre situation.
        </p>
      </div>
    </section>
  );
};

// Section « aides de l'État » : MaPrimeRénov', CEE, projet clé en main.
// `asHero` : quand la section est en tête de la page /aides, on ajoute
// l'espace nécessaire pour passer sous le menu fixe (évite le doublon de
// bandeau bleu qui donnait un effet « coupé en deux »).
export const AidesSection = ({ asHero = false, equipment = "votre pompe à chaleur", image }: { asHero?: boolean; equipment?: string; image?: string }) => {
  const Title = asHero ? "h1" : "h2";
  return (
    <section
      id="subventions"
      className={`${
        asHero ? "pt-28 pb-14 lg:pt-40 lg:pb-24" : "py-14 md:py-24"
      } relative overflow-hidden bg-gradient-to-br from-[#0b1a2c] via-[#0f2b4a] to-[#173a5e] text-white`}
    >
      {image && (
        <div className="absolute inset-0" aria-hidden="true">
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover object-[60%_40%]" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r from-[#0b1a2c]/90 via-[#0b1a2c]/70 to-[#0b1a2c]/35"></div>
        </div>
      )}
      <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <Kicker onDark>Aides de l'État {new Date().getFullYear()}</Kicker>
            <Title className="text-[30px] md:text-5xl font-extrabold mb-5 leading-[1.1] tracking-tight">
              Votre projet financé jusqu'à <span className="text-amber-200">100&nbsp;%</span>
            </Title>
            <p className="text-blue-100/80 text-base md:text-lg mb-7 leading-relaxed">
              Avec <b className="text-white">MaPrimeRénov'</b> et les{" "}
              <b className="text-white">primes CEE</b>, une grande partie du coût de
              l'équipement est prise en charge. Nous nous occupons de tout.
            </p>
            <ul className="space-y-3.5 mb-8">
              {[
                "Nous calculons vos droits dès le premier appel.",
                "Nous montons tous les dossiers à votre place.",
                "L'aide est déduite directement de votre devis.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-base md:text-lg font-medium">
                  <CheckCircle2 className="text-amber-200 mt-0.5 flex-shrink-0" size={22} />
                  {t}
                </li>
              ))}
            </ul>
            <div className="inline-flex items-center gap-5 bg-white rounded-2xl px-5 py-3.5">
              <img src="/images/aides/maprimerenov.png" alt="MaPrimeRénov'" className="h-9 w-auto" loading="lazy" />
              <span className="w-px h-9 bg-slate-200" />
              <img src="/images/aides/cee.png" alt="CEE — Certificats d'économies d'énergie" className="h-11 w-auto" loading="lazy" />
            </div>
            <p className="text-blue-100/50 text-xs mt-3">Montants attribués selon l'éligibilité de chaque foyer. Barèmes 2026, susceptibles d'évoluer.</p>
          </div>

          <div className="bg-white rounded-3xl p-7 md:p-10 text-gray-900 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-7 pb-5 border-b border-slate-100">
              <h3 className="text-xl md:text-2xl font-extrabold tracking-tight text-[#0f2a47]">Votre projet clé en main</h3>
              <span className="rounded-full bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 whitespace-nowrap">Jusqu'à 100&nbsp;%</span>
            </div>
            <ol className="relative space-y-7">
              <span className="absolute left-5 top-6 bottom-6 w-px bg-slate-200" aria-hidden="true"></span>
              {[
                { t: "Simulation en ligne", d: "2 minutes pour évaluer votre profil." },
                { t: "Validation des aides", d: "Un conseiller confirme vos droits selon votre département et vos revenus." },
                { t: "Installation RGE", d: `Un artisan certifié pose ${equipment} dans les règles de l'art.` },
              ].map((step, i) => (
                <li key={step.t} className="relative flex gap-5">
                  <span className="relative z-10 w-10 h-10 rounded-full bg-[#173a5e] text-white flex items-center justify-center font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-lg leading-snug">{step.t}</h4>
                    <p className="text-slate-500 mt-1">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <a
              href="/#simulateur"
              className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-amber-300 hover:bg-amber-200 text-[#0b1a2c] font-bold py-3.5 shadow-lg shadow-amber-500/20 transition-colors"
            >
              Estimer mes aides gratuitement <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

// Section « réalisations » : avant/après et détails de chantier.
export const RealisationsSection = () => (
  <section id="realisations" className="py-14 md:py-24 bg-gray-50 dark:bg-slate-950">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHead
        kicker="Un chantier récent"
        title="Avant, après : le travail en détail"
        subtitle="Remplacement d'une ancienne chaudière par une pompe à chaleur air/eau, réalisé par notre équipe."
      />

      {/* Avant / Après */}
      <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        <figure className="relative rounded-2xl overflow-hidden group">
          <img
            src="/images/realisations/avant-ancienne-chaudiere.jpg"
            alt="Ancienne chaudière avant remplacement"
            className="w-full h-80 object-cover group-hover:scale-105 transition-transform duration-700"
            loading="lazy"
          />
          <span className="absolute top-4 left-4 bg-gray-900/80 text-white text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full">
            Avant
          </span>
          <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-sm font-medium px-5 py-4">
            L'ancienne chaudière, avant intervention
          </figcaption>
        </figure>
        <figure className="relative rounded-2xl overflow-hidden group">
          <img
            src="/images/realisations/interieur-pac-ballon.jpg"
            alt="Pompe à chaleur et ballon d'eau chaude installés"
            className="w-full h-80 object-cover group-hover:scale-105 transition-transform duration-700"
            loading="lazy"
          />
          <span className="absolute top-4 left-4 bg-green-600 text-white text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full">
            Après
          </span>
          <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-sm font-medium px-5 py-4">
            Le module intérieur de la pompe à chaleur et le ballon d'eau chaude
          </figcaption>
        </figure>
      </div>

      {/* Détails du chantier */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          {
            src: "unite-exterieure.jpg",
            alt: "Unité extérieure de la pompe à chaleur installée contre le mur",
            caption: "Unité extérieure, posée sur plot béton",
          },
          {
            src: "detail-module-hydraulique.jpg",
            alt: "Détail du module hydraulique de la pompe à chaleur",
            caption: "Finitions soignées du module intérieur",
          },
          {
            src: "tableau-electrique-etiquete.jpg",
            alt: "Tableau électrique dédié, clairement étiqueté",
            caption: "Tableau électrique dédié, étiqueté pour l'entretien",
          },
          {
            src: "coffret-securite-exterieur.jpg",
            alt: "Coffret de sécurité électrique extérieur aux normes",
            caption: "Coffret de coupure extérieur aux normes",
          },
        ].map((photo) => (
          <figure
            key={photo.src}
            className="group rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900"
          >
            <div className="overflow-hidden">
              <img
                src={`/images/realisations/${photo.src}`}
                alt={photo.alt}
                className="w-full h-36 md:h-48 object-cover group-hover:scale-105 transition-transform duration-700"
                loading="lazy"
              />
            </div>
            <figcaption className="text-[13px] md:text-sm text-slate-600 dark:text-slate-300 px-3.5 py-3 leading-snug">
              {photo.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  </section>
);

// Section « avis clients ».
export const AvisSection = () => (
  <section id="avis" className="py-14 md:py-24 bg-white dark:bg-slate-950">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHead
        kicker="Avis clients"
        title="Ils ont sauté le pas"
        subtitle="Des propriétaires partout en France nous ont fait confiance."
      />

      <div className="grid md:grid-cols-3 gap-5 md:gap-8">
        {REVIEWS.map((review) => (
          <figure
            key={review.name}
            className="relative bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col"
          >
            <div
              className="flex gap-1 mb-4 text-yellow-400"
              aria-label="Note de 5 étoiles sur 5"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={16} fill="currentColor" />
              ))}
            </div>
            <blockquote className="text-gray-700 dark:text-slate-200 leading-relaxed mb-6 flex-1">
              « {review.text} »
            </blockquote>
            <figcaption className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
              <span
                className="w-10 h-10 rounded-full bg-[#173a5e] text-white font-bold text-sm flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                {review.name
                  .split(/[\s&]+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <span>
                <p className="font-bold text-gray-900 dark:text-white">{review.name}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-1">
                  <MapPin size={14} /> {review.location}
                </p>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  </section>
);

// Bandeau d'appel à l'action final, réutilisé en bas de chaque page. Le bouton
// « Simuler » renvoie vers le simulateur de la page d'accueil (/#simulateur),
// il fonctionne donc depuis n'importe quelle page.
export const FinalCTA = ({ href = "/#simulateur" }: { href?: string }) => (
  <section className="py-12 md:py-20 bg-white dark:bg-slate-950">
    <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
      <div className="bg-[#0b1a2c] rounded-3xl px-6 py-10 md:px-14 md:py-14 text-white md:flex md:items-center md:justify-between md:gap-10">
        <div className="text-center md:text-left">
          <h2 className="text-[26px] md:text-4xl font-extrabold tracking-tight leading-tight">
            Prêt à réduire vos factures de chauffage&nbsp;?
          </h2>
          <p className="text-blue-100/75 text-base md:text-lg mt-3 max-w-xl">
            Estimation gratuite en 2 minutes, sans engagement. Un conseiller vous
            rappelle pour valider vos aides.
          </p>
        </div>
        <div className="mt-7 md:mt-0 flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 flex-shrink-0">
          <a
            href={href}
            className="inline-flex items-center justify-center gap-2 bg-amber-300 text-[#0b1a2c] px-6 py-4 rounded-xl font-bold whitespace-nowrap hover:bg-amber-200 transition-colors"
          >
            Estimer mes aides <ArrowRight size={18} />
          </a>
          <a
            href="tel:+33749525267"
            className="inline-flex items-center justify-center gap-2 border border-white/25 text-white px-6 py-4 rounded-xl font-semibold whitespace-nowrap hover:bg-white/10 transition-colors"
          >
            07 49 52 52 67
          </a>
        </div>
      </div>
    </div>
  </section>
);
