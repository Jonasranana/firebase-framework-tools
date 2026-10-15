import { LOGO_FULL_D, LOGO_FULL_VIEWBOX } from "@/pages/ip5-logo";

// Écran de chargement : le logo IP5 Énergie « respire » au-dessus d'une barre lumineuse.
// full : occupe tout l'écran (démarrage du site et de l'outil) ; sinon centré dans la zone qui charge.
export default function BrandLoader({ full = false, label = "Chargement" }: { full?: boolean; label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-6 ${full ? "min-h-screen w-full bg-white dark:bg-slate-950" : "py-24"}`}
      dir="ltr"
    >
      <div className="ip5-loader-logo">
        <svg viewBox={LOGO_FULL_VIEWBOX} className="h-14 w-auto text-[#2b5a8f] dark:text-blue-300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d={LOGO_FULL_D} fill="currentColor" fillRule="evenodd" />
        </svg>
      </div>
      <div className="ip5-loader-bar h-1 w-40 rounded-full" />
    </div>
  );
}
