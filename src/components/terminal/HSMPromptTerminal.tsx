"use client";

import {
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import PageBarLoader from "@components/loader";
import TerminalHeader from "./TerminalHeader";
import HSMTerminalBody from "./HSMTerminalBody";
import { motion } from "framer-motion";
import { TerminalStoreProvider, useTerminalOverlays } from "@/cli/hooks/useTerminalStore";
import HSMOverlays from "./HSMOverlays";
import { useDock } from "@/context/DockContext";

// Grid and beam configurations (keeping the same visual design)
const GRID_BOX_SIZE = 32;
const BEAM_WIDTH_OFFSET = 1;
const CARD_POS_VH = 60; // 60vh ≈ "3/4 dari atas hampir ke tengah"

export default function HSMPromptTerminal() {
  const { ready } = usePrivy();
  const {
    terminalState: { open, minimized, fullscreen, version },
    closeTerminal,
    minimizeTerminal,
    toggleFullscreenTerminal,
  } = useDock();

  // When closed, keep the background visible
  if (!open) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-slate-950 text-slate-200">
        <BGGrid />
      </div>
    );
  }

  return (
    <TerminalStoreProvider key={version}>
      <HSMTerminalContent
        ready={ready}
        minimized={minimized}
        fullscreen={fullscreen}
        onClose={closeTerminal}
        onMinimize={minimizeTerminal}
        onToggleFullscreen={toggleFullscreenTerminal}
      />
    </TerminalStoreProvider>
  );
}

type HSMTerminalContentProps = {
  ready: boolean;
  minimized: boolean;
  fullscreen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onToggleFullscreen: () => void;
};

