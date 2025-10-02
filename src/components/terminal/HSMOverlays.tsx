"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Overlay } from "@/cli/state/types";
import { useTerminalOverlays } from "@/cli/hooks/useTerminalStore";

interface HSMOverlaysProps {
  overlays: Overlay[];
  onDismiss: (id?: string) => void;
}

const HSMOverlays = ({ overlays, onDismiss }: HSMOverlaysProps) => {
  const { confirmAction, cancelAction } = useTerminalOverlays();

  // Handle keyboard shortcuts for overlays
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (overlays.length === 0) return;

      const topOverlay = overlays[overlays.length - 1];

      if (topOverlay.kind === "confirm") {
        if (e.key === "Enter") {
          e.preventDefault();
          confirmAction();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelAction();
        }
      } else if (topOverlay.kind === "toast") {
        if (e.key === "Escape") {
          e.preventDefault();
          onDismiss();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [overlays, confirmAction, cancelAction, onDismiss]);

  if (overlays.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <AnimatePresence>
        {overlays.map((overlay, index) => (
          <div key={index} className="pointer-events-auto">
            {overlay.kind === "confirm" && (
              <ConfirmOverlay
                overlay={overlay}
                onConfirm={confirmAction}
                onCancel={cancelAction}
              />
            )}
            {overlay.kind === "toast" && (
              <ToastOverlay overlay={overlay} onDismiss={() => onDismiss()} />
            )}
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Confirmation overlay component
const ConfirmOverlay = ({
  overlay,
  onConfirm,
  onCancel,
}: {
  overlay: Extract<Overlay, { kind: "confirm" }>;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-md w-full shadow-xl"
      >
        <div className="mb-4">
          <p className="text-slate-100 text-lg">{overlay.message}</p>
        </div>

        <div className="flex space-x-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-slate-100 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
          >
            Confirm
          </button>
        </div>

        <div className="mt-4 text-sm text-slate-400 text-center">
          Press <kbd className="bg-slate-700 px-1 rounded">Enter</kbd> to confirm,{" "}
          <kbd className="bg-slate-700 px-1 rounded">Esc</kbd> to cancel
        </div>
      </motion.div>
    </motion.div>
  );
};

// Toast overlay component
const ToastOverlay = ({
  overlay,
  onDismiss,
}: {
  overlay: Extract<Overlay, { kind: "toast" }>;
  onDismiss: () => void;
}) => {
  // Auto-dismiss after ttl
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, overlay.ttlMs);

    return () => clearTimeout(timer);
  }, [overlay.ttlMs, onDismiss]);

  const getToastStyles = () => {
    switch (overlay.level) {
      case "error":
        return "bg-red-900/90 border-red-600 text-red-100";
      case "warn":
        return "bg-yellow-900/90 border-yellow-600 text-yellow-100";
      case "info":
      default:
        return "bg-blue-900/90 border-blue-600 text-blue-100";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: -20, x: "-50%" }}
      className={`absolute top-4 left-1/2 transform border rounded-lg p-3 max-w-sm shadow-lg z-50 ${getToastStyles()}`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-1">
          <p className="text-sm">{overlay.text}</p>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </motion.div>
  );
};

export default HSMOverlays;