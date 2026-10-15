import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  ChevronDown,
  ArrowRight,
  Building2,
  Droplet,
  Flame,
  HelpCircle,
  ArrowLeft,
  Calculator,
} from "lucide-react";
import {
  PageLayout,
  Simulator,
  TrustBar,
  AvantagesSection,
  AidesSection,
  AvisSection,
  FRENCH_PHONE_REGEX,
  submitCallbackRequest,
  trackStep,
  type CallbackRequest,
} from "./ip5-sections";

// ─────────────────────────────────────────────────────────────────────────
// LANDING PAGE DÉDIÉE — Campagne publicitaire Meta (Facebook / Instagram).
// Route : /pac (alias /simulateur-pac).
//
// Objectif unique : convertir le clic d'une publicité en LEAD qualifié.
// Le message du hero est calé (« message match ») sur l'angle des annonces :
// l'ÉLIGIBILITÉ AUX AIDES (MaPrimeRénov' + CEE). On réutilise le simulateur
// de captation de l'accueil : les leads partent dans la même collection
// Firestore « ip5_leads » (puis sync Monday), avec source « landing-pac-meta »
// enregistrée par le simulateur, et l'événement Meta Pixel « Lead » est
// déclenché à la soumission (voir submitLead dans ip5-sections.tsx).
//
// Différences avec l'accueil : une seule intention (pas de cartes de
// navigation qui font sortir du tunnel), une preuve sociale renforcée et une
// FAQ qui lève les objections classiques (prix, locataire, copropriété…).
// ─────────────────────────────────────────────────────────────────────────

const scrollToSimulateur = (e: React.MouseEvent) => {
  e.preventDefault();
  document
    .getElementById("simulateur")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
};

// Questions/réponses : chaque item lève une objection qui bloque la
// conversion. Réponses courtes, rassurantes, sans promesse ferme de montant.
const FAQ_ITEMS = [
  {
    q: "Combien coûte une pompe à chaleur, aides déduites ?",
    a: "Tout dépend de votre logement et de vos revenus. Grâce à MaPrimeRénov' et à la prime CEE cumulées, le reste à charge est souvent bien plus faible qu'on ne l'imagine — parfois quelques centaines d'euros pour les foyers les plus modestes. Le simulateur vous donne une première estimation gratuite, et un conseiller la valide ensuite avec vous.",
  },
  {
    q: "Le simulateur m'engage-t-il à quelque chose ?",
    a: "Non. Il est 100% gratuit et sans engagement. Vous obtenez une estimation de vos aides, et nous vous rappelons simplement pour affiner votre projet. Vous restez libre à chaque étape.",
  },
  {
    q: "Qui s'occupe des démarches administratives ?",
    a: "Nous. Le montage des dossiers d'aides (MaPrimeRénov', CEE) est géré de A à Z par nos équipes. Les aides sont déduites directement de votre devis : vous ne faites pas l'avance de trésorerie.",
  },
  {
    q: "Suis-je éligible si je suis locataire ou en copropriété ?",
    a: "Les aides s'adressent en priorité aux propriétaires occupants et bailleurs. En copropriété, des dispositifs existent aussi. Le plus simple : renseignez votre situation dans le simulateur, on vous dit en 2 minutes ce à quoi vous avez droit.",
  },
  {
    q: "Intervenez-vous dans mon département ?",
    a: "Nous intervenons dans la plupart des départements de France métropolitaine, hors pourtour méditerranéen et Corse. Indiquez votre code postal dans le simulateur : nous vous confirmons tout de suite si votre commune est couverte.",
  },
  {
    q: "Combien puis-je vraiment économiser ?",
    a: "Une pompe à chaleur restitue jusqu'à 4 kWh de chaleur pour 1 kWh d'électricité consommé. En remplacement d'une vieille chaudière fioul ou gaz, la facture de chauffage peut être divisée par deux à trois. L'économie exacte dépend de votre logement.",
  },
];

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 text-left px-6 py-5 font-semibold text-[#0f2a47] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
        <p className="px-6 pb-6 -mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">
          {a}
        </p>
      )}
    </div>
  );
};

