import React from "react";
import Image from "next/image";
import logo from "../../../public/execfi.icon.svg";

type TerminalHeaderProps = {
  isSessionActive?: boolean;
  className?: string;
};

const TerminalHeader = ({ isSessionActive, className = "" }: TerminalHeaderProps) => {
  return (
    <div
      className={[
        "sticky top-0 z-10 border-b border-white/10",
        "bg-slate-800/80 backdrop-blur",
        "grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2",
        className,
      ].join(" ")}
    >
      {/* traffic lights (left) */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="h-3 w-3 rounded-full bg-green-500" />
        </div>
      </div>

      {/* centered logo */}
      <div className="justify-self-center">
        <Image src={logo} alt="ExecFi Logo" className="h-6 w-auto" />
      </div>

      {/* session badge (right) */}
      <div className="ml-auto flex items-center gap-2">
        {isSessionActive && (
          <span className="text-xs text-green-400 bg-green-900/25 px-2 py-0.5 rounded border border-green-500/20">
            🔑 Session Active
          </span>
        )}
      </div>
    </div>
  );
};

export default TerminalHeader;
