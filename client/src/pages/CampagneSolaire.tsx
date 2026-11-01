import React, { useState } from "react";
import {
  Sun,
  Droplets,
  Leaf,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import {
  PageLayout,
  Simulator,
  AidesSection,
  AvisSection,
  FinalCTA,
  Kicker,
  SectionHead,
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
      <section className="relative pt-24 pb-14 lg:pt-36 lg:pb-24 overflow-hidden bg-slate-50 dark:bg-slate-950">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-6 mb-12 lg:mb-0 text-center lg:text-left">
              <Kicker>Aides 2026 ouvertes</Kicker>
              <h1 className="text-[32px] md:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight leading-[1.1] mb-5 text-[#0f2a47] dark:text-white">
                Eau chaude &amp; chauffage{" "}
                <span className="text-[#2b5a8f] dark:text-blue-300">solaires</span>
              </h1>
              <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 mb-7 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Des panneaux solaires thermiques pour votre eau chaude{" "}
                <b>et</b> votre chauffage — <b>à partir de 0 €</b> selon
                éligibilité, grâce à <b>MaPrimeRénov'</b> et la{" "}
                <b>prime CEE</b>. Découvrez en 2 minutes le montant d'aides
                auquel vous avez droit.
              </p>

              <div className="flex justify-center lg:justify-start">
                <a
                  href="#simulateur"
                  onClick={scrollToSimulateur}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2.5 bg-[#173a5e] hover:bg-[#122f4d] text-white px-8 py-4 rounded-xl font-bold text-base shadow-lg transition-colors"
                >
                  Vérifier mes aides gratuitement <ArrowRight size={18} />
                </a>
              </div>
              <p className="mt-5 flex items-center gap-x-5 gap-y-1 flex-wrap justify-center lg:justify-start text-sm text-gray-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-[#2b5a8f]" size={16} /> 100%
                  gratuit
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="text-[#2b5a8f]" size={16} /> 2 minutes
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="text-[#2b5a8f]" size={16} /> Sans
                  engagement
                </span>
              </p>
            </div>

            <div id="simulateur" className="lg:col-span-6 relative scroll-mt-28">
              <div className="relative">
                <Simulator source="landing-solaire-insta" />
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Pourquoi le chauffe-eau solaire */}
      <section className="py-14 md:py-24 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
          <SectionHead
            kicker="Les avantages"
            title="Pourquoi passer au chauffe-eau solaire&nbsp;?"
            subtitle="Une eau chaude économique et écologique, offerte par le soleil."
          />
          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            {AVANTAGES.map((a) => (
              <div key={a.title} className="flex md:flex-col gap-4">
                <span className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-[#173a5e] dark:text-blue-300 flex items-center justify-center flex-shrink-0">
                  <a.icon size={22} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-[#0f2a47] dark:text-white">{a.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed mt-1.5">{a.text}</p>
                </div>
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
      <section className="py-14 md:py-24 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHead
            kicker="Vos questions"
            title="Tout ce que vous vous demandez"
            subtitle="Les réponses aux questions les plus fréquentes sur le chauffe-eau solaire."
          />
          <div className="space-y-4">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <FinalCTA href="#simulateur" />
    </PageLayout>
  );
};

export default CampagneSolaire;