function HSMTerminalContent({
  ready,
  minimized,
  fullscreen,
  onClose,
  onMinimize,
  onToggleFullscreen,
}: HSMTerminalContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const overlays = useTerminalOverlays();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPositionReady, setIsPositionReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragCaptureTargetRef = useRef<EventTarget & { releasePointerCapture?: (pointerId: number) => void } | null>(null);
  const pointerUpListenerRef = useRef<((event: PointerEvent) => void) | null>(null);

  const preventDrag = useCallback((event: DragEvent) => {
    event.preventDefault();
  }, []);

  const clampWithinViewport = useCallback(() => {
    if (typeof window === "undefined" || fullscreen) return;
    const node = windowRef.current;
    if (!node) return;
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const maxX = Math.max(window.innerWidth - width, 0);
    const maxY = Math.max(window.innerHeight - height, 0);
    setPosition((prev) => ({
      x: Math.min(Math.max(prev.x, 0), maxX),
      y: Math.min(Math.max(prev.y, 0), maxY),
    }));
  }, []);

  const initializePosition = useCallback(() => {
    if (typeof window === "undefined" || fullscreen) return;
    const node = windowRef.current;
    if (!node) return;
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const centeredX = Math.max((window.innerWidth - width) / 2, 0);
    const desiredY = window.innerHeight * (CARD_POS_VH / 100) - height / 2;
    const maxY = Math.max(window.innerHeight - height, 0);
    const clampedY = Math.min(Math.max(desiredY, 0), maxY);
    setPosition({ x: centeredX, y: clampedY });
    setIsPositionReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      if (fullscreen) {
        setPosition({ x: 0, y: 0 });
        setIsPositionReady(true);
        return;
      }

      if (!isPositionReady) {
        initializePosition();
      } else {
        clampWithinViewport();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, isPositionReady, initializePosition, clampWithinViewport, fullscreen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      clampWithinViewport();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [clampWithinViewport]);

  useEffect(() => {
    if (!fullscreen) {
      setIsPositionReady(false);
    }
  }, [fullscreen]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (fullscreen || minimized) return;
      if (dragPointerIdRef.current !== event.pointerId) return;
      if (typeof window === "undefined") return;
      const node = windowRef.current;
      if (!node) return;
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      const maxX = Math.max(window.innerWidth - width, 0);
      const maxY = Math.max(window.innerHeight - height, 0);
      const nextX = Math.min(
        Math.max(event.clientX - dragOffsetRef.current.x, 0),
        maxX,
      );
      const nextY = Math.min(
        Math.max(event.clientY - dragOffsetRef.current.y, 0),
        maxY,
      );
      setPosition({ x: nextX, y: nextY });
    },
    [],
  );

  const endDrag = useCallback(
    (event?: PointerEvent) => {
      if (event && dragPointerIdRef.current !== event.pointerId) return;
      if (dragPointerIdRef.current === null) return;
      dragCaptureTargetRef.current?.releasePointerCapture?.(dragPointerIdRef.current);
      dragPointerIdRef.current = null;
      dragCaptureTargetRef.current = null;
      setIsDragging(false);
      if (typeof window !== "undefined") {
        window.removeEventListener("pointermove", handlePointerMove);
        if (pointerUpListenerRef.current) {
          window.removeEventListener("pointerup", pointerUpListenerRef.current);
          pointerUpListenerRef.current = null;
        }
      }
    },
    [handlePointerMove],
  );

  const handleDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (typeof window === "undefined" || fullscreen || minimized) return;
      if (event.button !== 0 && event.pointerType !== "touch") return;
      const node = windowRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      dragPointerIdRef.current = event.pointerId;
      dragOffsetRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      dragCaptureTargetRef.current = event.currentTarget;
      setIsDragging(true);
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      const pointerUpHandler = (nativeEvent: PointerEvent) => endDrag(nativeEvent);
      pointerUpListenerRef.current = pointerUpHandler;
      window.addEventListener("pointerup", pointerUpHandler, { passive: true });
    },
    [handlePointerMove, endDrag],
  );

  useEffect(() => {
    return () => {
      endDrag();
      if (typeof window !== "undefined") {
        window.removeEventListener("pointermove", handlePointerMove);
        if (pointerUpListenerRef.current) {
          window.removeEventListener("pointerup", pointerUpListenerRef.current);
          pointerUpListenerRef.current = null;
        }
      }
    };
  }, [handlePointerMove, endDrag]);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-slate-950 text-slate-200"
      onDragStart={preventDrag}
    >
      {/* === Background grid & beams === */}
      <BGGrid />

      {/* === Content === */}
      <div className="relative z-10">
        {minimized ? null : ready ? (
          <div
            ref={windowRef}
            className={
              fullscreen
                ? "fixed inset-0 z-30 flex items-center justify-center"
                : "absolute px-4"
            }
            style={{
              left: fullscreen ? undefined : position.x,
              top: fullscreen ? undefined : position.y,
              visibility: isPositionReady ? "visible" : "hidden",
              userSelect: isDragging ? "none" : undefined,
              width: fullscreen ? "100vw" : undefined,
              height: fullscreen ? "100vh" : undefined,
            }}
          >
            <div
              ref={containerRef}
              onClick={() => inputRef.current?.focus()}
              className={
                fullscreen
                  ? "relative flex h-[calc(100vh-4rem)] w-[calc(100vw-4rem)] cursor-text overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl font-mono"
                  : "mx-auto h-96 w-full max-w-3xl cursor-text overflow-y-auto rounded-2xl border border-slate-800 backdrop-blur shadow-xl font-mono"
              }
              draggable={false}
            >
              <TerminalHeader
                onDragHandle={fullscreen ? undefined : handleDragStart}
                isDragging={isDragging}
                onClose={onClose}
                onMinimize={onMinimize}
                onToggleFullscreen={onToggleFullscreen}
                isFullscreen={fullscreen}
              />
              <div className={fullscreen ? "h-[calc(100%-3rem)] overflow-y-auto" : ""}>
                <HSMTerminalBody inputRef={inputRef} containerRef={containerRef} />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl px-4"
            style={{ top: `${CARD_POS_VH}vh` }}
          >
            <PageBarLoader />
          </div>
        )}
      </div>

      {/* Global overlays positioned at viewport level */}
      <HSMOverlays overlays={overlays.overlays} onDismiss={overlays.dismissOverlay} />
    </div>
  );
}

const BGGrid = () => {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke-width='2' stroke='rgb(30 27 75 / 0.5)'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e")`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/0 to-slate-950/80" />
      <Beams />
    </div>
  );
};

const Beams = () => {
  const placements = [
    { top: GRID_BOX_SIZE * 0, left: GRID_BOX_SIZE * 4 },
    { top: GRID_BOX_SIZE * 12, left: GRID_BOX_SIZE * 8 },
    { top: GRID_BOX_SIZE * 3, left: GRID_BOX_SIZE * 12 },
    { top: GRID_BOX_SIZE * 9, left: GRID_BOX_SIZE * 20 },
    { top: 0, left: GRID_BOX_SIZE * 16 },
  ];

  return (
    <>
      {placements.map((p, i) => (
        <Beam key={i} top={p.top} left={p.left - BEAM_WIDTH_OFFSET} />
      ))}
    </>
  );
};

const Beam = ({ top, left }: { top: number; left: number }) => {
  return (
    <motion.div
      initial={{ y: 0, opacity: 0 }}
      animate={{ opacity: [0, 1, 0], y: GRID_BOX_SIZE * 8 }}
      transition={{
        ease: "easeInOut",
        duration: 3.5,
        repeat: Infinity,
        repeatDelay: 2,
      }}
      style={{ top, left }}
      className="absolute z-0 h-[64px] w-[1px] bg-gradient-to-b from-indigo-500/0 to-indigo-500"
    />
  );
};
