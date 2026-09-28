import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Gift,
  Clock,
  Phone,
  ChevronDown,
  HandCoins,
  BadgeCheck,
  Sparkles,
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
  RealisationsSection,
  AvisSection,
  FRENCH_PHONE_REGEX,
  submitCallbackRequest,
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
    q: "Intervenez-vous partout en France ?",
    a: "Oui, nous accompagnons des projets partout en France. Nos équipes et partenaires certifiés RGE assurent une installation aux normes, où que vous soyez.",
  },
  {
    q: "Combien puis-je vraiment économiser ?",
    a: "Une pompe à chaleur restitue jusqu'à 4 kWh de chaleur pour 1 kWh d'électricité consommé. En remplacement d'une vieille chaudière fioul ou gaz, la facture de chauffage peut être divisée par deux à trois. L'économie exacte dépend de votre logement.",
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

const HEATING_OPTIONS = [
  { value: "Fioul", label: "Fioul", icon: Droplet },
  { value: "Gaz", label: "Gaz", icon: Flame },
  { value: "Autre", label: "Autre", icon: HelpCircle },
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
  "w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-[#2b5a8f] outline-none transition-colors";

// Point d'entrée de la landing : une question (chauffage), puis le choix le
// plus simple possible — appeler, être rappelé, ou faire la simulation
// complète. Beaucoup de visiteurs mobiles abandonnent devant un formulaire
// en plusieurs étapes ; ici, un clic suffit pour entrer en contact.
const QuickStart = ({ source }: { source: string }) => {
  const [heating, setHeating] = useState("");
  const [mode, setMode] = useState<"" | "rappel" | "simulation">("");
  const [form, setForm] = useState<CallbackRequest>(INITIAL_CALLBACK);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (mode === "simulation") {
    return <Simulator source={source} />;
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
    if (!consent) next.consent = "Vous devez accepter d'être recontacté(e).";
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
    "bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 p-6 md:p-8 text-left";

  if (done) {
    return (
      <div className={`${card} text-center`}>
        <CheckCircle2 className="mx-auto mb-4 text-green-500" size={48} />
        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
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
        <p className="text-sm font-bold text-[#2b5a8f] dark:text-blue-400 mb-1">
          <span className="lg:hidden">Jusqu'à 100 % d'aides pour votre pompe à chaleur</span>
          <span className="hidden lg:inline">Question rapide</span>
        </p>
        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">
          Vous chauffez votre logement au :
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {HEATING_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setHeating(value)}
              className="flex flex-col items-center gap-2 py-5 rounded-2xl border-2 border-gray-200 dark:border-slate-700 hover:border-[#2b5a8f] hover:bg-blue-50 dark:hover:bg-slate-800 font-bold text-gray-900 dark:text-white transition-colors"
            >
              <Icon size={28} className="text-[#2b5a8f] dark:text-blue-400" />
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
        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-5">
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
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 w-4 h-4 accent-[#2b5a8f] flex-shrink-0"
              />
              <span className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
                J'accepte d'être recontacté(e) par IP5 Énergie au sujet de ma
                demande. Mes données ne sont jamais revendues et je peux
                exercer mes droits (accès, rectification, suppression) à tout
                moment.
              </span>
            </label>
            {errors.consent && <p className="text-red-600 text-xs mt-1">{errors.consent}</p>}
          </div>
          {errors.submit && <p className="text-red-600 text-sm">{errors.submit}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#2b5a8f] to-cyan-500 text-white py-4 rounded-full font-bold text-lg shadow-lg disabled:opacity-60"
          >
            {submitting ? "Envoi…" : "Être rappelé(e)"}
          </button>
        </div>
      </form>
    );
  }

  const choice =
    "w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-colors";
  return (
    <div className={card}>
      <button
        type="button"
        onClick={() => setHeating("")}
        className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft size={16} /> Chauffage : {heating}
      </button>
      <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-5">
        Comment souhaitez-vous avancer ?
      </h3>
      <div className="space-y-3">
        <a
          href="tel:+33749525267"
          onClick={trackCall}
          className={`${choice} border-green-500 bg-green-50 dark:bg-green-950/40 hover:bg-green-100`}
        >
          <Phone className="text-green-600 flex-shrink-0" size={26} />
          <span>
            <span className="block font-bold text-gray-900 dark:text-white">
              Appeler maintenant
            </span>
            <span className="block text-sm text-gray-600 dark:text-slate-300">
              07 49 52 52 67
            </span>
          </span>
        </a>
        <button
          type="button"
          onClick={() => setMode("rappel")}
          className={`${choice} border-[#2b5a8f] bg-blue-50 dark:bg-slate-800 hover:bg-blue-100`}
        >
          <Clock className="text-[#2b5a8f] dark:text-blue-400 flex-shrink-0" size={26} />
          <span>
            <span className="block font-bold text-gray-900 dark:text-white">
              Être rappelé(e) rapidement
            </span>
            <span className="block text-sm text-gray-600 dark:text-slate-300">
              Laissez votre numéro, un conseiller vous rappelle
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("simulation")}
          className={`${choice} border-amber-400 hover:border-amber-500`}
        >
          <Calculator className="text-gray-500 flex-shrink-0" size={26} />
          <span>
            <span className="block font-bold text-gray-900 dark:text-white">
              Faire la simulation (2 min)
            </span>
            <span className="block text-sm text-gray-600 dark:text-slate-300">
              Estimez vos aides en détail
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

const CampagnePAC = ({ source = "landing-pac-meta" }: { source?: string; params?: unknown } = {}) => {
  return (
    <PageLayout
      title="Pompe à chaleur : vérifiez vos aides 2026 — IP5 Énergie"
      hideFloatingWhileVisible="simulateur"
    >
      {/* ── HERO calé sur l'annonce : angle AIDES + ÉLIGIBILITÉ ── */}
      <section className="relative pt-24 pb-16 lg:pt-40 lg:pb-28 overflow-hidden bg-white dark:bg-slate-950">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[30rem] h-[30rem] rounded-full bg-blue-50 dark:bg-blue-900/20 blur-3xl opacity-70"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-green-50 dark:bg-green-900/20 blur-3xl opacity-70"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Mobile : la question rapide en tout premier, puis le titre et le
              texte. Ordinateur : texte à gauche, question à droite. */}
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-x-16 lg:gap-y-0">
            <div className="order-2 lg:order-none lg:col-span-6 lg:col-start-1 lg:row-start-1 lg:self-end text-center lg:text-left">
              <div className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 font-bold text-sm mb-6 border border-green-100 dark:border-green-900 shadow-sm">
                <Gift size={16} /> Aides 2026 ouvertes — vérifiez votre montant
              </div>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight lg:mb-6 text-gray-900 dark:text-white">
                Jusqu'à{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2b5a8f] to-cyan-500 dark:from-blue-400 dark:to-cyan-400">
                  100% d'aides
                </span>{" "}
                pour votre pompe à chaleur
              </h1>
            </div>

            <div id="simulateur" className="order-1 lg:order-none lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:row-span-2 lg:self-center relative scroll-mt-28">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-green-50 transform rotate-3 rounded-[3rem] blur-lg opacity-50"></div>
              <div className="relative">
                <QuickStart source={source} />
              </div>
            </div>

            <div className="order-3 lg:order-none lg:col-span-6 lg:col-start-1 lg:row-start-2 lg:self-start text-center lg:text-left">
              <p className="text-lg md:text-xl text-gray-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Remplacez votre ancienne chaudière et divisez votre facture de
                chauffage. Avec <b>MaPrimeRénov'</b> et la <b>prime CEE</b>{" "}
                cumulées, découvrez en 2 minutes le montant d'aides auquel vous
                avez droit.
              </p>

              <div className="hidden lg:flex justify-start">
                <a
                  href="#simulateur"
                  onClick={scrollToSimulateur}
                  className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#2b5a8f] to-cyan-500 text-white px-9 py-4 rounded-full font-bold text-lg shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-[1.03] transition-all duration-300"
                >
                  <Sparkles size={22} fill="currentColor" /> Vérifier mes aides
                  gratuitement
                </a>
              </div>
              <p className="lg:mt-5 flex items-center gap-x-5 gap-y-1 flex-wrap justify-center lg:justify-start text-sm text-gray-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-green-500" size={16} /> 100%
                  gratuit
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="text-green-500" size={16} /> 2 minutes
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="text-green-500" size={16} /> Sans
                  engagement
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Gages de confiance */}
      <TrustBar />

      {/* Pourquoi la pompe à chaleur */}
      <AvantagesSection />

      {/* Le cœur de l'annonce : les aides détaillées */}
      <AidesSection />

      {/* Preuve sociale : chantiers réels */}
      <RealisationsSection />

      {/* Avis clients */}
      <AvisSection />

      {/* ── FAQ : lève les objections avant l'appel ── */}
      <section className="py-24 bg-gray-50 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5 border bg-blue-50 dark:bg-blue-950/50 text-[#2b5a8f] dark:text-blue-300 border-blue-100 dark:border-blue-900">
              <HandCoins size={14} /> Vos questions
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
              Tout ce que vous vous demandez
            </h2>
            <p className="text-xl text-gray-600 dark:text-slate-300">
              Les réponses aux questions les plus fréquentes avant de se lancer.
            </p>
          </div>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final : reste sur la page, renvoie au simulateur ── */}
      <section className="py-20 bg-white dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-gradient-to-br from-[#173a5e] via-[#2b5a8f] to-[#122f4d] rounded-[2.5rem] px-8 py-14 md:p-16 text-center text-white overflow-hidden shadow-2xl">
            <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-cyan-400/20 blur-3xl"></div>
            <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-green-400/15 blur-3xl"></div>
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white font-bold text-sm mb-6">
                <BadgeCheck size={16} /> Installateur certifié RGE — France
                entière
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
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
                  className="inline-flex items-center justify-center gap-2 bg-white text-[#2b5a8f] px-8 py-4 rounded-full font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg"
                >
                  <Sparkles size={20} /> Vérifier mes aides
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

export default CampagnePAC;
