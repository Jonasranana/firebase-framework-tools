import React, { useState } from "react";
import {
  ShieldCheck,
  Gauge,
  Wrench,
  Fuel,
  CheckCircle2,
  Clock,
  ChevronDown,
  Phone,
  Sparkles,
  Building2,
  Truck,
  MapPin,
  FileCheck2,
} from "lucide-react";
import {
  PageLayout,
  Kicker,
  Button,
  FRENCH_PHONE_REGEX,
} from "./ip5-sections";
import { FIREBASE_CONFIG } from "./site-chrome";

// ─────────────────────────────────────────────────────────────────────────
// LANDING PAGE DÉDIÉE — Stations de gonflage des pneumatiques (CEE, fiche
// TRA-SE-104). Route : /gonflage-pneumatiques (alias /gonflage).
//
// Produit entièrement différent de la PAC/du solaire : la cible n'est pas
// un particulier mais une entreprise, une collectivité ou un exploitant de
// parking/aire d'autoroute qui signe un contrat d'entretien de sa station
// de gonflage, financé par les Certificats d'Économies d'Énergie (CEE).
// Le simulateur « particulier » (logement, revenu fiscal, foyer) ne
// s'applique pas ici : on utilise un formulaire de contact pro dédié,
// avec ses propres champs, mais on réutilise la même collection Firestore
// « ip5_leads » (source « landing-gonflage-pro ») pour rester compatible
// avec le pipeline de leads existant.
// ─────────────────────────────────────────────────────────────────────────

const scrollToFormulaire = (e: React.MouseEvent) => {
  e.preventDefault();
  document
    .getElementById("formulaire")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
};

const AVANTAGES = [
  {
    icon: ShieldCheck,
    title: "Sécurité de vos usagers",
    text: "Un pneu mal gonflé, c'est un risque d'accident. La station de gonflage entretenue protège vos salariés, vos clients ou vos administrés.",
  },
  {
    icon: Fuel,
    title: "Moins de carburant, moins d'usure",
    text: "Des pneus correctement gonflés réduisent la consommation de carburant et prolongent la durée de vie des pneumatiques de votre flotte.",
  },
  {
    icon: Wrench,
    title: "Financé par les CEE",
    text: "Le contrat d'entretien est pris en charge par les Certificats d'Économies d'Énergie. Le service de gonflage reste gratuit pour vos usagers.",
  },
];

// Les 3 types de sites définis par la fiche CEE TRA-SE-104.
const TYPES_SITES = [
  {
    icon: Truck,
    label: "Type A",
    title: "Autoroutes & grande circulation",
    text: "Stations implantées sur les autoroutes ou voies de grande circulation, sur des aires de stationnement et de repos.",
  },
  {
    icon: Building2,
    label: "Type B",
    title: "Zones urbaines & parkings publics",
    text: "Stations en agglomération ou hors agglomération (zones industrielles, d'activité, parkings grands publics).",
  },
  {
    icon: MapPin,
    label: "Type C",
    title: "Parkings privés d'entreprise",
    text: "Stations dans les parkings privés d'entreprises ou de collectivités, pour les véhicules de flotte professionnelle.",
  },
];

