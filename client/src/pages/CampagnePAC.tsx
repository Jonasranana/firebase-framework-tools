import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  ChevronDown,
  ArrowRight,
  BadgeCheck,
  Droplet,
  Flame,
  HelpCircle,
  ArrowLeft,
  Calculator,
  HandCoins,
  Lock,
  Sparkles,
  Users,
} from "lucide-react";
import {
  PageLayout,
  Simulator,
  AvantagesSection,
  AidesSection,
  AvisSection,
  FinalCTA,
  SectionHead,
  GLASS_CSS,
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
    a: "Non. Il est 100 % gratuit et sans engagement. Vous obtenez une estimation de vos aides, et nous vous rappelons simplement pour affiner votre projet. Vous restez libre à chaque étape.",
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
    <div className="border border-slate-200/80 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
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

// Une couleur par énergie, au style des tuiles du simulateur.
const HEATING_OPTIONS = [
  { value: "Fioul", label: "Fioul", icon: Droplet, tint: "from-amber-300 to-amber-500" },
  { value: "Gaz", label: "Gaz", icon: Flame, tint: "from-[#4a7fc1] to-[#1d4e89]" },
  { value: "Autre", label: "Autre", icon: HelpCircle, tint: "from-slate-400 to-slate-600" },
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
  "w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[16px] text-gray-900 dark:text-white placeholder:text-slate-400 focus:border-[#2b5a8f] focus:ring-4 focus:ring-[#2b5a8f]/10 outline-none transition-colors";

// Carte au même format que le simulateur (en-tête bleu nuit « Simulateur
// d'aides 2026 ») : le passage de la question rapide au simulateur complet
// se fait sans changement visuel.
const QuickShell = ({
  children,
  onBack,
  badge,
}: {
  children: React.ReactNode;
  onBack?: () => void;
  badge: string;
}) => (
  <div className="ip5-glass rounded-[1.75rem] max-w-md w-full mx-auto overflow-hidden text-left text-white bg-gradient-to-b from-white/[0.14] to-[#0b1a2c]/40 backdrop-blur-2xl border border-white/20 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.25)]">
    <style>{GLASS_CSS}</style>
    <div className="relative bg-white/[0.06] border-b border-white/10 px-5 pt-4 pb-4 text-white">
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" aria-hidden="true"></div>
      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-[13px] font-semibold text-white/80 hover:text-white transition-colors -ml-1 px-1 py-0.5 rounded-lg"
          >
            <ArrowLeft size={16} /> Retour
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold whitespace-nowrap">
            <Sparkles size={15} className="text-amber-300" /> Simulateur d'aides 2026
          </span>
        )}
        <span className="text-[12px] font-semibold text-white/85 bg-white/10 border border-white/15 rounded-full px-2.5 py-0.5 whitespace-nowrap">
          {badge}
        </span>
      </div>
      <p className="mt-3 flex items-center gap-3 text-[11.5px] text-white/80">
        <span className="flex items-center gap-1"><Clock size={12} /> 2 minutes</span>
        <span className="flex items-center gap-1"><CheckCircle2 size={12} /> Gratuit</span>
        <span className="flex items-center gap-1"><ShieldCheck size={12} /> Sans engagement</span>
      </p>
    </div>
    <div className="p-5 sm:p-7">{children}</div>
  </div>
);

