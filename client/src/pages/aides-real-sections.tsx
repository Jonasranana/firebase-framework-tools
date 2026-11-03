import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Check,
  ChevronDown,
  Gift,
  Landmark,
  Percent,
  ShieldCheck,
  Sparkles,
  X,
  ZoomIn,
} from "lucide-react";
import { SectionHead } from "./ip5-sections";

// ─────────────────────────────────────────────────────────────────────────
// Sections des pages « Aides » et « Réalisations ». Même style que le reste
// du site : bleu nuit, doré, en-têtes communs. Les informations sur les
// aides restent générales (aucun montant garanti) ; le calcul précis se fait
// dans le simulateur.
// ─────────────────────────────────────────────────────────────────────────

// ── Page Aides : les 4 dispositifs ──────────────────────────────────────
const DISPOSITIFS = [
  {
    icon: Landmark,
    name: "MaPrimeRénov'",
    who: "Aide de l'État",
    text: "Une aide directe, calculée selon les revenus du foyer et le type de travaux.",
  },
  {
    icon: Gift,
    name: "Prime CEE",
    who: "Fournisseurs d'énergie",
    text: "Financée par les fournisseurs d'énergie, accessible quels que soient vos revenus.",
  },
  {
    icon: Banknote,
    name: "Éco-prêt à taux zéro",
    who: "Banques partenaires",
    text: "Un prêt sans intérêts pour financer le reste à charge, si besoin.",
  },
  {
    icon: Percent,
    name: "TVA à 5,5 %",
    who: "Sur votre facture",
    text: "Appliquée directement sur les travaux de rénovation énergétique, au lieu de 20 %.",
  },
];

