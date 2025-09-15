"use client";

import { useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import PageBarLoader from "@components/loader";
import TerminalHeader from "./TerminalHeader";
import TerminalBody from "./TerminalBody";

const PromptTerminal = () => {
  const { ready } = usePrivy();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section
      style={{
        backgroundImage:
          "url(https://images.unsplash.com/photo-1482686115713-0fbcaced6e28?auto=format&fit=crop&w=1734&q=80)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      className="w-full h-full px-4 py-12 bg-violet-600"
    >
      {ready ? (
        <div
          ref={containerRef}
          onClick={() => inputRef.current?.focus()}
          className="h-96 bg-slate-950/70 backdrop-blur rounded-lg w-full max-w-3xl mx-auto overflow-y-scroll shadow-xl cursor-text font-mono"
        >
          <TerminalHeader headerTitle="Kentank" />
          <TerminalBody inputRef={inputRef} containerRef={containerRef} />
        </div>
      ) : (
        <PageBarLoader />
      )}
    </section>
  );
};

export default PromptTerminal;