const ETAPES = [
  {
    n: "1",
    title: "Étude gratuite de votre site",
    text: "Un conseiller IP5 étudie votre site (autoroute, zone urbaine ou parking privé) et le nombre de véhicules concernés.",
  },
  {
    n: "2",
    title: "Installation ou mise en conformité",
    text: "Nous installons ou mettons aux normes TNPF votre station de gonflage, avec affichage et accès conformes.",
  },
  {
    n: "3",
    title: "Contrat d'entretien signé",
    text: "Le contrat déclenche les certificats CEE : votre station est entretenue, et le gonflage reste gratuit pour vos usagers.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Qu'est-ce qu'un Certificat d'Économies d'Énergie (CEE) ?",
    a: "C'est un dispositif de l'État qui oblige les fournisseurs d'énergie à financer des actions d'économies d'énergie. L'opération « Station de gonflage des pneumatiques » (fiche TRA-SE-104) en fait partie : elle finance le contrat d'entretien de votre station.",
  },
  {
    q: "Est-ce que ça a un coût pour nous ?",
    a: "L'étude est gratuite et sans engagement. Le contrat d'entretien est valorisé par les CEE : nous vous présentons une offre chiffrée adaptée à votre site avant toute signature.",
  },
  {
    q: "Qui peut en bénéficier ?",
    a: "Toute structure disposant ou souhaitant installer une station de gonflage accessible aux véhicules de catégorie M1 ou N1 : exploitants d'autoroutes, communes, zones commerciales, entreprises avec flotte de véhicules.",
  },
  {
    q: "Que devient une station déjà existante ?",
    a: "Elle peut être reprise sous contrat d'entretien : nous vérifions sa conformité au cahier des charges TNPF (accès, affichage, sécurité) et prenons le relais de sa maintenance.",
  },
];

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 text-left px-6 py-5 font-bold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span>{q}</span>
        <ChevronDown
          size={20}
          className={`flex-shrink-0 text-[#2b5a8f] dark:text-blue-400 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <p className="px-6 pb-6 -mt-1 text-gray-600 dark:text-slate-300 leading-relaxed">
          {a}
        </p>
      )}
    </div>
  );
};

type ProLeadData = {
  entreprise: string;
  contact: string;
  phone: string;
  email: string;
  typeSite: string;
  nbVehicules: string;
  message: string;
  consent: boolean;
  hp: string; // honeypot anti-spam : doit rester vide
};

const INITIAL_PRO_DATA: ProLeadData = {
  entreprise: "",
  contact: "",
  phone: "",
  email: "",
  typeSite: "",
  nbVehicules: "",
  message: "",
  consent: false,
  hp: "",
};

// Enregistre le lead pro dans la même collection Firestore que le
// simulateur particulier (« ip5_leads »), avec sa propre source pour le
// distinguer côté Monday/mesure des campagnes.
async function submitProLead(
  data: ProLeadData,
  source = "landing-gonflage-pro",
): Promise<void> {
  if (data.hp) return; // bot détecté, on ignore silencieusement
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
    // « name » = nom de l'entreprise/collectivité : c'est le titre de la
    // fiche côté Monday, plus utile ici que le nom du contact.
    name: data.entreprise,
    contact: data.contact,
    phone: data.phone,
    email: data.email,
    typeSite: data.typeSite,
    nbVehicules: data.nbVehicules,
    message: data.message,
    projectType: "Station de gonflage",
    consent: data.consent,
    source,
    createdAt: fsMod.serverTimestamp(),
    mondaySynced: false,
  });
  try {
    (window as any).fbq?.("track", "Lead", { content_category: source });
  } catch {
    /* le tracking ne doit jamais casser l'enregistrement du lead */
  }
}

const ProLeadForm = () => {
  const [formData, setFormData] = useState<ProLeadData>(INITIAL_PRO_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [errors, setErrors] = useState<{
    entreprise?: string;
    contact?: string;
    phone?: string;
    email?: string;
    consent?: string;
    submit?: string;
  }>({});

  const effectiveSource = (() => {
    try {
      const p = new URLSearchParams(window.location.search).get("src");
      return p && p.trim() ? p.trim().slice(0, 40) : "landing-gonflage-pro";
    } catch {
      return "landing-gonflage-pro";
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (formData.entreprise.trim().length < 2) {
      newErrors.entreprise = "Merci d'indiquer le nom de votre structure.";
    }
    if (formData.contact.trim().length < 2) {
      newErrors.contact = "Merci d'indiquer un nom de contact.";
    }
    if (!FRENCH_PHONE_REGEX.test(formData.phone.trim())) {
      newErrors.phone = "Merci d'indiquer un numéro de téléphone français valide.";
    }
    const email = formData.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      newErrors.email = "Cette adresse e-mail ne semble pas valide.";
    }
    if (!formData.consent) {
      newErrors.consent = "Merci d'accepter d'être recontacté pour recevoir votre étude.";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await submitProLead(formData, effectiveSource);
      setIsDone(true);
    } catch (err) {
      console.error("Échec de l'enregistrement du lead pro:", err);
      setErrors({
        submit:
          "Une erreur est survenue lors de l'envoi. Réessayez, ou appelez-nous directement au 07 49 52 52 67.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 max-w-md w-full mx-auto text-center border border-gray-100">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">
          Demande envoyée !
        </h3>
        <p className="text-gray-600">
          Un conseiller IP5 Énergie va étudier votre site et vous recontacte
          rapidement pour vous présenter votre offre.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 max-w-md w-full mx-auto border border-gray-100">
      <h3 className="text-xl font-bold text-gray-800 mb-1 text-center">
        Étude gratuite de votre site
      </h3>
      <p className="text-sm text-gray-500 mb-6 text-center">
        Sans engagement — réponse sous 48h ouvrées.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="pro-entreprise" className="sr-only">
            Entreprise ou collectivité
          </label>
          <input
            id="pro-entreprise"
            type="text"
            required
            autoComplete="organization"
            placeholder="Entreprise / collectivité"
            value={formData.entreprise}
            aria-invalid={!!errors.entreprise}
            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#2b5a8f] focus:border-transparent outline-none bg-gray-50 text-gray-900 placeholder-gray-400 ${errors.entreprise ? "border-red-400" : "border-gray-300"}`}
            onChange={(e) =>
              setFormData({ ...formData, entreprise: e.target.value })
            }
          />
          {errors.entreprise && (
            <p className="text-red-600 text-xs mt-1">{errors.entreprise}</p>
          )}
        </div>

        <div>
          <label htmlFor="pro-contact" className="sr-only">
            Nom du contact
          </label>
          <input
            id="pro-contact"
            type="text"
            required
            autoComplete="name"
            placeholder="Votre nom"
            value={formData.contact}
            aria-invalid={!!errors.contact}
            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#2b5a8f] focus:border-transparent outline-none bg-gray-50 text-gray-900 placeholder-gray-400 ${errors.contact ? "border-red-400" : "border-gray-300"}`}
            onChange={(e) =>
              setFormData({ ...formData, contact: e.target.value })
            }
          />
          {errors.contact && (
            <p className="text-red-600 text-xs mt-1">{errors.contact}</p>
          )}
        </div>

        <div>
          <label htmlFor="pro-phone" className="sr-only">
            Téléphone
          </label>
          <input
            id="pro-phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder="Votre numéro de téléphone"
            value={formData.phone}
            aria-invalid={!!errors.phone}
            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#2b5a8f] focus:border-transparent outline-none bg-gray-50 text-gray-900 placeholder-gray-400 ${errors.phone ? "border-red-400" : "border-gray-300"}`}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
          />
          {errors.phone && (
            <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
          )}
        </div>

        <div>
          <label htmlFor="pro-email" className="sr-only">
            E-mail (facultatif)
          </label>
          <input
            id="pro-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="Votre e-mail (facultatif)"
            value={formData.email}
            aria-invalid={!!errors.email}
            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[#2b5a8f] focus:border-transparent outline-none bg-gray-50 text-gray-900 placeholder-gray-400 ${errors.email ? "border-red-400" : "border-gray-300"}`}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
          {errors.email && (
            <p className="text-red-600 text-xs mt-1">{errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="pro-type-site" className="sr-only">
            Type de site
          </label>
          <select
            id="pro-type-site"
            value={formData.typeSite}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2b5a8f] focus:border-transparent outline-none bg-gray-50 text-gray-900"
            onChange={(e) =>
              setFormData({ ...formData, typeSite: e.target.value })
            }
          >
            <option value="">Type de site (facultatif)</option>
            <option value="Autoroute / grande circulation (Type A)">
              Autoroute / grande circulation
            </option>
            <option value="Zone urbaine / parking public (Type B)">
              Zone urbaine / parking public
            </option>
            <option value="Parking privé entreprise ou collectivité (Type C)">
              Parking privé entreprise ou collectivité
            </option>
          </select>
        </div>

        <div>
          <label htmlFor="pro-nb-vehicules" className="sr-only">
            Nombre approximatif de véhicules
          </label>
          <input
            id="pro-nb-vehicules"
            type="text"
            inputMode="numeric"
            placeholder="Nombre approx. de véhicules concernés (facultatif)"
            value={formData.nbVehicules}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#2b5a8f] focus:border-transparent outline-none bg-gray-50 text-gray-900 placeholder-gray-400"
            onChange={(e) =>
              setFormData({ ...formData, nbVehicules: e.target.value })
            }
          />
        </div>

        {/* Honeypot anti-spam : caché aux humains, rempli par les bots */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="pro-hp">Site</label>
          <input
            id="pro-hp"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={formData.hp}
            onChange={(e) => setFormData({ ...formData, hp: e.target.value })}
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
              J'accepte d'être recontacté(e) par IP5 Énergie au sujet de ma
              demande. Mes données ne sont jamais revendues et je peux
              exercer mes droits (accès, rectification, suppression) à tout
              moment.
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
          {isSubmitting ? "Envoi en cours..." : "Demander mon étude gratuite"}
        </Button>
      </form>
    </div>
  );
};

const CampagneGonflage = () => {
  return (
    <PageLayout title="Station de gonflage des pneumatiques — financée CEE — IP5 Énergie">
      {/* ── HERO : angle B2B / collectivités ── */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden bg-white dark:bg-slate-950">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[30rem] h-[30rem] rounded-full bg-slate-100 dark:bg-slate-800/40 blur-3xl opacity-70"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-50 dark:bg-blue-900/20 blur-3xl opacity-70"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-6 mb-12 lg:mb-0 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#2b5a8f] dark:text-blue-300 font-bold text-sm mb-6 border border-blue-100 dark:border-blue-900 shadow-sm">
                <FileCheck2 size={16} /> Opération CEE n° TRA-SE-104
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6 text-gray-900 dark:text-white">
                Stations de gonflage des{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2b5a8f] to-cyan-500 dark:from-blue-400 dark:to-cyan-400">
                  pneumatiques
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Pour les entreprises, collectivités et exploitants de
                parkings ou d'aires d'autoroute :{" "}
                <b>installation et contrat d'entretien</b> financés par les{" "}
                <b>Certificats d'Économies d'Énergie</b>. Aucune facture pour
                vos usagers.
              </p>

              <div className="flex justify-center lg:justify-start">
                <a
                  href="#formulaire"
                  onClick={scrollToFormulaire}
                  className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#2b5a8f] to-cyan-500 text-white px-9 py-4 rounded-full font-bold text-lg shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-[1.03] transition-all duration-300"
                >
                  <Sparkles size={22} fill="currentColor" /> Demander une
                  étude gratuite
                </a>
              </div>
              <p className="mt-5 flex items-center gap-x-5 gap-y-1 flex-wrap justify-center lg:justify-start text-sm text-gray-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-green-500" size={16} />{" "}
                  Financé par les CEE
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="text-green-500" size={16} /> Réponse sous
                  48h
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="text-green-500" size={16} /> Sans
                  engagement
                </span>
              </p>
            </div>

            <div
              id="formulaire"
              className="lg:col-span-6 relative scroll-mt-28"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-slate-100 transform rotate-3 rounded-[3rem] blur-lg opacity-50"></div>
              <div className="relative">
                <ProLeadForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Avantages */}
      <section className="py-24 bg-gray-50 dark:bg-slate-950 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-100/40 dark:bg-blue-900/20 blur-3xl"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Kicker icon={Gauge}>Les avantages</Kicker>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
              Pourquoi équiper votre site
            </h2>
            <p className="text-xl text-gray-600 dark:text-slate-300">
              Sécurité, économies et prise en charge par les CEE.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {AVANTAGES.map((a) => (
              <div
                key={a.title}
                className="group flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-8 md:p-9 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border border-blue-100 dark:border-blue-900 text-[#2b5a8f] dark:text-blue-300 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                  <a.icon size={26} strokeWidth={1.75} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {a.title}
                </h3>
                <p className="text-gray-600 dark:text-slate-300 leading-relaxed">
                  {a.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Les 3 types de sites (repris de la fiche CEE) */}
      <section className="py-24 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Kicker icon={MapPin}>Quel que soit votre site</Kicker>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
              3 types de sites éligibles
            </h2>
            <p className="text-xl text-gray-600 dark:text-slate-300">
              La fiche CEE TRA-SE-104 couvre tous les contextes, de
              l'autoroute au parking d'entreprise.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {TYPES_SITES.map((t) => (
              <div
                key={t.label}
                className="bg-gray-50 dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-[#2b5a8f] dark:text-blue-300 flex items-center justify-center flex-shrink-0">
                    <t.icon size={22} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#2b5a8f] dark:text-blue-400">
                    {t.label}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {t.title}
                </h3>
                <p className="text-gray-600 dark:text-slate-300 text-sm leading-relaxed">
                  {t.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="py-24 bg-gradient-to-br from-[#173a5e] via-[#2b5a8f] to-[#122f4d] text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        ></div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Kicker icon={Wrench} onDark>
              Comment ça marche
            </Kicker>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
              De l'étude au contrat, en 3 étapes
            </h2>
          </div>
          <div className="space-y-8">
            {ETAPES.map((e) => (
              <div
                key={e.n}
                className="flex gap-5 bg-white/5 p-6 rounded-2xl border border-white/10"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-black text-xl flex-shrink-0">
                  {e.n}
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">{e.title}</h4>
                  <p className="text-blue-100">{e.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-gray-50 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <Kicker icon={FileCheck2}>Vos questions</Kicker>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
              Tout ce que vous vous demandez
            </h2>
          </div>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 bg-white dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-gradient-to-br from-[#173a5e] via-[#2b5a8f] to-[#122f4d] rounded-[2.5rem] px-8 py-14 md:p-16 text-center text-white overflow-hidden shadow-2xl">
            <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl"></div>
            <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-blue-300/10 blur-3xl"></div>
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
                Équipez votre site, sans frais de gonflage pour vos usagers
              </h2>
              <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
                Étude gratuite et sans engagement. Un conseiller IP5 Énergie
                vous recontacte pour chiffrer votre projet.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="#formulaire"
                  onClick={scrollToFormulaire}
                  className="inline-flex items-center justify-center gap-2 bg-white text-[#2b5a8f] px-8 py-4 rounded-full font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg"
                >
                  <Sparkles size={20} /> Demander mon étude
                </a>
                <a
                  href="tel:+33749525267"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 border-2 border-white/40 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-colors"
                >
                  <Phone size={20} /> 07 49 52 52 67
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default CampagneGonflage;
