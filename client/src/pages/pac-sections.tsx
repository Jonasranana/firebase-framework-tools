import React, { useEffect, useState } from "react";
import {
  ChevronDown,
  Droplets,
  Smartphone,
  Snowflake,
  Thermometer,
  Check,
} from "lucide-react";
import { SectionHead } from "./ip5-sections";

// ─────────────────────────────────────────────────────────────────────────
// Sections de la page « Pompes à chaleur » : ce que fait une PAC, comment
// elle fonctionne (schéma interactif), ce que comprend notre installation
// (photos de chantier) et les questions fréquentes. Palette du site :
// bleu nuit + doré.
// ─────────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Thermometer,
    title: "Chauffe toute la maison",
    text: "Avec vos radiateurs existants ou un plancher chauffant, selon le modèle choisi.",
  },
  {
    icon: Droplets,
    title: "Produit votre eau chaude",
    text: "Associée à un ballon, elle fournit aussi l'eau chaude de la salle de bain et de la cuisine.",
  },
  {
    icon: Snowflake,
    title: "Rafraîchit l'été",
    text: "Les modèles réversibles peuvent rafraîchir le logement, avec un plancher ou des ventilo-convecteurs.",
  },
  {
    icon: Smartphone,
    title: "Se pilote simplement",
    text: "Programmation, thermostat d'ambiance et, selon les modèles, réglage depuis votre téléphone.",
  },
];

