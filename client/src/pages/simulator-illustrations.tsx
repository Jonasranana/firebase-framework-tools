import React from "react";

// Illustrations animées du simulateur, dessinées en SVG aux couleurs IP5
// (pas d'images externes : tout est vectoriel, léger et sans droits à gérer).
// Chaque étape du simulateur a sa scène ; les animations tournent en boucle.

export const IllustrationStyles = () => (
  <style>{`
    @keyframes ip5-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
    @keyframes ip5-drift { 0%,100% { transform: translateX(0) } 50% { transform: translateX(10px) } }
    @keyframes ip5-rise { 0% { transform: translateY(4px) scale(.7); opacity: 0 } 30% { opacity: .8 } 100% { transform: translateY(-22px) scale(1.25); opacity: 0 } }
    @keyframes ip5-flicker { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(1.25) scaleX(.9) } }
    @keyframes ip5-fall { 0% { transform: translateY(-14px); opacity: 0 } 25% { opacity: 1 } 100% { transform: translateY(26px); opacity: 0 } }
    @keyframes ip5-spin { to { transform: rotate(360deg) } }
    @keyframes ip5-wiggle { 0%,100% { transform: rotate(-10deg) } 50% { transform: rotate(12deg) } }
    @keyframes ip5-pop { 0% { transform: scale(0) } 75% { transform: scale(1.12) } 100% { transform: scale(1) } }
    @keyframes ip5-coin { 0% { transform: translateY(-20px); opacity: 0 } 30% { opacity: 1 } 75% { transform: translateY(8px); opacity: 1 } 100% { transform: translateY(10px); opacity: 0 } }
    @keyframes ip5-wave { 0%,100% { opacity: .25; transform: translateX(0) } 50% { opacity: .9; transform: translateX(5px) } }
    @keyframes ip5-bounce-dot { 0%,100% { transform: translateY(0) } 40% { transform: translateY(-12px) } }
    .ip5-anim { transform-box: fill-box; transform-origin: center; }
  `}</style>
);

const anim = (name: string, dur: string, delay = "0s", timing = "ease-in-out") =>
  ({ animation: `${name} ${dur} ${timing} ${delay} infinite` }) as React.CSSProperties;

// Scène commune : fond dégradé doux + bulles décoratives qui flottent.
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-36 mb-5 rounded-2xl bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 border border-blue-100 overflow-hidden flex items-center justify-center">
    <span
      className="absolute w-16 h-16 rounded-full bg-cyan-200/50 -top-4 -left-4"
      style={anim("ip5-float", "4s")}
    />
    <span
      className="absolute w-8 h-8 rounded-full bg-blue-200/60 top-4 right-8"
      style={anim("ip5-float", "3.2s", ".6s")}
    />
    <span
      className="absolute w-5 h-5 rounded-full bg-green-200/70 bottom-3 right-16"
      style={anim("ip5-drift", "5s", ".3s")}
    />
    <span
      className="absolute w-10 h-10 rounded-full bg-blue-300/30 -bottom-3 left-10"
      style={anim("ip5-float", "4.6s", "1s")}
    />
    <svg viewBox="0 0 220 120" className="relative h-full w-auto" aria-hidden="true">
      {children}
    </svg>
  </div>
);

const Sun = ({ x = 185, y = 22 }: { x?: number; y?: number }) => (
  <g className="ip5-anim" style={anim("ip5-float", "3.5s")}>
    <circle cx={x} cy={y} r="11" fill="#fbbf24" />
    {Array.from({ length: 8 }).map((_, i) => {
      const a = (i * Math.PI) / 4;
      return (
        <line
          key={i}
          x1={x + Math.cos(a) * 14}
          y1={y + Math.sin(a) * 14}
          x2={x + Math.cos(a) * 18}
          y2={y + Math.sin(a) * 18}
          stroke="#fbbf24"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      );
    })}
  </g>
);

