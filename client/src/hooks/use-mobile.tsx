import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const check = () => {
      // Vrai smartphone ou tablette tactile : écran tactile OU User Agent mobile
      const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
      const isMobileUA = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const isNarrow = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(isNarrow && (isTouch || isMobileUA));
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [])

  return isMobile
}
