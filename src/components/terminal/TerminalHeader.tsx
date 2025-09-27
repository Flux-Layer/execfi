import React from "react";
import Image from "next/image";
import logo from "../../../public/execfi.icon.svg";

type TerminalHeaderProps = {
  isSessionActive?: boolean;
  className?: string;
  onDragHandle?: (event: React.PointerEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
};

const TerminalHeader = ({
  isSessionActive,
  className = "",
  onDragHandle,
  isDragging,
}: TerminalHeaderProps) => {
  const headerClasses = [
    "sticky top-0 z-10 border-b border-white/10",
    "bg-slate-800/80 backdrop-blur",
    "grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2",
    onDragHandle ? "cursor-grab active:cursor-grabbing select-none" : "",
    isDragging ? "ring-1 ring-blue-500/40" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div onPointerDown={onDragHandle} className={headerClasses}>
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