const House = ({ x = 0, y = 0 }: { x?: number; y?: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="18" y="52" width="64" height="48" rx="4" fill="#ffffff" stroke="#2b5a8f" strokeWidth="3.5" />
    <path d="M10 56 L50 22 L90 56 Z" fill="#2b5a8f" />
    <rect x="64" y="26" width="9" height="18" rx="2" fill="#2b5a8f" />
    <rect x="28" y="62" width="16" height="14" rx="2" fill="#7dd3fc" stroke="#2b5a8f" strokeWidth="2.5" />
    <rect x="56" y="66" width="16" height="34" rx="2" fill="#2b5a8f" />
    <circle cx="60" cy="84" r="1.8" fill="#fbbf24" />
  </g>
);

const Smoke = ({ x, y }: { x: number; y: number }) => (
  <>
    {[0, 1, 2].map((i) => (
      <circle
        key={i}
        cx={x + i * 3}
        cy={y - i * 2}
        r={3.5 + i}
        fill="#94a3b8"
        opacity="0"
        className="ip5-anim"
        style={anim("ip5-rise", "2.6s", `${i * 0.85}s`, "ease-out")}
      />
    ))}
  </>
);

// 1 — Type de logement : maison + immeuble sous le soleil
const HousingScene = () => (
  <Stage>
    <Sun />
    <House x={4} y={4} />
    <Smoke x={72} y={28} />
    <g>
      <rect x="126" y="30" width="58" height="70" rx="4" fill="#ffffff" stroke="#2b5a8f" strokeWidth="3.5" />
      {[0, 1, 2].map((r) =>
        [0, 1].map((c) => (
          <rect
            key={`${r}${c}`}
            x={136 + c * 22}
            y={38 + r * 18}
            width="12"
            height="10"
            rx="2"
            fill={r === 1 && c === 1 ? "#fbbf24" : "#7dd3fc"}
            stroke="#2b5a8f"
            strokeWidth="2"
          />
        )),
      )}
      <rect x="148" y="88" width="14" height="12" rx="2" fill="#2b5a8f" />
    </g>
    <ellipse cx="110" cy="106" rx="95" ry="5" fill="#bfdbfe" opacity=".6" />
  </Stage>
);

// 2 — Propriétaire : maison + grande clé qui se balance
const OwnerScene = () => (
  <Stage>
    <House x={14} y={4} />
    <Smoke x={82} y={28} />
    <g className="ip5-anim" style={{ ...anim("ip5-wiggle", "2.4s"), transformOrigin: "160px 45px" }}>
      <circle cx="160" cy="45" r="16" fill="none" stroke="#f59e0b" strokeWidth="7" />
      <rect x="156" y="58" width="8" height="34" rx="3" fill="#f59e0b" />
      <rect x="160" y="76" width="12" height="7" rx="2" fill="#f59e0b" />
      <rect x="160" y="86" width="9" height="6" rx="2" fill="#f59e0b" />
    </g>
    <ellipse cx="110" cy="106" rx="95" ry="5" fill="#bfdbfe" opacity=".6" />
  </Stage>
);

// 3 — Surface : la maison grandit avec le curseur (30 → 300 m²)
const SurfaceScene = ({ surface = 100 }: { surface?: number }) => {
  const scale = 0.7 + ((surface - 30) / 270) * 0.55;
  return (
    <Stage>
      <Sun x={190} y={20} />
      <g
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "50px 105px",
          transition: "transform .25s ease-out",
        }}
      >
        <House x={4} y={4} />
      </g>
      {/* règle de mesure */}
      <g>
        <line x1="120" y1="100" x2="205" y2="100" stroke="#2b5a8f" strokeWidth="3" strokeLinecap="round" />
        <line x1="120" y1="93" x2="120" y2="107" stroke="#2b5a8f" strokeWidth="3" strokeLinecap="round" />
        <line x1="205" y1="93" x2="205" y2="107" stroke="#2b5a8f" strokeWidth="3" strokeLinecap="round" />
        {[135, 150, 165, 180, 195].map((x) => (
          <line key={x} x1={x} y1="96" x2={x} y2="104" stroke="#60a5fa" strokeWidth="2" />
        ))}
      </g>
      <text x="162" y="86" textAnchor="middle" fontSize="13" fontWeight="800" fill="#2b5a8f">
        {surface} m²
      </text>
    </Stage>
  );
};

