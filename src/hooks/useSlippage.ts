// Hook for managing slippage settings

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_SLIPPAGE, normalizeSlippage, formatSlippage } from "@/lib/utils/slippage";

const STORAGE_KEY = "execfi_slippage_default";

/**
 * Hook for managing slippage tolerance settings
 */
export function useSlippage() {
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);
  const [isLoading, setIsLoading] = useState(true);

  // Load slippage from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseFloat(stored);
        const normalized = normalizeSlippage(parsed, false, DEFAULT_SLIPPAGE);
        setSlippage(normalized);
      }
    } catch (error) {
      console.warn("Failed to load slippage from localStorage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update slippage and persist to localStorage
  const updateSlippage = useCallback((newSlippage: number) => {
    const normalized = normalizeSlippage(newSlippage, false, DEFAULT_SLIPPAGE);
    setSlippage(normalized);
    
    try {
      localStorage.setItem(STORAGE_KEY, normalized.toString());
    } catch (error) {
      console.warn("Failed to save slippage to localStorage:", error);
    }
  }, []);

  // Reset to default
  const resetSlippage = useCallback(() => {
    setSlippage(DEFAULT_SLIPPAGE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to remove slippage from localStorage:", error);
    }
  }, []);

  return {
    slippage,
    updateSlippage,
    resetSlippage,
    isLoading,
    formattedSlippage: formatSlippage(slippage),
  };
}
