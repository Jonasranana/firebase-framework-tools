import React from "react";
import { ShieldCheck, CheckCircle2, ArrowRight, Award, Phone, Building2, ClipboardCheck, Home, FileText, Wrench, HandCoins, Users } from "lucide-react";
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
      <section className="relative pt-16 pb-10 lg:pt-36 lg:pb-24 overflow-hidden bg-slate-50 dark:bg-slate-950 lg:bg-[#0b1a2c] border-b border-slate-200 dark:border-slate-800 lg:border-0">
        {/* Ordinateur : la photo occupe tout le bandeau, assombrie à gauche
            pour le texte ; le simulateur est posé à droite. */}
        <div className="hidden lg:block absolute inset-0" aria-hidden="true">
          <img src="/images/hero-accueil.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-[60%_30%]" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1a2c] via-[#0b1a2c]/85 to-[#0b1a2c]/35"></div>
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0b1a2c]/80 to-transparent"></div>
        </div>
        {/* Téléphone : grande photo avec le titre posé dessus, comme les sites
            des grands installateurs. Sur ordinateur, la mise en page reste en
            deux colonnes (texte + simulateur). */}
        <div className="lg:hidden relative h-[420px] overflow-hidden bg-[#0b1a2c]">
          <img
            src="/images/hero-accueil.jpg"
            alt="Un couple étudie son projet de rénovation avec un ordinateur"
            className="absolute inset-0 w-full h-full object-cover object-[50%_22%]"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b1a2c]/0 via-[#0b1a2c]/10 to-[#0b1a2c]/95"></div>
          <div className="absolute inset-x-0 bottom-0 px-5 pb-6 text-white animate-in fade-in slide-in-from-bottom-3 duration-700">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1 text-[12px] font-semibold mb-3">
              <ShieldCheck size={14} className="text-emerald-300" /> Installateur certifié RGE QualiPAC
            </span>
            <h1 className="text-[31px] leading-[1.1] font-extrabold tracking-tight drop-shadow-sm">
              Votre pompe à chaleur financée jusqu'à{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200">100&nbsp;%</span>
            </h1>
            <p className="mt-2.5 text-[15px] leading-snug text-white/85">
              Étude, aides et installation&nbsp;: on s'occupe de tout.
            </p>
          </div>
        </div>
        {/* Téléphone : bouton principal visible sans faire défiler + 3 gages. */}
        <div className="lg:hidden px-5 pt-5">
          <a
            href="#simulateur"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("simulateur")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex items-center justify-center gap-2.5 w-full rounded-2xl py-4 text-[17px] font-bold text-white bg-gradient-to-r from-[#173a5e] via-[#2b5a8f] to-[#0e7490] shadow-lg shadow-blue-900/25 active:scale-[0.99] transition-transform"
          >
            Estimer mes aides gratuitement <ArrowRight size={19} />
          </a>
          <ul className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { icon: ShieldCheck, label: "Certifié RGE" },
              { icon: HandCoins, label: "Aides déduites du devis" },
              { icon: Users, label: "Entreprise familiale" },
            ].map((g) => (
              <li key={g.label} className="flex flex-col items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-1.5 py-2.5 dark:bg-slate-900 dark:border-slate-800">
                <g.icon size={18} className="text-[#2b5a8f] dark:text-blue-300" />
                <span className="text-[11.5px] font-semibold leading-tight text-slate-700 dark:text-slate-200">{g.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 relative z-10 pt-8 lg:pt-0">
          <div className="lg:grid lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-6 mb-8 lg:mb-0 text-left">
              <div className="hidden lg:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white font-semibold text-sm mb-6 border border-white/20">
                <ShieldCheck size={16} className="text-emerald-300" /> Installateur certifié RGE QualiPAC
              </div>
              <h1 className="hidden lg:block text-[3.6rem] font-extrabold tracking-tight leading-[1.05] mb-6 text-white">
                Votre pompe à chaleur financée jusqu'à{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200">100&nbsp;%</span>
              </h1>
              <p className="hidden lg:block text-xl text-white/80 mb-9 max-w-xl leading-relaxed">
                Étude, dossiers <b className="font-semibold text-white">MaPrimeRénov'</b> et{" "}
                <b className="font-semibold text-white">CEE</b>, installation par des artisans certifiés RGE&nbsp;:
                on s'occupe de tout, avec un seul interlocuteur.
              </p>

              <div className="hidden lg:flex flex-row gap-3 lg:justify-start">
                <a
                  href="#simulateur"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById("simulateur")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="inline-flex items-center justify-center gap-2.5 bg-white hover:bg-blue-50 text-[#173a5e] px-7 py-4 rounded-xl font-bold text-base shadow-xl transition-colors"
                >
                  Estimer mes aides gratuitement <ArrowRight size={18} />
                </a>
                <a
                  href="tel:+33749525267"
                  className="inline-flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-7 py-4 rounded-xl font-semibold text-base border border-white/30 transition-colors"
                >
                  <Phone size={18} /> 07 49 52 52 67
                </a>
              </div>
              <p className="hidden lg:flex mt-6 items-center gap-x-6 gap-y-1.5 flex-wrap lg:justify-start text-sm text-white/80">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-emerald-300" size={16} /> Étude gratuite
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-emerald-300" size={16} /> Sans engagement
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-emerald-300" size={16} /> Rappel par un conseiller
                </span>
              </p>

              {/* Identité de l'entreprise : rassure par des faits vérifiables. */}
              <div className="lg:mt-10 lg:pt-6 lg:border-t border-slate-200 lg:border-white/15 dark:border-slate-800 flex items-start gap-3 lg:justify-start text-left">
                <Building2 size={20} className="mt-0.5 text-[#2b5a8f] lg:text-white/70 dark:text-blue-300 shrink-0" />
                <p className="text-sm text-slate-500 lg:text-white/65 dark:text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-700 lg:text-white dark:text-slate-200">IP5 CONSEILS</span> — société française, siège à Paris
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
        <section className="py-14 md:py-20 bg-white dark:bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-8 md:mb-12">
              <p className="text-sm font-semibold uppercase tracking-wider text-[#2b5a8f] dark:text-blue-300 mb-2">Notre méthode</p>
              <h2 className="text-3xl font-bold text-[#0f2a47] dark:text-white mb-3">Un projet suivi de A à Z</h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                Vous n'avez pas à gérer les dossiers ni à chercher un artisan : nous coordonnons chaque étape.
              </p>
            </div>
            <ol className="grid md:grid-cols-4 gap-3 md:gap-6">
              {[
                { icon: ClipboardCheck, title: "Étude de votre projet", text: "Vous répondez à quelques questions. Un conseiller vous rappelle pour vérifier votre éligibilité aux aides." },
                { icon: Home, title: "Visite technique", text: "Un professionnel étudie votre logement et définit la pompe à chaleur adaptée à vos besoins." },
                { icon: FileText, title: "Dossiers d'aides", text: "Nous montons vos dossiers MaPrimeRénov' et CEE. Les aides sont déduites de votre devis." },
                { icon: Wrench, title: "Installation certifiée", text: "La pose est réalisée par un artisan certifié RGE, puis nous restons votre interlocuteur." },
              ].map((step, i) => (
                <li key={step.title} className="relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6">
                  <div className="flex items-center justify-between mb-3 md:mb-5">
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
      <section className="py-14 md:py-24 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 md:mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5 border bg-blue-50 dark:bg-blue-950/50 text-[#2b5a8f] dark:text-blue-300 border-blue-100 dark:border-blue-900">
              <Award size={14} /> Découvrir IP5 Énergie
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
              Tout ce qu'il faut savoir sur votre projet
            </h2>
            <p className="text-lg md:text-xl text-gray-600 dark:text-slate-300">
              Nos pompes à chaleur, les aides de l'État et nos chantiers, en
              détail.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 md:gap-8">
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
