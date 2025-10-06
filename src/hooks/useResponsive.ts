"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768; // md breakpoint

export function useResponsive() {
  const [isMobile, setIsMobile] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      setIsReady(true);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return { isMobile, isDesktop: !isMobile, isReady };
}