// 4 — Chauffage actuel : vieille chaudière, flamme et flocons (le froid qui guette)
const HeatingScene = () => (
  <Stage>
    <g>
      <rect x="78" y="26" width="52" height="74" rx="8" fill="#e2e8f0" stroke="#64748b" strokeWidth="3.5" />
      <circle cx="104" cy="48" r="11" fill="#fff" stroke="#64748b" strokeWidth="3" />
      <circle cx="104" cy="48" r="4" fill="#64748b" />
      <rect x="88" y="68" width="32" height="6" rx="3" fill="#94a3b8" />
      <rect x="88" y="80" width="22" height="6" rx="3" fill="#94a3b8" />
      <g className="ip5-anim" style={{ ...anim("ip5-flicker", "0.9s"), transformOrigin: "104px 100px" }}>
        <path d="M104 108 C96 100 98 92 104 86 C110 92 112 100 104 108 Z" fill="#f97316" transform="translate(0 -14)" />
        <path d="M104 104 C100 100 101 95 104 92 C107 95 108 100 104 104 Z" fill="#fbbf24" transform="translate(0 -14)" />
      </g>
    </g>
    {[
      { x: 40, d: "0s" },
      { x: 56, d: ".9s" },
      { x: 165, d: ".4s" },
      { x: 182, d: "1.3s" },
    ].map((f, i) => (
      <g key={i} className="ip5-anim" style={anim("ip5-fall", "3s", f.d, "linear")}>
        <line x1={f.x - 5} y1={40} x2={f.x + 5} y2={40} stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
        <line x1={f.x} y1={35} x2={f.x} y2={45} stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
        <line x1={f.x - 4} y1={36} x2={f.x + 4} y2={44} stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" />
        <line x1={f.x - 4} y1={44} x2={f.x + 4} y2={36} stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" />
      </g>
    ))}
    <ellipse cx="110" cy="106" rx="80" ry="5" fill="#bfdbfe" opacity=".6" />
  </Stage>
);

// 5 — Département : carte stylisée + épingle qui rebondit
const MapScene = () => (
  <Stage>
    <path
      d="M60 30 Q90 14 130 24 Q170 32 168 62 Q166 92 130 100 Q92 108 66 88 Q44 70 60 30 Z"
      fill="#ffffff"
      stroke="#2b5a8f"
      strokeWidth="3.5"
    />
    <path d="M70 46 Q110 36 156 50" stroke="#bfdbfe" strokeWidth="3" fill="none" />
    <path d="M66 68 Q112 60 160 72" stroke="#bfdbfe" strokeWidth="3" fill="none" />
    <path d="M92 30 Q98 64 88 98" stroke="#bfdbfe" strokeWidth="3" fill="none" />
    <path d="M128 26 Q134 60 126 100" stroke="#bfdbfe" strokeWidth="3" fill="none" />
    <g className="ip5-anim" style={anim("ip5-bounce-dot", "1.4s")}>
      <path d="M112 30 C99 30 92 40 92 49 C92 62 112 78 112 78 C112 78 132 62 132 49 C132 40 125 30 112 30 Z" fill="#ef4444" />
      <circle cx="112" cy="49" r="7" fill="#ffffff" />
    </g>
    <ellipse cx="112" cy="82" rx="9" ry="2.5" fill="#94a3b8" opacity=".5" />
  </Stage>
);

// 6 — Foyer : la famille devant la maison, cœur qui flotte
const FamilyScene = () => {
  const person = (x: number, y: number, s: number, color: string, i: number) => (
    <g key={i} className="ip5-anim" style={anim("ip5-float", "3.4s", `${i * 0.35}s`)}>
      <circle cx={x} cy={y} r={7 * s} fill="#f8b98b" />
      <path
        d={`M${x - 9 * s} ${y + 26 * s} Q${x} ${y + 6 * s} ${x + 9 * s} ${y + 26 * s} Z`}
        fill={color}
      />
    </g>
  );
  return (
    <Stage>
      <g opacity=".35">
        <House x={118} y={8} />
      </g>
      {person(46, 42, 1.15, "#2b5a8f", 0)}
      {person(76, 44, 1.1, "#0ea5e9", 1)}
      {person(104, 54, 0.8, "#22c55e", 2)}
      {person(126, 56, 0.7, "#f59e0b", 3)}
      <g className="ip5-anim" style={anim("ip5-rise", "3s", ".5s", "ease-out")}>
        <path
          d="M86 30 C86 26 90 24 92 27 C94 24 98 26 98 30 C98 34 92 38 92 38 C92 38 86 34 86 30 Z"
          fill="#f472b6"
        />
      </g>
      <ellipse cx="100" cy="106" rx="90" ry="5" fill="#bfdbfe" opacity=".6" />
    </Stage>
  );
};

