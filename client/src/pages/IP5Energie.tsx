import React from "react";
import { ShieldCheck, CheckCircle2, ArrowRight, Phone, ClipboardCheck, Home, FileText, Wrench, HandCoins, Users } from "lucide-react";
import {
  PageLayout,
  Simulator,
  AvantagesSection,
  VideoSection,
  FinalCTA,
  SectionHead,
  Reveal,
  BrandMarquee,
  GRID_BG,
} from "./ip5-sections";

// Page d'accueil d'IP5 Énergie : accroche + simulateur (capture de leads),
// gages de confiance, avantages de la pompe à chaleur, et raccourcis vers les
// pages détaillées (nos pompes à chaleur, aides de l'État, réalisations).
const IP5Energie = () => {
  return (
    <PageLayout title="IP5 Énergie — Pompes à chaleur, jusqu'à 100 % d'aides" hideFloatingWhileVisible="simulateur">
      {/* Hero Section : sobre, factuel, orienté confiance */}
      <section className="relative pt-16 pb-12 lg:pt-36 lg:pb-24 overflow-hidden bg-[#0b1a2c]">
        {/* Ordinateur : la photo occupe tout le bandeau, assombrie à gauche
            pour le texte ; le simulateur est posé à droite. */}
        <div className="hidden lg:block absolute inset-0" aria-hidden="true">
          <picture>
            {/* Téléphone : pas de téléchargement de la grande photo ordinateur */}
            <source media="(max-width: 1023px)" srcSet="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" />
            <img src="/images/hero-accueil-pac.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-[30%_60%]" fetchPriority="high" />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1a2c] from-25% via-[#0b1a2c]/60 to-[#0b1a2c]/25"></div>
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0b1a2c]/80 to-transparent"></div>
        </div>
        {/* Téléphone : grande photo avec le titre posé dessus, comme les sites
            des grands installateurs. Sur ordinateur, la mise en page reste en
            deux colonnes (texte + simulateur). */}
        <div className="lg:hidden relative h-[420px] overflow-hidden bg-[#0b1a2c]">
          <picture>
            <source media="(min-width: 1024px)" srcSet="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" />
            <img
              src="/images/hero-accueil.jpg"
              alt="Un couple étudie son projet de rénovation avec un ordinateur"
              className="absolute inset-0 w-full h-full object-cover object-[50%_22%]"
              fetchPriority="high"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b1a2c]/0 via-[#0b1a2c]/10 to-[#0b1a2c]"></div>
          <div className="absolute inset-x-0 bottom-0 px-5 pb-6 text-white animate-in fade-in slide-in-from-bottom-3 duration-700">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1 text-[12px] font-semibold mb-3">
              <ShieldCheck size={14} className="text-amber-200" /> Installateur certifié RGE QualiPAC
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
            className="flex items-center justify-center gap-2.5 w-full rounded-2xl py-4 text-[17px] font-bold text-[#0b1a2c] bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200 shadow-lg shadow-amber-500/30 active:scale-[0.99] transition-transform"
          >
            Estimer mes aides gratuitement <ArrowRight size={19} />
          </a>
          <ul className="mt-4 grid grid-cols-3 gap-2 text-center">
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
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 relative z-10 pt-8 lg:pt-0">
          <div className="lg:grid lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-6 mb-8 lg:mb-0 text-left">
              <div className="hidden lg:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white font-semibold text-sm mb-6 border border-white/20">
                <ShieldCheck size={16} className="text-amber-200" /> Installateur certifié RGE QualiPAC
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
                  className="inline-flex items-center justify-center gap-2.5 bg-amber-300 hover:bg-amber-200 text-[#0b1a2c] px-7 py-4 rounded-xl font-bold text-base shadow-xl transition-colors"
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
                  <CheckCircle2 className="text-amber-200" size={16} /> Étude gratuite
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-amber-200" size={16} /> Sans engagement
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="text-amber-200" size={16} /> Rappel par un conseiller
                </span>
              </p>
            </div>

            <div id="simulateur" className="lg:col-span-6 relative scroll-mt-28">
              <Simulator tone="pro" glass />
            </div>
          </div>
        </div>
      </section>

      <BrandMarquee />

      {/* Déroulé d'un projet : 4 grandes cartes photo numérotées (défilement
          horizontal sur téléphone, grille sur ordinateur). */}
      <section className={`py-14 md:py-24 bg-slate-50 dark:bg-slate-950 ${GRID_BG}`}>
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <SectionHead
            kicker="Notre méthode"
            title="Un projet suivi de A à Z"
            subtitle="Vous n'avez ni dossier à gérer ni artisan à chercher : nous coordonnons chaque étape."
          />
          <ol className="-mx-5 px-5 sm:mx-0 sm:px-0 flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-2 [scrollbar-width:none]">
            {[
              { img: "/images/site/contact-conseillere.jpg", title: "Étude de votre projet", text: "Quelques questions en ligne, puis un conseiller vous rappelle pour vérifier vos droits.", points: ["Gratuit et sans engagement", "Rappel sous 24 h"] },
              { img: "/images/pac/module-ballon.jpg", title: "Visite technique", text: "Un professionnel étudie votre maison et choisit la pompe à chaleur adaptée.", points: ["Bilan de votre chauffage", "Matériel dimensionné"] },
              { img: "/images/site/aides-signature.jpg", title: "Dossiers d'aides", text: "Nous montons MaPrimeRénov' et CEE à votre place.", points: ["Aides déduites du devis", "Aucune avance de votre part"] },
              { img: "/images/site/artisan-pac.jpg", title: "Installation certifiée", text: "Pose par un artisan RGE, puis nous restons votre interlocuteur.", points: ["Mise en service incluse", "Suivi après l'installation"] },
            ].map((step, i) => (
              <li
                key={step.title}
                className="snap-start shrink-0 w-[82%] sm:w-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 shadow-[0_10px_40px_-24px_rgba(11,26,44,0.35)] flex flex-col"
              >
                <div className="relative overflow-hidden rounded-2xl aspect-[4/3]">
                  <img src={step.img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <div className="px-2 pt-5 pb-3 flex-1 flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[#173a5e] dark:text-blue-200 font-extrabold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <h3 className="text-lg font-bold text-[#0f2a47] dark:text-white leading-snug">{step.title}</h3>
                  </div>
                  <p className="text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed mt-3">{step.text}</p>
                  <ul className="mt-3 space-y-1.5">
                    {step.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-2 text-[14px] font-medium text-slate-700 dark:text-slate-300">
                        <ArrowRight size={16} className="text-amber-500 shrink-0" /> {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

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
      <section className={`py-14 md:py-24 bg-slate-50 dark:bg-slate-950 ${GRID_BG}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHead
            kicker="Découvrir IP5 Énergie"
            title="Tout savoir sur votre projet"
            subtitle="Nos pompes à chaleur, les aides de l'État et nos chantiers, en détail."
          />

          <div className="grid md:grid-cols-3 gap-5 md:gap-8">
            {[
              {
                href: "/pompe-a-chaleur",
                title: "Nos pompes à chaleur",
                text: "Les 7 marques que nous installons et comment choisir le bon modèle pour votre logement.",
                cta: "Voir les modèles",
                visual: "marques",
              },
              {
                href: "/aides",
                title: "Les aides de l'État",
                text: "MaPrimeRénov', CEE : jusqu'à 100 % de votre installation financée, démarches gérées de A à Z.",
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
                className="group flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:shadow-lg transition-shadow duration-300 overflow-hidden"
              >
                <div className="h-44 overflow-hidden bg-slate-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800">
                  {card.visual === "marques" && (
                    // Les marques de pompes à chaleur : logos sur plaques blanches (lisibles aussi en mode sombre).
                    <div className="grid grid-cols-3 gap-2 p-3 h-full">
                      {["chappee.png", "atlantic.png", "daikin.png", "dedietrich.png", "tcl.png", "blaupunkt.png"].map((logo) => (
                        <div key={logo} className="bg-white rounded-lg flex items-center justify-center p-2 border border-slate-100">
                          <img src={`/images/marques/${logo}`} alt="" className="max-h-9 max-w-full object-contain" loading="lazy" />
                        </div>
                      ))}
                    </div>
                  )}
                  {card.visual === "aides" && (
                    <div className="relative h-full">
                      <img src="/images/site/aides-signature.jpg" alt="Un couple signe son dossier d'aides" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
                        <span className="bg-white rounded-lg px-2 py-1 shadow"><img src="/images/aides/maprimerenov.png" alt="MaPrimeRénov'" className="h-6 object-contain" loading="lazy" /></span>
                        <span className="bg-white rounded-lg px-2 py-1 shadow"><img src="/images/aides/cee.png" alt="CEE" className="h-6 object-contain" loading="lazy" /></span>
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
