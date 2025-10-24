"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import useUserXp from "@/hooks/useUserXp";
import { useDock } from "@/context/DockContext";
import { useTerminalInput } from "@/cli/hooks/useTerminalStore";
import {
  TbPlugConnected,
  TbPlugConnectedX,
  TbCopy,
  TbCopyCheck,
} from "react-icons/tb";
import { FaWallet } from "react-icons/fa6";

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

const SCRAMBLE_CHARS = "!@#$%^&*():{};|,.<>/?";
const SCRAMBLE_CYCLES_PER_LETTER = 2;
const SCRAMBLE_INTERVAL_MS = 50;

type ScrambleActionButtonProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

function ScrambleActionButton({
  label,
  icon,
  onClick,
}: ScrambleActionButtonProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [displayText, setDisplayText] = useState(label);

  const stopScramble = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDisplayText(label);
  }, [label]);

  const scramble = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    let iteration = 0;
    intervalRef.current = setInterval(() => {
      const scrambled = label
        .split("")
        .map((char, index) => {
          if (iteration / SCRAMBLE_CYCLES_PER_LETTER > index) {
            return char;
          }
          const randomChar =
            SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          return randomChar;
        })
        .join("");

      setDisplayText(scrambled);
      iteration += 1;

      if (iteration >= label.length * SCRAMBLE_CYCLES_PER_LETTER) {
        stopScramble();
      }
    }, SCRAMBLE_INTERVAL_MS);
  }, [label, stopScramble]);

  useEffect(() => {
    setDisplayText(label);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [label]);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={scramble}
      onMouseLeave={stopScramble}
      onFocus={scramble}
      onBlur={stopScramble}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-neutral-500/50 bg-neutral-800/80 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-300 transition-colors hover:text-indigo-300"
    >
      <div className="relative z-10 flex items-center gap-2">
        {icon}
        <span>{displayText}</span>
      </div>
      <motion.span
        initial={{ y: "100%" }}
        animate={{ y: "-100%" }}
        transition={{
          repeat: Infinity,
          repeatType: "mirror",
          duration: 1,
          ease: "linear",
        }}
        className="absolute inset-0 z-0 scale-125 bg-gradient-to-t from-indigo-400/0 from-40% via-indigo-400/70 to-indigo-400/0 to-60% opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
    </motion.button>
  );
}

