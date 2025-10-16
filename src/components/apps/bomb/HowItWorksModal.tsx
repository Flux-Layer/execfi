"use client";

import { useEffect } from "react";
import OverlayModal from "@/components/common/OverlayModal";

type HowItWorksModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function HowItWorksModal({ open, onClose }: HowItWorksModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <OverlayModal open={open} onClose={onClose} title="How It Works">
      <p>
        Choose your bet, then start the round. Each row hides exactly one bomb. Pick safe tiles to climb
        multipliers calculated as <span className="font-mono text-emerald-300">N / (N - 1) × (1 - edge)</span>.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-400">
        <li>Carry-in displays the cumulative multiplier up to the current row.</li>
        <li>You can cash out anytime; hitting a bomb ends the round with zero payout.</li>
        <li>The layout automatically adjusts to approach a maximum total multiplier close to x1000.</li>
      </ul>
    </OverlayModal>
  );
}