// Une couleur par énergie pour que les trois choix se distinguent d'un coup
// d'œil (classes écrites en entier pour que Tailwind les génère).
const HEATING_OPTIONS = [
  {
    value: "Fioul",
    label: "Fioul",
    icon: Droplet,
    style: "border-orange-300 bg-orange-50 hover:border-orange-500 hover:bg-orange-100 dark:bg-orange-950/30 dark:border-orange-800",
    iconStyle: "text-orange-500",
  },
  {
    value: "Gaz",
    label: "Gaz",
    icon: Flame,
    style: "border-sky-300 bg-sky-50 hover:border-sky-500 hover:bg-sky-100 dark:bg-sky-950/30 dark:border-sky-800",
    iconStyle: "text-sky-500",
  },
  {
    value: "Autre",
    label: "Autre",
    icon: HelpCircle,
    style: "border-violet-300 bg-violet-50 hover:border-violet-500 hover:bg-violet-100 dark:bg-violet-950/30 dark:border-violet-800",
    iconStyle: "text-violet-500",
  },
];

const INITIAL_CALLBACK: CallbackRequest = {
  firstName: "",
  lastName: "",
  phone: "",
  postalCode: "",
  currentHeating: "",
  company: "",
};

const inputClass =
  "w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-[#2b5a8f] focus:ring-2 focus:ring-[#2b5a8f]/15 outline-none transition-colors";

