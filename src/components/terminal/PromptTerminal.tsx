"use client";

import { useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import PageBarLoader from "@components/loader";
import TerminalHeader from "./TerminalHeader";
import TerminalBody from "./TerminalBody";
import { motion } from "framer-motion";
import useBiconomyWithSessionKey from "@/hooks/useBiconomyWithSessionKey";

// ukuran grid
const GRID_BOX_SIZE = 32;
const BEAM_WIDTH_OFFSET = 1;

// Geser posisi vertikal di sini (dalam vh)
const CARD_POS_VH = 60; // 60vh ≈ “3/4 dari atas hampir ke tengah”

export default function PromptTerminal() {
  const { ready } = usePrivy();
  const { isSessionActive } = useBiconomyWithSessionKey();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-200">
      {/* === Background grid & beams === */}
      <BGGrid />

      {/* === Content === */}
      <div className="relative z-10">
        {ready ? (
          <div
            // posisi: center horizontal, sekitar 60vh vertical
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-4"
            style={{ top: `${CARD_POS_VH}vh` }}
          >
            <div
              ref={containerRef}
              onClick={() => inputRef.current?.focus()}
              className="mx-auto h-96 w-full max-w-3xl cursor-text overflow-y-auto rounded-2xl border border-slate-800 backdrop-blur shadow-xl font-mono"
            >
              <TerminalHeader headerTitle="Kentank" />
              <TerminalBody inputRef={inputRef} containerRef={containerRef} />
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
    { top: GRID_BOX_SIZE * 0,  left: GRID_BOX_SIZE * 4  },
    { top: GRID_BOX_SIZE * 12, left: GRID_BOX_SIZE * 8  },
    { top: GRID_BOX_SIZE * 3,  left: GRID_BOX_SIZE * 12 },
    { top: GRID_BOX_SIZE * 9,  left: GRID_BOX_SIZE * 20 },
    { top: 0,                  left: GRID_BOX_SIZE * 16 },
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
      transition={{ ease: "easeInOut", duration: 3.5, repeat: Infinity, repeatDelay: 2 }}
      style={{ top, left }}
      className="absolute z-0 h-[64px] w-[1px] bg-gradient-to-b from-indigo-500/0 to-indigo-500"
    />
  );
};