// 7 — Revenus : avis d'imposition + pièces qui tombent dans la tirelire
const IncomeScene = () => (
  <Stage>
    <g transform="translate(48 22)">
      <rect x="0" y="0" width="58" height="76" rx="6" fill="#ffffff" stroke="#2b5a8f" strokeWidth="3.5" />
      <rect x="9" y="10" width="40" height="6" rx="3" fill="#93c5fd" />
      <rect x="9" y="24" width="32" height="5" rx="2.5" fill="#cbd5e1" />
      <rect x="9" y="35" width="40" height="5" rx="2.5" fill="#cbd5e1" />
      <rect x="9" y="46" width="26" height="5" rx="2.5" fill="#cbd5e1" />
      <rect x="9" y="60" width="24" height="8" rx="4" fill="#22c55e" opacity=".85" />
    </g>
    {[0, 1].map((i) => (
      <g key={i} className="ip5-anim" style={anim("ip5-coin", "2.2s", `${i * 1.1}s`, "ease-in")}>
        <circle cx={150 + i * 14} cy={34} r="9" fill="#fbbf24" stroke="#d97706" strokeWidth="2.5" />
        <text x={150 + i * 14} y={38.5} textAnchor="middle" fontSize="11" fontWeight="800" fill="#92400e">
          €
        </text>
      </g>
    ))}
    <g>
      <ellipse cx="157" cy="76" rx="26" ry="19" fill="#f9a8d4" stroke="#db2777" strokeWidth="3" />
      <circle cx="176" cy="70" r="7" fill="#f9a8d4" stroke="#db2777" strokeWidth="3" />
      <circle cx="178.5" cy="69" r="1.6" fill="#831843" />
      <rect x="148" y="55" width="16" height="4" rx="2" fill="#831843" />
      <path d="M138 92 l-3 8 M176 92 l3 8" stroke="#db2777" strokeWidth="4" strokeLinecap="round" />
    </g>
    <ellipse cx="110" cy="106" rx="90" ry="5" fill="#bfdbfe" opacity=".6" />
  </Stage>
);

// 8 — Échéance : calendrier + horloge dont l'aiguille tourne
const TimingScene = () => (
  <Stage>
    <g transform="translate(56 20)">
      <rect x="0" y="6" width="72" height="74" rx="8" fill="#ffffff" stroke="#2b5a8f" strokeWidth="3.5" />
      <rect x="0" y="6" width="72" height="20" rx="8" fill="#2b5a8f" />
      <rect x="12" y="0" width="7" height="14" rx="3.5" fill="#2b5a8f" />
      <rect x="53" y="0" width="7" height="14" rx="3.5" fill="#2b5a8f" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect
            key={`${r}${c}`}
            x={10 + c * 15}
            y={34 + r * 14}
            width="9"
            height="8"
            rx="2"
            fill={r === 1 && c === 2 ? "#22c55e" : "#dbeafe"}
          />
        )),
      )}
    </g>
    <g>
      <circle cx="158" cy="76" r="22" fill="#ffffff" stroke="#0ea5e9" strokeWidth="4" />
      <g className="ip5-anim" style={{ ...anim("ip5-spin", "5s", "0s", "linear"), transformOrigin: "158px 76px" }}>
        <line x1="158" y1="76" x2="158" y2="62" stroke="#0ea5e9" strokeWidth="3.5" strokeLinecap="round" />
      </g>
      <line x1="158" y1="76" x2="168" y2="76" stroke="#2b5a8f" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="158" cy="76" r="3" fill="#2b5a8f" />
    </g>
  </Stage>
);