// Point d'entrée de la landing : une question (chauffage), puis le choix le
// plus simple possible — appeler, être rappelé, ou faire la simulation
// complète. Beaucoup de visiteurs mobiles abandonnent devant un formulaire
// en plusieurs étapes ; ici, un clic suffit pour entrer en contact.
const QuickStart = ({ source }: { source: string }) => {
  const [heating, setHeating] = useState("");
  const [mode, setMode] = useState<"" | "rappel" | "simulation">("");
  const [form, setForm] = useState<CallbackRequest>(INITIAL_CALLBACK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (mode === "simulation") {
    return <Simulator source={source} tone="pro" initialHeating={heating} />;
  }

  const trackCall = () => {
    try {
      if (!source.startsWith("reactivation"))
        (window as any).fbq?.("track", "Contact", { content_category: source });
    } catch {
      /* sans effet sur l'appel */
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = "Indiquez votre prénom.";
    if (!form.lastName.trim()) next.lastName = "Indiquez votre nom.";
    if (!FRENCH_PHONE_REGEX.test(form.phone.trim()))
      next.phone = "Numéro de téléphone invalide.";
    if (!/^\d{5}$/.test(form.postalCode.trim()))
      next.postalCode = "Code postal à 5 chiffres.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      await submitCallbackRequest({ ...form, currentHeating: heating }, `${source}-rappel`);
      setDone(true);
    } catch {
      setErrors({ submit: "Une erreur est survenue. Appelez-nous au 07 49 52 52 67." });
    } finally {
      setSubmitting(false);
    }
  };

  const card =
    "bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200 dark:border-slate-800 p-6 md:p-8 text-left";

  if (done) {
    return (
      <div className={`${card} text-center`}>
        <CheckCircle2 className="mx-auto mb-4 text-green-500" size={48} />
        <h3 className="text-2xl font-bold text-[#0f2a47] dark:text-white mb-2">
          Merci {form.firstName.trim()} !
        </h3>
        <p className="text-gray-600 dark:text-slate-300">
          Votre demande est bien reçue. Un conseiller IP5 Énergie vous rappelle
          très rapidement.
        </p>
      </div>
    );
  }

  if (!heating) {
    return (
      <div className={card}>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#2b5a8f] dark:text-blue-300 mb-2">
          <span className="lg:hidden">Jusqu'à 100 % d'aides pour votre pompe à chaleur</span>
          <span className="hidden lg:inline">Question rapide</span>
        </p>
        <h3 className="text-2xl font-bold text-[#0f2a47] dark:text-white mb-6">
          Vous chauffez votre logement au :
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {HEATING_OPTIONS.map(({ value, label, icon: Icon, style, iconStyle }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setHeating(value);
                trackStep(source, 1, { currentHeating: value });
              }}
              className={`flex flex-col items-center gap-2 py-5 rounded-xl border-2 font-semibold text-gray-900 dark:text-white transition-colors ${style}`}
            >
              <Icon size={30} className={iconStyle} />
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "rappel") {
    return (
      <form onSubmit={submit} className={card} noValidate>
        <button
          type="button"
          onClick={() => setMode("")}
          className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-4"
        >
          <ArrowLeft size={16} /> Retour
        </button>
        <h3 className="text-2xl font-bold text-[#0f2a47] dark:text-white mb-5">
          On vous rappelle
        </h3>
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          className="hidden"
          aria-hidden="true"
        />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                className={inputClass}
                placeholder="Prénom"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
              {errors.firstName && <p className="text-red-600 text-xs mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <input
                className={inputClass}
                placeholder="Nom"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
              {errors.lastName && <p className="text-red-600 text-xs mt-1">{errors.lastName}</p>}
            </div>
          </div>
          <div>
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              placeholder="Téléphone"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
          </div>
          <div>
            <input
              className={inputClass}
              inputMode="numeric"
              maxLength={5}
              placeholder="Code postal"
              autoComplete="postal-code"
              value={form.postalCode}
              onChange={(e) =>
                setForm({ ...form, postalCode: e.target.value.replace(/\D/g, "") })
              }
            />
            {errors.postalCode && <p className="text-red-600 text-xs mt-1">{errors.postalCode}</p>}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
            En cliquant sur « Être rappelé(e) », j'accepte d'être recontacté(e) par IP5 Énergie au
            sujet de ma demande. Mes données ne sont jamais revendues et je peux exercer mes droits
            (accès, rectification, suppression) à tout moment.
          </p>
          {errors.submit && <p className="text-red-600 text-sm">{errors.submit}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#173a5e] hover:bg-[#122f4d] text-white py-4 rounded-lg font-semibold text-lg shadow-md transition-colors disabled:opacity-60"
          >
            {submitting ? "Envoi…" : "Être rappelé(e)"}
          </button>
        </div>
      </form>
    );
  }

  // La simulation est le choix principal : seul bloc encadré, en grand.
  // Rappel puis appel viennent ensuite, en simples lignes sans cadre.
  const secondary =
    "w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors";
  return (
    <div className={card}>
      <button
        type="button"
        onClick={() => setHeating("")}
        className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft size={16} /> Chauffage : {heating}
      </button>
      <h3 className="text-2xl font-bold text-[#0f2a47] dark:text-white mb-5">
        Comment souhaitez-vous avancer ?
      </h3>
      <button
        type="button"
        onClick={() => setMode("simulation")}
        className="w-full text-left rounded-xl border-2 border-[#173a5e] bg-slate-50 dark:bg-slate-800 p-5 shadow-md hover:shadow-lg hover:bg-blue-50 dark:hover:bg-slate-700 transition-all"
      >
        <span className="flex items-center gap-4">
          <span className="flex-shrink-0 w-14 h-14 rounded-lg bg-[#173a5e] text-white flex items-center justify-center">
            <Calculator size={30} />
          </span>
          <span>
            <span className="block text-xl font-bold text-[#0f2a47] dark:text-white leading-tight">
              Faire la simulation
            </span>
            <span className="block text-sm text-gray-600 dark:text-slate-300 mt-0.5">
              2 minutes · gratuite · vos aides en détail
            </span>
          </span>
        </span>
        <span className="mt-4 flex items-center justify-center gap-2 w-full rounded-lg bg-[#173a5e] text-white font-semibold py-3">
          Commencer la simulation <ArrowRight size={18} />
        </span>
      </button>
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-gray-400 mt-5 mb-1">
        ou
      </p>
      <button type="button" onClick={() => setMode("rappel")} className={secondary}>
        <Clock className="text-[#2b5a8f] dark:text-blue-400 flex-shrink-0" size={22} />
        <span>
          <span className="block font-semibold text-[#0f2a47] dark:text-white">
            Être rappelé(e) rapidement
          </span>
          <span className="block text-sm text-gray-500 dark:text-slate-400">
            Laissez votre numéro, un conseiller vous rappelle
          </span>
        </span>
      </button>
      <a href="tel:+33749525267" onClick={trackCall} className={secondary}>
        <Phone className="text-[#2b5a8f] dark:text-blue-400 flex-shrink-0" size={22} />
        <span>
          <span className="block font-semibold text-[#0f2a47] dark:text-white">
            Appeler maintenant
          </span>
          <span className="block text-sm text-gray-500 dark:text-slate-400">
            07 49 52 52 67
          </span>
        </span>
      </a>
    </div>
  );
};


// Preuve par l'image juste sous le hero : le vrai chantier avant / après est
// ce qui rassure le plus un visiteur venu d'une pub. Remplace, sur cette
// page, la longue section « Nos réalisations » placée plus bas.
const CHANTIER_DETAILS = [
  { src: "unite-exterieure.jpg", alt: "Unité extérieure de la pompe à chaleur posée sur plot béton", caption: "Unité extérieure" },
  { src: "detail-module-hydraulique.jpg", alt: "Détail du module hydraulique", caption: "Module intérieur" },
  { src: "tableau-electrique-etiquete.jpg", alt: "Tableau électrique dédié et étiqueté", caption: "Tableau dédié" },
  { src: "coffret-securite-exterieur.jpg", alt: "Coffret de coupure extérieur aux normes", caption: "Coffret de coupure" },
];

const ChantierPreuve = () => (
  <section className="py-14 lg:py-20 bg-white dark:bg-slate-950">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#2b5a8f] dark:text-blue-300 mb-2">Nos réalisations</p>
        <h2 className="text-2xl md:text-3xl font-bold text-[#0f2a47] dark:text-white">
          Un vrai chantier IP5 Énergie
        </h2>
        <p className="text-slate-600 dark:text-slate-300 mt-2">
          Remplacement d'une chaudière fioul par une pompe à chaleur air/eau.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        {[
          { src: "avant-ancienne-chaudiere.jpg", alt: "Ancienne chaudière fioul avant remplacement", label: "Avant", badge: "bg-red-600" },
          { src: "interieur-pac-ballon.jpg", alt: "Pompe à chaleur et ballon d'eau chaude installés", label: "Après", badge: "bg-green-600" },
        ].map((photo) => (
          <figure key={photo.src} className="relative rounded-xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-800">
            <img
              src={`/images/realisations/${photo.src}`}
              alt={photo.alt}
              className="w-full h-56 sm:h-80 object-cover"
              loading="lazy"
            />
            <span className={`absolute top-3 left-3 ${photo.badge} text-white text-xs sm:text-sm font-semibold uppercase tracking-wide px-3 py-1 rounded-md shadow`}>
              {photo.label}
            </span>
          </figure>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-4 mt-3 sm:mt-6">
        {CHANTIER_DETAILS.map((photo) => (
          <figure key={photo.src} className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <img
              src={`/images/realisations/${photo.src}`}
              alt={photo.alt}
              className="w-full h-20 sm:h-36 object-cover"
              loading="lazy"
            />
            <figcaption className="text-[10px] sm:text-xs text-gray-600 dark:text-slate-300 px-1.5 py-1.5 text-center leading-tight">
              {photo.caption}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="text-center mt-8">
        <button
          onClick={scrollToSimulateur}
          className="inline-flex items-center gap-2.5 bg-[#173a5e] hover:bg-[#122f4d] text-white font-semibold px-7 py-3.5 rounded-lg shadow-md transition-colors"
        >
          Vérifier mes aides <ArrowRight size={18} />
        </button>
      </div>
    </div>
  </section>
);

const CampagnePAC = ({ source = "landing-pac-meta" }: { source?: string; params?: unknown } = {}) => {
  return (
    <PageLayout
      title="Pompe à chaleur : vérifiez vos aides 2026 — IP5 Énergie"
      hideFloatingWhileVisible="simulateur"
    >
      {/* ── HERO calé sur l'annonce : angle AIDES + ÉLIGIBILITÉ ──
          Même présentation sobre que la page d'accueil (fond gris clair,
          bleu nuit, identité de l'entreprise). */}
      <section className="relative pt-24 pb-14 lg:pt-40 lg:pb-24 overflow-hidden bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Mobile : la question rapide en tout premier, puis le titre et le
              texte. Ordinateur : texte à gauche, question à droite. */}
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-x-14 lg:gap-y-0">
            <div className="order-2 lg:order-none lg:col-span-6 lg:col-start-1 lg:row-start-1 lg:self-end text-center lg:text-left">
              <div className="hidden lg:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-white dark:bg-slate-900 text-[#173a5e] dark:text-blue-200 font-semibold text-sm mb-6 border border-slate-200 dark:border-slate-700">
                <ShieldCheck size={16} className="text-[#2b5a8f] dark:text-blue-300" /> Aides 2026 : MaPrimeRénov' et prime CEE
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.12] lg:mb-6 text-[#0f2a47] dark:text-white">
                Jusqu'à <span className="text-[#2b5a8f] dark:text-blue-300">100&nbsp;% d'aides</span> pour votre pompe à chaleur
              </h1>
            </div>

            <div id="simulateur" className="order-1 lg:order-none lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:row-span-2 lg:self-center relative scroll-mt-28">
              <QuickStart source={source} />
            </div>

            <div className="order-3 lg:order-none lg:col-span-6 lg:col-start-1 lg:row-start-2 lg:self-start text-center lg:text-left">
              <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Remplacez votre ancienne chaudière et divisez votre facture de
                chauffage. Avec{" "}
                <b className="font-semibold text-slate-800 dark:text-slate-100">MaPrimeRénov'</b> et la{" "}
                <b className="font-semibold text-slate-800 dark:text-slate-100">prime CEE</b> cumulées,
                découvrez en 2 minutes le montant d'aides auquel vous avez droit.
              </p>

              <div className="hidden lg:flex gap-3 justify-start">
                <a
                  href="#simulateur"
                  onClick={scrollToSimulateur}
                  className="inline-flex items-center justify-center gap-2.5 bg-[#173a5e] hover:bg-[#122f4d] text-white px-7 py-3.5 rounded-lg font-semibold text-base shadow-md transition-colors"
                >
                  Vérifier mes aides gratuitement <ArrowRight size={18} />
                </a>
                <a
                  href="tel:+33749525267"
                  className="inline-flex items-center justify-center gap-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-[#173a5e] dark:text-blue-200 px-7 py-3.5 rounded-lg font-semibold text-base border border-slate-300 dark:border-slate-600 transition-colors"
                >
                  <Phone size={18} /> 07 49 52 52 67
                </a>
              </div>
              <p className="lg:mt-5 flex items-center gap-x-5 gap-y-1 flex-wrap justify-center lg:justify-start text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-[#2b5a8f] dark:text-blue-300" size={16} /> 100&nbsp;% gratuit
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="text-[#2b5a8f] dark:text-blue-300" size={16} /> 2 minutes
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="text-[#2b5a8f] dark:text-blue-300" size={16} /> Sans engagement
                </span>
              </p>

              {/* Identité de l'entreprise, comme sur l'accueil. */}
              <div className="hidden lg:flex mt-9 pt-6 border-t border-slate-200 dark:border-slate-800 items-start gap-3 text-left">
                <Building2 size={20} className="mt-0.5 text-[#2b5a8f] dark:text-blue-300 shrink-0" />
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">IP5 CONSEILS</span> — société française, siège à Paris
                  <br />
                  SIREN 890 293 277 · Certifiée RGE QualiPAC
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gages de confiance */}
      <TrustBar />

      {/* Preuve par l'image : le vrai chantier, tout de suite */}
      <ChantierPreuve />

      {/* Pourquoi la pompe à chaleur */}
      <AvantagesSection />

      {/* Le cœur de l'annonce : les aides détaillées */}
      <AidesSection />

      {/* Avis clients */}
      <AvisSection />

      {/* ── FAQ : lève les objections avant l'appel ── */}
      <section className="py-20 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#2b5a8f] dark:text-blue-300 mb-2">Vos questions</p>
            <h2 className="text-3xl font-bold text-[#0f2a47] dark:text-white mb-3">
              Tout ce que vous vous demandez
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Les réponses aux questions les plus fréquentes avant de se lancer.
            </p>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final : reste sur la page, renvoie au simulateur ── */}
      <section className="py-20 bg-white dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-[#173a5e] rounded-2xl px-8 py-14 md:p-16 text-center text-white overflow-hidden shadow-xl">
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-white/10 border border-white/20 text-white font-semibold text-sm mb-6">
                <ShieldCheck size={16} /> Installateur certifié RGE QualiPAC
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
                Découvrez vos aides en 2 minutes
              </h2>
              <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
                Estimation gratuite et sans engagement. Un expert IP5 Énergie
                vous rappelle pour valider votre éligibilité et chiffrer votre
                projet.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="#simulateur"
                  onClick={scrollToSimulateur}
                  className="inline-flex items-center justify-center gap-2.5 bg-white text-[#173a5e] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-slate-100 transition-colors shadow-md"
                >
                  Vérifier mes aides <ArrowRight size={20} />
                </a>
                <a
                  href="tel:+33749525267"
                  className="inline-flex items-center justify-center gap-2 bg-transparent border border-white/40 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors"
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

export default CampagnePAC;
