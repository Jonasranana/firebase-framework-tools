import React, { useState } from "react";
import {
  Sun,
  Droplets,
  Leaf,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronDown,
  Phone,
  Sparkles,
  Gift,
} from "lucide-react";
import {
  PageLayout,
  Simulator,
  TrustBar,
  AidesSection,
  AvisSection,
} from "./ip5-sections";

// ─────────────────────────────────────────────────────────────────────────
// LANDING PAGE DÉDIÉE — Campagne panneaux solaires thermiques (chauffe-eau
// solaire). Route : /solaire (alias /chauffe-eau-solaire).
//
// Même mécanique que la landing PAC (/pac) : hero calé sur l'angle « eau
// chaude gratuite + aides », simulateur de captation réutilisé, leads
// enregistrés dans la même collection Firestore « ip5_leads » avec la
// source « landing-solaire-insta » (distincte de la PAC), et l'événement
// Meta Pixel « Lead » déclenché à la soumission.
// ─────────────────────────────────────────────────────────────────────────

const scrollToSimulateur = (e: React.MouseEvent) => {
  e.preventDefault();
  document
    .getElementById("simulateur")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
};

// Points forts du chauffe-eau solaire (3 cartes).
const AVANTAGES = [
  {
    icon: Sun,
    title: "Jusqu'à 70% d'eau chaude gratuite",
    text: "Le soleil chauffe votre eau toute l'année. Une grande partie de votre eau chaude devient gratuite, sans rien faire.",
  },
  {
    icon: Leaf,
    title: "Énergie 100% renouvelable",
    text: "Fini le gaz ou l'électricité pour l'eau chaude : vous utilisez une énergie propre, gratuite et inépuisable.",
  },
  {
    icon: Droplets,
    title: "Facture d'eau chaude réduite",
    text: "L'eau chaude représente une grosse part de la facture. Le solaire la fait fondre, dès le premier été.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Ça marche même en hiver ou par temps nuageux ?",
    a: "Oui. Le chauffe-eau solaire produit de l'eau chaude toute l'année, même par ciel couvert (le rayonnement passe à travers les nuages). Un appoint (électrique ou votre chauffage) prend le relais quand il y a moins de soleil : vous ne manquez jamais d'eau chaude.",
  },
  {
    q: "Combien coûte un chauffe-eau solaire, aides déduites ?",
    a: "Tout dépend de votre logement et de vos revenus. Avec MaPrimeRénov' et la prime CEE cumulées, le reste à charge est fortement réduit. Le simulateur vous donne une première estimation gratuite, et un conseiller la valide ensuite avec vous.",
  },
  {
    q: "Quelles aides pour un chauffe-eau solaire ?",
    a: "Le chauffe-eau solaire individuel est éligible à MaPrimeRénov' et aux Certificats d'Économie d'Énergie (CEE). Nous montons les dossiers pour vous, et les aides sont déduites de votre devis : pas d'avance de trésorerie.",
  },
  {
    q: "Le simulateur m'engage-t-il à quelque chose ?",
    a: "Non. Il est 100% gratuit et sans engagement. Vous obtenez une estimation de vos aides, et nous vous rappelons simplement pour affiner votre projet.",
  },
  {
    q: "Combien de temps dure l'installation ?",
    a: "En général 1 à 2 jours. Nous nous occupons de tout, de l'étude à la pose, avec un seul interlocuteur.",
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

const CampagneSolaire = () => {
  return (
    <PageLayout title="Chauffe-eau solaire : vérifiez vos aides — IP5 Énergie">
      {/* ── HERO : angle « eau chaude gratuite grâce au soleil » ── */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden bg-white dark:bg-slate-950">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[30rem] h-[30rem] rounded-full bg-amber-50 dark:bg-amber-900/20 blur-3xl opacity-70"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-50 dark:bg-blue-900/20 blur-3xl opacity-70"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-6 mb-12 lg:mb-0 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold text-sm mb-6 border border-amber-100 dark:border-amber-900 shadow-sm">
                <Gift size={16} /> Aides 2026 ouvertes — vérifiez votre montant
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6 text-gray-900 dark:text-white">
                Votre eau chaude,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-400 dark:to-orange-400">
                  gratuite
                </span>{" "}
                grâce au soleil
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Installez un <b>chauffe-eau solaire</b> et couvrez jusqu'à 70% de
                vos besoins en eau chaude gratuitement. Avec{" "}
                <b>MaPrimeRénov'</b> et la <b>prime CEE</b>, découvrez en 2
                minutes le montant d'aides auquel vous avez droit.
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
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-100 to-blue-50 transform rotate-3 rounded-[3rem] blur-lg opacity-50"></div>
              <div className="relative">
                <Simulator source="landing-solaire-insta" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gages de confiance */}
      <TrustBar />

      {/* Pourquoi le chauffe-eau solaire */}
      <section className="py-24 bg-gray-50 dark:bg-slate-950 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-100/40 dark:bg-amber-900/20 blur-3xl"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5 border bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900">
              <Sun size={14} /> Les avantages
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
              Pourquoi passer au{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-400 dark:to-orange-400">
                chauffe-eau solaire
              </span>{" "}
              ?
            </h2>
            <p className="text-xl text-gray-600 dark:text-slate-300">
              Une eau chaude économique et écologique, offerte par le soleil.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {AVANTAGES.map((a) => (
              <div
                key={a.title}
                className="group flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-8 md:p-9 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border border-amber-100 dark:border-amber-900 text-amber-600 dark:text-amber-300 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
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

      {/* Les aides détaillées */}
      <AidesSection />

      {/* Avis clients */}
      <AvisSection />

      {/* ── FAQ solaire ── */}
      <section className="py-24 bg-gray-50 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5 border bg-blue-50 dark:bg-blue-950/50 text-[#2b5a8f] dark:text-blue-300 border-blue-100 dark:border-blue-900">
              <Droplets size={14} /> Vos questions
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
              Tout ce que vous vous demandez
            </h2>
            <p className="text-xl text-gray-600 dark:text-slate-300">
              Les réponses aux questions les plus fréquentes sur le chauffe-eau
              solaire.
            </p>
          </div>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-20 bg-white dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-gradient-to-br from-[#173a5e] via-[#2b5a8f] to-[#122f4d] rounded-[2.5rem] px-8 py-14 md:p-16 text-center text-white overflow-hidden shadow-2xl">
            <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-amber-400/20 blur-3xl"></div>
            <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-cyan-400/15 blur-3xl"></div>
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white font-bold text-sm mb-6">
                <ShieldCheck size={16} /> Installateur certifié RGE — France
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

export default CampagneSolaire;
