"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export const PathFinderLoader = ({ caption = "Initializing" }: { caption?: string }) => {
  return (
    <div className="relative h-screen w-screen bg-neutral-950 overflow-hidden">
      <div className="absolute inset-0 grid place-content-center">
        <PathFinder caption={caption} />
      </div>
    </div>
  );
};

export const PathFinder = ({ caption }: { caption?: string }) => {
  const [loaded, setLoaded] = useState(false);
  const angleRef = useRef(0);
  const lastCellsRef = useRef<string[]>([]);

  useEffect(() => {
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    let raf: number | null = null;
    let last = performance.now();
    const speedDegPerSec = 180; // rotate speed

    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      angleRef.current = (angleRef.current + (speedDegPerSec * dt) / 1000) % 360;
      drawSpinner(angleRef.current);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [loaded]);

  const drawSpinner = (angleDeg: number) => {
    const cx = Math.floor(ROWS / 2);
    const cy = Math.floor(COLS / 2);
    const RING_RATIO = 0.28; // slightly larger ring for visibility
    const radius = Math.max(2, Math.floor(Math.min(ROWS, COLS) * RING_RATIO));

    // Clear previously painted cells for crisp spinner
    if (lastCellsRef.current.length) {
      for (const id of lastCellsRef.current) {
        const el = document.getElementById(id) as HTMLElement | null;
        if (el) {
          el.style.background = "transparent";
          el.style.boxShadow = "none";
        }
      }
    }

    // Neon silver palette (single color)
    const SILVER: [number, number, number] = [192, 192, 255];

    // Draw N dots around the ring to simulate spinner segments
    const segments = 12;
    const newIds: string[] = [];
    for (let i = 0; i < segments; i++) {
      const segAngle = angleDeg - i * (360 / segments);
      const rad = (segAngle * Math.PI) / 180;
      const r = radius;
      const x = Math.round(cx + r * Math.cos(rad));
      const y = Math.round(cy + r * Math.sin(rad));
      const id = `${x}-${y}`;
      const el = document.getElementById(id) as HTMLElement | null;
      if (!el) continue;
      // Neon silver with glow; slight fade per segment
      const [pr, pg, pb] = SILVER;
      const alpha = Math.max(0.7, 1 - i * (0.3 / segments)); // 1.0 -> 0.7
      el.style.background = `rgba(${pr},${pg},${pb},${alpha})`;
      el.style.boxShadow = `0 0 14px rgba(${pr},${pg},${pb},${alpha})`;
      newIds.push(id);
    }

    lastCellsRef.current = newIds;
  };

  const generateBoxes = () => {
    const els = [] as React.ReactNode[];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        els.push(
          <div
            data-visited="false"
            id={`${r}-${c}`}
            className="game-box col-span-1 aspect-square w-full transition-colors duration-400"
            key={`${r}-${c}`}
          />
        );
      }
    }

    return <>{els}</>;
  };

  return (
    <div className="relative w-[38vmin] aspect-square">
      <div
        className="grid absolute inset-0"
        style={{
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
        }}
      >
        {generateBoxes()}
      </div>
      {caption && (
        <div className="absolute inset-0 grid place-content-center pointer-events-none">
          <div className="text-sm font-mono tracking-widest uppercase select-none neon-silver animate-fadePulse">
            {caption}
          </div>
        </div>
      )}
    </div>
  );
};

const START_COLOR = "#8b5cf6";
const GOAL_COLOR = "#10b981";
const FLOOD_COLOR = "#404040";
const FOUND_PATH_COLOR = "#FFFFFF";

const ROWS = 25;
const COLS = 25;

type Coordinate = {
  top: number;
  left: number;
};

const sleep = async (ms: number) => new Promise((r) => setTimeout(r, ms));

export default PathFinderLoader;
