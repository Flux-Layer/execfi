import React, { useEffect, useState } from "react";
import Image from "next/image";
import logo from "../../../public/execfi.icon.svg";

type TerminalHeaderProps = {
  className?: string;
  onDragHandle?: (event: React.PointerEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
};

const TerminalHeader = ({
  className = "",
  onDragHandle,
  isDragging,
}: TerminalHeaderProps) => {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const locale =
    typeof navigator !== "undefined" && navigator.language
      ? navigator.language
      : "en-US";

  const timeLabel = time.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const headerClasses = [
    "sticky top-0 z-10 border-b border-white/10",
    "bg-slate-900",
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

      {/* clock */}
      <div className="ml-auto text-xs font-mono text-slate-200">{timeLabel}</div>
    </div>
  );
};

export default TerminalHeader;
