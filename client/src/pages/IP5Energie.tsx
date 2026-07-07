import React, { useEffect, useRef, useState } from "react";
import {
  Leaf,
  PiggyBank,
  ShieldCheck,
  CheckCircle2,
  Phone,
  MessageCircle,
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
  Bot,
  Send,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { LOGO_FULL_D, LOGO_FULL_VIEWBOX } from "./ip5-logo";

// --- COMPONENTS ---

// Logo IP5 Énergie : tracé vectoriel exact du logo officiel (voir ip5-logo.ts).
// La couleur suit currentColor : bleu marque dans le header, blanchi par le
// filtre du footer.
const LogoIP5 = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox={LOGO_FULL_VIEWBOX}
    className={`h-12 md:h-14 w-auto text-[#2b5a8f] ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="IP5 Énergie"
  >
    <path d={LOGO_FULL_D} fill="currentColor" fillRule="evenodd" />
  </svg>
);

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

const TOTAL_QUESTIONS = 6;

type SimulatorData = {
  housingType: string;
  surface: number;
  currentHeating: string;
  department: string;
  householdSize: string;
  incomeBracket: string;
  name: string;
  phone: string;
  consent: boolean;
  company: string; // honeypot anti-spam : doit rester vide
};

const INITIAL_DATA: SimulatorData = {
  housingType: "",
  surface: 100,
  currentHeating: "",
  department: "",
  householdSize: "",
  incomeBracket: "",
  name: "",
  phone: "",
  consent: false,
  company: "",
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
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAllJSME9X_ECgmnUudhdapDhOfBsUYbz0",
  authDomain: "kachoto-7554c.firebaseapp.com",
  projectId: "kachoto-7554c",
  storageBucket: "kachoto-7554c.firebasestorage.app",
  messagingSenderId: "930806777855",
  appId: "1:930806777855:web:c73960da99f3853d3e49ca",
};

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
  });
}

const Simulator = () => {
  const [step, setStep] = useState(1);
  const [isCalculating, setIsCalculating] = useState(false);
  const [formData, setFormData] = useState<SimulatorData>(INITIAL_DATA);
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    consent?: string;
    submit?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goToResults = () => {
    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
      setStep(TOTAL_QUESTIONS + 1);
    }, 1800); // Simule le temps de calcul
  };

  const nextStep = () => {
    if (step === TOTAL_QUESTIONS) {
      goToResults();
    } else {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1 && !isCalculating) {
      setStep(step - 1);
    }
  };

  const choose = (key: keyof SimulatorData, value: string) => {
    setFormData({ ...formData, [key]: value });
    nextStep();
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
            <Button onClick={nextStep} className="w-full">
              Continuer <ArrowRight size={18} />
            </Button>
          </div>
        );
      case 3:
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
      case 4:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
              <Map className="text-[#2b5a8f]" size={32} />
            </div>
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
              onClick={nextStep}
              className="w-full"
              disabled={!formData.department}
            >
              Continuer <ArrowRight size={18} />
            </Button>
          </div>
        );
      case 5:
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
              <Users className="text-[#2b5a8f]" size={32} />
            </div>
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
      case 6: {
        const brackets = getIncomeBrackets(
          formData.department,
          formData.householdSize,
        );
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
              <PiggyBank className="text-[#2b5a8f]" size={32} />
            </div>
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
      case 7: {
        const savings = savingsEstimate();
        const isRose = formData.incomeBracket.includes("rose");

        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-green-50 rounded-2xl p-6 mb-6 text-center border border-green-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <PiggyBank size={80} />
              </div>
              <p className="text-green-800 font-semibold mb-2">
                Excellente nouvelle !
              </p>
              <p className="text-gray-700 text-sm mb-2">
                Vous pourriez économiser jusqu'à
              </p>
              <p className="text-4xl font-extrabold text-green-600 mb-3">
                {savings} € / an
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
      case 8:
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
            className="h-full bg-[#2b5a8f] transition-all duration-500 ease-out"
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
            {step <= TOTAL_QUESTIONS
              ? `Étape ${step} sur ${TOTAL_QUESTIONS}`
              : "Votre résultat"}
          </p>
        </div>
      )}

      {isCalculating ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#2b5a8f] mb-6"></div>
          <p className="text-gray-800 font-bold text-lg text-center mb-2">
            Calcul de vos droits en cours...
          </p>
          <p className="text-gray-500 text-sm text-center">
            Secteur : {formData.department} • Foyer de {formData.householdSize}{" "}
            pers.
          </p>
        </div>
      ) : (
        renderStep()
      )}
    </div>
  );
};

// Consignes données à Gemini : cadrent les réponses sur le métier d'IP5
// Énergie et évitent de promettre des montants d'aide fermes (chaque dossier
// est différent, seul un appel avec un expert les confirme).
const AI_SYSTEM_INSTRUCTION = `Tu es l'assistant virtuel du site d'IP5 Énergie, entreprise française certifiée RGE QualiPAC, spécialisée dans l'installation de pompes à chaleur air/eau.

Ton rôle : répondre en français, en 2 à 5 phrases maximum, aux questions des visiteurs sur :
- Le fonctionnement des pompes à chaleur (COP, économies d'énergie, aspect écologique)
- Les aides de l'État : MaPrimeRénov' (profils Bleu/Jaune/Violet/Rose selon le revenu fiscal de référence), les Certificats d'Économie d'Énergie (CEE), l'éco-PTZ
- Le déroulement d'une installation et la certification RGE
- Les services d'IP5 Énergie : étude gratuite, prise en charge des démarches administratives, installation par des techniciens certifiés

Règles strictes :
- Ne donne jamais de montant d'aide exact et garanti pour la situation personnelle d'un visiteur : ce sont des estimations qui dépendent d'un dossier réel. Invite-le à utiliser le simulateur en haut de la page ou à appeler IP5 Énergie au 07 49 52 52 67 pour un calcul précis.
- Si la question sort du sujet chauffage/énergie/rénovation ou de l'entreprise IP5 Énergie, réponds poliment que tu es spécialisé sur ces sujets et invite à contacter IP5 Énergie pour le reste.
- Ne donne pas de conseil juridique ou fiscal définitif, seulement des informations générales publiques.
- Reste chaleureux et professionnel.
- Si le visiteur semble prêt à passer à l'action, encourage-le à remplir le simulateur ou à appeler / écrire sur WhatsApp au 07 49 52 52 67.`;

type ChatMessage = { role: "user" | "model"; text: string };

const AI_WELCOME_MESSAGE: ChatMessage = {
  role: "model",
  text: "👋 Bonjour ! Je suis l'assistant d'IP5 Énergie, propulsé par Gemini. Une question sur les aides (MaPrimeRénov', CEE) ou sur l'installation d'une pompe à chaleur ? Je suis là pour vous répondre.",
};

// Badge de marque Gemini : dégradé aux couleurs de l'icône Google Gemini,
// réutilisé sur le bouton flottant et dans l'en-tête du chat.
const GeminiBadge = ({ size = 12 }: { size?: number }) => (
  <span className="bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 rounded-full p-1 flex items-center justify-center flex-shrink-0">
    <Sparkles size={size} className="text-white" />
  </span>
);

// Assistant IA flottant, propulsé par Gemini via Firebase AI Logic. Le SDK
// est importé dynamiquement (npm, code-splitté par Vite) pour ne pas
// alourdir le chargement initial de la page.
const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([AI_WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isOpen]);

  const getChatSession = async () => {
    if (chatRef.current) return chatRef.current;
    const [{ initializeApp, getApps, getApp }, { getAI, getGenerativeModel, GoogleAIBackend }] =
      await Promise.all([import("firebase/app"), import("firebase/ai")]);
    const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, {
      model: "gemini-2.5-flash",
      systemInstruction: AI_SYSTEM_INSTRUCTION,
    });
    chatRef.current = model.startChat();
    return chatRef.current;
  };

  const send = async () => {
    const question = input.trim();
    if (!question || isLoading) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setIsLoading(true);
    try {
      const chat = await getChatSession();
      const result = await chat.sendMessage(question);
      const text = result.response.text();
      setMessages((prev) => [...prev, { role: "model", text }]);
    } catch (err) {
      console.error("Erreur assistant IA:", err);
      setError(
        "Désolé, l'assistant est momentanément indisponible. Appelez-nous au 07 49 52 52 67 ou écrivez sur WhatsApp.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-x-4 bottom-40 sm:inset-x-auto sm:right-6 sm:bottom-40 sm:w-96 h-[28rem] max-h-[70vh] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#2b5a8f] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 font-bold">
                <Bot size={20} /> Assistant IP5 Énergie
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <GeminiBadge size={10} />
                <span className="text-[11px] font-semibold text-blue-100">
                  Propulsé par{" "}
                  <span className="bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                    Google Gemini
                  </span>
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Fermer l'assistant"
              className="hover:opacity-70 transition-opacity"
            >
              <X size={20} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#2b5a8f] text-white ml-auto rounded-br-sm"
                    : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            ))}
            {isLoading && (
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2 w-fit">
                <Loader2 size={16} className="animate-spin text-[#2b5a8f]" />
                <span className="text-sm text-gray-500">En train d'écrire...</span>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-2.5 text-sm">
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 p-3 border-t border-gray-100 flex-shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question..."
              aria-label="Votre question à l'assistant"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 focus:ring-2 focus:ring-[#2b5a8f] focus:border-transparent outline-none text-sm bg-gray-50 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Envoyer"
              className="bg-[#2b5a8f] text-white rounded-full p-2.5 hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Fermer l'assistant Gemini" : "Ouvrir l'assistant Gemini"}
        className="fixed bottom-24 right-6 bg-[#2b5a8f] text-white p-4 rounded-full shadow-2xl hover:bg-blue-800 hover:scale-110 transition-all duration-300 z-50 flex items-center justify-center group"
      >
        {isOpen ? <X size={28} /> : <Bot size={28} />}
        {!isOpen && (
          <>
            <span className="absolute -top-1 -right-1 shadow-md">
              <GeminiBadge size={12} />
            </span>
            <span className="absolute right-16 bg-white text-gray-900 text-sm font-bold py-2 px-4 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
              Posez vos questions à notre IA Gemini !
            </span>
          </>
        )}
      </button>
    </>
  );
};

const IP5Energie = () => {
  // Le reste de l'app est en RTL (index.css force direction:rtl sur html) :
  // cette page est en français, on impose le sens gauche→droite pendant
  // qu'elle est affichée, puis on restaure en quittant.
  React.useEffect(() => {
    const html = document.documentElement;
    const prevDir = html.style.direction;
    const prevLang = html.lang;
    const prevTitle = document.title;
    html.style.direction = "ltr";
    html.lang = "fr";
    document.title = "IP5 Énergie — Pompes à chaleur, jusqu'à 80% d'aides";
    return () => {
      html.style.direction = prevDir;
      html.lang = prevLang;
      document.title = prevTitle;
    };
  }, []);

  return (
    <div dir="ltr" className="font-sans text-gray-900 bg-gray-50 min-h-screen">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md fixed w-full z-50 top-0 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              {/* Le Logo Vectoriel est appelé ici */}
              <LogoIP5 />
            </div>
            <div className="hidden md:flex space-x-8 items-center">
              <a
                href="#avantages"
                className="text-gray-600 hover:text-[#2b5a8f] font-medium transition-colors"
              >
                Avantages
              </a>
              <a
                href="#subventions"
                className="text-gray-600 hover:text-[#2b5a8f] font-medium transition-colors"
              >
                Aides de l'État
              </a>
              <a
                href="#realisations"
                className="text-gray-600 hover:text-[#2b5a8f] font-medium transition-colors"
              >
                Réalisations
              </a>
              <a
                href="#avis"
                className="text-gray-600 hover:text-[#2b5a8f] font-medium transition-colors"
              >
                Avis clients
              </a>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="tel:+33749525267"
                className="flex items-center gap-2 text-[#2b5a8f] font-bold hover:text-blue-800 transition-colors"
                aria-label="Appeler IP5 Énergie au 07 49 52 52 67"
              >
                <Phone size={18} />
                <span className="hidden md:inline">07 49 52 52 67</span>
              </a>
            </div>
          </div>
        </div>
      </nav>

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

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <div className="flex items-center gap-3 text-gray-700 font-semibold bg-white px-5 py-3 rounded-xl shadow-md border border-gray-100">
                  <CheckCircle2 className="text-green-500" size={22} /> Étude
                  gratuite
                </div>
                <div className="flex items-center gap-3 text-gray-700 font-semibold bg-white px-5 py-3 rounded-xl shadow-md border border-gray-100">
                  <CheckCircle2 className="text-green-500" size={22} />{" "}
                  Démarches incluses
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-green-50 transform rotate-3 rounded-[3rem] blur-lg opacity-50"></div>
              <div className="relative">
                <Simulator />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="avantages" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Pourquoi choisir la pompe à chaleur ?
            </h2>
            <p className="text-xl text-gray-600">
              Le système de chauffage le plus performant et économique en
              France.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                <PiggyBank size={32} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">
                Jusqu'à 70% d'économies
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Pour 1 kWh d'électricité consommé, la pompe à chaleur restitue
                jusqu'à 4 kWh d'énergie thermique. Votre facture fond
                instantanément.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-16 h-16 bg-blue-50 text-[#2b5a8f] rounded-2xl flex items-center justify-center mb-6">
                <Leaf size={32} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">
                Écologique & Propre
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Fini les énergies fossiles comme le fioul ou le gaz. Vous
                utilisez les calories naturellement présentes dans l'air,
                réduisant votre empreinte carbone.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">
                Valorisation du bien
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Améliorez le DPE (Diagnostic de Performance Énergétique) de
                votre maison. Un atout majeur pour la valeur de votre
                patrimoine immobilier.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Subsidies Section */}
      <section
        id="subventions"
        className="py-24 bg-[#2b5a8f] text-white relative overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        ></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block bg-white/10 px-4 py-1.5 rounded-full text-blue-100 font-semibold text-sm mb-6 border border-white/20">
                Aides de l'État {new Date().getFullYear()}
              </div>
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
                className="w-full h-80 object-cover"
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
                className="w-full h-80 object-cover"
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
                className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white"
              >
                <img
                  src={`/images/realisations/${photo.src}`}
                  alt={photo.alt}
                  className="w-full h-48 object-cover"
                  loading="lazy"
                />
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
                className="bg-gray-50 p-8 rounded-3xl border border-gray-100 flex flex-col"
              >
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
                <figcaption>
                  <p className="font-bold text-gray-900">{review.name}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin size={14} /> {review.location}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="mb-6 opacity-80 filter grayscale brightness-200">
                {/* Le Logo Vectoriel en mode Footer */}
                <LogoIP5 />
              </div>
              <p className="text-sm leading-relaxed max-w-sm mb-6">
                Votre partenaire de confiance pour la transition énergétique en
                France. Spécialiste de l'installation de pompes à chaleur
                certifié RGE.
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ShieldCheck size={18} className="text-green-500" /> Certifié
                RGE QualiPAC
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 text-lg">Contact</h4>
              <ul className="space-y-4">
                <li>
                  <a
                    href="tel:+33749525267"
                    className="flex items-center gap-3 hover:text-blue-400 transition-colors"
                  >
                    <Phone size={18} />{" "}
                    <span className="font-medium">07 49 52 52 67</span>
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:info@ip5energie.com"
                    className="flex items-center gap-3 hover:text-blue-400 transition-colors"
                  >
                    <MessageCircle size={18} />{" "}
                    <span>info@ip5energie.com</span>
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 text-lg">Légal</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="hover:text-blue-400 transition-colors">
                    Mentions légales
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-400 transition-colors">
                    Politique de confidentialité
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-400 transition-colors">
                    Conditions générales de vente
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center text-sm">
            <p>
              &copy; {new Date().getFullYear()} IP5 Énergie. Tous droits
              réservés.
            </p>
            <p className="mt-4 md:mt-0 text-gray-500">
              Propulsé pour la conversion.
            </p>
          </div>
        </div>
      </footer>

      <AIChatWidget />

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/33749525267"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-green-500 text-white p-4 rounded-full shadow-2xl hover:bg-green-600 hover:scale-110 transition-all duration-300 z-50 flex items-center justify-center group"
        aria-label="Contactez-nous sur WhatsApp"
      >
        <MessageCircle size={32} />
        <span className="absolute right-16 bg-white text-gray-900 text-sm font-bold py-2 px-4 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
          Une question ? Écrivez-nous !
        </span>
      </a>
    </div>
  );
};

export default IP5Energie;