// Point d'entrée de la landing : une question (chauffage), puis le choix le
// plus simple possible — simulation, être rappelé ou appeler. Beaucoup de
// visiteurs mobiles abandonnent devant un formulaire en plusieurs étapes ;
// ici, un clic suffit pour entrer en contact.
const QuickStart = ({ source }: { source: string }) => {
  const [heating, setHeating] = useState("");
  const [mode, setMode] = useState<"" | "rappel" | "simulation">("");
  const [form, setForm] = useState<CallbackRequest>(INITIAL_CALLBACK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Maison ou appartement : la pompe à chaleur air/eau ne concerne que les maisons.
  const [housing, setHousing] = useState<"" | "Maison" | "Appartement">("");

  if (mode === "simulation") {
    return <Simulator source={source} tone="pro" initialHeating={heating} glass />;
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
    if (!housing) next.housing = "Indiquez votre type de logement.";
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

  const title = "text-[22px] sm:text-2xl font-extrabold tracking-tight text-[#0f2a47] dark:text-white text-center leading-tight";
  const goldBtn =
    "w-full inline-flex items-center justify-center gap-2.5 rounded-2xl py-4 text-[17px] font-bold text-[#0b1a2c] bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200 shadow-lg shadow-amber-500/25 hover:brightness-105 active:scale-[0.99] transition disabled:opacity-60";

  if (done) {
    return (
      <QuickShell badge="Demande envoyée">
        <div className="text-center py-2">
          <span className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
            <CheckCircle2 className="text-amber-500" size={36} />
          </span>
          <h3 className={title}>Merci {form.firstName.trim()} !</h3>
          <p className="text-slate-600 dark:text-slate-300 mt-2">
            Votre demande est bien reçue. Un conseiller IP5 Énergie vous rappelle très rapidement.
          </p>
        </div>
      </QuickShell>
    );
  }

  if (!heating) {
    return (
      <QuickShell badge="C'est parti !">
        <h3 className={title}>Comment chauffez-vous votre logement&nbsp;?</h3>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-1.5">
          Pour estimer vos aides MaPrimeRénov' et CEE.
        </p>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mt-5">
          {HEATING_OPTIONS.map(({ value, label, icon: Icon, tint }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setHeating(value);
                trackStep(source, 1, { currentHeating: value });
              }}
              className="group flex flex-col items-center gap-3 py-5 sm:py-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all"
            >
              <span className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${tint} text-white flex items-center justify-center shadow-md`}>
                <Icon size={28} />
              </span>
              <span className="font-bold text-[17px] text-[#0f2a47] dark:text-white">{label}</span>
            </button>
          ))}
        </div>
        <p className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-4 text-[12px] font-semibold text-slate-400">
          <span className="flex items-center gap-1"><Lock size={13} /> Données protégées</span>
          <span className="flex items-center gap-1"><BadgeCheck size={13} /> Conseiller RGE</span>
        </p>
      </QuickShell>
    );
  }

  if (mode === "rappel" && housing === "Appartement") {
    return (
      <QuickShell badge="Rappel gratuit" onBack={() => setHousing("")}>
        <div className="text-center py-2">
          <h3 className={title}>Nos installations sont réservées aux maisons</h3>
          <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm">
            Une pompe à chaleur demande de la place à l'extérieur et l'accord de la copropriété : nous ne
            l'installons donc pas en appartement. Merci de votre intérêt !
          </p>
          <button type="button" onClick={() => setHousing("Maison")} className={`${goldBtn} mt-5`}>
            Je me suis trompé, c'est une maison
          </button>
        </div>
      </QuickShell>
    );
  }

  if (mode === "rappel") {
    return (
      <QuickShell badge="Rappel gratuit" onBack={() => setMode("")}>
        <form onSubmit={submit} noValidate>
          <h3 className={title}>On vous rappelle</h3>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-1.5 mb-5">
            Un conseiller vous appelle pour estimer vos aides.
          </p>
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="hidden"
            aria-hidden="true"
          />
          <div className="space-y-3">
            <div>
              <div className="grid grid-cols-2 gap-3">
                {(["Maison", "Appartement"] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => { setHousing(h); setErrors((e) => ({ ...e, housing: "" })); }}
                    className={`rounded-xl border-2 py-3 font-bold text-[15px] transition ${housing === h ? "border-amber-300 bg-amber-50 text-[#0f2a47]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
              {errors.housing && <p className="text-red-600 text-xs mt-1">{errors.housing}</p>}
            </div>
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
                onChange={(e) => setForm({ ...form, postalCode: e.target.value.replace(/\D/g, "") })}
              />
              {errors.postalCode && <p className="text-red-600 text-xs mt-1">{errors.postalCode}</p>}
            </div>
            {errors.submit && <p className="text-red-600 text-sm">{errors.submit}</p>}
            <button type="submit" disabled={submitting} className={goldBtn}>
              {submitting ? "Envoi…" : "Être rappelé(e)"} {!submitting && <ArrowRight size={18} />}
            </button>
            <p className="text-[11.5px] text-slate-400 dark:text-slate-500 leading-relaxed text-center">
              En cliquant sur « Être rappelé(e) », j'accepte d'être recontacté(e) par IP5 Énergie au sujet de ma
              demande. Mes données ne sont jamais revendues et je peux exercer mes droits (accès, rectification,
              suppression) à tout moment.
            </p>
          </div>
        </form>
      </QuickShell>
    );
  }

  // La simulation est le choix principal (bouton doré) ; rappel et appel
  // viennent ensuite, en lignes simples.
  const secondary =
    "w-full flex items-center gap-3.5 px-4 py-3.5 text-left rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors";
  return (
    <QuickShell badge={`Chauffage : ${heating}`} onBack={() => setHeating("")}>
      <h3 className={title}>Comment souhaitez-vous avancer&nbsp;?</h3>
      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-1.5 mb-5">
        Le plus rapide : la simulation, vos aides en détail.
      </p>
      <button type="button" onClick={() => setMode("simulation")} className={goldBtn}>
        <Calculator size={20} /> Calculer mes aides
      </button>
      <div className="flex items-center gap-3 my-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>ou<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
      </div>
      <div className="space-y-2.5">
        <button type="button" onClick={() => setMode("rappel")} className={secondary}>
          <span className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-[#173a5e] dark:text-blue-300 flex items-center justify-center flex-shrink-0">
            <Clock size={19} />
          </span>
          <span className="flex-1">
            <span className="block font-bold text-[#0f2a47] dark:text-white">Être rappelé(e)</span>
            <span className="block text-[13px] text-slate-500 dark:text-slate-400">Un conseiller vous rappelle rapidement</span>
          </span>
          <ArrowRight size={18} className="text-slate-300" />
        </button>
        <a href="tel:+33749525267" onClick={trackCall} className={secondary}>
          <span className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-[#173a5e] dark:text-blue-300 flex items-center justify-center flex-shrink-0">
            <Phone size={19} />
          </span>
          <span className="flex-1">
            <span className="block font-bold text-[#0f2a47] dark:text-white">Appeler maintenant</span>
            <span className="block text-[13px] text-slate-500 dark:text-slate-400">07 49 52 52 67</span>
          </span>
          <ArrowRight size={18} className="text-slate-300" />
        </a>
      </div>
    </QuickShell>
  );
};

// Preuve par l'image juste sous le hero : le vrai chantier avant / après est
// ce qui rassure le plus un visiteur venu d'une pub.
const CHANTIER_DETAILS = [
  { src: "unite-exterieure.jpg", alt: "Unité extérieure de la pompe à chaleur posée sur plot béton", caption: "Unité extérieure" },
  { src: "detail-module-hydraulique.jpg", alt: "Détail du module hydraulique", caption: "Module intérieur" },
  { src: "tableau-electrique-etiquete.jpg", alt: "Tableau électrique dédié et étiqueté", caption: "Tableau dédié" },
  { src: "coffret-securite-exterieur.jpg", alt: "Coffret de coupure extérieur aux normes", caption: "Coffret de coupure" },
];

const ChantierPreuve = () => (
  <section className="py-14 md:py-24 bg-white dark:bg-slate-950">
    <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
      <SectionHead
        kicker="Un chantier récent"
        title="Avant, après : un vrai chantier IP5"
        subtitle="Remplacement d'une chaudière fioul par une pompe à chaleur air/eau."
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        {[
          { src: "avant-ancienne-chaudiere.jpg", alt: "Ancienne chaudière fioul avant remplacement", label: "Avant", badge: "bg-[#0b1a2c]/85 text-white" },
          { src: "interieur-pac-ballon.jpg", alt: "Pompe à chaleur et ballon d'eau chaude installés", label: "Après", badge: "bg-amber-300 text-[#0b1a2c]" },
        ].map((photo) => (
          <figure key={photo.src} className="relative rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800">
            <img
              src={`/images/realisations/${photo.src}`}
              alt={photo.alt}
              className="w-full h-56 sm:h-80 object-cover"
              loading="lazy"
            />
            <span className={`absolute top-3 left-3 ${photo.badge} text-[11px] sm:text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow`}>
              {photo.label}
            </span>
          </figure>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-4 mt-3 sm:mt-6">
        {CHANTIER_DETAILS.map((photo) => (
          <figure key={photo.src} className="rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
            <img
              src={`/images/realisations/${photo.src}`}
              alt={photo.alt}
              className="w-full h-20 sm:h-36 object-cover"
              loading="lazy"
            />
            <figcaption className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-300 px-1.5 py-1.5 text-center leading-tight">
              {photo.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  </section>
);

// Méthode en 4 étapes (frise), comme sur l'accueil.
const METHODE = [
  { title: "Simulation", text: "Vos aides estimées en 2 minutes." },
  { title: "Visite technique", text: "Un conseiller valide votre projet." },
  { title: "Dossiers d'aides", text: "On monte MaPrimeRénov' et CEE." },
  { title: "Installation", text: "Pose par un artisan RGE QualiPAC." },
];

const CampagnePAC = ({ source = "landing-pac-meta" }: { source?: string; params?: unknown } = {}) => {
  return (
    <PageLayout
      title="Pompe à chaleur : vérifiez vos aides 2026 — IP5 Énergie"
      hideFloatingWhileVisible="simulateur"
    >
      {/* ── HERO calé sur l'annonce : angle AIDES. Téléphone : photo + titre,
          puis tout de suite la question rapide. Ordinateur : photo en fond,
          texte à gauche, question à droite (comme l'accueil). ── */}
      <section className="relative pt-16 pb-12 lg:pt-36 lg:pb-24 overflow-hidden bg-[#0b1a2c]">
        <div className="hidden lg:block absolute inset-0" aria-hidden="true">
          <img src="/images/hero-pac.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1a2c] via-[#0b1a2c]/85 to-[#0b1a2c]/40"></div>
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0b1a2c]/80 to-transparent"></div>
        </div>

        <div className="lg:hidden relative h-[250px] overflow-hidden bg-[#0b1a2c]">
          <img
            src="/images/hero-pac.jpg"
            alt="Pompe à chaleur installée par IP5 Énergie"
            className="absolute inset-0 w-full h-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b1a2c]/30 via-[#0b1a2c]/50 to-[#0b1a2c]"></div>
          <div className="absolute inset-x-0 bottom-0 px-5 pb-14 text-white animate-in fade-in slide-in-from-bottom-3 duration-700">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1 text-[12px] font-semibold mb-3">
              <ShieldCheck size={14} className="text-amber-200" /> Aides 2026 : MaPrimeRénov' + CEE
            </span>
            <h1 className="text-[28px] leading-[1.1] font-extrabold tracking-tight drop-shadow-sm">
              Jusqu'à{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200">100&nbsp;% d'aides</span>{" "}
              pour votre pompe à chaleur
            </h1>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 -mt-10 lg:mt-0">
          <div className="lg:grid lg:grid-cols-12 gap-14 items-center">
            <div className="hidden lg:block lg:col-span-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white font-semibold text-sm mb-6 border border-white/20">
                <ShieldCheck size={16} className="text-amber-200" /> Aides 2026 : MaPrimeRénov' et prime CEE
              </div>
              <h1 className="text-[3.4rem] font-extrabold tracking-tight leading-[1.05] mb-6 text-white">
                Jusqu'à{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200">100&nbsp;% d'aides</span>{" "}
                pour votre pompe à chaleur
              </h1>
              <p className="text-xl text-white/80 mb-9 max-w-xl leading-relaxed">
                Remplacez votre ancienne chaudière et divisez votre facture de chauffage. Avec{" "}
                <b className="font-semibold text-white">MaPrimeRénov'</b> et la{" "}
                <b className="font-semibold text-white">prime CEE</b> cumulées, découvrez en 2 minutes vos aides.
              </p>
              <div className="flex flex-row gap-3">
                <a
                  href="#simulateur"
                  onClick={scrollToSimulateur}
                  className="inline-flex items-center justify-center gap-2.5 bg-amber-300 hover:bg-amber-200 text-[#0b1a2c] px-7 py-4 rounded-xl font-bold text-base shadow-xl transition-colors"
                >
                  Vérifier mes aides gratuitement <ArrowRight size={18} />
                </a>
                <a
                  href="tel:+33749525267"
                  className="inline-flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-7 py-4 rounded-xl font-semibold text-base border border-white/30 transition-colors"
                >
                  <Phone size={18} /> 07 49 52 52 67
                </a>
              </div>
              <p className="mt-6 flex items-center gap-x-6 gap-y-1.5 flex-wrap text-sm text-white/80">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="text-amber-200" size={16} /> Étude gratuite</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="text-amber-200" size={16} /> Sans engagement</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="text-amber-200" size={16} /> Artisans certifiés RGE</span>
              </p>
            </div>

            <div id="simulateur" className="lg:col-span-6 relative scroll-mt-24">
              <QuickStart source={source} />
            </div>
          </div>

          {/* Téléphone : 3 gages sous le formulaire. */}
          <ul className="lg:hidden mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              { icon: ShieldCheck, label: "Certifié RGE" },
              { icon: HandCoins, label: "Aides déduites du devis" },
              { icon: Users, label: "Entreprise familiale" },
            ].map((g) => (
              <li key={g.label} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-1.5 py-2.5">
                <g.icon size={18} className="text-amber-200" />
                <span className="text-[11.5px] font-semibold leading-tight text-white/85">{g.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Preuve par l'image : le vrai chantier, tout de suite */}
      <ChantierPreuve />

      {/* Pourquoi la pompe à chaleur : bandeau chiffres */}
      <AvantagesSection />

      {/* Méthode : frise en 4 étapes */}
      <section className="py-14 md:py-24 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
          <SectionHead
            kicker="Notre méthode"
            title="Un projet suivi de A à Z"
            subtitle="Un seul interlocuteur, de la simulation à la mise en service."
          />
          <ol className="relative grid gap-7 md:grid-cols-4 md:gap-6">
            <span className="hidden md:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-slate-200 dark:bg-slate-800" aria-hidden="true"></span>
            <span className="md:hidden absolute top-2 bottom-2 left-6 w-px bg-slate-200 dark:bg-slate-800" aria-hidden="true"></span>
            {METHODE.map((m, i) => (
              <li key={m.title} className="relative flex md:flex-col md:items-center md:text-center gap-4">
                <span className="relative z-10 w-12 h-12 flex-shrink-0 rounded-full bg-[#0b1a2c] text-amber-200 font-extrabold text-lg flex items-center justify-center ring-8 ring-white dark:ring-slate-950">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-bold text-[#0f2a47] dark:text-white text-lg">{m.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">{m.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Le cœur de l'annonce : les aides détaillées */}
      <AidesSection />

      {/* Avis clients */}
      <AvisSection />

      {/* ── FAQ : lève les objections avant l'appel ── */}
      <section className="py-14 md:py-24 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHead
            kicker="Vos questions"
            title="Tout ce que vous vous demandez"
            subtitle="Les réponses aux questions les plus fréquentes avant de se lancer."
          />
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final : renvoie au formulaire en haut ── */}
      <FinalCTA href="#simulateur" />
    </PageLayout>
  );
};

export default CampagnePAC;
