import { LOGO_FULL_D, LOGO_FULL_VIEWBOX } from "@/pages/ip5-logo";

// Écran de chargement : le logo IP5 Énergie, pâle, traversé en boucle par un reflet (aucune barre).
// full : occupe tout l'écran (démarrage du site et de l'outil) ; sinon centré dans la zone qui charge.
export default function BrandLoader({ full = false, label = "Chargement" }: { full?: boolean; label?: string }) {
  const logo = (
    <svg viewBox={LOGO_FULL_VIEWBOX} className="h-16 w-auto text-[#ff6a1a] dark:text-[#ff8a3d] block" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={LOGO_FULL_D} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`ip5-loader-wrap flex items-center justify-center ${full ? "min-h-screen w-full bg-white dark:bg-slate-950" : "py-24"}`}
      // Le logo n'apparaît qu'après un court instant : si le contenu arrive tout de suite, aucun écran de chargement n'a clignoté.
      style={{ opacity: 0, animation: `ip5-loader-in 0.25s ease ${full ? 0.12 : 0.22}s forwards` }}
      dir="ltr"
    >
      <div className="ip5-loader">
        <div className="ip5-loader-base">{logo}</div>
        <div className="ip5-loader-shine">{logo}</div>
      </div>
    </div>
  );
}
