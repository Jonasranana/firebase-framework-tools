import React from "react";
import { ShieldCheck, CheckCircle2, Zap, ArrowRight, Award } from "lucide-react";
import {
  PageLayout,
  Simulator,
  TrustBar,
  AvantagesSection,
  VideoSection,
  FinalCTA,
} from "./ip5-sections";

// Page d'accueil d'IP5 Énergie : accroche + simulateur (capture de leads),
// gages de confiance, avantages de la pompe à chaleur, et raccourcis vers les
// pages détaillées (nos pompes à chaleur, aides de l'État, réalisations).
const IP5Energie = () => {
  return (
    <PageLayout title="IP5 Énergie — Pompes à chaleur, jusqu'à 80% d'aides">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-white dark:bg-slate-950">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[30rem] h-[30rem] rounded-full bg-blue-50 dark:bg-blue-900/20 blur-3xl opacity-70"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-green-50 dark:bg-green-900/20 blur-3xl opacity-70"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-6 mb-12 lg:mb-0 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#2b5a8f] dark:text-blue-300 font-bold text-sm mb-6 border border-blue-100 dark:border-blue-900 shadow-sm">
                <ShieldCheck size={16} /> Installateur Agréé RGE France
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6 text-gray-900 dark:text-white">
                Passez à la pompe à chaleur et coupez vos factures par{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2b5a8f] to-cyan-500 dark:from-blue-400 dark:to-cyan-400">
                  trois
                </span>
                .
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
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
                  <Zap size={22} fill="currentColor" /> Je calcule mes économies
                </a>
              </div>
              <p className="mt-5 flex items-center gap-x-5 gap-y-1 flex-wrap justify-center lg:justify-start text-sm text-gray-500 dark:text-slate-400 font-medium">
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

            <div id="simulateur" className="lg:col-span-6 relative scroll-mt-28">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-green-50 transform rotate-3 rounded-[3rem] blur-lg opacity-50"></div>
              <div className="relative">
                <Simulator />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bande de confiance */}
      <TrustBar />

      {/* Avantages de la pompe à chaleur */}
      <AvantagesSection />

      {/* Vidéos pédagogiques : la PAC et les aides expliquées */}
      <VideoSection />

      {/* Raccourcis vers les pages détaillées */}
      <section className="py-24 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5 border bg-blue-50 dark:bg-blue-950/50 text-[#2b5a8f] dark:text-blue-300 border-blue-100 dark:border-blue-900">
              <Award size={14} /> Découvrir IP5 Énergie
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
              Tout ce qu'il faut savoir sur votre projet
            </h2>
            <p className="text-xl text-gray-600 dark:text-slate-300">
              Nos pompes à chaleur, les aides de l'État et nos chantiers, en
              détail.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                href: "/pompe-a-chaleur",
                title: "Nos pompes à chaleur",
                text: "Les 6 marques que nous installons et comment choisir le bon modèle pour votre logement.",
                cta: "Voir les modèles",
                img: "/images/realisations/interieur-pac-ballon.jpg",
              },
              {
                href: "/aides",
                title: "Les aides de l'État",
                text: "MaPrimeRénov', CEE : jusqu'à 80% de votre installation financée, démarches gérées de A à Z.",
                cta: "Comprendre les aides",
                img: "/images/realisations/unite-exterieure.jpg",
              },
              {
                href: "/realisations",
                title: "Nos réalisations",
                text: "Avant / après, détails de chantier et avis de nos clients partout en France.",
                cta: "Voir nos chantiers",
                img: "/images/realisations/detail-module-hydraulique.jpg",
              },
            ].map((card) => (
              <a
                key={card.href}
                href={card.href}
                className="group flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                <div className="h-44 overflow-hidden">
                  <img
                    src={card.img}
                    alt={card.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    loading="lazy"
                  />
                </div>
                <div className="p-7 flex flex-col flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {card.title}
                  </h3>
                  <p className="text-gray-600 dark:text-slate-300 leading-relaxed mb-5 flex-1">
                    {card.text}
                  </p>
                  <span className="inline-flex items-center gap-2 text-[#2b5a8f] dark:text-blue-400 font-bold group-hover:gap-3 transition-all">
                    {card.cta} <ArrowRight size={18} />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Bandeau d'appel à l'action final */}
      <FinalCTA />
    </PageLayout>
  );
};

export default IP5Energie;
