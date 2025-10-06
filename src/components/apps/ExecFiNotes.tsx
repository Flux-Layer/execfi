"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import TerminalHeader from "@/components/terminal/TerminalHeader";
import { useDock } from "@/context/DockContext";
import { useResponsive } from "@/hooks/useResponsive";

export default function ExecFiNotesWindow() {
  const {
    docsState: { open, minimized, fullscreen, version },
    closeDocs,
    minimizeDocs,
    toggleFullscreenDocs,
  } = useDock();

  if (!open) return null;

  return (
    <ExecFiNotesContent
      key={version}
      minimized={minimized}
      fullscreen={fullscreen}
      onClose={closeDocs}
      onMinimize={minimizeDocs}
      onToggleFullscreen={toggleFullscreenDocs}
    />
  );
}

type Props = {
  minimized: boolean;
  fullscreen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onToggleFullscreen: () => void;
};

function ExecFiNotesContent({ minimized, fullscreen, onClose, onMinimize, onToggleFullscreen }: Props) {
  const { isMobile } = useResponsive();
  const windowRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  // On mobile, always treat as fullscreen
  const effectiveFullscreen = fullscreen || isMobile;

  const initPos = useCallback(() => {
    if (typeof window === "undefined" || effectiveFullscreen) return;
    const node = windowRef.current;
    if (!node) return;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    setPos({ x: Math.max((window.innerWidth - w) / 2, 0), y: Math.max((window.innerHeight - h) / 2, 0) });
    setIsReady(true);
  }, [effectiveFullscreen]);

  useEffect(() => {
    const r = requestAnimationFrame(initPos);
    return () => cancelAnimationFrame(r);
  }, [initPos]);

  // Clamp within viewport on resize when windowed
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      if (effectiveFullscreen) return;
      const node = windowRef.current;
      if (!node) return;
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      const maxX = Math.max(window.innerWidth - w, 0);
      const maxY = Math.max(window.innerHeight - h, 0);
      setPos((p) => ({ x: Math.min(Math.max(p.x, 0), maxX), y: Math.min(Math.max(p.y, 0), maxY) }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [effectiveFullscreen]);

  // When leaving fullscreen, re-init position smoothly
  useEffect(() => {
    if (!effectiveFullscreen) setIsReady(false);
  }, [effectiveFullscreen]);

  // Auto-scroll to bottom when entering fullscreen
  useEffect(() => {
    if (effectiveFullscreen && containerRef.current) {
      const scrollToBottom = () => {
        const scrollable = containerRef.current?.querySelector('[class*="overflow"]');
        if (scrollable) {
          scrollable.scrollTop = scrollable.scrollHeight;
        }
      };

      requestAnimationFrame(() => {
        scrollToBottom();
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 150);
      });
    }
  }, [effectiveFullscreen]);

  if (minimized) return null;

  return (
    <div className="pointer-events-none">
      <div
        ref={windowRef}
        className={effectiveFullscreen ? "fixed inset-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-[calc(7rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-center pt-safe" : "fixed px-4 z-40"}
        style={effectiveFullscreen ? undefined : { left: pos.x, top: pos.y, visibility: isReady ? "visible" : "hidden" }}
      >
        <div
          ref={containerRef}
          className={
            effectiveFullscreen
              ? "relative flex flex-col h-full w-full md:h-[calc(95vh-4rem)] md:w-[calc(100vw-4rem)] cursor-default overflow-hidden md:rounded-2xl border-0 md:border md:border-slate-800 bg-slate-900/95 shadow-2xl font-mono pointer-events-auto"
              : "mx-auto h-[28rem] w-full max-w-3xl cursor-default overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-xl font-mono pointer-events-auto"
          }
        >
          <TerminalHeader
            onDragHandle={(e) => {
              if (effectiveFullscreen) return;
              const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
              const offsetX = e.clientX - rect.left;
              const offsetY = e.clientY - rect.top;
              setDragging(true);
              const onMove = (ev: PointerEvent) => {
                setPos({ x: Math.max(0, ev.clientX - offsetX), y: Math.max(0, ev.clientY - offsetY) });
              };
              const onUp = () => {
                setDragging(false);
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
              };
              window.addEventListener("pointermove", onMove, { passive: true });
              window.addEventListener("pointerup", onUp, { passive: true });
            }}
            isDragging={dragging}
            onClose={onClose}
            onMinimize={isMobile ? undefined : onMinimize}
            onToggleFullscreen={isMobile ? undefined : onToggleFullscreen}
            isFullscreen={fullscreen}
            showClock={false}
          />
          <div className={effectiveFullscreen ? "h-[calc(100%-3rem)] overflow-hidden" : "h-[calc(100%-3rem)] overflow-hidden"}>
            <NotesApp />
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple notes app (read‑only execFi note + user notes CRUD)
type Note = { id: string; title: string; content: string; createdAt: number; updatedAt: number; readonly?: boolean };
const LS_KEY = "notes-app-v1";

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Default with execFi read-only note
  const now = Date.now();
  const execfi: Note = {
    id: "execfi",
    title: "execFi",
    content:
      "ExecFi turns natural language into safe, verifiable on‑chain actions via Privy Smart Accounts (ERC‑4337).\n\n" +
      "How it works:\n- Intent parse → normalize → validate → simulate → execute → monitor\n- Smart‑accounts‑only (non‑custodial), JSON contracts over prose\n- Idempotency guard to prevent duplicate sends\n- Explorer link and concise UX copy after execution\n\n" +
      "Try now:\n- Native ETH transfers on Base / Base Sepolia\n- Smart Account execution via Privy\n- AI‑assisted prompts with clarification\n\n" +
      "Coming next:\n- ERC‑20 transfers, approvals/permits\n- Swap/bridge via LI.FI with route policies\n- Session keys, daily caps, journaling persistence\n",
    createdAt: now,
    updatedAt: now,
    readonly: true,
  };
  return [execfi];
}

function saveNotes(notes: Note[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(notes)); } catch {}
}

