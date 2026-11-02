import React, { useState } from "react";
import { ArrowRight, ChevronDown, HandCoins, Phone, ShieldCheck, CheckCircle2, Users } from "lucide-react";
import {
  PageLayout,
  Simulator,
  AidesSection,
  AvisSection,
  FinalCTA,
  SectionHead,
} from "./ip5-sections";
import { SolarStatsBand, SolarHowItWorksSection, SolarOffersSection } from "./solar-sections";

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
    a: "Non. Il est 100 % gratuit et sans engagement. Vous obtenez une estimation de vos aides, et nous vous rappelons simplement pour affiner votre projet.",
  },
  {
    q: "Combien de temps dure l'installation ?",
    a: "En général 1 à 2 jours. Nous nous occupons de tout, de l'étude à la pose, avec un seul interlocuteur.",
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
        className="w-full flex items-center justify-between gap-4 text-left px-6 py-5 font-semibold text-[#0f2a47] dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
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
    <PageLayout title="Chauffe-eau solaire : vérifiez vos aides — IP5 Énergie" hideFloatingWhileVisible="simulateur">
      {/* ── HERO : même présentation que l'accueil et /pac. Téléphone : photo
          + titre, puis tout de suite le simulateur sur fond bleu nuit.
          Ordinateur : photo en fond, texte à gauche, simulateur à droite. ── */}
      <section className="relative pt-16 pb-12 lg:pt-36 lg:pb-24 overflow-hidden bg-[#0b1a2c]">
        <div className="hidden lg:block absolute inset-0" aria-hidden="true">
          <img
            src="/images/site/solaire-toit.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[70%_50%]"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1a2c] via-[#0b1a2c]/85 to-[#0b1a2c]/40"></div>
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0b1a2c]/80 to-transparent"></div>
        </div>

        <div className="lg:hidden relative h-[250px] overflow-hidden bg-[#0b1a2c]">
          <img
            src="/images/site/solaire-toit.jpg"
            alt="Chauffe-eau solaire posé sur un toit en tuiles, sous un ciel bleu"
            className="absolute inset-0 w-full h-full object-cover object-[50%_45%]"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b1a2c]/30 via-[#0b1a2c]/50 to-[#0b1a2c]"></div>
          <div className="absolute inset-x-0 bottom-0 px-5 pb-14 text-white animate-in fade-in slide-in-from-bottom-3 duration-700">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1 text-[12px] font-semibold mb-3">
              <ShieldCheck size={14} className="text-amber-200" /> Aides 2026 : MaPrimeRénov' + CEE
            </span>
            <h1 className="text-[28px] leading-[1.1] font-extrabold tracking-tight drop-shadow-sm">
              Eau chaude et chauffage{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200">solaires</span>
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
                Eau chaude et chauffage{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200">solaires</span>
              </h1>
              <p className="text-xl text-white/80 mb-9 max-w-xl leading-relaxed">
                Des panneaux solaires thermiques pour votre eau chaude <b className="font-semibold text-white">et</b> votre
                chauffage, <b className="font-semibold text-white">à partir de 0{"\u00a0"}€</b> selon éligibilité grâce à{" "}
                <b className="font-semibold text-white">MaPrimeRénov'</b> et à la <b className="font-semibold text-white">prime CEE</b>.
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
                <span className="flex items-center gap-1.5"><CheckCircle2 className="text-amber-200" size={16} /> Installateur certifié RGE</span>
              </p>
            </div>

            <div id="simulateur" className="lg:col-span-6 relative scroll-mt-24">
              <Simulator source="landing-solaire-insta" tone="pro" glass />
            </div>
          </div>

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

      <SolarOffersSection />
      <SolarStatsBand />
      <SolarHowItWorksSection />
      <AidesSection equipment="votre installation solaire" />
      <AvisSection />

      {/* ── FAQ solaire ── */}
      <section className="py-14 md:py-24 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHead
            kicker="Vos questions"
            title="Tout savoir sur le solaire thermique"
            subtitle="Les réponses aux questions les plus fréquentes sur le chauffe-eau solaire."
          />
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      <FinalCTA href="#simulateur" />
    </PageLayout>
  );
};

export default CampagneSolaire;