export const PacFeaturesSection = () => (
  <section className="py-14 md:py-24 bg-white dark:bg-slate-950">
    <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
        <div className="relative mb-10 lg:mb-0">
          <img
            src="/images/realisations/interieur-pac-ballon.jpg"
            alt="Module intérieur de pompe à chaleur et ballon d'eau chaude installés par IP5 Énergie"
            className="w-full h-72 md:h-[460px] object-cover rounded-2xl border border-slate-200/80 dark:border-slate-800"
            loading="lazy"
          />
          <div className="absolute -bottom-5 left-5 right-5 md:left-auto md:right-6 md:w-72 bg-[#0b1a2c] text-white rounded-2xl px-5 py-4 shadow-xl">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-amber-200">Une seule installation</p>
            <p className="mt-1 text-sm text-white/85 leading-snug">Chauffage, eau chaude et confort d'été, avec un seul appareil.</p>
          </div>
        </div>
        <div>
          <SectionHead
            align="left"
            kicker="Une PAC qui fait tout"
            title="Bien plus qu'un chauffage"
            subtitle="La pompe à chaleur air/eau remplace votre chaudière et s'occupe de tout votre confort."
          />
          <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-7 -mt-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2b5a8f] to-[#0f2b4a] text-amber-200 flex items-center justify-center flex-shrink-0 shadow-md">
                  <f.icon size={22} />
                </span>
                <div>
                  <h3 className="font-bold text-[#0f2a47] dark:text-white">{f.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-1">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

// ── Comment ça marche : schéma interactif en 4 étapes ───────────────────
const STEPS = [
  {
    title: "L'air extérieur",
    text: "Même en hiver, l'air contient de la chaleur. Le ventilateur de l'unité extérieure la capte.",
    x: 70,
    y: 160,
  },
  {
    title: "Le compresseur",
    text: "Un fluide récupère cette chaleur, puis le compresseur la fait monter en température.",
    x: 192,
    y: 245,
  },
  {
    title: "L'échangeur",
    text: "Dans le module installé chez vous, la chaleur passe à l'eau de votre circuit de chauffage.",
    x: 352,
    y: 176,
  },
  {
    title: "Radiateurs et eau chaude",
    text: "L'eau chaude circule dans vos radiateurs ou votre plancher, et chauffe aussi votre eau sanitaire.",
    x: 500,
    y: 214,
  },
];

const PacDiagram = ({ active, onPick }: { active: number; onPick: (i: number) => void }) => (
  <svg viewBox="0 40 600 290" className="w-full h-auto" role="img" aria-label="Schéma du fonctionnement d'une pompe à chaleur air/eau">
    <style>{`@keyframes ip5-flow { to { stroke-dashoffset: -24 } } .ip5-flow { animation: ip5-flow 1s linear infinite } @media (prefers-reduced-motion: reduce) { .ip5-flow { animation: none } }`}</style>
    {/* Sol */}
    <rect x="0" y="300" width="600" height="40" fill="#e2e8f0" />
    <text x="145" y="322" textAnchor="middle" fontSize="13" fontWeight="700" fill="#64748b" letterSpacing="2">DEHORS</text>
    <text x="410" y="322" textAnchor="middle" fontSize="13" fontWeight="700" fill="#64748b" letterSpacing="2">CHEZ VOUS</text>
    {/* Air extérieur */}
    {[130, 160, 190].map((y, i) => (
      <path
        key={y}
        d={`M14 ${y} q12 -10 24 0 t24 0`}
        fill="none"
        stroke={active === 0 ? "#f59e0b" : "#93c5fd"}
        strokeWidth="3"
        strokeLinecap="round"
        opacity={0.5 + i * 0.2}
      />
    ))}
    {/* Unité extérieure */}
    <rect x="70" y="190" width="150" height="110" rx="10" fill="#fff" stroke="#173a5e" strokeWidth="4" />
    <circle cx="125" cy="245" r="36" fill="#f1f5f9" stroke="#173a5e" strokeWidth="3" />
    <g stroke="#173a5e" strokeWidth="3" strokeLinecap="round">
      <line x1="125" y1="245" x2="125" y2="215" />
      <line x1="125" y1="245" x2="151" y2="260" />
      <line x1="125" y1="245" x2="99" y2="260" />
    </g>
    <rect x="178" y="215" width="28" height="60" rx="5" fill={active === 1 ? "#fde68a" : "#e2e8f0"} stroke="#173a5e" strokeWidth="3" />
    {/* Maison */}
    <path d="M250 300 V150 L410 60 L570 150 V300" fill="#fff" stroke="#173a5e" strokeWidth="4" strokeLinejoin="round" />
    {/* Liaisons */}
    <path d="M220 230 H330" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
    <path
      d="M220 230 H330"
      fill="none"
      stroke={active >= 1 ? "#f59e0b" : "#94a3b8"}
      strokeWidth="4"
      strokeLinecap="round"
      strokeDasharray="8 4"
      className="ip5-flow"
    />
    {/* Module intérieur */}
    <rect x="320" y="140" width="64" height="130" rx="8" fill={active === 2 ? "#fef3c7" : "#fff"} stroke="#173a5e" strokeWidth="4" />
    <rect x="334" y="156" width="36" height="14" rx="3" fill="#173a5e" />
    {/* Circuit de chauffage */}
    <path d="M384 250 H460" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
    <path
      d="M384 250 H460"
      fill="none"
      stroke={active >= 2 ? "#f59e0b" : "#94a3b8"}
      strokeWidth="4"
      strokeLinecap="round"
      strokeDasharray="8 4"
      className="ip5-flow"
    />
    {/* Radiateur */}
    <g fill={active === 3 ? "#fde68a" : "#fff"} stroke="#173a5e" strokeWidth="3">
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={462 + i * 16} y="220" width="12" height="58" rx="5" />
      ))}
    </g>
    {active === 3 &&
      [478, 510, 526].map((x) => (
        <path key={x} d={`M${x} 210 q-6 -10 0 -20 t0 -20`} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      ))}
    {/* Points numérotés */}
    {STEPS.map((s, i) => (
      <g key={s.title} onClick={() => onPick(i)} className="cursor-pointer" role="button" aria-label={`Étape ${i + 1} : ${s.title}`}>
        {i === active && <circle cx={s.x} cy={s.y} r="27" fill="#fcd34d" opacity="0.35" />}
        <circle cx={s.x} cy={s.y} r="19" fill={i === active ? "#fcd34d" : "#0b1a2c"} stroke="#fff" strokeWidth="3" />
        <text x={s.x} y={s.y + 6} textAnchor="middle" fontSize="17" fontWeight="800" fill={i === active ? "#0b1a2c" : "#fde68a"}>
          {i + 1}
        </text>
      </g>
    ))}
  </svg>
);

