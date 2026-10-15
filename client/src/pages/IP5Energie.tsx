import React from "react";
import { ShieldCheck, CheckCircle2, ArrowRight, Award, Phone, Building2, ClipboardCheck, Home, FileText, Wrench } from "lucide-react";
import {
  PageLayout,
  Simulator,
  TrustBar,
  AvantagesSection,
  VideoSection,
  FinalCTA,
  Reveal,
} from "./ip5-sections";

// Page d'accueil d'IP5 Énergie : accroche + simulateur (capture de leads),
// gages de confiance, avantages de la pompe à chaleur, et raccourcis vers les
// pages détaillées (nos pompes à chaleur, aides de l'État, réalisations).
const IP5Energie = () => {
  return (
    <PageLayout title="IP5 Énergie — Pompes à chaleur, jusqu'à 100% d'aides">
      {/* Hero Section : sobre, factuel, orienté confiance */}
      <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-24 overflow-hidden bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-6 mb-12 lg:mb-0 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-white dark:bg-slate-900 text-[#173a5e] dark:text-blue-200 font-semibold text-sm mb-6 border border-slate-200 dark:border-slate-700">
                <ShieldCheck size={16} className="text-[#2b5a8f] dark:text-blue-300" /> Installateur certifié RGE QualiPAC
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.12] mb-6 text-[#0f2a47] dark:text-white">
                Votre pompe à chaleur, de l'étude à la mise en service, avec jusqu'à 100&nbsp;% d'aides
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                IP5 Énergie étudie votre projet, prépare vos dossiers{" "}
                <b className="font-semibold text-slate-800 dark:text-slate-100">MaPrimeRénov'</b> et{" "}
                <b className="font-semibold text-slate-800 dark:text-slate-100">CEE</b>, puis fait installer votre pompe à chaleur
                par des artisans certifiés RGE. Un seul interlocuteur du début à la fin.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <a
                  href="#simulateur"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById("simulateur")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="inline-flex items-center justify-center gap-2.5 bg-[#173a5e] hover:bg-[#122f4d] text-white px-7 py-3.5 rounded-lg font-semibold text-base shadow-md transition-colors"
                >
                  Estimer mes aides gratuitement <ArrowRight size={18} />
                </a>
                <a
                  href="tel:+33749525267"
                  className="inline-flex items-center justify-center gap-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-[#173a5e] dark:text-blue-200 px-7 py-3.5 rounded-lg font-semibold text-base border border-slate-300 dark:border-slate-600 transition-colors"
                >
                  <Phone size={18} /> 07 49 52 52 67
                </a>
              </div>
              <p className="mt-5 flex items-center gap-x-5 gap-y-1 flex-wrap justify-center lg:justify-start text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-[#2b5a8f] dark:text-blue-300" size={16} /> Étude gratuite
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-[#2b5a8f] dark:text-blue-300" size={16} /> Sans engagement
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-[#2b5a8f] dark:text-blue-300" size={16} /> Rappel par un conseiller
                </span>
              </p>

              {/* Identité de l'entreprise : rassure par des faits vérifiables. */}
              <div className="mt-9 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-start gap-3 justify-center lg:justify-start text-left">
                <Building2 size={20} className="mt-0.5 text-[#2b5a8f] dark:text-blue-300 shrink-0" />
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">IP5 CONSEILS</span> — société française, siège à Paris
                  <br />
                  SIREN 890 293 277 · Certifiée RGE QualiPAC
                </p>
              </div>
            </div>

            <div id="simulateur" className="lg:col-span-6 relative scroll-mt-28">
              <Simulator tone="pro" />
            </div>
          </div>
        </div>
      </section>

      {/* Bande de confiance */}
      <TrustBar />

      {/* Déroulé d'un projet : rassure sur ce qui se passe après la demande */}
      <Reveal>
        <section className="py-20 bg-white dark:bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-sm font-semibold uppercase tracking-wider text-[#2b5a8f] dark:text-blue-300 mb-2">Notre méthode</p>
              <h2 className="text-3xl font-bold text-[#0f2a47] dark:text-white mb-3">Un projet suivi de A à Z</h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                Vous n'avez pas à gérer les dossiers ni à chercher un artisan : nous coordonnons chaque étape.
              </p>
            </div>
            <ol className="grid md:grid-cols-4 gap-6">
              {[
                { icon: ClipboardCheck, title: "Étude de votre projet", text: "Vous répondez à quelques questions. Un conseiller vous rappelle pour vérifier votre éligibilité aux aides." },
                { icon: Home, title: "Visite technique", text: "Un professionnel étudie votre logement et définit la pompe à chaleur adaptée à vos besoins." },
                { icon: FileText, title: "Dossiers d'aides", text: "Nous montons vos dossiers MaPrimeRénov' et CEE. Les aides sont déduites de votre devis." },
                { icon: Wrench, title: "Installation certifiée", text: "La pose est réalisée par un artisan certifié RGE, puis nous restons votre interlocuteur." },
              ].map((step, i) => (
                <li key={step.title} className="relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="w-10 h-10 rounded-lg bg-[#173a5e] text-white flex items-center justify-center">
                      <step.icon size={20} />
                    </span>
                    <span className="text-sm font-semibold text-slate-400">0{i + 1}</span>
                  </div>
                  <h3 className="text-base font-semibold text-[#0f2a47] dark:text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </Reveal>

      {/* Avantages de la pompe à chaleur */}
      <Reveal>
        <AvantagesSection />
      </Reveal>

      {/* Vidéos pédagogiques : la PAC et les aides expliquées */}
      <Reveal>
        <VideoSection />
      </Reveal>

      {/* Raccourcis vers les pages détaillées */}
      <Reveal>
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
                visual: "marques",
              },
              {
                href: "/aides",
                title: "Les aides de l'État",
                text: "MaPrimeRénov', CEE : jusqu'à 100% de votre installation financée, démarches gérées de A à Z.",
                cta: "Comprendre les aides",
                visual: "aides",
              },
              {
                href: "/realisations",
                title: "Nos réalisations",
                text: "Avant / après et détails de nos chantiers, pour voir comment nous travaillons.",
                cta: "Voir nos chantiers",
                visual: "realisations",
              },
            ].map((card) => (
              <a
                key={card.href}
                href={card.href}
                className="group flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                <div className="h-44 overflow-hidden bg-slate-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800">
                  {card.visual === "marques" && (
                    // Les marques de pompes à chaleur : logos sur plaques blanches (lisibles aussi en mode sombre).
                    <div className="grid grid-cols-3 gap-2 p-3 h-full">
                      {["daikin.png", "atlantic.png", "dedietrich.png", "tcl.png", "blaupunkt.png", "aux.png"].map((logo) => (
                        <div key={logo} className="bg-white rounded-lg flex items-center justify-center p-2 border border-slate-100">
                          <img src={`/images/marques/${logo}`} alt="" className="max-h-9 max-w-full object-contain" loading="lazy" />
                        </div>
                      ))}
                    </div>
                  )}
                  {card.visual === "aides" && (
                    <div className="h-full flex items-center justify-center gap-5 px-5">
                      <div className="bg-white rounded-xl border border-slate-100 flex items-center justify-center h-24 flex-1 px-3">
                        <img src="/images/aides/maprimerenov.png" alt="MaPrimeRénov'" className="max-h-14 max-w-full object-contain" loading="lazy" />
                      </div>
                      <div className="bg-white rounded-xl border border-slate-100 flex items-center justify-center h-24 flex-1 px-3">
                        <img src="/images/aides/cee.png" alt="Certificats d'économies d'énergie" className="max-h-16 max-w-full object-contain" loading="lazy" />
                      </div>
                    </div>
                  )}
                  {card.visual === "realisations" && (
                    <div className="grid grid-cols-2 grid-rows-2 gap-1 h-full">
                      {["avant-ancienne-chaudiere.jpg", "interieur-pac-ballon.jpg", "unite-exterieure.jpg", "tableau-electrique-etiquete.jpg"].map((photo) => (
                        <img key={photo} src={`/images/realisations/${photo}`} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ))}
                    </div>
                  )}
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
      </Reveal>

      {/* Bandeau d'appel à l'action final */}
      <Reveal>
        <FinalCTA />
      </Reveal>
    </PageLayout>
  );
};

export default IP5Energie;