export const AidesDispositifsSection = () => (
  <section className="py-14 md:py-24 bg-white dark:bg-slate-950">
    <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
      <SectionHead
        kicker="Les aides en détail"
        title="Quatre aides qui se cumulent"
        subtitle="Bien combinées, elles réduisent fortement le reste à payer. Nous les montons toutes pour vous."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {DISPOSITIFS.map((d) => (
          <div key={d.name} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col">
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2b5a8f] to-[#0f2b4a] text-amber-200 flex items-center justify-center mb-5 shadow-md">
              <d.icon size={22} />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2b5a8f] dark:text-blue-300">{d.who}</p>
            <h3 className="text-lg font-extrabold text-[#0f2a47] dark:text-white mt-1">{d.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-2">{d.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── Page Aides : les 4 profils MaPrimeRénov' ─────────────────────────────
const PROFILS = [
  { key: "Bleu", label: "Revenus très modestes", bar: "bg-blue-600", chip: "bg-blue-600 text-white", text: "Le niveau d'aide le plus élevé." },
  { key: "Jaune", label: "Revenus modestes", bar: "bg-yellow-400", chip: "bg-yellow-400 text-[#0b1a2c]", text: "Un soutien important de l'État." },
  { key: "Violet", label: "Revenus intermédiaires", bar: "bg-violet-500", chip: "bg-violet-500 text-white", text: "Une aide plus limitée, selon les travaux." },
  { key: "Rose", label: "Revenus supérieurs", bar: "bg-pink-500", chip: "bg-pink-500 text-white", text: "Pas de MaPrimeRénov' pour une pompe à chaleur seule, mais la prime CEE reste accessible." },
];

export const AidesProfilsSection = () => {
  const [active, setActive] = useState(0);
  const p = PROFILS[active];
  return (
    <section className="py-14 md:py-24 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
        <SectionHead
          kicker="MaPrimeRénov'"
          title="Bleu, jaune, violet ou rose : quel est votre profil ?"
          subtitle="Votre couleur dépend du revenu fiscal de référence et du nombre de personnes du foyer. Elle fixe le niveau de l'aide."
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PROFILS.map((x, i) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={`text-left rounded-2xl border-2 p-4 transition-all ${
                i === active ? "border-[#173a5e] bg-white dark:bg-slate-900 shadow-lg -translate-y-0.5" : "border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300"
              }`}
            >
              <span className={`inline-block h-2 w-10 rounded-full ${x.bar}`}></span>
              <span className="block mt-3 font-extrabold text-[#0f2a47] dark:text-white">Profil {x.key}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{x.label}</span>
            </button>
          ))}
        </div>
        <div key={p.key} className="mt-5 rounded-2xl bg-[#0b1a2c] text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5 animate-in fade-in duration-300">
          <span className={`self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${p.chip}`}>Profil {p.key}</span>
          <p className="flex-1 text-white/90 leading-relaxed">
            <b className="text-white">{p.label}.</b> {p.text}
          </p>
          <a
            href="/#simulateur"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 hover:bg-amber-200 text-[#0b1a2c] px-5 py-3 font-bold whitespace-nowrap transition-colors"
          >
            Trouver mon profil <Sparkles size={16} />
          </a>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Les plafonds de revenus changent chaque année : le simulateur applique le barème 2026 de votre département.
        </p>
      </div>
    </section>
  );
};

// ── Page Aides : les erreurs qui font perdre les aides ──────────────────
const ERREURS = [
  { title: "Signer le devis trop tôt", text: "Les aides se demandent avant la signature. Un devis signé trop tôt peut faire perdre la prime CEE." },
  { title: "Choisir un installateur non RGE", text: "Sans certification RGE, pas d'aide de l'État. IP5 Énergie est certifiée RGE QualiPAC." },
  { title: "Se fier à un montant « garanti »", text: "Chaque aide se calcule sur vos revenus et votre projet réel : méfiez-vous des promesses trop belles." },
  { title: "Monter le dossier seul", text: "Pièces manquantes, délais, plateformes différentes : nous montons et suivons tous les dossiers pour vous." },
];

export const AidesErreursSection = () => (
  <section className="py-14 md:py-24 bg-white dark:bg-slate-950">
    <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
      <SectionHead
        kicker="Bon à savoir"
        title="Les 4 erreurs qui font perdre les aides"
        subtitle="Avec nous, vous les évitez toutes : on s'occupe des démarches dans le bon ordre."
      />
      <div className="grid md:grid-cols-2 gap-4 md:gap-5">
        {ERREURS.map((e) => (
          <div key={e.title} className="flex gap-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 md:p-6">
            <span className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} />
            </span>
            <div>
              <h3 className="font-bold text-[#0f2a47] dark:text-white">{e.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">{e.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── FAQ (pages Aides) ────────────────────────────────────────────────────
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
        <ChevronDown size={20} className={`flex-shrink-0 text-[#2b5a8f] transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="px-6 pb-6 -mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">{a}</p>}
    </div>
  );
};

const AIDES_FAQ = [
  { q: "Les aides peuvent-elles vraiment couvrir 100 % du projet ?", a: "Pour certains foyers, oui, en cumulant MaPrimeRénov' et la prime CEE. Cela dépend des revenus, du logement et du projet : seul un calcul sur votre situation permet de le dire." },
  { q: "Dois-je avancer l'argent des aides ?", a: "Dans la plupart des cas, non : les aides sont déduites directement de votre devis. Vous ne payez que le reste à charge." },
  { q: "Qui monte les dossiers ?", a: "Nous. Le montage des dossiers MaPrimeRénov' et CEE est inclus, de la demande au versement." },
  { q: "Les primes CEE sont-elles imposables ?", a: "Pour un particulier, les primes CEE liées à des travaux sur sa résidence principale ne sont pas considérées comme un revenu imposable." },
  { q: "Je suis locataire, ai-je droit aux aides ?", a: "Les aides s'adressent surtout aux propriétaires, occupants ou bailleurs. Votre propriétaire peut faire la demande pour le logement que vous occupez." },
];

export const AidesFaqSection = () => (
  <section className="py-14 md:py-24 bg-slate-50 dark:bg-slate-950">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHead kicker="Vos questions" title="Tout savoir sur les aides" subtitle="Les réponses aux questions qu'on nous pose le plus souvent." />
      <div className="space-y-3">
        {AIDES_FAQ.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </div>
    </div>
  </section>
);

// ── Page Réalisations : avant / après à glisser ──────────────────────────
export const BeforeAfterSection = () => {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(4, Math.min(96, ((clientX - r.left) / r.width) * 100)));
  };
  useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);
  return (
    <section className="py-14 md:py-24 bg-white dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
        <SectionHead
          kicker="Un chantier récent"
          title="Avant, après : glissez pour comparer"
          subtitle="Remplacement d'une ancienne chaudière fioul par une pompe à chaleur air/eau, réalisé par notre équipe."
        />
        <div
          ref={box}
          className="relative aspect-[4/5] md:aspect-[4/3] max-w-3xl mx-auto rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 select-none touch-none cursor-ew-resize shadow-xl"
          onPointerDown={(e) => {
            dragging.current = true;
            move(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && move(e.clientX)}
        >
          <img src="/images/realisations/interieur-pac-ballon.jpg" alt="Après : module intérieur de pompe à chaleur et ballon d'eau chaude" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" draggable={false} />
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            <img src="/images/realisations/avant-ancienne-chaudiere.jpg" alt="Avant : ancienne chaudière fioul" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" draggable={false} />
          </div>
          <span className="absolute top-4 left-4 bg-[#0b1a2c]/85 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">Avant</span>
          <span className="absolute top-4 right-4 bg-amber-300 text-[#0b1a2c] text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">Après</span>
          <div className="absolute inset-y-0 w-[3px] bg-white shadow-[0_0_12px_rgba(0,0,0,0.4)]" style={{ left: `calc(${pos}% - 1.5px)` }}>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white text-[#0b1a2c] shadow-xl flex items-center justify-center font-extrabold text-lg">
              ⟷
            </span>
          </div>
        </div>
        <input
          type="range"
          min={4}
          max={96}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Comparer avant et après"
          className="sr-only"
        />
      </div>
    </section>
  );
};

// ── Page Réalisations : galerie des détails, avec agrandissement ────────
const DETAILS = [
  { src: "unite-exterieure.jpg", caption: "Unité extérieure, posée sur plot béton" },
  { src: "detail-module-hydraulique.jpg", caption: "Finitions soignées du module intérieur" },
  { src: "tableau-electrique-etiquete.jpg", caption: "Tableau électrique dédié, étiqueté" },
  { src: "coffret-securite-exterieur.jpg", caption: "Coffret de coupure extérieur aux normes" },
  { src: "ballon-eau-chaude.jpg", caption: "Ballon d'eau chaude raccordé" },
  { src: "interieur-pac-ballon.jpg", caption: "Module intérieur et ballon, vue d'ensemble" },
];

export const RealisationsGallerySection = () => {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : (o + 1) % DETAILS.length));
      if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : (o - 1 + DETAILS.length) % DETAILS.length));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <section className="py-14 md:py-24 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
        <SectionHead kicker="Le travail en détail" title="Chaque détail compte" subtitle="Touchez une photo pour l'agrandir." />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
          {DETAILS.map((d, i) => (
            <button
              key={d.src}
              type="button"
              onClick={() => setOpen(i)}
              className="group relative rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white text-left"
            >
              <img src={`/images/realisations/${d.src}`} alt={d.caption} className="w-full h-36 md:h-64 object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              <span className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 text-[#0b1a2c] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn size={16} />
              </span>
              <span className="block px-3 py-2.5 md:px-4 md:py-3 text-xs md:text-sm font-medium text-slate-600">{d.caption}</span>
            </button>
          ))}
        </div>
      </div>
      {open !== null && (
        <div className="fixed inset-0 z-[60] bg-[#0b1a2c]/95 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center" onClick={() => setOpen(null)}>
            <X size={22} />
          </button>
          <figure className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={`/images/realisations/${DETAILS[open].src}`} alt={DETAILS[open].caption} className="w-full max-h-[78vh] object-contain rounded-2xl" />
            <figcaption className="mt-3 flex items-center justify-between gap-3 text-white/85 text-sm">
              <button type="button" onClick={() => setOpen((open - 1 + DETAILS.length) % DETAILS.length)} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20">←</button>
              <span className="text-center">{DETAILS[open].caption}</span>
              <button type="button" onClick={() => setOpen((open + 1) % DETAILS.length)} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20">→</button>
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
};

// ── Page Réalisations : nos engagements sur chaque chantier ─────────────
const ENGAGEMENTS = [
  { icon: ShieldCheck, title: "Artisans certifiés RGE", text: "Chaque installation est réalisée par des professionnels certifiés RGE QualiPAC." },
  { icon: Check, title: "Chantier propre", text: "Protections posées, déchets évacués : nous laissons les lieux propres." },
  { icon: BadgeCheck, title: "Mise en service expliquée", text: "Réglages, essais et prise en main avec vous, avant de partir." },
  { icon: Landmark, title: "Aides gérées", text: "Les dossiers MaPrimeRénov' et CEE sont montés et suivis par notre équipe." },
];

export const EngagementsSection = () => (
  <section className="py-14 md:py-24 bg-[#0b1a2c] text-white">
    <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-12 lg:gap-14 items-center">
        <div className="lg:col-span-5 mb-10 lg:mb-0">
          <img
            src="/images/site/artisan-pac.jpg"
            alt="Un artisan installe l'unité extérieure d'une pompe à chaleur"
            className="w-full h-64 md:h-[460px] object-cover rounded-2xl border border-white/10"
            loading="lazy"
          />
        </div>
        <div className="lg:col-span-7">
          <SectionHead onDark align="left" kicker="Nos engagements" title="Sur chaque chantier" subtitle="La même exigence, quelle que soit la taille du projet." />
          <div className="grid sm:grid-cols-2 gap-4 md:gap-5 -mt-2">
            {ENGAGEMENTS.map((e) => (
              <div key={e.title} className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
                <span className="w-10 h-10 rounded-full bg-amber-300 text-[#0b1a2c] flex items-center justify-center mb-3">
                  <e.icon size={18} />
                </span>
                <h3 className="font-bold">{e.title}</h3>
                <p className="text-sm text-blue-100/70 leading-relaxed mt-1">{e.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);
