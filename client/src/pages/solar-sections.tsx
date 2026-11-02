import React, { useEffect, useState } from "react";
import { Check, Droplets, Home } from "lucide-react";
import { SectionHead } from "./ip5-sections";

// ─────────────────────────────────────────────────────────────────────────
// Sections de la page Solaire : bandeau chiffres, schéma interactif du
// fonctionnement et comparaison chauffe-eau solaire / système solaire
// combiné. Même style que la page Pompes à chaleur (bleu nuit + doré).
// ─────────────────────────────────────────────────────────────────────────

export const SolarStatsBand = () => (
  <section className="py-14 md:py-24 bg-[#0b1a2c] text-white">
    <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
      <SectionHead
        onDark
        kicker="Pourquoi le solaire thermique"
        title="Le soleil chauffe votre eau"
        subtitle="Une énergie gratuite et inépuisable, captée sur votre toit."
      />
      <dl className="grid md:grid-cols-3 md:divide-x divide-white/10 border-y border-white/10 md:border-y-0">
        {[
          { stat: "70 %", title: "de votre eau chaude par le soleil", text: "Jusqu'à 70 % des besoins en eau chaude, selon la région et l'installation." },
          { stat: "2 en 1", title: "eau chaude et chauffage", text: "Avec un système solaire combiné, le soleil aide aussi à chauffer la maison." },
          { stat: "2 aides", title: "cumulables pour financer le projet", text: "MaPrimeRénov' et prime CEE, déduites de votre devis selon éligibilité." },
        ].map((a, i) => (
          <div
            key={a.stat}
            className={`flex md:flex-col items-center md:items-start gap-5 md:gap-3 py-6 md:py-2 md:px-10 md:first:pl-0 ${i > 0 ? "border-t border-white/10 md:border-t-0" : ""}`}
          >
            <dt className="text-[34px] md:text-5xl font-extrabold tracking-tight text-amber-200 w-[128px] md:w-auto flex-shrink-0 whitespace-nowrap">{a.stat}</dt>
            <dd>
              <p className="font-bold text-white text-lg leading-snug">{a.title}</p>
              <p className="text-sm text-blue-100/70 leading-relaxed mt-1">{a.text}</p>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  </section>
);

// ── Comment ça marche : schéma interactif en 4 étapes ───────────────────
const STEPS = [
  { title: "Les capteurs sur le toit", text: "Les capteurs solaires absorbent la chaleur du soleil, même par ciel voilé.", x: 255, y: 92 },
  { title: "Le fluide caloporteur", text: "Un liquide circule dans les capteurs, se réchauffe et descend vers le ballon.", x: 392, y: 176 },
  { title: "Le ballon solaire", text: "Dans le ballon, la chaleur passe à votre eau sanitaire, qui reste chaude plusieurs jours.", x: 330, y: 238 },
  { title: "L'eau chaude au robinet", text: "Vous profitez de l'eau chaude ; un appoint prend le relais quand le soleil manque.", x: 470, y: 238 },
];

const SolarDiagram = ({ active, onPick }: { active: number; onPick: (i: number) => void }) => (
  <svg viewBox="0 20 600 310" className="w-full h-auto" role="img" aria-label="Schéma du fonctionnement d'un chauffe-eau solaire">
    <style>{`@keyframes ip5-flow { to { stroke-dashoffset: -24 } } .ip5-flow { animation: ip5-flow 1s linear infinite } @keyframes ip5-spin { to { transform: rotate(360deg) } } .ip5-sun { transform-origin: 70px 70px; animation: ip5-spin 18s linear infinite } @media (prefers-reduced-motion: reduce) { .ip5-flow, .ip5-sun { animation: none } }`}</style>
    {/* Soleil */}
    <g className="ip5-sun">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={70 + Math.cos(a) * 30}
            y1={70 + Math.sin(a) * 30}
            x2={70 + Math.cos(a) * 42}
            y2={70 + Math.sin(a) * 42}
            stroke="#f59e0b"
            strokeWidth="4"
            strokeLinecap="round"
          />
        );
      })}
    </g>
    <circle cx="70" cy="70" r="22" fill="#fcd34d" />
    {/* Rayons vers les capteurs */}
    {active === 0 &&
      [0, 1, 2].map((i) => (
        <line key={i} x1={100 + i * 6} y1={86 + i * 8} x2={200 + i * 14} y2={104 + i * 10} stroke="#fcd34d" strokeWidth="2.5" strokeDasharray="6 6" className="ip5-flow" />
      ))}
    {/* Sol */}
    <rect x="0" y="300" width="600" height="30" fill="#e2e8f0" />
    {/* Maison */}
    <path d="M170 300 V170 L370 60 L570 170 V300" fill="#fff" stroke="#173a5e" strokeWidth="4" strokeLinejoin="round" />
    {/* Capteurs sur le toit */}
    <g transform="rotate(-28.8 255 118)">
      <rect x="200" y="104" width="112" height="30" rx="3" fill={active === 0 ? "#1d4e89" : "#173a5e"} stroke="#0b1a2c" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line key={i} x1={212 + i * 15} y1="106" x2={212 + i * 15} y2="132" stroke="#93c5fd" strokeWidth="1.5" opacity="0.7" />
      ))}
    </g>
    {/* Circuit solaire */}
    <path d="M300 128 C 360 140, 395 160, 395 230 L 350 230" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
    <path
      d="M300 128 C 360 140, 395 160, 395 230 L 350 230"
      fill="none"
      stroke={active >= 1 ? "#f59e0b" : "#94a3b8"}
      strokeWidth="4"
      strokeLinecap="round"
      strokeDasharray="8 4"
      className="ip5-flow"
    />
    {/* Ballon */}
    <rect x="300" y="200" width="60" height="96" rx="26" fill={active === 2 ? "#fef3c7" : "#fff"} stroke="#173a5e" strokeWidth="4" />
    <path d="M312 246 h36" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" opacity={active >= 2 ? 1 : 0.35} />
    <path d="M312 258 h36" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" opacity={active >= 2 ? 1 : 0.35} />
    {/* Eau chaude vers le robinet */}
    <path d="M360 216 H470 V232" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
    <path d="M360 216 H470 V232" fill="none" stroke={active >= 3 ? "#f59e0b" : "#94a3b8"} strokeWidth="4" strokeLinecap="round" strokeDasharray="8 4" className="ip5-flow" />
    {/* Lavabo */}
    <path d="M440 262 h70 a35 18 0 0 1 -70 0z" fill={active === 3 ? "#fde68a" : "#fff"} stroke="#173a5e" strokeWidth="3.5" />
    {active === 3 && <path d="M470 236 v18" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" />}
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

export const SolarHowItWorksSection = () => {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
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
          title="Du soleil à votre robinet"
          subtitle="En 4 étapes, le chauffe-eau solaire transforme la chaleur du soleil en eau chaude."
        />
        <div className="lg:grid lg:grid-cols-12 lg:gap-12 items-center">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 md:p-8 mb-6 lg:mb-0">
            <SolarDiagram active={active} onPick={pick} />
          </div>
          <ol className="lg:col-span-5 space-y-2.5">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => pick(i)}
                  aria-pressed={i === active}
                  className={`w-full text-left flex gap-4 rounded-2xl border-2 px-4 py-3.5 transition-colors ${
                    i === active ? "border-amber-300 bg-white dark:bg-slate-900 shadow-md" : "border-transparent hover:bg-white/70 dark:hover:bg-slate-900/60"
                  }`}
                >
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold flex-shrink-0 ${i === active ? "bg-amber-300 text-[#0b1a2c]" : "bg-[#0b1a2c] text-amber-200"}`}>
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
      </div>
    </section>
  );
};

// ── Deux solutions : CESI ou SSC ────────────────────────────────────────
const OFFERS = [
  {
    icon: Droplets,
    name: "Chauffe-eau solaire individuel",
    short: "CESI",
    pitch: "Pour l'eau chaude de toute la famille.",
    points: [
      "Quelques mètres carrés de capteurs sur le toit",
      "Un ballon solaire qui remplace votre chauffe-eau",
      "Jusqu'à 70 % de votre eau chaude par le soleil",
      "Éligible à MaPrimeRénov' et à la prime CEE",
    ],
  },
  {
    icon: Home,
    name: "Système solaire combiné",
    short: "SSC",
    pitch: "Pour l'eau chaude et une partie du chauffage.",
    points: [
      "Une surface de capteurs plus grande",
      "Un ballon qui alimente aussi le chauffage",
      "Idéal avec un plancher chauffant ou des radiateurs basse température",
      "Éligible à MaPrimeRénov' et à la prime CEE",
    ],
  },
];

export const SolarOffersSection = () => (
  <section className="py-14 md:py-24 bg-white dark:bg-slate-950">
    <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
      <SectionHead
        kicker="Nos solutions"
        title="Deux façons de profiter du soleil"
        subtitle="Nous vous conseillons la plus adaptée à votre maison et à vos besoins."
      />
      <div className="grid md:grid-cols-2 gap-5 md:gap-8">
        {OFFERS.map((o, i) => (
          <div
            key={o.short}
            className={`relative rounded-2xl p-6 md:p-8 border ${
              i === 0 ? "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800" : "bg-[#0b1a2c] text-white border-[#0b1a2c]"
            }`}
          >
            <div className="flex items-center gap-4 mb-5">
              <span className={`w-12 h-12 rounded-2xl flex items-center justify-center ${i === 0 ? "bg-gradient-to-br from-[#2b5a8f] to-[#0f2b4a] text-amber-200" : "bg-amber-300 text-[#0b1a2c]"}`}>
                <o.icon size={22} />
              </span>
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.18em] ${i === 0 ? "text-[#2b5a8f]" : "text-amber-200"}`}>{o.short}</p>
                <h3 className={`text-xl font-extrabold ${i === 0 ? "text-[#0f2a47] dark:text-white" : "text-white"}`}>{o.name}</h3>
              </div>
            </div>
            <p className={`mb-5 ${i === 0 ? "text-slate-600 dark:text-slate-300" : "text-blue-100/80"}`}>{o.pitch}</p>
            <ul className="space-y-3">
              {o.points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${i === 0 ? "bg-amber-100 text-[#0b1a2c]" : "bg-amber-300 text-[#0b1a2c]"}`}>
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span className={`text-sm leading-relaxed ${i === 0 ? "text-slate-700 dark:text-slate-200" : "text-white/90"}`}>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  </section>
);
