"use client";

import type React from "react";
import TerminalHeader from "@/components/terminal/TerminalHeader";

type BombWindowFrameProps = {
  windowRef: React.MutableRefObject<HTMLDivElement | null>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  effectiveFullscreen: boolean;
  fullscreen: boolean;
  isMobile: boolean;
  position: { x: number; y: number };
  isReady: boolean;
  dragging: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onToggleFullscreen: () => void;
  onHeaderDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
};

export function BombWindowFrame({
  windowRef,
  containerRef,
  effectiveFullscreen,
  fullscreen,
  isMobile,
  position,
  isReady,
  dragging,
  onClose,
  onMinimize,
  onToggleFullscreen,
  onHeaderDrag,
  children,
}: BombWindowFrameProps) {
  return (
    <div className="pointer-events-none">
      <div
        ref={windowRef}
        className={
          effectiveFullscreen
            ? "fixed inset-0 z-40 flex items-center justify-center pb-[calc(5rem+env(safe-area-inset-bottom))] pt-safe md:pb-[calc(7rem+env(safe-area-inset-bottom))]"
            : "fixed z-40 px-4"
        }
        style={
          effectiveFullscreen
            ? undefined
            : {
                left: position.x,
                top: position.y,
                visibility: isReady ? "visible" : "hidden",
              }
        }
      >
        <div
          ref={containerRef}
          className={
            effectiveFullscreen
              ? "pointer-events-auto relative flex h-full w-full flex-col overflow-x-hidden overflow-y-auto bg-slate-950/95 font-mono md:h-[calc(95vh-4rem)] md:w-[calc(100vw-4rem)] md:rounded-2xl md:border md:border-slate-800 md:shadow-2xl md:shadow-black/50"
              : "pointer-events-auto relative flex h-[32rem] w-full max-w-4xl flex-col overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-900 bg-slate-950/95 font-mono shadow-2xl shadow-black/60"
          }
        >
          <div className="sticky top-0 z-10">
            <TerminalHeader
              onDragHandle={effectiveFullscreen ? undefined : onHeaderDrag}
              isDragging={dragging}
              onClose={onClose}
              onMinimize={isMobile ? undefined : onMinimize}
              onToggleFullscreen={isMobile ? undefined : onToggleFullscreen}
              isFullscreen={fullscreen}
              showClock={false}
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