// Pompe à chaleur : unité extérieure au ventilateur qui tourne
const HeatPump = ({ x = 60, y = 30, spin = "1.6s" }: { x?: number; y?: number; spin?: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="0" y="0" width="96" height="62" rx="10" fill="#ffffff" stroke="#2b5a8f" strokeWidth="4" />
    <circle cx="34" cy="31" r="21" fill="#e0f2fe" stroke="#2b5a8f" strokeWidth="3" />
    <g className="ip5-anim" style={{ ...anim("ip5-spin", spin, "0s", "linear"), transformOrigin: `${x + 34}px ${y + 31}px` }}>
      {[0, 120, 240].map((a) => (
        <path
          key={a}
          d="M0 0 Q10 -14 2 -18 Q-8 -14 0 0 Z"
          fill="#2b5a8f"
          transform={`translate(34 31) rotate(${a})`}
        />
      ))}
    </g>
    <circle cx="34" cy="31" r="4.5" fill="#2b5a8f" />
    <rect x="66" y="12" width="20" height="5" rx="2.5" fill="#93c5fd" />
    <rect x="66" y="24" width="20" height="5" rx="2.5" fill="#93c5fd" />
    <rect x="66" y="36" width="20" height="5" rx="2.5" fill="#93c5fd" />
    <circle cx="76" cy="52" r="3.5" fill="#22c55e" />
  </g>
);

// Écran de calcul : PAC qui tourne + ondes de chaleur
export const CalculatingScene = () => (
  <Stage>
    <HeatPump x={52} y={30} spin="0.9s" />
    {[0, 1, 2].map((i) => (
      <path
        key={i}
        d={`M${162 + i * 12} 44 q6 8 0 16 q-6 8 0 16`}
        stroke="#f97316"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        className="ip5-anim"
        style={anim("ip5-wave", "1.6s", `${i * 0.3}s`)}
      />
    ))}
    <ellipse cx="110" cy="102" rx="85" ry="5" fill="#bfdbfe" opacity=".6" />
  </Stage>
);

// Résultats : la maison bien chauffée, soleil, euros qui s'envolent
const ResultScene = () => (
  <Stage>
    <Sun x={188} y={22} />
    <House x={8} y={4} />
    <HeatPump x={104} y={56} spin="2.2s" />
    {[0, 1, 2].map((i) => (
      <g key={i} className="ip5-anim" style={anim("ip5-rise", "2.8s", `${i * 0.9}s`, "ease-out")}>
        <circle cx={150 + i * 18} cy={36} r="8" fill="#bbf7d0" stroke="#16a34a" strokeWidth="2.5" />
        <text x={150 + i * 18} y={40} textAnchor="middle" fontSize="10" fontWeight="800" fill="#166534">
          €
        </text>
      </g>
    ))}
    <ellipse cx="110" cy="106" rx="95" ry="5" fill="#bfdbfe" opacity=".6" />
  </Stage>
);

// Confirmation : coche + confettis
const SuccessScene = () => (
  <Stage>
    <g className="ip5-anim" style={anim("ip5-pop", "2.6s", "0s", "ease-out")}>
      <circle cx="110" cy="58" r="30" fill="#22c55e" />
      <path d="M96 58 l10 11 l19 -22" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
    {[
      { x: 52, c: "#f59e0b", d: "0s" },
      { x: 72, c: "#0ea5e9", d: ".5s" },
      { x: 148, c: "#f472b6", d: ".2s" },
      { x: 168, c: "#22c55e", d: ".8s" },
      { x: 186, c: "#8b5cf6", d: ".4s" },
    ].map((p, i) => (
      <rect
        key={i}
        x={p.x}
        y={30}
        width="7"
        height="12"
        rx="2"
        fill={p.c}
        transform={`rotate(${20 + i * 25} ${p.x} 36)`}
        className="ip5-anim"
        style={anim("ip5-fall", "2.4s", p.d, "linear")}
      />
    ))}
  </Stage>
);

// Sélecteur : l'illustration de chaque étape du simulateur.
export const StepIllustration = ({
  step,
  surface,
}: {
  step: number;
  surface: number;
}) => {
  switch (step) {
    case 1:
      return <HousingScene />;
    case 2:
      return <OwnerScene />;
    case 3:
      return <SurfaceScene surface={surface} />;
    case 4:
      return <HeatingScene />;
    case 5:
      return <MapScene />;
    case 6:
      return <FamilyScene />;
    case 7:
      return <IncomeScene />;
    case 8:
      return <TimingScene />;
    case 9:
      return <ResultScene />;
    case 10:
      return <SuccessScene />;
    default:
      return null;
  }
};