export default function StatusBar() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { openTerminal } = useDock();
  const { setInputText, submitInput } = useTerminalInput();
  const [mounted, setMounted] = useState(false);
  const [clockDisplay, setClockDisplay] = useState<string>("—");
  const [dateDisplay, setDateDisplay] = useState<string>("—");
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const [xpTooltipOpen, setXpTooltipOpen] = useState(false);
  const xpTooltipRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  const walletAddress =
    ready && authenticated ? user?.wallet?.address ?? null : null;
  const normalizedAddress = walletAddress
    ? (walletAddress as `0x${string}`)
    : null;
  const walletConnected = Boolean(normalizedAddress);
  const walletLabel = walletConnected
    ? truncateAddress(normalizedAddress!)
    : "Wallet not connected";

  const {
    formatted: {
      total: formattedTotalXp,
      breakdown: formattedXpBreakdown = [],
    },
    isLoading: xpLoading,
    isFetching: xpFetching,
    isError: xpError,
  } = useUserXp({ address: normalizedAddress });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const updateClock = () => {
      const now = new Date();
      setClockDisplay(timeFormatter.format(now));
      setDateDisplay(dateFormatter.format(now));
    };
    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, [mounted]);

  useEffect(() => {
    if (!walletMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (
        walletMenuRef.current &&
        !walletMenuRef.current.contains(event.target as Node)
      ) {
        setWalletMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [walletMenuOpen]);

  useEffect(() => {
    setWalletMenuOpen(false);
  }, [walletConnected]);

  useEffect(() => {
    if (!walletConnected) {
      setXpTooltipOpen(false);
    }
  }, [walletConnected]);

  useEffect(() => {
    if (!xpTooltipOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setXpTooltipOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [xpTooltipOpen]);

  const toggleWalletMenu = () => {
    setWalletMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!walletMenuOpen) {
      setCopied(false);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    }
  }, [walletMenuOpen]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  const handleCopyAddress = useCallback(async () => {
    if (!normalizedAddress) return;
    try {
      await navigator.clipboard.writeText(normalizedAddress);
      setCopied(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 1600);
    } catch (error) {
      console.error("Failed to copy address", error);
    }
  }, [normalizedAddress]);

  const handleLogin = () => {
    setWalletMenuOpen(false);
    openTerminal();
    setInputText("/login");
    submitInput("/login");
  };

  const handleLogout = async () => {
    setWalletMenuOpen(false);
    try {
      await logout?.();
    } catch (error) {
      console.error("Failed to logout", error);
    }
  };

  const showXpTooltip = () => setXpTooltipOpen(true);
  const hideXpTooltip = () => setXpTooltipOpen(false);
  const toggleXpTooltip = () => setXpTooltipOpen((prev) => !prev);

  const handleXpKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleXpTooltip();
    }
  };

  const xpDisplay = walletConnected
    ? xpLoading && !formattedTotalXp
      ? "Loading…"
      : xpError
      ? "Unavailable"
      : formattedTotalXp ?? "0"
    : "—";

  const xpBreakdownItems = walletConnected
    ? formattedXpBreakdown.map((item) => ({
        label: item.label,
        value:
          xpLoading && !item.value
            ? "Loading…"
            : xpError
            ? "Unavailable"
            : item.value ?? "0",
      }))
    : [];

  return (
    <div className="pointer-events-none fixed top-0 left-0 right-0 z-30 flex justify-center px-3 pt-1 sm:pt-2 lg:justify-end lg:px-5 lg:pt-3">
      <div className="pointer-events-auto grid w-full max-w-md grid-cols-[auto_auto] items-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2 text-[11px] font-medium text-slate-200 shadow-lg backdrop-blur-md sm:max-w-xl sm:grid-cols-[auto_auto_auto] sm:px-4 sm:text-xs lg:w-auto lg:max-w-fit lg:flex lg:h-12 lg:items-center lg:gap-4 lg:px-5 lg:text-sm">
        <div className="flex items-center gap-2 lg:gap-3">
          <span className="tracking-[0.3em] text-slate-400">
            ExecFi OS
          </span>
          <div className="hidden h-4 w-px bg-white/10 lg:block" aria-hidden />
          <div className="relative flex items-center gap-1 lg:gap-2" ref={walletMenuRef}>
            <FaWallet className={walletConnected ? "text-emerald-400" : ""}/>
            <button
              type="button"
              onClick={toggleWalletMenu}
              aria-haspopup="menu"
              aria-expanded={walletMenuOpen}
              className={`max-w-[140px] truncate text-left text-slate-300 transition-colors ${
                walletMenuOpen ? "text-slate-100" : "hover:text-slate-100"
              }`}
            >
              {walletLabel}
            </button>
            {walletMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-xs text-slate-200 shadow-lg lg:left-auto lg:right-0 lg:mt-4 lg:w-44">
                {walletConnected ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-200 transition-colors hover:border-indigo-400/60 hover:text-indigo-300"
                    >
                      {copied ? (
                        <TbCopyCheck className="h-3.5 w-3.5" />
                      ) : (
                        <TbCopy className="h-3.5 w-3.5" />
                      )}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                    <ScrambleActionButton
                      label="Disconnect"
                      icon={<TbPlugConnected className="h-3.5 w-3.5" />}
                      onClick={handleLogout}
                    />
                  </div>
                ) : (
                  <ScrambleActionButton
                    label="Connect"
                    icon={<TbPlugConnectedX className="h-3.5 w-3.5" />}
                    onClick={handleLogin}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <div
          ref={xpTooltipRef}
          className="relative flex items-center gap-2 lg:gap-3"
          role="button"
          tabIndex={0}
          onMouseEnter={showXpTooltip}
          onMouseLeave={hideXpTooltip}
          onFocus={showXpTooltip}
          onBlur={hideXpTooltip}
          onKeyDown={handleXpKeyDown}
        >
          <span className="text-slate-400">Total XP</span>
          <span className={`font-semibold ${xpFetching ? "opacity-70" : ""}`}>
            {xpDisplay}
          </span>
          {xpTooltipOpen && (
            <div className="absolute left-0 top-full z-10 mt-2 w-[calc(100vw-2.5rem)] max-w-xs rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-lg sm:left-auto sm:right-0 sm:w-56 sm:max-w-none">
              <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-slate-400">
                XP Breakdown
              </div>
              {walletConnected ? (
                <div className="space-y-2">
                  <dl className="space-y-1">
                    {xpBreakdownItems.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-1"
                      >
                        <dt className="text-slate-300">{item.label}</dt>
                        <dd className="font-medium text-slate-100">
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="text-slate-400">Total</span>
                    <span className="font-semibold text-slate-50">
                      {xpDisplay}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">
                  Connect wallet to view per-game breakdown.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          <span className="font-semibold tracking-wide">{clockDisplay}</span>
          <span className="text-slate-300">{dateDisplay}</span>
        </div>
      </div>
    </div>
  );
}
