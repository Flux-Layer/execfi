"use client";

import { useCallback, useRef } from "react";

type GestureHandlers = {
  onSwipeDown?: () => void;
  onSwipeUp?: () => void;
  threshold?: number;
};

export function useTouchGestures({ onSwipeDown, onSwipeUp, threshold = 150 }: GestureHandlers) {
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null || touchStartX.current === null) return;

      const touchEndY = e.changedTouches[0].clientY;
      const touchEndX = e.changedTouches[0].clientX;
      const deltaY = touchEndY - touchStartY.current;
      const deltaX = touchEndX - touchStartX.current;

      // Only trigger if vertical movement is dominant
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        if (deltaY > threshold && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < -threshold && onSwipeUp) {
          onSwipeUp();
        }
      }

      touchStartY.current = null;
      touchStartX.current = null;
    },
    [onSwipeDown, onSwipeUp, threshold]
  );

  return { handleTouchStart, handleTouchEnd };
}