export function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const initial = loadNotes();
    setNotes(initial);
    setSelectedId(initial[0]?.id ?? null);
  }, []);

  useEffect(() => { saveNotes(notes); }, [notes]);

  const selected = notes.find(n => n.id === selectedId) || null;
  const isReadonly = !!selected?.readonly;

  const addNote = () => {
    const now = Date.now();
    const newNote: Note = { id: `n_${now}`, title: "Untitled", content: "", createdAt: now, updatedAt: now };
    setNotes([newNote, ...notes]);
    setSelectedId(newNote.id);
  };

  const deleteNote = (id: string) => {
    const target = notes.find(n => n.id === id);
    if (!target || target.readonly) return;
    const next = notes.filter(n => n.id !== id);
    setNotes(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };

  const updateNote = (patch: Partial<Note>) => {
    if (!selected) return;
    if (selected.readonly) return;
    const now = Date.now();
    setNotes(notes.map(n => n.id === selected.id ? { ...n, ...patch, updatedAt: now } : n));
  };

  const execFi = notes.find(n => n.id === 'execfi');
  const userNotes = notes.filter(n => n.id !== 'execfi');

  // Drag & drop reordering for user notes (execFi pinned on top)
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const reorderToTarget = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const srcIdx = notes.findIndex(n => n.id === sourceId);
    const tgtIdx = notes.findIndex(n => n.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    // Keep execFi pinned at index 0
    if (notes[srcIdx]?.id === 'execfi') return;
    const minIndex = execFi ? 1 : 0;
    const next = notes.slice();
    const [item] = next.splice(srcIdx, 1);
    const insertAt = Math.max(minIndex, tgtIdx);
    next.splice(insertAt, 0, item);
    setNotes(next);
  };

  return (
    <div className="h-full w-full flex divide-x divide-slate-800">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900/60 p-3 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-slate-300 font-semibold">Notes</span>
          <button onClick={addNote} className="text-xs px-2 py-1 rounded border border-slate-700 text-slate-200 hover:bg-slate-800">New</button>
        </div>
        <div className="space-y-2">
          {/* Pinned execFi at top */}
          {execFi && (
            <button
              key={execFi.id}
              onClick={() => setSelectedId(execFi.id)}
              className={`w-full text-left p-2 rounded border ${selectedId===execFi.id? 'border-emerald-600 bg-slate-800/60' : 'border-slate-800 hover:bg-slate-800/40'} `}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-200 font-medium truncate">{execFi.title}</span>
                <span className="text-[10px] text-slate-400">read‑only</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">{new Date(execFi.updatedAt).toLocaleString()}</div>
            </button>
          )}

          {/* User notes with drag to reorder */}
          {userNotes.map((n) => (
            <div
              key={n.id}
              draggable
              onDragStart={() => setDragId(n.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(n.id); }}
              onDrop={(e) => { e.preventDefault(); if (dragId) reorderToTarget(dragId, n.id); setDragId(null); setDragOverId(null); }}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              className={`rounded border ${selectedId===n.id? 'border-emerald-600 bg-slate-800/60' : 'border-slate-800 hover:bg-slate-800/40'} ${dragOverId===n.id ? 'ring-1 ring-emerald-500/40' : ''}`}
            >
              <button onClick={() => setSelectedId(n.id)} className="w-full text-left p-2 cursor-move">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-200 font-medium truncate">{n.title}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{new Date(n.updatedAt).toLocaleString()}</div>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Editor */}
      <section className="flex-1 p-4 overflow-y-auto">
        {!selected ? (
          <div className="text-slate-400 text-sm">No note selected</div>
        ) : (
          <div className="h-full flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <input
                value={selected.title}
                disabled={isReadonly}
                onChange={e => updateNote({ title: e.target.value })}
                className="flex-1 bg-slate-900/60 text-slate-100 text-sm px-3 py-2 rounded border border-slate-700 outline-none focus:border-emerald-600"
              />
              <button
                onClick={() => !isReadonly && deleteNote(selected.id)}
                disabled={isReadonly}
                className={`text-xs px-2 py-1 rounded border ${isReadonly? 'border-slate-700 text-slate-500' : 'border-red-700 text-red-300 hover:bg-red-900/20'}`}
              >Delete</button>
            </div>
            <textarea
              value={selected.content}
              disabled={isReadonly}
              onChange={e => updateNote({ content: e.target.value })}
              className="flex-1 resize-none bg-slate-900/60 text-slate-100 text-sm p-3 rounded border border-slate-700 outline-none focus:border-emerald-600 leading-relaxed"
            />
          </div>
        )}
      </section>
    </div>
  );
}