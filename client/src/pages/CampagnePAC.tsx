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
} from "lucide-react";
import {
  PageLayout,
  Simulator,
  TrustBar,
  AvantagesSection,
  AidesSection,
  RealisationsSection,
  AvisSection,
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

const CampagnePAC = () => {
  return (
    <PageLayout title="Pompe à chaleur : vérifiez vos aides 2026 — IP5 Énergie">
      {/* ── HERO calé sur l'annonce : angle AIDES + ÉLIGIBILITÉ ── */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden bg-white dark:bg-slate-950">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[30rem] h-[30rem] rounded-full bg-blue-50 dark:bg-blue-900/20 blur-3xl opacity-70"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-green-50 dark:bg-green-900/20 blur-3xl opacity-70"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-6 mb-12 lg:mb-0 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 font-bold text-sm mb-6 border border-green-100 dark:border-green-900 shadow-sm">
                <Gift size={16} /> Aides 2026 ouvertes — vérifiez votre montant
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6 text-gray-900 dark:text-white">
                Jusqu'à{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2b5a8f] to-cyan-500 dark:from-blue-400 dark:to-cyan-400">
                  80% d'aides
                </span>{" "}
                pour votre pompe à chaleur
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Remplacez votre ancienne chaudière et divisez votre facture de
                chauffage. Avec <b>MaPrimeRénov'</b> et la <b>prime CEE</b>{" "}
                cumulées, découvrez en 2 minutes le montant d'aides auquel vous
                avez droit.
              </p>

              <div className="flex justify-center lg:justify-start">
                <a
                  href="#simulateur"
                  onClick={scrollToSimulateur}
                  className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#2b5a8f] to-cyan-500 text-white px-9 py-4 rounded-full font-bold text-lg shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-[1.03] transition-all duration-300"
                >
                  <Sparkles size={22} fill="currentColor" /> Vérifier mes aides
                  gratuitement
                </a>
              </div>
              <p className="mt-5 flex items-center gap-x-5 gap-y-1 flex-wrap justify-center lg:justify-start text-sm text-gray-500 dark:text-slate-400 font-medium">
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

            <div id="simulateur" className="lg:col-span-6 relative scroll-mt-28">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-green-50 transform rotate-3 rounded-[3rem] blur-lg opacity-50"></div>
              <div className="relative">
                <Simulator source="landing-pac-meta" />
              </div>
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
