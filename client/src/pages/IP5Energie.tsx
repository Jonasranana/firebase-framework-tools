import React, { useEffect, useState } from "react";
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
  Map,
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

// --- COMPONENTS ---

type ButtonVariant = "primary" | "secondary" | "outline" | "success";

const Button = ({
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

// Étiquette décorative affichée au-dessus des titres de section.
const Kicker = ({
  icon: Icon,
  children,
  onDark = false,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  onDark?: boolean;
}) => (
  <span
    className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5 border ${
      onDark
        ? "bg-white/10 text-blue-100 border-white/20"
        : "bg-blue-50 text-[#2b5a8f] border-blue-100"
    }`}
  >
    <Icon size={14} /> {children}
  </span>
);

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

const REVIEWS = [
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

const TOTAL_QUESTIONS = 8;

type SimulatorData = {
  housingType: string;
  ownerStatus: string;
  surface: number;
  currentHeating: string;
  department: string;
  householdSize: string;
  incomeBracket: string;
  projectTiming: string;
  name: string;
  phone: string;
  email: string; // optionnel
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
  name: "",
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
        ? "Parfait ! Les maisons sont idéales pour une pompe à chaleur air/eau."
        : "C'est noté ! Des solutions existent aussi en appartement.";
    case "ownerStatus":
      if (value === "Propriétaire")
        return "Top ! Les propriétaires peuvent cumuler l'ensemble des aides.";
      if (value === "Bientôt propriétaire")
        return "Bien vu d'anticiper : les aides se préparent dès l'achat.";
      return "C'est noté — nous vous expliquerons les options possibles avec votre propriétaire.";
    case "currentHeating":
      if (value === "Fioul")
        return "Bonne nouvelle : remplacer une chaudière fioul est souvent le cas le mieux subventionné !";
      if (value === "Gaz")
        return "Bonne nouvelle : le remplacement du gaz ouvre droit à de belles aides, selon éligibilité.";
      if (value === "Electrique")
        return "Une pompe à chaleur consomme jusqu'à 3 fois moins qu'un chauffage électrique classique.";
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

// Barème MaPrimeRénov' (revenu fiscal de référence, avis d'imposition N-1).
// Plafonds "très modeste" / "modeste" / "intermédiaire" par taille de foyer
// (1 à 5+ personnes) ; au-delà du dernier plafond : profil supérieur (rose).
// Montants indicatifs — le barème officiel est confirmé lors de l'appel.
const MPR_PLAFONDS = {
  idf: [
    [23768, 28933, 40404],
    [34884, 42463, 59394],
    [41893, 51000, 71060],
    [48914, 59549, 83637],
    [55961, 68123, 95758],
  ],
  province: [
    [17173, 22015, 30844],
    [25115, 32197, 45340],
    [30206, 38719, 54592],
    [35285, 45234, 63844],
    [40388, 51775, 73098],
  ],
};

const IDF_PREFIXES = ["75", "77", "78", "91", "92", "93", "94", "95"];

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

// Numéros FR : 0X XX XX XX XX ou +33 X XX XX XX XX, séparateurs tolérés
const FRENCH_PHONE_REGEX = /^(?:\+33|0)\s*[1-9](?:[\s.\-]*\d{2}){4}$/;

// Enregistre le lead dans Firestore (projet Firebase du site, collection
// "ip5_leads"). Le SDK est chargé à la volée depuis le CDN pour ne pas
// alourdir le bundle. Le honeypot est vérifié avant l'appel.
// Les règles Firestore doivent autoriser la création sur ip5_leads :
//   match /ip5_leads/{doc} { allow create: if true; allow read: if false; }
async function submitLead(data: SimulatorData): Promise<void> {
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
  const { company, ...lead } = data;
  await fsMod.addDoc(fsMod.collection(db, "ip5_leads"), {
    ...lead,
    source: "simulateur-landing",
    createdAt: fsMod.serverTimestamp(),
    // Passe à true quand le robot de synchronisation a copié le lead dans
    // Monday (voir scripts/sync-leads-to-monday.mjs).
    mondaySynced: false,
  });
}

const Simulator = () => {
  const [step, setStep] = useState(1);
  const [isCalculating, setIsCalculating] = useState(false);
  const [formData, setFormData] = useState<SimulatorData>(INITIAL_DATA);
  const [reward, setReward] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
    consent?: string;
    submit?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goToResults = () => {
    setReward(null);
    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
      setStep(TOTAL_QUESTIONS + 1);
    }, 1800); // Simule le temps de calcul
  };

  // Avance d'une étape en affichant le message d'encouragement lié à la
  // réponse qui vient d'être donnée.
  const advance = (rewardMsg: string | null) => {
    if (step === TOTAL_QUESTIONS) {
      goToResults();
    } else {
      setReward(rewardMsg);
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1 && !isCalculating) {
      setReward(null);
      setStep(step - 1);
    }
  };

  const choose = (key: keyof SimulatorData, value: string) => {
    setFormData({ ...formData, [key]: value });
    advance(rewardFor(key, value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (formData.name.trim().length < 2) {
      newErrors.name = "Merci d'indiquer votre nom complet.";
    }
    if (!FRENCH_PHONE_REGEX.test(formData.phone.trim())) {
      newErrors.phone = "Merci d'indiquer un numéro de téléphone français valide (ex : 06 12 34 56 78).";
    }
    const email = formData.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      newErrors.email = "Cette adresse e-mail ne semble pas valide (vous pouvez aussi laisser vide).";
    }
    if (!formData.consent) {
      newErrors.consent = "Vous devez accepter d'être recontacté pour recevoir votre devis.";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await submitLead(formData);
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

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              Quel est votre type de logement ?
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => choose("housingType", "Maison")}
                className="flex flex-col items-center p-6 border-2 border-gray-200 rounded-2xl hover:border-[#2b5a8f] hover:bg-blue-50 transition-all"
              >
                <Home size={48} className="text-[#2b5a8f] mb-4" />
                <span className="font-semibold text-gray-700">Maison</span>
              </button>
              <button
                onClick={() => choose("housingType", "Appartement")}
                className="flex flex-col items-center p-6 border-2 border-gray-200 rounded-2xl hover:border-[#2b5a8f] hover:bg-blue-50 transition-all"
              >
                <Building size={48} className="text-[#2b5a8f] mb-4" />
                <span className="font-semibold text-gray-700">Appartement</span>
              </button>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-gray-800 mb-2 text-center">
              Vous êtes… ?
            </h3>
            <p className="text-gray-500 text-sm mb-6 text-center">
              Les aides diffèrent selon votre situation.
            </p>
            <div className="space-y-3">
              {[
                { value: "Propriétaire", hint: "Vous habitez votre logement" },
                { value: "Bientôt propriétaire", hint: "Achat en cours ou prévu" },
                { value: "Locataire", hint: "Votre propriétaire décide des travaux" },
              ].map((o) => (
                <button
                  key={o.value}
                  onClick={() => choose("ownerStatus", o.value)}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#2b5a8f] hover:bg-blue-50 transition-all text-left"
                >
                  <KeyRound size={24} className="text-[#2b5a8f] flex-shrink-0" />
                  <span className="flex-1">
                    <span className="block font-semibold text-gray-800">
                      {o.value}
                    </span>
                    <span className="block text-xs text-gray-500">{o.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Quelle est la surface à chauffer ?
            </h3>
            <div className="mb-8">
              <span className="text-5xl font-bold text-[#2b5a8f]">
                {formData.surface} m²
              </span>
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
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#2b5a8f] mb-8"
            />
            <Button
              onClick={() => advance(`${formData.surface} m², c'est noté !`)}
              className="w-full"
            >
              Continuer <ArrowRight size={18} />
            </Button>
          </div>
        );
      case 4:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              Quel est votre chauffage actuel ?
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => choose("currentHeating", "Fioul")}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-2xl hover:border-[#2b5a8f] hover:bg-blue-50 transition-all"
              >
                <Droplets size={32} className="text-gray-600 mb-2" />
                <span className="font-semibold text-gray-700">Fioul</span>
              </button>
              <button
                onClick={() => choose("currentHeating", "Gaz")}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-2xl hover:border-[#2b5a8f] hover:bg-blue-50 transition-all"
              >
                <Flame size={32} className="text-orange-500 mb-2" />
                <span className="font-semibold text-gray-700">Gaz</span>
              </button>
              <button
                onClick={() => choose("currentHeating", "Electrique")}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-2xl hover:border-[#2b5a8f] hover:bg-blue-50 transition-all"
              >
                <Zap size={32} className="text-yellow-500 mb-2" />
                <span className="font-semibold text-gray-700">Électrique</span>
              </button>
              <button
                onClick={() => choose("currentHeating", "Autre")}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-2xl hover:border-[#2b5a8f] hover:bg-blue-50 transition-all"
              >
                <span className="text-[#2b5a8f] mb-2 text-2xl font-bold">?</span>
                <span className="font-semibold text-gray-700">Autre</span>
              </button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Dans quel département se situe votre projet ?
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Les aides d'État (MaPrimeRénov') varient selon votre région.
            </p>

            <div className="relative mb-8 text-left">
              <MapPin
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <select
                value={formData.department}
                aria-label="Département du projet"
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
                className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:ring-0 focus:border-[#2b5a8f] outline-none appearance-none bg-white font-medium text-gray-700 transition-colors cursor-pointer"
                required
              >
                <option value="" disabled>
                  Sélectionnez votre département...
                </option>
                {DEPARTMENTS.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <ArrowRight size={16} className="text-gray-400 rotate-90" />
              </div>
            </div>

            <Button
              onClick={() => advance(rewardFor("department", formData.department))}
              className="w-full"
              disabled={!formData.department}
            >
              Continuer <ArrowRight size={18} />
            </Button>
          </div>
        );
      case 6:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Combien de personnes composent votre foyer ?
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Ce critère est indispensable pour calculer le montant de vos
              subventions.
            </p>

            <div className="grid grid-cols-5 gap-2 mb-8">
              {["1", "2", "3", "4", "5+"].map((num) => (
                <button
                  key={num}
                  onClick={() => choose("householdSize", num)}
                  className="flex flex-col items-center justify-center py-4 border-2 border-gray-200 rounded-xl hover:border-[#2b5a8f] hover:bg-blue-50 transition-all font-bold text-gray-700 text-xl"
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        );
      case 7: {
        const brackets = getIncomeBrackets(
          formData.department,
          formData.householdSize,
        );
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Quel est le revenu fiscal de votre foyer ?
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Il figure sur votre <b>avis d'imposition de l'année dernière</b>{" "}
              (« revenu fiscal de référence »). C'est lui qui détermine votre
              profil MaPrimeRénov'.
            </p>

            <div className="space-y-3 mb-2">
              {brackets.map((b) => (
                <button
                  key={b.value}
                  onClick={() => choose("incomeBracket", b.value)}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#2b5a8f] hover:bg-blue-50 transition-all text-left"
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${b.dot}`}
                    aria-hidden="true"
                  ></span>
                  <span className="flex-1">
                    <span className="block font-semibold text-gray-800">
                      {b.range}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {b.label} — profil {b.profile}
                    </span>
                  </span>
                </button>
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
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-gray-800 mb-2 text-center">
              Dernière question : c'est pour quand ?
            </h3>
            <p className="text-gray-500 text-sm mb-6 text-center">
              Votre estimation est prête juste après 🎁
            </p>
            <div className="space-y-3">
              {[
                { value: "Dès que possible", hint: "Je veux avancer rapidement", icon: Zap },
                { value: "Dans les 6 mois", hint: "Je prépare mon projet", icon: CalendarClock },
                { value: "Je me renseigne", hint: "Je compare et je réfléchis", icon: Search },
              ].map((o) => (
                <button
                  key={o.value}
                  onClick={() => choose("projectTiming", o.value)}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#2b5a8f] hover:bg-blue-50 transition-all text-left"
                >
                  <o.icon size={24} className="text-[#2b5a8f] flex-shrink-0" />
                  <span className="flex-1">
                    <span className="block font-semibold text-gray-800">
                      {o.value}
                    </span>
                    <span className="block text-xs text-gray-500">{o.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      case 9: {
        const savings = savingsEstimate();
        const isRose = formData.incomeBracket.includes("rose");

        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-green-50 rounded-2xl p-6 mb-6 text-center border border-green-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <PiggyBank size={80} />
              </div>
              <p className="text-green-800 font-semibold mb-2 flex items-center justify-center gap-2">
                <PartyPopper size={18} /> Excellente nouvelle !
              </p>
              <p className="text-gray-700 text-sm mb-2">
                Vous pourriez économiser jusqu'à
              </p>
              <p className="text-4xl font-extrabold text-green-600 mb-3">
                <AnimatedEuros value={savings} />
              </p>
              <div className="inline-flex items-center justify-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                <CheckCircle2 size={14} />{" "}
                {isRose
                  ? "Éligible aux primes CEE"
                  : "Éligible MaPrimeRénov' & CEE"}
              </div>
              <p className="text-[11px] text-gray-500 mt-3">
                Estimation indicative, non contractuelle, basée sur vos
                réponses. Le montant exact dépend de votre logement et de vos
                revenus.
              </p>
            </div>

            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">
              Recevez votre devis exact gratuit
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="lead-name" className="sr-only">
                  Nom complet
                </label>
                <input
                  id="lead-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Votre nom complet"
                  value={formData.name}
                  aria-invalid={!!errors.name}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#2b5a8f] focus:border-transparent outline-none bg-gray-50 ${errors.name ? "border-red-400" : "border-gray-300"}`}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
                {errors.name && (
                  <p className="text-red-600 text-xs mt-1">{errors.name}</p>
                )}
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
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#2b5a8f] focus:border-transparent outline-none bg-gray-50 ${errors.phone ? "border-red-400" : "border-gray-300"}`}
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
                  Adresse e-mail (facultatif)
                </label>
                <input
                  id="lead-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="Votre e-mail (facultatif, pour le devis écrit)"
                  value={formData.email}
                  aria-invalid={!!errors.email}
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#2b5a8f] focus:border-transparent outline-none bg-gray-50 ${errors.email ? "border-red-400" : "border-gray-300"}`}
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

              <div>
                <label className="flex items-start gap-3 text-left cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.consent}
                    aria-invalid={!!errors.consent}
                    onChange={(e) =>
                      setFormData({ ...formData, consent: e.target.checked })
                    }
                    className="mt-1 w-4 h-4 accent-[#2b5a8f] flex-shrink-0"
                  />
                  <span className="text-xs text-gray-600 leading-relaxed">
                    J'accepte d'être recontacté(e) par IP5 Énergie au sujet de
                    ma demande de devis. Mes données ne sont jamais revendues
                    et je peux exercer mes droits (accès, rectification,
                    suppression) à tout moment.
                  </span>
                </label>
                {errors.consent && (
                  <p className="text-red-600 text-xs mt-1">{errors.consent}</p>
                )}
              </div>

              {errors.submit && (
                <p className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {errors.submit}
                </p>
              )}
              <Button
                type="submit"
                variant="success"
                disabled={isSubmitting}
                className="w-full text-lg shadow-green-500/50 py-4"
              >
                {isSubmitting ? "Envoi en cours..." : "Voir mes résultats complets"}
              </Button>
            </form>
          </div>
        );
      }
      case 10:
        return (
          <div className="text-center py-8 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Demande envoyée avec succès !
            </h3>
            <p className="text-gray-600 mb-6">
              Un expert technique <b>IP5 Énergie</b> a reçu vos informations.
              Nous vous appelons d'ici quelques minutes pour valider vos aides
              de l'État.
            </p>
            <Button variant="outline" className="w-full" onClick={restart}>
              Faire une nouvelle simulation
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const progressPercentage = Math.min((step / (TOTAL_QUESTIONS + 1)) * 100, 100);
  const showProgress = step <= TOTAL_QUESTIONS + 1 && !isCalculating;
  // Petit jalon d'encouragement affiché à côté du numéro d'étape.
  const milestone =
    step <= 2 ? "🚀 C'est parti" : step <= 5 ? "💪 À mi-chemin" : "🏁 Dernière ligne droite";

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 max-w-md w-full mx-auto relative overflow-hidden border border-gray-100">
      {showProgress && (
        <div
          className="absolute top-0 left-0 w-full h-2 bg-gray-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPercentage)}
          aria-label="Progression de la simulation"
        >
          <div
            className="h-full bg-gradient-to-r from-[#2b5a8f] to-cyan-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      )}

      {showProgress && (
        <div className="flex items-center justify-between mb-6 pt-2">
          {step > 1 ? (
            <button
              onClick={prevStep}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-[#2b5a8f] font-medium transition-colors"
            >
              <ArrowLeft size={16} /> Retour
            </button>
          ) : (
            <span />
          )}
          <p className="text-sm text-gray-400 font-medium">
            {step <= TOTAL_QUESTIONS ? (
              <>
                <span className="mr-2">{milestone}</span>
                {step} / {TOTAL_QUESTIONS}
              </>
            ) : (
              "Votre résultat"
            )}
          </p>
        </div>
      )}

      {step === 1 && !isCalculating && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 -mt-3 mb-4">
          <Clock size={13} /> 30 secondes, sans engagement
        </p>
      )}

      {reward && showProgress && step <= TOTAL_QUESTIONS && (
        <div
          key={step}
          className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 text-sm font-medium rounded-xl px-4 py-3 mb-5 animate-in fade-in slide-in-from-top-2 duration-500"
          role="status"
        >
          <CheckCircle2 size={17} className="flex-shrink-0 mt-0.5 text-green-600" />
          <span>{reward}</span>
        </div>
      )}

      <IllustrationStyles />

      {isCalculating ? (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="w-full">
            <CalculatingScene />
          </div>
          <div className="flex gap-2 my-4" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-3 h-3 rounded-full bg-[#2b5a8f]"
                style={{
                  animation: `ip5-bounce-dot 1s ease-in-out ${i * 0.12}s infinite`,
                }}
              ></span>
            ))}
          </div>
          <p className="text-gray-800 font-bold text-lg text-center mb-2">
            Calcul de vos droits en cours...
          </p>
          <p className="text-gray-500 text-sm text-center">
            Secteur : {formData.department} • Foyer de {formData.householdSize}{" "}
            pers.
          </p>
        </div>
      ) : (
        <>
          {step !== TOTAL_QUESTIONS + 1 && (
            <div
              key={`illu-${step}`}
              className="animate-in fade-in zoom-in-95 duration-500"
            >
              <StepIllustration step={step} surface={formData.surface} />
            </div>
          )}
          {renderStep()}
          {step > 1 && step <= TOTAL_QUESTIONS && (
            <button
              onClick={prevStep}
              className="mt-6 flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#2b5a8f] font-medium transition-colors"
            >
              <ArrowLeft size={15} /> Je me suis trompé, revenir en arrière
            </button>
          )}
        </>
      )}
    </div>
  );
};

const IP5Energie = () => {
  useFrenchPageMeta("IP5 Énergie — Pompes à chaleur, jusqu'à 80% d'aides");

  return (
    <div dir="ltr" className="font-sans text-gray-900 bg-gray-50 min-h-screen">
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-white">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[30rem] h-[30rem] rounded-full bg-blue-50 blur-3xl opacity-70"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-green-50 blur-3xl opacity-70"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-6 mb-12 lg:mb-0 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-[#2b5a8f] font-bold text-sm mb-6 border border-blue-100 shadow-sm">
                <ShieldCheck size={16} /> Installateur Agréé RGE France
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6 text-gray-900">
                Passez à la pompe à chaleur et coupez vos factures par{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2b5a8f] to-cyan-500">
                  trois
                </span>
                .
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Remplacez votre ancien chauffage. Profitez d'une chaleur douce
                en hiver, et bénéficiez des subventions <b>MaPrimeRénov'</b>{" "}
                pour financer jusqu'à 80% de votre installation.
              </p>

              <div className="flex justify-center lg:justify-start">
                <a
                  href="#simulateur"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById("simulateur")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#2b5a8f] to-cyan-500 text-white px-9 py-4 rounded-full font-bold text-lg shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-[1.03] transition-all duration-300"
                >
                  <Zap size={22} fill="currentColor" /> Je calcule mes
                  économies
                </a>
              </div>
              <p className="mt-5 flex items-center gap-x-5 gap-y-1 flex-wrap justify-center lg:justify-start text-sm text-gray-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-green-500" size={16} /> Gratuit
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-green-500" size={16} /> 30
                  secondes
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-green-500" size={16} /> Sans
                  engagement
                </span>
              </p>
            </div>

            <div id="simulateur" className="lg:col-span-6 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-green-50 transform rotate-3 rounded-[3rem] blur-lg opacity-50"></div>
              <div className="relative">
                <Simulator />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      {/* Bande de confiance */}
      <div className="bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: BadgeCheck, title: "Certifié RGE", sub: "QualiPAC" },
            { icon: FileCheck2, title: "Démarches gérées", sub: "de A à Z" },
            { icon: HandCoins, title: "Aides déduites", sub: "du devis final" },
            { icon: Users, title: "Entreprise familiale", sub: "un seul interlocuteur" },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-3 justify-center lg:justify-start">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 text-[#2b5a8f] flex items-center justify-center flex-shrink-0">
                <item.icon size={22} />
              </div>
              <div className="leading-tight">
                <p className="font-bold text-gray-900 text-sm">{item.title}</p>
                <p className="text-gray-500 text-xs">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <section id="avantages" className="py-24 bg-gray-50 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-100/40 blur-3xl"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-green-100/40 blur-3xl"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Kicker icon={Sparkles}>Les avantages</Kicker>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Pourquoi choisir la{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2b5a8f] to-cyan-500">
                pompe à chaleur
              </span>{" "}
              ?
            </h2>
            <p className="text-xl text-gray-600">
              Le système de chauffage le plus performant et économique en
              France.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: PiggyBank,
                gradient: "from-emerald-400 to-green-600",
                shadow: "shadow-green-500/30",
                bar: "from-emerald-400 to-green-500",
                chip: "1 kWh consommé → jusqu'à 4 kWh de chaleur",
                chipStyle: "bg-green-50 text-green-700 border-green-100",
                title: "Jusqu'à 70% d'économies",
                text: "Pour 1 kWh d'électricité consommé, la pompe à chaleur restitue jusqu'à 4 kWh d'énergie thermique. Votre facture fond instantanément.",
              },
              {
                icon: Leaf,
                gradient: "from-sky-400 to-[#2b5a8f]",
                shadow: "shadow-blue-500/30",
                bar: "from-sky-400 to-[#2b5a8f]",
                chip: "0 fioul · 0 gaz · énergie de l'air",
                chipStyle: "bg-blue-50 text-[#2b5a8f] border-blue-100",
                title: "Écologique & propre",
                text: "Fini les énergies fossiles comme le fioul ou le gaz. Vous utilisez les calories naturellement présentes dans l'air, réduisant votre empreinte carbone.",
              },
              {
                icon: ShieldCheck,
                gradient: "from-violet-400 to-purple-600",
                shadow: "shadow-purple-500/30",
                bar: "from-violet-400 to-purple-500",
                chip: "Un meilleur DPE à la revente",
                chipStyle: "bg-purple-50 text-purple-700 border-purple-100",
                title: "Valorisation du bien",
                text: "Améliorez le DPE (Diagnostic de Performance Énergétique) de votre maison. Un atout majeur pour la valeur de votre patrimoine immobilier.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="group relative bg-white p-8 pt-10 rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden"
              >
                <div
                  className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${card.bar}`}
                ></div>
                <card.icon
                  size={140}
                  className="absolute -bottom-8 -right-8 text-gray-900 opacity-[0.04] group-hover:opacity-[0.07] group-hover:scale-110 transition-all duration-500 pointer-events-none"
                />
                <div
                  className={`w-16 h-16 bg-gradient-to-br ${card.gradient} text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg ${card.shadow} group-hover:scale-110 transition-transform duration-300`}
                >
                  <card.icon size={30} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">
                  {card.title}
                </h3>
                <p className="text-gray-600 leading-relaxed mb-5">{card.text}</p>
                <span
                  className={`inline-block text-xs font-bold px-3 py-1.5 rounded-full border ${card.chipStyle}`}
                >
                  {card.chip}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subsidies Section */}
      <section
        id="subventions"
        className="py-24 bg-gradient-to-br from-[#173a5e] via-[#2b5a8f] to-[#122f4d] text-white relative overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        ></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl"></div>
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-blue-300/10 blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Kicker icon={HandCoins} onDark>
                Aides de l'État {new Date().getFullYear()}
              </Kicker>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
                Financer votre projet n'a jamais été aussi simple.
              </h2>
              <p className="text-blue-100 text-lg mb-8 leading-relaxed">
                L'État français encourage la transition énergétique. Avec{" "}
                <b>MaPrimeRénov'</b> et les{" "}
                <b>Certificats d'Économie d'Énergie (CEE)</b>, une grande
                partie du coût de l'équipement est prise en charge.
              </p>
              <ul className="space-y-5 mb-8">
                <li className="flex items-start gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <CheckCircle2
                    className="text-green-400 mt-0.5 flex-shrink-0"
                    size={24}
                  />
                  <span className="text-lg font-medium">
                    Nous calculons vos droits lors du premier appel.
                  </span>
                </li>
                <li className="flex items-start gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <CheckCircle2
                    className="text-green-400 mt-0.5 flex-shrink-0"
                    size={24}
                  />
                  <span className="text-lg font-medium">
                    L'équipe IP5 Énergie gère 100% de la paperasse pour vous.
                  </span>
                </li>
                <li className="flex items-start gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <CheckCircle2
                    className="text-green-400 mt-0.5 flex-shrink-0"
                    size={24}
                  />
                  <span className="text-lg font-medium">
                    L'aide est déduite directement du devis final.
                  </span>
                </li>
              </ul>

              {/* Les dispositifs officiels que nous mobilisons */}
              <div className="bg-white rounded-2xl p-5 shadow-lg">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4 text-center">
                  Les dispositifs officiels que nous mobilisons
                </p>
                <div className="flex items-center justify-center gap-8 flex-wrap">
                  <img
                    src="/images/aides/maprimerenov.png"
                    alt="MaPrimeRénov' — Mieux chez moi, mieux pour la planète"
                    className="h-12 w-auto"
                    loading="lazy"
                  />
                  <img
                    src="/images/aides/cee.png"
                    alt="CEE — Les certificats d'économies d'énergie"
                    className="h-12 w-auto"
                    loading="lazy"
                  />
                </div>
                <p className="text-gray-400 text-[11px] text-center mt-3">
                  Montants attribués selon l'éligibilité de chaque foyer.
                </p>
              </div>
            </div>

            <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl text-gray-900 relative">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-yellow-400 rounded-full flex flex-col items-center justify-center shadow-lg transform rotate-12 border-4 border-white">
                <span className="text-sm font-bold text-yellow-900 leading-none">
                  Jusqu'à
                </span>
                <span className="text-2xl font-black text-yellow-900 leading-none">
                  -80%
                </span>
              </div>

              <h3 className="text-2xl font-bold mb-8 text-center border-b pb-6">
                Votre projet clé en main
              </h3>
              <div className="space-y-8">
                <div className="flex gap-5">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-[#2b5a8f] flex items-center justify-center font-black text-xl flex-shrink-0 shadow-sm border border-blue-100">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">
                      Simulation en ligne
                    </h4>
                    <p className="text-gray-600">
                      Vous remplissez notre formulaire en 30 secondes pour
                      évaluer votre profil.
                    </p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-[#2b5a8f] flex items-center justify-center font-black text-xl flex-shrink-0 shadow-sm border border-blue-100">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">
                      Validation des aides
                    </h4>
                    <p className="text-gray-600">
                      Un expert IP5 confirme votre éligibilité selon votre
                      département et vos revenus.
                    </p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-[#2b5a8f] flex items-center justify-center font-black text-xl flex-shrink-0 shadow-sm border border-blue-100">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Installation RGE</h4>
                    <p className="text-gray-600">
                      Nos techniciens certifiés installent votre pompe à
                      chaleur dans les règles de l'art.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Réalisations : vraies photos de chantier, sans localisation précise
          pour préserver la vie privée des clients. */}
      <section id="realisations" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Kicker icon={Award}>Notre savoir-faire</Kicker>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Nos réalisations
            </h2>
            <p className="text-xl text-gray-600">
              Un chantier récent réalisé par notre équipe : remplacement d'une
              ancienne chaudière par une pompe à chaleur air/eau.
            </p>
          </div>

          {/* Avant / Après */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <figure className="relative rounded-3xl overflow-hidden shadow-lg border border-gray-100 group">
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
            <figure className="relative rounded-3xl overflow-hidden shadow-lg border border-gray-100 group">
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
                Le module intérieur de la pompe à chaleur et le ballon d'eau
                chaude
              </figcaption>
            </figure>
          </div>

          {/* Détails du chantier */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                className="group rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 bg-white transition-all duration-300 hover:-translate-y-1"
              >
                <div className="overflow-hidden">
                  <img
                    src={`/images/realisations/${photo.src}`}
                    alt={photo.alt}
                    className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-700"
                    loading="lazy"
                  />
                </div>
                <figcaption className="text-sm text-gray-600 px-4 py-3">
                  {photo.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="avis" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Kicker icon={Star}>Avis clients</Kicker>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Ils ont sauté le pas
            </h2>
            <p className="text-xl text-gray-600">
              Des propriétaires partout en France nous font confiance pour leur
              transition énergétique.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {REVIEWS.map((review) => (
              <figure
                key={review.name}
                className="relative bg-gray-50 p-8 rounded-3xl border border-gray-100 flex flex-col hover:shadow-xl hover:-translate-y-1 hover:bg-white transition-all duration-300 overflow-hidden"
              >
                <Quote
                  size={72}
                  className="absolute -top-2 -right-2 text-[#2b5a8f] opacity-[0.06] pointer-events-none"
                  fill="currentColor"
                />
                <div
                  className="flex gap-1 mb-4 text-yellow-400"
                  aria-label="Note de 5 étoiles sur 5"
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={18} fill="currentColor" />
                  ))}
                </div>
                <blockquote className="text-gray-700 leading-relaxed mb-6 flex-1">
                  « {review.text} »
                </blockquote>
                <figcaption className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <span
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-[#2b5a8f] to-cyan-500 text-white font-bold text-sm flex items-center justify-center flex-shrink-0"
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
                    <p className="font-bold text-gray-900">{review.name}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin size={14} /> {review.location}
                    </p>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Bandeau d'appel à l'action final */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-gradient-to-br from-[#173a5e] via-[#2b5a8f] to-[#122f4d] rounded-[2.5rem] px-8 py-14 md:p-16 text-center text-white overflow-hidden shadow-2xl">
            <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl"></div>
            <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-green-400/15 blur-3xl"></div>
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
                Prêt à réduire vos factures de chauffage ?
              </h2>
              <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
                Estimation gratuite en 30 secondes, sans engagement. Un expert
                IP5 Énergie vous rappelle pour valider vos aides.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="#simulateur"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById("simulateur")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-white text-[#2b5a8f] px-8 py-4 rounded-full font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg"
                >
                  <Sparkles size={20} /> Simuler mes économies
                </a>
                <a
                  href="tel:+33749525267"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 border-2 border-white/40 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-colors"
                >
                  07 49 52 52 67
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
      <AIChatWidget />
      <WhatsAppButton />
    </div>
  );
};

export default IP5Energie;
