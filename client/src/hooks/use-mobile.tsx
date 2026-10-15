import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const isMobileUA = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const isNarrow = window.innerWidth < MOBILE_BREAKPOINT;
    return isNarrow && (isTouch || isMobileUA);
  });

  React.useEffect(() => {
    const check = () => {
      const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
      const isMobileUA = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const isNarrow = typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(isNarrow && (isTouch || isMobileUA));
    };
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [])

  return isMobile
}