export const PacHowItWorksSection = () => {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  // Défilement automatique des étapes tant que le visiteur n'a pas cliqué.
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setActive((a) => (a + 1) % STEPS.length), 3500);
    return () => clearInterval(t);
  }, [auto]);
  const pick = (i: number) => {
    setAuto(false);
    setActive(i);
  };

  return (
    <section className="py-14 md:py-24 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
        <SectionHead
          kicker="Comment ça marche"
          title="La chaleur de l'air, chez vous"
          subtitle="En 4 étapes, la pompe à chaleur transforme l'air extérieur en chauffage et en eau chaude."
        />
        <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-center">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 md:p-8 mb-6 lg:mb-0">
            <PacDiagram active={active} onPick={pick} />
          </div>
          <ol className="lg:col-span-5 space-y-2.5">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => pick(i)}
                  aria-pressed={i === active}
                  className={`w-full text-left flex gap-4 rounded-2xl border-2 px-4 py-3.5 transition-colors ${
                    i === active
                      ? "border-amber-300 bg-white dark:bg-slate-900 shadow-md"
                      : "border-transparent hover:bg-white/70 dark:hover:bg-slate-900/60"
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold flex-shrink-0 ${
                      i === active ? "bg-amber-300 text-[#0b1a2c]" : "bg-[#0b1a2c] text-amber-200"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-bold text-[#0f2a47] dark:text-white">{s.title}</span>
                    <span
                      className={`block text-sm leading-relaxed text-slate-500 dark:text-slate-400 overflow-hidden transition-all duration-300 ${
                        i === active ? "max-h-32 mt-1 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      {s.text}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-8 text-center text-sm md:text-base text-slate-600 dark:text-slate-300">
          Résultat : <b className="text-[#0f2a47] dark:text-white">1 kWh d'électricité</b> donne jusqu'à{" "}
          <b className="text-[#0f2a47] dark:text-white">4 kWh de chaleur</b>.
        </p>
      </div>
    </section>
  );
};

// ── Ce que comprend l'installation : liste + photo du vrai chantier ─────
const INSTALL_ITEMS = [
  {
    title: "Unité extérieure",
    text: "Posée sur plot béton ou support, à l'endroit le plus adapté pour le rendement et la tranquillité des voisins.",
    photo: "unite-exterieure.jpg",
    alt: "Unité extérieure de pompe à chaleur posée sur plot béton",
  },
  {
    title: "Module intérieur et ballon",
    text: "À la place de l'ancienne chaudière : le module hydraulique et, si besoin, le ballon d'eau chaude.",
    photo: "interieur-pac-ballon.jpg",
    alt: "Module intérieur de pompe à chaleur et ballon d'eau chaude",
  },
  {
    title: "Raccordements soignés",
    text: "Raccordement à vos radiateurs ou à votre plancher, avec des finitions propres et isolées.",
    photo: "detail-module-hydraulique.jpg",
    alt: "Détail des raccordements hydrauliques du module intérieur",
  },
  {
    title: "Électricité aux normes",
    text: "Protection dédiée dans le tableau, étiquetée pour l'entretien, et coffret de coupure à l'extérieur.",
    photo: "tableau-electrique-etiquete.jpg",
    alt: "Tableau électrique dédié et étiqueté",
  },
  {
    title: "Mise en service",
    text: "Réglages, essais et explications : vous savez utiliser votre pompe à chaleur dès le premier jour.",
    photo: "coffret-securite-exterieur.jpg",
    alt: "Coffret de coupure extérieur aux normes",
  },
];

export const PacInstallationSection = () => {
  const [active, setActive] = useState(0);
  const item = INSTALL_ITEMS[active];
  return (
    <section className="py-14 md:py-24 bg-white dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
        <SectionHead
          kicker="Clé en main"
          title="Ce que comprend votre installation"
          subtitle="Touchez chaque étape pour voir le travail sur un vrai chantier IP5 Énergie."
        />
        <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-start">
          <ul className="lg:col-span-5 space-y-2 mb-6 lg:mb-0">
            {INSTALL_ITEMS.map((it, i) => (
              <li key={it.title}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-pressed={i === active}
                  className={`w-full text-left rounded-2xl border-2 px-4 py-3.5 transition-colors ${
                    i === active
                      ? "border-[#173a5e] bg-slate-50 dark:bg-slate-900"
                      : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        i === active ? "bg-amber-300 text-[#0b1a2c]" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}
                    >
                      <Check size={15} strokeWidth={3} />
                    </span>
                    <span className="font-bold text-[#0f2a47] dark:text-white">{it.title}</span>
                  </span>
                  {i === active && (
                    <span className="block text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-2 pl-10">{it.text}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <figure className="lg:col-span-7 lg:sticky lg:top-28">
            <img
              key={item.photo}
              src={`/images/realisations/${item.photo}`}
              alt={item.alt}
              className="w-full h-72 md:h-[440px] object-cover rounded-2xl border border-slate-200/80 dark:border-slate-800 animate-in fade-in duration-300"
              loading="lazy"
            />
            <figcaption className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Photo d'un chantier réalisé par IP5 Énergie : {item.title.toLowerCase()}.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
};

// ── Questions fréquentes sur la pompe à chaleur ─────────────────────────
const PAC_FAQ = [
  {
    q: "Une pompe à chaleur peut-elle remplacer ma chaudière fioul ou gaz ?",
    a: "Oui, c'est l'usage le plus courant. La pompe à chaleur air/eau se raccorde à votre circuit de chauffage existant et remplace la chaudière. C'est aussi le cas qui ouvre droit aux aides les plus importantes.",
  },
  {
    q: "Puis-je garder mes radiateurs ?",
    a: "Dans la plupart des cas, oui. Lors de la visite technique, nous vérifions vos radiateurs et choisissons un modèle adapté (basse ou haute température) pour garder le même confort.",
  },
  {
    q: "Est-ce que ça chauffe quand il fait très froid ?",
    a: "Oui. Les pompes à chaleur récentes fonctionnent même par fortes gelées. Le modèle est dimensionné pour votre logement et votre région, avec un appoint si nécessaire.",
  },
  {
    q: "Est-ce que l'unité extérieure fait du bruit ?",
    a: "Les modèles récents sont discrets, et beaucoup ont un mode nuit. Nous choisissons aussi l'emplacement de l'unité extérieure pour limiter la gêne pour vous et vos voisins.",
  },
  {
    q: "Combien de temps dure une pompe à chaleur ?",
    a: "Bien entretenue, une pompe à chaleur air/eau dure en général entre 15 et 20 ans.",
  },
  {
    q: "Faut-il l'entretenir ?",
    a: "Oui : un entretien par un professionnel est obligatoire tous les 2 ans pour la plupart des pompes à chaleur de maison. Il garde la machine performante et prolonge sa durée de vie.",
  },
  {
    q: "Combien coûte une pompe à chaleur, aides déduites ?",
    a: "Tout dépend de votre logement et de vos revenus. Avec MaPrimeRénov' et la prime CEE, le reste à charge est souvent bien plus faible qu'on ne l'imagine. Le simulateur vous donne une estimation gratuite en 2 minutes.",
  },
  {
    q: "Combien de temps dure l'installation ?",
    a: "En général 1 à 3 jours selon le chantier. Nous nous occupons de tout, de la dépose de l'ancienne chaudière à la mise en service.",
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
          className={`flex-shrink-0 text-[#2b5a8f] dark:text-blue-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <p className="px-6 pb-6 -mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">{a}</p>}
    </div>
  );
};

export const PacFaqSection = () => (
  <section className="py-14 md:py-24 bg-slate-50 dark:bg-slate-950">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHead
        kicker="Vos questions"
        title="Tout savoir sur la pompe à chaleur"
        subtitle="Les réponses aux questions que l'on nous pose le plus souvent."
      />
      <div className="space-y-3">
        {PAC_FAQ.map((item) => (
          <FaqItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  </section>
);
