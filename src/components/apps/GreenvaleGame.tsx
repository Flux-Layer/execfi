"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import clsx from "clsx";
import { toast, Toaster } from "react-hot-toast";
import {
  Map as MapIcon,
  BookOpen,
  CloudRain,
  Sun,
  Home,
  Store,
  ShoppingCart,
} from "lucide-react";
import TerminalHeader from "@/components/terminal/TerminalHeader";
import { useDock } from "@/context/DockContext";
import { useResponsive } from "@/hooks/useResponsive";
import {
  formatEther,
  parseEther,
  zeroAddress,
  type AbiEvent,
  type Hex,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { useAccount, usePublicClient, useReadContract, useSwitchChain } from "wagmi";
import { useEOA } from "@/providers/EOAProvider";
import useGreenvaleConfig, {
  type UseGreenvaleConfigResult,
} from "@/hooks/useGreenvaleConfig";
import useGreenvaleActions, {
  type MarketplaceListingInfo,
} from "@/hooks/useGreenvaleActions";
import useGreenvalePlots, {
  type GreenvalePlot,
} from "@/hooks/useGreenvalePlots";
import useGreenvaleInventory, {
  type UseGreenvaleInventoryResult,
} from "@/hooks/useGreenvaleInventory";
import {
  FARMING_CHAIN_ID,
  LAND721_ADDRESS,
  MARKETPLACE_ADDRESS,
  MARKETPLACE_DEPLOYMENT_BLOCK,
  MARKETPLACE_LOOKBACK_BLOCKS,
} from "@/lib/contracts/addresses";
import { usePrivy } from "@privy-io/react-auth";

type BuildingKey = "home" | "shop" | "marketplace";

type Building = {
  key: BuildingKey;
  label: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  style: CSSProperties;
};

const PIXEL_PATTERN =
  "data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='32' height='32' fill='none'/%3E%3Cpath d='M0 16h16v16H0z' fill='%2391c262' opacity='0.35'/%3E%3Cpath d='M16 0h16v16H16z' fill='%239acc6d' opacity='0.35'/%3E%3C/svg%3E";

const BUILDINGS: Building[] = [
  {
    key: "home",
    label: "Greenvale Village",
    subtitle: "Central Hub",
    icon: Home,
    style: { top: "22%", left: "50%" },
  },
  {
    key: "marketplace",
    label: "Marketplace",
    subtitle: "Player Trades",
    icon: ShoppingCart,
    style: { top: "25%", left: "24%" },
  },
  {
    key: "shop",
    label: "Farm Shop",
    subtitle: "Seeds & Tools",
    icon: Store,
    style: { top: "25%", left: "76%" },
  },
];

const MAX_LAND_PER_ACCOUNT = 4;
const TOOL_TOKEN_BASE = 100_000;
const SEED_TOKEN_BASE = 200_000;
const WATER_TOKEN_ID = 300_000;
const MARKETPLACE_1155_PREFILL_KEY = "greenvale-marketplace-prefill-1155";
const MARKETPLACE_LISTING_CREATED_EVENT_ABI = [
  {
    type: "event",
    name: "MarketplaceListingCreated",
    inputs: [
      { name: "listingId", type: "bytes32", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "asset", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "pricePerUnit", type: "uint128", indexed: false },
      { name: "currency", type: "address", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
    ],
  },
] as const satisfies AbiEvent[];
const MIN_MARKETPLACE_LOG_BLOCK_SPAN = 9n;
const MAX_MARKETPLACE_LOG_BLOCK_SPAN = 20_000n;
const DEFAULT_MARKETPLACE_LOOKBACK_BLOCKS = 200_000n;
const MAX_MARKETPLACE_LOG_REQUESTS = 120;

export default function GreenvaleGameWindow() {
  const {
    greenvaleState: { open, minimized, fullscreen, version },
    closeGreenvale,
    minimizeGreenvale,
    toggleFullscreenGreenvale,
  } = useDock();

  if (!open) return null;

  return (
    <GreenvaleGameContent
      key={version}
      minimized={minimized}
      fullscreen={fullscreen}
      onClose={closeGreenvale}
      onMinimize={minimizeGreenvale}
      onToggleFullscreen={toggleFullscreenGreenvale}
    />
  );
}

type GreenvaleProps = {
  minimized: boolean;
  fullscreen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onToggleFullscreen: () => void;
};

function GreenvaleGameContent({
  minimized,
  fullscreen,
  onClose,
  onMinimize,
  onToggleFullscreen,
}: GreenvaleProps) {
  const weather = useMemo(
    () => ({
      today: { label: "Stormy", bonus: "+10% XP", icon: CloudRain },
      next: { label: "Tomorrow · Breezy", icon: Sun },
    }),
    []
  );
  const { isMobile } = useResponsive();
  const { selectedWallet } = useEOA();
  const {
    address: wagmiAddress,
    chainId: wagmiChainId,
    isConnected: isWagmiConnected,
  } = useAccount();
  const windowRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [activeBuilding, setActiveBuilding] = useState<BuildingKey | null>(null);
  const [unlockingSlot, setUnlockingSlot] = useState<number | null>(null);
  const { ready: privyReady, login } = usePrivy();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Greenvale] Active building changed:", activeBuilding);
    }
  }, [activeBuilding]);

  const {
    seeds,
    tools,
    waterPriceWei,
    waterActive,
    landPriceWei,
    landActive,
    global,
    isLoading: isConfigLoading,
    error: configError,
    hasRegistry,
    refetch,
  } = useGreenvaleConfig();
  const activeAddress = useMemo(
    () =>
      (selectedWallet?.address ?? wagmiAddress ?? null) as
        | `0x${string}`
        | null,
    [selectedWallet?.address, wagmiAddress],
  );
  const actions = useGreenvaleActions({
    account: activeAddress,
    connectedWallet: selectedWallet ?? null,
  });
  const inventorySeedTypes = useMemo(
    () => seeds.map((seed) => seed.seedType),
    [seeds],
  );
  const inventoryToolRarities = useMemo(
    () => tools.map((tool) => tool.rarity),
    [tools],
  );
  const inventory = useGreenvaleInventory(
    activeAddress,
    inventorySeedTypes,
    inventoryToolRarities,
  );
  const {
    plots,
    readyPlotIds,
    isLoading: plotsLoading,
    error: plotsError,
    refetch: refetchPlots,
  } = useGreenvalePlots(activeAddress);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[Greenvale] Account:", activeAddress);
    }
  }, [activeAddress]);
  const landBalanceQuery = useReadContract({
    address: LAND721_ADDRESS ?? zeroAddress,
    abi: [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ] as const,
    functionName: "balanceOf",
    args: [activeAddress ?? zeroAddress],
    chainId: FARMING_CHAIN_ID,
    query: {
      enabled: Boolean(activeAddress && LAND721_ADDRESS),
      refetchInterval: 15_000,
    },
  });
  const rawBalance = landBalanceQuery.data;
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[Greenvale] Land balance raw:", rawBalance);
    }
  }, [rawBalance]);
  const landBalanceNumber = useMemo(() => {
    if (typeof rawBalance === "bigint") {
      return Number(rawBalance);
    }
    const numericBalance = Number(rawBalance ?? 0);
    return Number.isFinite(numericBalance) ? numericBalance : 0;
  }, [rawBalance]);
  const ownedLandCount = useMemo(
    () => Math.max(plots.length, landBalanceNumber),
    [landBalanceNumber, plots.length],
  );
  const hasLand = ownedLandCount > 0;
  const unlockPriceLabel = useMemo(
    () =>
      landPriceWei !== null
        ? `${formatEther(landPriceWei)} ETH`
        : null,
    [landPriceWei],
  );
  const resolveUnlockError = useCallback((err: unknown) => {
    if (!err) return "Transaksi gagal";
    if (typeof err === "object" && err && "shortMessage" in (err as any)) {
      const short = (err as { shortMessage?: string }).shortMessage;
      if (short) return short;
    }
    if (err instanceof Error) return err.message;
    return String(err);
  }, []);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        "[Greenvale] Owned land count:",
        ownedLandCount,
        "plots:",
        plots.map((plot) => plot.landId),
      );
    }
  }, [ownedLandCount, plots]);
  const refetchLandBalance = useCallback(async () => {
    if (landBalanceQuery.refetch) {
      await landBalanceQuery.refetch();
    }
  }, [landBalanceQuery.refetch, activeAddress]);

  const desiredChainHex = useMemo(
    () => `0x${FARMING_CHAIN_ID.toString(16)}` as Hex,
    [],
  );
  const { switchChainAsync } = useSwitchChain();
  const walletChainId = useMemo(() => {
    const chainIdString = selectedWallet?.chainId;
    if (chainIdString) {
      const segments = chainIdString.split(":");
      const maybe = segments[segments.length - 1];
      const parsed = Number(maybe);
      if (Number.isFinite(parsed)) return parsed;
    }
    return typeof wagmiChainId === "number" ? wagmiChainId : null;
  }, [selectedWallet?.chainId, wagmiChainId]);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[Greenvale] Chain ID:", walletChainId);
    }
  }, [walletChainId]);
  const isWalletConnected = Boolean(activeAddress);
  const needsChainSwitch =
    isWalletConnected && walletChainId !== null && walletChainId !== FARMING_CHAIN_ID;

  const targetChainLabel = useMemo(() => {
    if (FARMING_CHAIN_ID === base.id) return "Base";
    if (FARMING_CHAIN_ID === baseSepolia.id) return "Base Sepolia";
    return `Chain ${FARMING_CHAIN_ID}`;
  }, []);

  const handleSwitchChain = useCallback(async () => {
    if (!selectedWallet && !isWagmiConnected) {
      toast.error("Wallet belum tersambung");
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[Greenvale] Switch chain requested but no connected wallet detected",
        );
      }
      return;
    }
    try {
      if (selectedWallet) {
        await selectedWallet.switchChain(desiredChainHex);
      } else {
        try {
          await switchChainAsync({ chainId: FARMING_CHAIN_ID });
        } catch (innerError) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "[Greenvale] Wagmi switch chain fallback failed",
              innerError,
            );
          }
          throw innerError;
        }
      }
      toast.success(`Berhasil switch ke ${targetChainLabel}`);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[Greenvale] switch chain error", error);
      }
      const message =
        error instanceof Error ? error.message : "Gagal switch jaringan";
      toast.error(message);
    }
  }, [
    desiredChainHex,
    selectedWallet,
    switchChainAsync,
    targetChainLabel,
    isWagmiConnected,
  ]);
  const handleUnlockPlot = useCallback(
    async (slotIndex: number) => {
      if (!landActive || landPriceWei === null) {
        toast.error("Land belum tersedia saat ini");
        return;
      }
      if (!isWalletConnected) {
        toast.error("Hubungkan wallet terlebih dahulu");
        return;
      }
      if (needsChainSwitch) {
        toast.error(`Switch ke ${targetChainLabel} sebelum membeli land`);
        return;
      }
      if (ownedLandCount >= MAX_LAND_PER_ACCOUNT) {
        toast.error("Maksimal 4 land per akun tercapai");
        return;
      }
      try {
        setUnlockingSlot(slotIndex);
        await toast.promise(
          (async () => {
            await actions.buyLand(1, landPriceWei);
            await Promise.all([
              refetch?.(),
              refetchPlots?.(),
              refetchLandBalance?.(),
            ]);
          })(),
          {
            loading: "Membeli land…",
            success: "Land berhasil dibeli!",
            error: (err) => resolveUnlockError(err),
          },
        );
      } catch (err) {
        toast.error(resolveUnlockError(err));
      } finally {
        setUnlockingSlot(null);
      }
    },
    [
      actions,
      landActive,
      landPriceWei,
      isWalletConnected,
      needsChainSwitch,
      targetChainLabel,
      ownedLandCount,
      refetch,
      refetchPlots,
      refetchLandBalance,
      resolveUnlockError,
    ],
  );

  const handleConnectWallet = useCallback(async () => {
    if (!privyReady) {
      toast.error("Privy belum siap, coba beberapa detik lagi");
      console.warn("[Greenvale] Connect wallet clicked but Privy not ready");
      return;
    }
    try {
      console.log("[Greenvale] Opening Privy login");
      await login();
    } catch (error) {
      console.error("[Greenvale] connect wallet error", error);
      const message =
        error instanceof Error ? error.message : "Gagal membuka login";
      toast.error(message);
    }
  }, [login, privyReady]);

  const effectiveFullscreen = fullscreen || isMobile;

  const initPos = useCallback(() => {
    if (typeof window === "undefined" || effectiveFullscreen) return;
    const node = windowRef.current;
    if (!node) return;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    setPos({
      x: Math.max((window.innerWidth - w) / 2, 0),
      y: Math.max((window.innerHeight - h) / 2, 0),
    });
    setIsReady(true);
  }, [effectiveFullscreen]);

  useEffect(() => {
    const r = requestAnimationFrame(initPos);
    return () => cancelAnimationFrame(r);
  }, [initPos]);

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
      setPos((prev) => ({
        x: Math.min(Math.max(prev.x, 0), maxX),
        y: Math.min(Math.max(prev.y, 0), maxY),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [effectiveFullscreen]);

  useEffect(() => {
    if (!effectiveFullscreen) setIsReady(false);
  }, [effectiveFullscreen]);

  if (minimized) return null;

  return (
    <div className="pointer-events-none">
      <div
        ref={windowRef}
        className={
          effectiveFullscreen
            ? "fixed inset-0 z-40 flex items-center justify-center pt-safe pb-[calc(5rem+env(safe-area-inset-bottom))]"
            : "fixed z-40 px-4"
        }
        style={
          effectiveFullscreen
            ? undefined
            : {
                left: pos.x,
                top: pos.y,
                visibility: isReady ? "visible" : "hidden",
              }
        }
      >
        <div
          ref={containerRef}
          className={clsx(
            "pointer-events-auto flex h-full w-full flex-col overflow-hidden",
            effectiveFullscreen
              ? "relative flex h-full w-full mb-5 flex-col overflow-hidden bg-[#fbe9c7] font-sans md:h-[calc(95vh-4rem)] md:w-[calc(100vw-4rem)] md:rounded-2xl md:border md:border-[#2f2b28]/70 md:shadow-[0_30px_80px_-40px_rgba(56,29,14,0.6)]"
              : "relative flex h-[36rem] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#2f2b28]/80 bg-[#fbe9c7] font-sans shadow-[0_24px_60px_-40px_rgba(56,29,14,0.6)]"
          )}
        >
          <TerminalHeader
            onDragHandle={(event) => {
              if (effectiveFullscreen) return;
              const parent = event.currentTarget
                .parentElement as HTMLElement | null;
              if (!parent) return;
              const rect = parent.getBoundingClientRect();
              const offsetX = event.clientX - rect.left;
              const offsetY = event.clientY - rect.top;
              setDragging(true);

              const handleMove = (ev: PointerEvent) => {
                setPos({
                  x: Math.max(0, ev.clientX - offsetX),
                  y: Math.max(0, ev.clientY - offsetY),
                });
              };
              const handleUp = () => {
                setDragging(false);
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
              };

              window.addEventListener("pointermove", handleMove, {
                passive: true,
              });
              window.addEventListener("pointerup", handleUp, { passive: true });
            }}
            isDragging={dragging}
            onClose={onClose}
            onMinimize={effectiveFullscreen ? undefined : onMinimize}
            onToggleFullscreen={isMobile ? undefined : onToggleFullscreen}
            isFullscreen={fullscreen}
            showClock={false}
          />

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <PixelHeader />
            <div className="relative flex-1 min-h-[25rem] min-w-[50rem] overflow-hidden border-t border-dashed border-[#d4b480]/60 bg-[#a4cf79]">
              <PixelBackdrop />
              <PathLayer />
              <BuildingLayer onSelect={(key) => setActiveBuilding(key)} />
              <FarmPlotsLayer
                hasLand={hasLand}
                ownedLandCount={ownedLandCount}
                plots={plots}
                isLoading={plotsLoading}
                onSelect={(key) => setActiveBuilding(key)}
                onUnlockPlot={handleUnlockPlot}
                unlockAvailable={landActive && landPriceWei !== null}
                unlockPriceLabel={unlockPriceLabel}
                unlockingIndex={unlockingSlot}
              />
              <FloatingWidgets weather={weather} />
              <ActiveBuildingPanel
                active={activeBuilding}
                onClose={() => setActiveBuilding(null)}
                config={{
                  seeds,
                  tools,
                  waterPriceWei,
                  waterActive,
                  landPriceWei,
                  landActive,
                  global,
                  isLoading: isConfigLoading,
                  error: configError,
                  hasRegistry,
                  hasLand,
                  ownedLandCount,
                  plots,
                  readyPlotIds,
                  plotsLoading,
                  plotsError,
                  onRefetch: refetch,
                  refetchPlots,
                  refetchLandBalance,
                  actions,
                  account: activeAddress,
                  isWalletConnected,
                  needsChainSwitch,
                  onConnectWallet: handleConnectWallet,
                  onSwitchChain: handleSwitchChain,
                  targetChainLabel,
                  privyReady,
                  inventory,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 2200,
          style: {
            borderRadius: 10,
            border: "2px solid #FFD37A",
            background: "#1f1b18",
            color: "#fdf8ef",
            fontSize: 13,
          },
        }}
      />
    </div>
  );
}

function PixelHeader() {
  return (
    <header className="relative z-10 flex items-center justify-between border-b border-dashed border-[#d4b480]/60 bg-[repeating-linear-gradient(90deg,#ffe7b5_0px,#ffe7b5_16px,#fcd68e_16px,#fcd68e_32px)] px-5 py-3">
      <span className="rounded-[10px] border border-[#45311f] bg-[#fff3c8] px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#45311f]">
        Greenvale Map
      </span>
      <p className="text-[11px] uppercase tracking-[0.35em] text-[#6d5138]">
        Village · Shop · Marketplace · Plots
      </p>
    </header>
  );
}

function PixelBackdrop() {
  const patternStyle = useMemo<CSSProperties>(
    () => ({ backgroundImage: `url("${PIXEL_PATTERN}")` }),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#93c46b_0px,#93c46b_24px,#8bbd62_24px,#8bbd62_48px)] opacity-80" />
      <div
        className="absolute inset-0 opacity-35 mix-blend-multiply"
        style={patternStyle}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#76ac4f]" />
    </div>
  );
}

function PathLayer() {
  const PATH_COLOR = "#f5d8a4";
  const PATH_BORDER = "#c89f62";

  const segments: Array<{
    top: string;
    left: string;
    width: string;
    height: string;
    translateX?: string;
    translateY?: string;
  }> = [
    { top: "32%", left: "50%", width: "9%", height: "65%", translateX: "-50%" }, // main trunk
    {
      top: "38%",
      left: "50%",
      width: "68%",
      height: "7%",
      translateX: "-50%",
      translateY: "-50%",
    }, // upper spine
    {
      top: "50%",
      left: "50%",
      width: "76%",
      height: "7%",
      translateX: "-50%",
      translateY: "-50%",
    }, // mid spine
    {
      top: "75%",
      left: "50%",
      width: "76%",
      height: "7%",
      translateX: "-50%",
      translateY: "-50%",
    }, // lower spine
  ];

  return (
    <div className="pointer-events-none absolute inset-0">
      {segments.map((segment, index) => (
        <div
          key={index}
          className="absolute rounded-[24px] border-[6px]"
          style={{
            top: segment.top,
            left: segment.left,
            width: segment.width,
            height: segment.height,
            transform: `translate(${segment.translateX ?? "-50%"}, ${
              segment.translateY ?? "0"
            })`,
            background: `repeating-linear-gradient(90deg,${PATH_COLOR} 0px,${PATH_COLOR} 14px,${PATH_COLOR} 14px,${PATH_COLOR} 28px)`,
            borderColor: PATH_BORDER,
            boxShadow: "0 10px 0 rgba(61,39,20,0.18) inset",
          }}
        />
      ))}
    </div>
  );
}

function BuildingLayer({ onSelect }: { onSelect: (key: BuildingKey) => void }) {
  return (
    <div className="absolute inset-0">
      {BUILDINGS.map((building) => (
        <PixelBuilding
          key={building.key}
          building={building}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function PixelBuilding({
  building,
  onSelect,
}: {
  building: Building;
  onSelect: (key: BuildingKey) => void;
}) {
  const Icon = building.icon;
  const isShopOrMarketplace =
    building.key === "shop" || building.key === "marketplace";

  return (
    <button
      type="button"
      style={building.style}
      onClick={() => {
        if (
          process.env.NODE_ENV !== "production" &&
          (building.key === "shop" || building.key === "marketplace")
        ) {
          const label = building.key === "shop" ? "Shop" : "Marketplace";
          console.info(`[Greenvale] ${label} clicked`);
        }
        onSelect(building.key);
      }}
      className={clsx(
        "group absolute z-50 flex min-w-[150px] max-w-[200px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center",
        isShopOrMarketplace ? "cursor-pointer hover:cursor-auto" : "cursor-pointer",
      )}
    >
      <div className="rounded-[18px] border-4 border-[#45311f] bg-[#ffe8b2] px-5 py-3 shadow-[0_8px_0_rgba(69,49,31,0.5)] transition group-hover:-translate-y-1">
        <Icon className="mx-auto h-7 w-7 text-[#45311f]" />
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.4em] text-[#45311f]">
          {building.label}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[#6d5138]">
          {building.subtitle}
        </p>
      </div>
    </button>
  );
}

function FarmPlotsLayer({
  onSelect,
  hasLand,
  ownedLandCount,
  plots,
  isLoading,
  onUnlockPlot,
  unlockAvailable,
  unlockPriceLabel,
  unlockingIndex,
}: {
  onSelect: (key: BuildingKey) => void;
  hasLand: boolean;
  ownedLandCount: number;
  plots: GreenvalePlot[];
  isLoading: boolean;
  onUnlockPlot?: (slotIndex: number) => void;
  unlockAvailable: boolean;
  unlockPriceLabel: string | null;
  unlockingIndex: number | null;
}) {
  const rows: Array<{ top: string; positions: string[] }> = [
    { top: "63%", positions: ["32%", "68%"] },
    { top: "88%", positions: ["32%", "68%"] },
  ];

  const slots = rows.flatMap((row) =>
    row.positions.map((left) => ({
      top: row.top,
      left,
    })),
  );

  const unlockedSlots = Math.min(ownedLandCount, slots.length);

  const getStatus = (plot: GreenvalePlot | undefined, unlocked: boolean) => {
    if (!unlocked) {
      return {
        label: "Slot Terkunci",
        description: "",
        highlight: false,
      };
    }
    if (!plot) {
      return {
        label: hasLand ? "Plot Kosong" : "Plot Terkunci",
        description: "",
        highlight: false,
      };
    }
    if (plot.isReady) {
      return {
        label: "Siap Panen",
        description: `Land #${plot.landId}`,
        highlight: true,
      };
    }
    if (plot.isGrowing) {
      return {
        label: "Sedang Tumbuh",
        description: `Land #${plot.landId}`,
        highlight: false,
      };
    }
    if (plot.seedCount === 0 && plot.dug) {
      return {
        label: "Siap Tanam",
        description: `Land #${plot.landId}`,
        highlight: false,
      };
    }
    if (!plot.dug) {
      return {
        label: "Belum Digali",
        description: `Land #${plot.landId}`,
        highlight: false,
      };
    }
    return {
      label: `Land #${plot.landId}`,
      description: "",
      highlight: false,
    };
  };

  return (
    <div className="absolute inset-0">
      {slots.map((slot, index) => {
        const plot = plots[index];
        const unlocked = index < unlockedSlots;
        const status = getStatus(plot, unlocked);
        return (
          <div
            key={`${slot.left}-${slot.top}`}
            style={{ top: slot.top, left: slot.left }}
            onClick={() => {
              if (!unlocked) {
                if (unlockingIndex === index) {
                  return;
                }
                if (!unlockAvailable) {
                  toast("Land belum tersedia untuk dibeli saat ini");
                  return;
                }
                onUnlockPlot?.(index);
                return;
              }
              if (!plot) return;
              onSelect("home");
            }}
            className={clsx(
              "absolute h-28 w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border-4 shadow-[0_10px_0_rgba(0,0,0,0.08)] transition",
              hasLand && unlocked && plot
                ? "cursor-pointer hover:-translate-y-1 border-[#2f5c23] bg-[#89b861]"
                : hasLand && unlocked
                  ? "cursor-not-allowed border-[#4f6038] bg-[#6f9b4a] opacity-70"
                  : "cursor-pointer border-[#8c693d] bg-[#c28d55] opacity-90 hover:-translate-y-1",
              plot?.isReady ? "ring-4 ring-emerald-400" : undefined,
            )}
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-[12px] border-4 border-[#45311f] bg-[#fff3c8] px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#45311f] shadow-[0_6px_0_rgba(69,49,31,0.4)]">
              {status.label}
            </div>
            <div className="absolute inset-[12%] rounded-[14px] border-4 border-[#5c4125] bg-[repeating-linear-gradient(90deg,#f3c77a_0px,#f3c77a_12px,#d7b07b_12px,#d7b07b_24px)] shadow-[inset_0_8px_0_rgba(0,0,0,0.05)]" />
            {status.description && (
              <div className="absolute bottom-2 left-1/2 w-[90%] -translate-x-1/2 rounded-[10px] border-2 border-[#45311f] bg-[#fff3c8]/80 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-[#45311f]">
                {status.description}
              </div>
            )}
            {!unlocked && (
              <div className="absolute inset-x-[12%] bottom-2 flex flex-col items-center gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-[#fff3c8]">
                {unlockAvailable && onUnlockPlot ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onUnlockPlot?.(index);
                    }}
                    disabled={unlockingIndex === index}
                    className="w-full rounded-[10px] border-2 border-[#45311f] bg-[#ffe0a6] px-2 py-1 text-[#45311f] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {unlockingIndex === index
                      ? "Memproses…"
                      : unlockPriceLabel
                        ? `Unlock (${unlockPriceLabel})`
                        : "Unlock"}
                  </button>
                ) : (
                  <span className="rounded-[8px] bg-[#45311f]/70 px-2 py-1 text-[#ffe8b2]">
                    Beli land tersedia segera
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-[16px] border-4 border-[#45311f] bg-[#fff7e0] px-5 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.3em] text-[#45311f] shadow-[0_10px_0_rgba(69,49,31,0.3)]">
            Memuat status plot…
          </div>
        </div>
      )}
      {!hasLand && !isLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-[16px] border-4 border-[#45311f] bg-[#fff7e0] px-5 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.3em] text-[#45311f] shadow-[0_10px_0_rgba(69,49,31,0.3)]">
            Beli Land di Farm Shop untuk membuka plot
          </div>
        </div>
      )}
    </div>
  );
}

function FloatingWidgets({
  weather,
}: {
  weather: {
    today: {
      label: string;
      bonus: string;
      icon: ComponentType<{ className?: string }>;
    };
    next: { label: string; icon: ComponentType<{ className?: string }> };
  };
}) {
  const WeatherIcon = weather.today.icon;
  const NextIcon = weather.next.icon;

  return (
    <>
      <div className="absolute left-6 top-6 flex w-[160px] flex-col gap-3">
        <PixelPanel
          onClick={() => toast("Map dibuka (UI demo)")}
          icon={MapIcon}
          label="Map"
        />
        <PixelPanel
          onClick={() => toast("Guides dibuka (UI demo)")}
          icon={BookOpen}
          label="Guides"
        />
      </div>

      <div className="pointer-events-none absolute right-6 top-6 flex min-w-[180px] flex-col gap-2 rounded-[18px] border-4 border-[#45311f] bg-[#fff3c8] px-4 py-3 text-[#45311f] shadow-[0_10px_0_rgba(69,49,31,0.4)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-[#45311f] bg-[#a4d8ff]">
            <WeatherIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em]">
              Today’s Weather
            </p>
            <p className="text-xs">{weather.today.label}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#6d5138]">
              {weather.today.bonus}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-[10px] border-2 border-[#45311f] bg-[#ffe8b2] px-3 py-1 text-[10px] uppercase tracking-[0.3em]">
          <NextIcon className="h-4 w-4" />
          {weather.next.label}
        </div>
      </div>
    </>
  );
}

function PixelPanel({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-[18px] border-4 border-[#45311f] bg-[#fff3c8] px-4 py-3 text-left text-[#45311f] shadow-[0_12px_0_rgba(69,49,31,0.4)] transition hover:-translate-y-[2px]"
    >
      <Icon className="h-6 w-6" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.35em]">
        {label}
      </span>
    </button>
  );
}

type GreenvaleActions = ReturnType<typeof useGreenvaleActions>;

type PanelConfig = {
  seeds: UseGreenvaleConfigResult["seeds"];
  tools: UseGreenvaleConfigResult["tools"];
  waterPriceWei: UseGreenvaleConfigResult["waterPriceWei"];
  waterActive: UseGreenvaleConfigResult["waterActive"];
  landPriceWei: UseGreenvaleConfigResult["landPriceWei"];
  landActive: UseGreenvaleConfigResult["landActive"];
  global: UseGreenvaleConfigResult["global"];
  isLoading: UseGreenvaleConfigResult["isLoading"];
  error: UseGreenvaleConfigResult["error"];
  hasRegistry: UseGreenvaleConfigResult["hasRegistry"];
  onRefetch: UseGreenvaleConfigResult["refetch"];
  actions: GreenvaleActions;
  hasLand: boolean;
  ownedLandCount: number;
  plots: GreenvalePlot[];
  readyPlotIds: number[];
  plotsLoading: boolean;
  plotsError: Error | null;
  refetchPlots: () => Promise<void>;
  refetchLandBalance: () => Promise<void>;
  inventory: UseGreenvaleInventoryResult;
  account: `0x${string}` | null;
  isWalletConnected: boolean;
  needsChainSwitch: boolean;
  onConnectWallet: () => Promise<void> | void;
  onSwitchChain?: () => Promise<void>;
  targetChainLabel: string;
  privyReady: boolean;
};

function ActiveBuildingPanel({
  active,
  onClose,
  config,
}: {
  active: BuildingKey | null;
  onClose: () => void;
  config: PanelConfig;
}) {
  if (!active) return null;

  const titleMap: Record<BuildingKey, string> = {
    home: "Farm Overview",
    shop: "Farm Shop",
    marketplace: "Marketplace",
  };

  let content: ReactNode = null;

  if (!config.isWalletConnected) {
    content = (
      <div className="space-y-3 text-[#45311f]">
        <p className="text-sm">
          Hubungkan wallet Base Account kamu untuk mulai bermain. Farm Shop dan
          Marketplace membutuhkan wallet terhubung.
        </p>
        <button
          type="button"
          onClick={() => {
            void config.onConnectWallet();
          }}
          disabled={!config.privyReady}
          className="rounded-[12px] border-2 border-[#45311f] bg-[#ffe0a6] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#45311f] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {config.privyReady ? "Connect Wallet" : "Menyiapkan Privy…"}
        </button>
      </div>
    );
  } else if (config.needsChainSwitch) {
    content = (
      <div className="space-y-3 text-[#45311f]">
        <p className="text-sm">
          Wallet terhubung di jaringan lain. Switch ke {config.targetChainLabel}
          untuk mengakses Farm Shop dan Marketplace.
        </p>
        <button
          type="button"
          onClick={() => {
            void config.onSwitchChain?.();
          }}
          className="rounded-[12px] border-2 border-[#45311f] bg-[#ffe0a6] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#45311f] transition hover:-translate-y-[1px]"
        >
          Switch ke {config.targetChainLabel}
        </button>
      </div>
    );
  } else {
    switch (active) {
      case "shop":
        content = <ShopPanel {...config} />;
        break;
      case "marketplace":
        content = <MarketplacePanel {...config} />;
        break;
      case "home":
      default:
        content = <OverviewPanel {...config} />;
        break;
    }
  }

  return (
    <div className="pointer-events-auto">
      <div className="absolute bottom-6 left-1/2 z-50 w-[96%] max-w-5xl -translate-x-1/2 rounded-[24px] border-4 border-[#45311f] bg-[#fff7e0] shadow-[0_20px_0_rgba(69,49,31,0.35)]">
        <div className="flex items-center justify-between border-b-4 border-[#45311f]/60 bg-[#f6e7c3] px-5 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-[#45311f]">
            {titleMap[active]}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-2 border-[#45311f] bg-[#ffe8b2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#45311f] transition hover:-translate-y-[1px]"
          >
            Close
          </button>
        </div>
        <div className="max-h-[24rem] overflow-y-auto px-6 py-5">{content}</div>
      </div>
    </div>
  );
}

function OverviewPanel({
  global,
  isLoading,
  error,
  hasRegistry,
  onRefetch,
  actions,
  hasLand,
  ownedLandCount,
  plots,
  readyPlotIds,
  plotsLoading,
  plotsError,
  refetchPlots,
  refetchLandBalance,
  inventory,
  account,
  isWalletConnected,
  needsChainSwitch,
  onSwitchChain,
  targetChainLabel,
}: PanelConfig) {
  const [landIdInput, setLandIdInput] = useState("");
  const [seedInput, setSeedInput] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [harvestPending, setHarvestPending] = useState(false);
  const [equipPending, setEquipPending] = useState<number | null>(null);
  useEffect(() => {
    if (plots.length > 0 && !landIdInput) {
      setLandIdInput(String(plots[0].landId));
    }
  }, [landIdInput, plots]);
  const {
    seeds: inventorySeeds,
    tools: inventoryTools,
    water,
    activeToolTokenId,
    isLoading: inventoryLoading,
    error: inventoryError,
    refetch: refetchInventory,
  } = inventory;
  const activeToolRarity =
    activeToolTokenId !== null
      ? Number(activeToolTokenId) - TOOL_TOKEN_BASE
      : null;

  const resolveErrorMessage = useCallback((err: unknown) => {
    if (!err) return "Transaksi gagal";
    if (process.env.NODE_ENV !== "production") {
      console.error("[Greenvale] action error", err);
    }
    if (typeof err === "object" && "shortMessage" in (err as any)) {
      const message = (err as { shortMessage?: string }).shortMessage;
      if (message) return message;
    }
    if (err instanceof Error) return err.message;
    return String(err);
  }, []);

  const parseLandId = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        throw new Error("Land ID wajib diisi");
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("Land ID tidak valid");
      }
      return parsed;
    },
    [],
  );

  const parseSeedInput = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        throw new Error("Masukkan minimal 1 seed");
      }
      const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length === 0) throw new Error("Masukkan minimal 1 seed");
      const seeds = parts.map((part) => {
        const asNumber = Number(part);
        if (!Number.isFinite(asNumber) || asNumber < 0) {
          throw new Error(`Seed type ${part} tidak valid`);
        }
        return asNumber;
      });
      return seeds;
    },
    [],
  );

  const executePlotAction = useCallback(
    async (key: string, action: () => Promise<unknown>) => {
      if (!isWalletConnected) {
        toast.error("Hubungkan wallet terlebih dahulu");
        return;
      }
      if (needsChainSwitch) {
        toast.error(`Switch ke ${targetChainLabel} sebelum melakukan aksi`);
        return;
      }
      if (process.env.NODE_ENV !== "production") {
        console.debug("[Greenvale] executePlotAction", key, {
          hasLand,
          readyPlotIds,
        });
      }
      try {
        setPendingAction(key);
        await toast.promise(
          (async () => {
            await action();
            await Promise.all([
              onRefetch?.(),
              refetchPlots?.(),
              refetchLandBalance?.(),
              refetchInventory(),
            ]);
          })(),
          {
            loading: "Mengirim transaksi…",
            success: "Transaksi berhasil",
            error: (err) => resolveErrorMessage(err),
          },
        );
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[Greenvale] plot action error", err);
        }
        toast.error(resolveErrorMessage(err));
      } finally {
        setPendingAction(null);
      }
    },
    [
      hasLand,
      isWalletConnected,
      needsChainSwitch,
      onRefetch,
      readyPlotIds,
      refetchPlots,
      refetchLandBalance,
      refetchInventory,
      resolveErrorMessage,
      targetChainLabel,
    ],
  );

  const handleHarvestReadyPlots = useCallback(async () => {
    if (!account) {
      toast.error("Hubungkan wallet terlebih dahulu");
      return;
    }
    if (needsChainSwitch) {
      toast.error(`Switch ke ${targetChainLabel} sebelum harvest`);
      return;
    }
    if (readyPlotIds.length === 0) {
      toast("Tidak ada plot yang siap panen");
      return;
    }

    try {
      setHarvestPending(true);
      const deadline = Math.floor(Date.now() / 1000) + 600;
      const response = await fetch("/api/farming/sign-xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: account,
          landIds: readyPlotIds,
          deadline,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        const message = payload?.error ?? "Gagal mengambil signature XP";
        throw new Error(message);
      }

      const data = payload.data as {
        amount: string;
        deadline: string;
        signature: `0x${string}`;
      };

      await toast.promise(
        (async () => {
          await actions.harvestAndClaimXP({
            landIds: readyPlotIds,
            expAmount: BigInt(data.amount),
            deadline: BigInt(data.deadline),
            signature: data.signature,
          });
          await Promise.all([
            onRefetch?.(),
            refetchPlots?.(),
            refetchLandBalance?.(),
            refetchInventory(),
          ]);
        })(),
        {
          loading: "Claim XP…",
          success: "Harvest berhasil!",
          error: (err) => resolveErrorMessage(err),
        },
      );
    } catch (err) {
      toast.error(resolveErrorMessage(err));
    } finally {
      setHarvestPending(false);
    }
  }, [
    account,
    actions,
    needsChainSwitch,
    onRefetch,
    readyPlotIds,
    refetchLandBalance,
    refetchInventory,
    refetchPlots,
    resolveErrorMessage,
    targetChainLabel,
  ]);

  const handleEquipTool = useCallback(
    async (tokenId: number) => {
      if (!isWalletConnected) {
        toast.error("Hubungkan wallet terlebih dahulu");
        return;
      }
      if (needsChainSwitch) {
        toast.error(`Switch ke ${targetChainLabel} sebelum mengganti alat`);
        return;
      }
      try {
        setEquipPending(tokenId);
        await toast.promise(
          (async () => {
            await actions.setActiveTool(tokenId);
            await refetchInventory();
          })(),
          {
            loading: "Mengatur alat…",
            success: "Alat aktif diperbarui",
            error: (err) => resolveErrorMessage(err),
          },
        );
      } catch (err) {
        toast.error(resolveErrorMessage(err));
      } finally {
        setEquipPending(null);
      }
    },
    [
      actions,
      isWalletConnected,
      needsChainSwitch,
      refetchInventory,
      resolveErrorMessage,
      targetChainLabel,
    ],
  );

  const handleClearActiveTool = useCallback(async () => {
    if (!isWalletConnected) {
      toast.error("Hubungkan wallet terlebih dahulu");
      return;
    }
    if (needsChainSwitch) {
      toast.error(`Switch ke ${targetChainLabel} sebelum mengganti alat`);
      return;
    }
    try {
      setEquipPending(0);
      await toast.promise(
        (async () => {
          await actions.setActiveTool(0);
          await refetchInventory();
        })(),
        {
          loading: "Mengatur alat…",
          success: "Tidak ada alat aktif",
          error: (err) => resolveErrorMessage(err),
        },
      );
    } catch (err) {
      toast.error(resolveErrorMessage(err));
    } finally {
      setEquipPending(null);
    }
  }, [
    actions,
    isWalletConnected,
    needsChainSwitch,
    refetchInventory,
    resolveErrorMessage,
    targetChainLabel,
  ]);

  if (!hasRegistry) {
    return (
      <p className="text-sm text-[#6d5138]">
        Parameter registry belum dikonfigurasi. Pastikan kontrak sudah siap
        sebelum memulai aktivitas farming.
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-[#6d5138]">Memuat konfigurasi farm…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Gagal memuat konfigurasi: {error.message}
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-3 text-[#45311f] md:grid-cols-2">
        <OverviewCard title="Total Land Dimiliki">
          {ownedLandCount}
        </OverviewCard>
        <OverviewCard title="Max Plots per Harvest">
          {global.maxPlotsPerHarvest ?? "—"}
        </OverviewCard>
        <OverviewCard title="XP Rate Limit per TX">
          {global.xpRateLimitPerTx ? global.xpRateLimitPerTx.toString() : "—"}
        </OverviewCard>
        <OverviewCard title="Season Bonus">
          {global.seasonBonusBps !== null
            ? `${(global.seasonBonusBps / 100).toFixed(2)}%`
            : "—"}
        </OverviewCard>
        <OverviewCard title="Treasury Destination">
          Semua pembelian Shop otomatis disetorkan ke alamat treasury on-chain.
        </OverviewCard>
        <OverviewCard title="Harvest Bonus">
          Harvest melakukan forwarding XP ke XPRegistry dengan bonus seasonal &
          batas 1.2k XP per transaksi.
        </OverviewCard>
      </div>

      <div className="mt-4 rounded-[18px] border-4 border-[#d7b07b] bg-[#fff3c8] px-4 py-4 text-[#45311f]">
        <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
          Status Plot Kamu
        </h4>
        <p className="mt-1 text-xs text-[#6d5138]">
          Kamu memiliki {ownedLandCount} land terdaftar. Maksimal 4 land per akun dapat dimiliki saat ini.
        </p>
        {plotsError && (
          <p className="mt-2 text-xs text-red-600">
            Gagal memuat status plot: {plotsError.message}
          </p>
        )}
        {plotsLoading ? (
          <p className="mt-3 text-sm text-[#6d5138]">Memuat status plot…</p>
        ) : !hasLand ? (
          <p className="mt-3 text-sm text-[#6d5138]">
            Kamu belum memiliki Land. Beli Land terlebih dahulu untuk mulai
            bertani.
          </p>
        ) : plots.length === 0 ? (
          <p className="mt-3 text-sm text-[#6d5138]">
            Belum ada data plot ditemukan untuk wallet ini.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {plots.map((plot) => (
              <li
                key={plot.landId}
                className={clsx(
                  "rounded-[12px] border-2 border-[#45311f]/60 bg-[#fffdf4] px-3 py-2",
                  plot.isReady ? "border-emerald-500 bg-emerald-50" : undefined,
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold uppercase tracking-[0.2em]">
                    Land #{plot.landId}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[#6d5138]">
                    {plot.isReady
                      ? "Siap Panen"
                      : plot.isGrowing
                        ? "Sedang Tumbuh"
                        : plot.seedCount === 0
                          ? plot.dug
                            ? "Siap Tanam"
                            : "Belum Digali"
                          : "Status Tidak Diketahui"}
                  </span>
                </div>
                {plot.seedTypes.length > 0 && (
                  <p className="mt-1 text-[11px] text-[#6d5138]">
                    Seeds: {plot.seedTypes.join(", ")} · Ready At: {Number(plot.readyAt) > 0 ? new Date(Number(plot.readyAt) * 1000).toLocaleString() : "-"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[#6d5138]">
            Plot siap panen: {readyPlotIds.length}
          </p>
          <button
            type="button"
            disabled={harvestPending || readyPlotIds.length === 0}
            onClick={handleHarvestReadyPlots}
            className="rounded-[12px] border-2 border-[#45311f] bg-[#ffe0a6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {harvestPending ? "Memanen…" : "Harvest Plot Siap"}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-[18px] border-4 border-[#d7b07b] bg-[#fff3c8] px-4 py-4 text-[#45311f]">
        <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
          Inventory Kamu
        </h4>
        {inventoryLoading ? (
          <p className="mt-3 text-sm text-[#6d5138]">Memuat inventory…</p>
        ) : (
          <>
            {inventoryError && (
              <p className="mt-2 text-xs text-red-600">
                Gagal memuat inventory: {inventoryError.message}
              </p>
            )}
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="rounded-[14px] border-2 border-[#d7b07b] bg-[#fffdf4] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
                  Stok Konsumsi
                </p>
                <ul className="mt-2 space-y-2 text-[12px]">
                  <li className="flex items-center justify-between">
                    <span>Water</span>
                    <span className="font-semibold">{water.balance.toString()}</span>
                  </li>
                  {inventorySeeds.length === 0 ? (
                    <li className="text-[#6d5138]">Belum ada benih</li>
                  ) : (
                    inventorySeeds.map((seed) => (
                      <li
                        key={seed.seedType}
                        className="flex items-center justify-between"
                      >
                        <span>Seed #{seed.seedType}</span>
                        <span className="font-semibold">
                          {seed.balance.toString()}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="rounded-[14px] border-2 border-[#d7b07b] bg-[#fffdf4] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
                  Tools Aktif
                </p>
                <p className="mt-1 text-[12px] text-[#6d5138]">
                  {activeToolRarity !== null
                    ? `Cangkul rarity ${activeToolRarity} sedang aktif`
                    : "Belum ada alat aktif"}
                </p>
                {activeToolRarity !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleClearActiveTool();
                    }}
                    disabled={equipPending === 0}
                    className="mt-2 rounded-[10px] border-2 border-[#45311f] bg-[#ffe0a6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {equipPending === 0 ? "Memproses…" : "Lepas Alat"}
                  </button>
                )}
                <ul className="mt-3 space-y-2 text-[12px]">
                  {inventoryTools.length === 0 ? (
                    <li className="text-[#6d5138]">Belum punya alat</li>
                  ) : (
                    inventoryTools.map((tool) => {
                      const isActive =
                        activeToolTokenId !== null &&
                        Number(activeToolTokenId) === tool.tokenId;
                      return (
                        <li
                          key={tool.rarity}
                          className="flex flex-col gap-1 rounded-[10px] border border-[#d7b07b] bg-[#fffdf4] px-2 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <span>Rarity {tool.rarity}</span>
                            <span className="font-semibold">
                              {tool.balance.toString()}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={tool.balance === 0n || isActive || equipPending === tool.tokenId}
                            onClick={() => {
                              void handleEquipTool(tool.tokenId);
                            }}
                            className="rounded-[10px] border-2 border-[#45311f] bg-[#ffe0a6] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isActive
                              ? "Sedang Aktif"
                              : equipPending === tool.tokenId
                                ? "Memproses…"
                                : "Set Aktif"}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function OverviewCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[16px] border-4 border-[#d7b07b] bg-[#fff3c8] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
        {title}
      </p>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}

function ShopPanel({
  seeds,
  tools,
  waterPriceWei,
  waterActive,
  landPriceWei: _landPriceWei,
  landActive: _landActive,
  isLoading,
  error,
  hasRegistry,
  onRefetch,
  actions,
  refetchPlots,
  refetchLandBalance,
  inventory,
  isWalletConnected,
  needsChainSwitch,
  onSwitchChain,
  targetChainLabel,
}: PanelConfig) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const {
    seeds: inventorySeeds,
    tools: inventoryTools,
    water,
    activeToolTokenId,
  } = inventory;

  if (!hasRegistry) {
    return (
      <p className="text-sm text-[#6d5138]">
        Shop belum siap—parameter registry belum tersedia.
      </p>
    );
  }

  if (!isWalletConnected) {
    return (
      <p className="text-sm text-[#6d5138]">
        Hubungkan wallet terlebih dahulu di panel utama untuk melakukan
        pembelian.
      </p>
    );
  }

  if (needsChainSwitch) {
    return (
      <div className="space-y-2 text-sm text-[#6d5138]">
        <p>
          Switch ke {targetChainLabel} terlebih dahulu sebelum melakukan
          pembelian.
        </p>
        <button
          type="button"
          onClick={() => {
            void onSwitchChain?.();
          }}
          className="rounded-[12px] border-2 border-[#45311f] bg-[#ffe0a6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition hover:-translate-y-[1px]"
        >
          Switch ke {targetChainLabel}
        </button>
      </div>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-[#6d5138]">Mengambil data shop…</p>;
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600">
          Gagal mengambil data shop: {error.message}
        </p>
        <button
          type="button"
          onClick={onRefetch}
          className="rounded-lg border-2 border-[#45311f] bg-[#ffe0a6] px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#45311f] transition hover:-translate-y-[1px]"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const inventoryList = useMemo(
    () => ({
      seeds: inventorySeeds.filter((item) => item.balance > 0n),
      tools: inventoryTools.filter((tool) => {
        if (tool.balance === 0n) return false;
        if (!activeToolTokenId) return true;
        return BigInt(tool.tokenId) !== activeToolTokenId;
      }),
      waterBalance: water.balance,
    }),
    [activeToolTokenId, inventorySeeds, inventoryTools, water.balance],
  );
  const handlePrefill1155 = useCallback(
    (tokenId: number, qty: bigint) => {
      const payload = {
        tokenId: tokenId.toString(),
        amount: qty.toString(),
      };
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          MARKETPLACE_1155_PREFILL_KEY,
          JSON.stringify(payload),
        );
      }
      toast.success(
        `Listing siap: token ${tokenId} × ${qty.toString()} tersimpan. Buka Marketplace untuk lanjut.`,
      );
    },
    [],
  );

  const formatPrice = (value: bigint | null) =>
    value !== null ? `${formatEther(value)} ETH` : "—";

  const resolveErrorMessage = (err: unknown) => {
    if (!err) return "Transaksi gagal";
    if (typeof err === "object" && "shortMessage" in err && err.shortMessage) {
      return String(err.shortMessage);
    }
    if (err instanceof Error) return err.message;
    return String(err);
  };

  const executeTx = useCallback(
    async (key: string, action: () => Promise<unknown>) => {
      try {
        setPendingKey(key);
        await toast.promise(
          (async () => {
            await action();
            await Promise.all([
              onRefetch?.(),
              refetchPlots?.(),
              refetchLandBalance?.(),
            ]);
          })(),
          {
            loading: "Mengirim transaksi…",
            success: "Transaksi berhasil",
            error: (err) => resolveErrorMessage(err),
          },
        );
      } catch (err) {
        const message = resolveErrorMessage(err);
        toast.error(message);
      } finally {
        setPendingKey(null);
      }
    },
    [onRefetch, refetchLandBalance, refetchPlots, resolveErrorMessage],
  );

  return (
    <div className="flex flex-col gap-4 text-[#45311f]">
      <section className="rounded-[18px] border-4 border-[#d7b07b] bg-[#fffdf4] px-4 py-4">
        <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
          Inventory Siap Dijual
        </h4>
        {inventoryList.seeds.length === 0 && inventoryList.waterBalance === 0n && inventoryList.tools.length === 0 ? (
          <p className="mt-3 text-sm text-[#6d5138]">
            Kamu belum memiliki item yang siap dijual. Beli dari Shop lalu kembali ke sini untuk listing.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-[14px] border-2 border-[#d7b07b] bg-[#fffdf4] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
                Seeds
              </p>
              <ul className="mt-2 space-y-2 text-[12px]">
                {inventoryList.seeds.length === 0 ? (
                  <li className="text-[#6d5138]">Tidak ada stok seed</li>
                ) : (
                  inventoryList.seeds.map((seed) => (
                    <li
                      key={seed.seedType}
                      className="rounded-[10px] border border-[#d7b07b] bg-[#fffdf9] px-2 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span>Seed #{seed.seedType}</span>
                        <span className="font-semibold">{seed.balance.toString()}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrefill1155(SEED_TOKEN_BASE + seed.seedType, seed.balance)}
                        className="mt-2 w-full rounded-[8px] border-2 border-[#45311f] bg-[#ffe0a6] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition hover:-translate-y-[1px]"
                      >
                        Isi Form Listing
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-[14px] border-2 border-[#d7b07b] bg-[#fffdf4] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
                Water
              </p>
              {inventoryList.waterBalance > 0n ? (
                <div className="mt-2 rounded-[10px] border border-[#d7b07b] bg-[#fffdf9] px-2 py-2 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span>Water Token</span>
                    <span className="font-semibold">{inventoryList.waterBalance.toString()}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePrefill1155(WATER_TOKEN_ID, inventoryList.waterBalance)}
                    className="mt-2 w-full rounded-[8px] border-2 border-[#45311f] bg-[#ffe0a6] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition hover:-translate-y-[1px]"
                  >
                    Isi Form Listing
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-[#6d5138]">Tidak ada stok water</p>
              )}
            </div>
            <div className="rounded-[14px] border-2 border-[#d7b07b] bg-[#fffdf4] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
                Tools (tidak aktif)
              </p>
              <ul className="mt-2 space-y-2 text-[12px]">
                {inventoryList.tools.length === 0 ? (
                  <li className="text-[#6d5138]">Tidak ada alat cadangan</li>
                ) : (
                  inventoryList.tools.map((tool) => (
                    <li
                      key={tool.rarity}
                      className="rounded-[10px] border border-[#d7b07b] bg-[#fffdf9] px-2 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span>Rarity {tool.rarity}</span>
                        <span className="font-semibold">{tool.balance.toString()}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrefill1155(tool.tokenId, tool.balance)}
                        className="mt-2 w-full rounded-[8px] border-2 border-[#45311f] bg-[#ffe0a6] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition hover:-translate-y-[1px]"
                      >
                        Isi Form Listing
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}
      </section>
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
          Tools
        </h4>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {tools.map((tool) => (
            <div
              key={tool.rarity}
              className="rounded-[16px] border-4 border-[#d7b07b] bg-[#fff3c8] px-4 py-3"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em]">
                Rarity {tool.rarity}
              </p>
              <p className="text-[12px] text-[#6d5138]">
                Speed Bonus: +{(tool.speedBps / 100).toFixed(2)}%
              </p>
              <p className="text-[12px] text-[#6d5138]">
                Multiplier: {tool.speedMultiplier.toFixed(2)}x
              </p>
              <p className="mt-2 text-sm font-semibold">
                {formatPrice(tool.priceWei)}
              </p>
              {!tool.active && (
                <span className="mt-1 inline-block rounded-full bg-[#e57373] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                  Inactive
                </span>
              )}
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#6d5138]">
                Aktifkan via Greenvale Village
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    !tool.active ||
                    tool.priceWei <= 0n ||
                    pendingKey === `tool-buy-${tool.rarity}`
                  }
                  onClick={() =>
                    executeTx(`tool-buy-${tool.rarity}`, () =>
                      actions.buyTool(tool.rarity, 1, tool.priceWei),
                    )
                  }
                  className="rounded-[12px] border-2 border-[#45311f] bg-[#ffe0a6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingKey === `tool-buy-${tool.rarity}`
                    ? "Memproses…"
                    : "Beli 1"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
          Seeds
        </h4>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {seeds.map((seed) => (
            <div
              key={seed.seedType}
              className="rounded-[16px] border-4 border-[#d7b07b] bg-[#fffdf4] px-4 py-3"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em]">
                Seed #{seed.seedType}
              </p>
              <p className="text-[12px] text-[#6d5138]">
                Base EXP: {seed.baseExp}
              </p>
              <p className="text-[12px] text-[#6d5138]">
                Growth: {Math.round(seed.growthSeconds / 60)} menit
              </p>
              <p className="mt-2 text-sm font-semibold">
                {formatPrice(seed.priceWei)}
              </p>
              {!seed.active && (
                <span className="mt-1 inline-block rounded-full bg-[#e57373] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                  Inactive
                </span>
              )}
              <button
                type="button"
                disabled={
                  !seed.active ||
                  seed.priceWei <= 0n ||
                  pendingKey === `seed-${seed.seedType}`
                }
                onClick={() =>
                  executeTx(`seed-${seed.seedType}`, () =>
                    actions.buySeed(seed.seedType, 1, seed.priceWei),
                  )
                }
                className="mt-3 w-full rounded-[12px] border-2 border-[#45311f] bg-[#ffe0a6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingKey === `seed-${seed.seedType}` ? "Memproses…" : "Beli 1"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="rounded-[16px] border-4 border-[#d7b07b] bg-[#fff3c8] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
            Water
          </p>
          <p className="mt-2 text-sm font-semibold">
            {formatPrice(waterPriceWei)}
          </p>
          <p className="text-[12px] text-[#6d5138]">
            Dibutuhkan untuk menyiram dan mempercepat proses tumbuh tanaman.
          </p>
          {!waterActive && (
            <span className="mt-1 inline-block rounded-full bg-[#e57373] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
              Inactive
            </span>
          )}
          <button
            type="button"
            disabled={
              !waterActive ||
              waterPriceWei === null ||
              pendingKey === "water"
            }
            onClick={() =>
              executeTx("water", () =>
                actions.buyWater(1, waterPriceWei ?? 0n),
              )
            }
            className="mt-3 w-full rounded-[12px] border-2 border-[#45311f] bg-[#ffe0a6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingKey === "water" ? "Memproses…" : "Beli 1"}
          </button>
        </div>
      </section>
    </div>
  );
}

function MarketplacePanel({
  actions,
  account,
  onRefetch,
  refetchPlots,
  refetchLandBalance,
  isWalletConnected,
  needsChainSwitch,
  onSwitchChain,
  targetChainLabel,
  inventory,
}: PanelConfig) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const {
    seeds: inventorySeeds,
    tools: inventoryTools,
    water,
    activeToolTokenId,
    refetch: refetchInventory,
  } = inventory;
  const publicClient = usePublicClient({ chainId: FARMING_CHAIN_ID });
  const mountedRef = useRef(true);
  const [ownedListings, setOwnedListings] = useState<MarketplaceListingInfo[]>([]);
  const [otherListings, setOtherListings] = useState<MarketplaceListingInfo[]>([]);
  const [marketListingsLoading, setMarketListingsLoading] = useState(false);
  const [marketListingsError, setMarketListingsError] = useState<string | null>(null);
  const [listingDrafts, setListingDrafts] = useState<
    Record<number, { amount: string; price: string; expiry: string }>
  >({});
  const [buyDrafts, setBuyDrafts] = useState<Record<number, string>>({});
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[Marketplace] mount", { account });
    }
    return () => {
      mountedRef.current = false;
      if (process.env.NODE_ENV !== "production") {
        console.debug("[Marketplace] unmount");
      }
    };
  }, [account]);
  const resolveErrorMessage = useCallback((err: unknown) => {
    if (!err) return "Terjadi kesalahan";
    if (process.env.NODE_ENV !== "production") {
      console.error("[Greenvale] marketplace error", err);
    }
    if (typeof err === "object" && "shortMessage" in (err as any)) {
      const message = (err as { shortMessage?: string }).shortMessage;
      if (message) return message;
    }
    if (err instanceof Error) return err.message;
    return String(err);
  }, []);

  const listableInventory = useMemo(
    () => ({
      seeds: inventorySeeds.filter((seed) => seed.balance > 0n),
      tools: inventoryTools.filter((tool) => {
        if (tool.balance === 0n) return false;
        if (activeToolTokenId && BigInt(tool.tokenId) === activeToolTokenId) {
          return false;
        }
        return true;
      }),
      water:
        water.balance > 0n
          ? { tokenId: water.tokenId, balance: water.balance }
          : null,
    }),
    [activeToolTokenId, inventorySeeds, inventoryTools, water.balance, water.tokenId],
  );
  const waterItem = listableInventory.water;

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));


  const describeListingAsset = useCallback((listing: MarketplaceListingInfo) => {
    if (!listing.is1155) {
      return `Land #${listing.tokenId}`;
    }
    if (listing.tokenId === WATER_TOKEN_ID) {
      return "Water Token";
    }
    if (listing.tokenId >= SEED_TOKEN_BASE) {
      return `Seed #${listing.tokenId - SEED_TOKEN_BASE}`;
    }
    if (listing.tokenId >= TOOL_TOKEN_BASE) {
      return `Tool Rarity ${listing.tokenId - TOOL_TOKEN_BASE}`;
    }
    return `Token ${listing.tokenId}`;
  }, []);

  const formatListingExpiry = useCallback((expiry: bigint) => {
    if (expiry === 0n) return "Tidak ada";
    try {
      const expiryNumber = Number(expiry);
      if (!Number.isFinite(expiryNumber)) {
        return expiry.toString();
      }
      const date = new Date(expiryNumber * 1000);
      if (Number.isNaN(date.getTime())) {
        return expiry.toString();
      }
      const formatted = date.toLocaleString();
      const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
      if (expiry <= nowSeconds) {
        return `${formatted} (sudah lewat)`;
      }
      return formatted;
    } catch {
      return expiry.toString();
    }
  }, []);

  const refreshMarketplaceListings = useCallback(async () => {
    if (!mountedRef.current) return;
    if (!account || !publicClient || !MARKETPLACE_ADDRESS) {
      if (mountedRef.current) {
        setOwnedListings([]);
        setOtherListings([]);
        setMarketListingsError(null);
        setMarketListingsLoading(false);
      }
      return;
    }

    if (mountedRef.current) {
      setMarketListingsLoading(true);
      setMarketListingsError(null);
    }

    try {
      const latestBlock = await publicClient.getBlockNumber();
      if (process.env.NODE_ENV !== "production") {
        console.debug("[Marketplace] refresh start", {
          chainId: FARMING_CHAIN_ID,
          account,
          latestBlock: latestBlock.toString(),
        });
      }
      const configuredLookback =
        MARKETPLACE_LOOKBACK_BLOCKS ?? DEFAULT_MARKETPLACE_LOOKBACK_BLOCKS;
      const lookbackStart =
        configuredLookback > 0n && latestBlock > configuredLookback
          ? latestBlock - configuredLookback
          : 0n;
      const deploymentBlock = MARKETPLACE_DEPLOYMENT_BLOCK;
      const minBlock =
        deploymentBlock !== null && deploymentBlock > lookbackStart
          ? deploymentBlock
          : lookbackStart;

      let toBlock = latestBlock;
      let iterations = 0;
      const accountLower = account.toLowerCase();
      const listingEvents: Array<{ id: bigint; seller: string }> = [];

      const totalRange = latestBlock > minBlock ? latestBlock - minBlock : 0n;
      const maxRequestsBigInt = BigInt(MAX_MARKETPLACE_LOG_REQUESTS);
      const divisor = maxRequestsBigInt > 1n ? maxRequestsBigInt - 1n : 1n;
      let blockSpan = MIN_MARKETPLACE_LOG_BLOCK_SPAN;
      if (totalRange > 0n) {
        const idealSpan = totalRange / divisor + 1n;
        if (idealSpan > MAX_MARKETPLACE_LOG_BLOCK_SPAN) {
          blockSpan = MAX_MARKETPLACE_LOG_BLOCK_SPAN;
        } else if (idealSpan > blockSpan) {
          blockSpan = idealSpan;
        }
      }
      if (process.env.NODE_ENV !== "production") {
        console.debug("[Marketplace] log scan config", {
          minBlock: minBlock.toString(),
          totalRange: totalRange.toString(),
          blockSpan: blockSpan.toString(),
          maxRequests: MAX_MARKETPLACE_LOG_REQUESTS,
        });
      }

      while (
        toBlock >= minBlock &&
        iterations < MAX_MARKETPLACE_LOG_REQUESTS
      ) {
        const fromBlockCandidate =
          toBlock > minBlock + blockSpan
            ? toBlock - blockSpan
            : minBlock;

        const logs = await publicClient.getLogs({
          address: MARKETPLACE_ADDRESS,
          event: MARKETPLACE_LISTING_CREATED_EVENT_ABI[0],
          fromBlock: fromBlockCandidate,
          toBlock,
        });

        for (const log of logs) {
          const topics = log.topics;
          if (!topics || topics.length < 3) continue;
          const listingIdTopic = topics[1];
          const sellerTopic = topics[2];
          if (!listingIdTopic || !sellerTopic) continue;

          const sellerAddress = (
            `0x${sellerTopic.slice(-40)}` as `0x${string}`
          ).toLowerCase();
          try {
            const parsedId = BigInt(listingIdTopic);
            listingEvents.push({ id: parsedId, seller: sellerAddress });
          } catch {
            continue;
          }
        }

        if (process.env.NODE_ENV !== "production") {
          console.debug("[Marketplace] logs segment", {
            fromBlock: fromBlockCandidate.toString(),
            toBlock: toBlock.toString(),
            span: (toBlock - fromBlockCandidate + 1n).toString(),
            logsCount: logs.length,
          });
        }

        iterations += 1;

        if (fromBlockCandidate === minBlock || fromBlockCandidate === 0n) {
          break;
        }

        toBlock = fromBlockCandidate - 1n;
      }

      const uniqueIdStrings = Array.from(
        new Set(listingEvents.map((event) => event.id.toString())),
      );
      const sortedIds = uniqueIdStrings
        .map((id) => BigInt(id))
        .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

      if (sortedIds.length === 0) {
        if (mountedRef.current) {
          setOwnedListings([]);
          setOtherListings([]);
        }
        return;
      }

      const idNumbers = sortedIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

      const fetched = await Promise.all(
        idNumbers.map(async (listingId) => {
          try {
            return await actions.getMarketplaceListing(listingId);
          } catch (err) {
            if (process.env.NODE_ENV !== "production") {
              console.error("[Marketplace] fetch listing failed", {
                listingId,
                error: err,
              });
            }
            return null;
          }
        }),
      );

      if (process.env.NODE_ENV !== "production") {
        console.debug("[Marketplace] fetched listings", {
          fetchedCount: fetched.length,
          entries: fetched.map((entry) =>
            entry
              ? {
                  listingId: entry.listingId,
                  seller: entry.seller,
                  amount: entry.amount.toString(),
                  expiry: entry.expiry.toString(),
                  is1155: entry.is1155,
                }
              : null,
          ),
        });
      }

      const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
      const sanitizedListings = fetched.filter(
        (item): item is MarketplaceListingInfo =>
          item !== null && item.amount > 0n,
      );

      const owned: MarketplaceListingInfo[] = [];
      const others: MarketplaceListingInfo[] = [];
      for (const listing of sanitizedListings) {
        const sellerLower = listing.seller.toLowerCase();
        if (sellerLower === accountLower) {
          owned.push(listing);
          continue;
        }

        if (!listing.is1155) {
          if (process.env.NODE_ENV !== "production") {
            console.debug("[Marketplace] listing ignored (non-ERC1155)", {
              listingId: listing.listingId,
              asset: listing.asset,
              is1155: listing.is1155,
            });
          }
          continue;
        }

        const isExpired = listing.expiry !== 0n && listing.expiry <= nowSeconds;
        if (!isExpired) {
          others.push(listing);
        }
      }

      owned.sort((a, b) => b.listingId - a.listingId);
      others.sort((a, b) => b.listingId - a.listingId);

      const maxDisplay = 40;
      const limitedOthers = others.slice(0, maxDisplay);

      if (mountedRef.current) {
        setOwnedListings(owned);
        setOtherListings(limitedOthers);
        setMarketListingsError(null);
        if (process.env.NODE_ENV !== "production") {
          console.debug("[Marketplace] listings updated", {
            ownedCount: owned.length,
            othersCount: limitedOthers.length,
            ownedListings: owned.map((listing) => ({
              listingId: listing.listingId,
              seller: listing.seller,
              amount: listing.amount.toString(),
              expiry: listing.expiry.toString(),
            })),
          });
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setOwnedListings([]);
        setOtherListings([]);
        setMarketListingsError(resolveErrorMessage(err));
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("[Marketplace] refresh failed", err);
      }
    } finally {
      if (mountedRef.current) {
        setMarketListingsLoading(false);
      }
      if (process.env.NODE_ENV !== "production") {
        console.debug("[Marketplace] refresh complete");
      }
    }
  }, [account, actions, publicClient, resolveErrorMessage]);

  useEffect(() => {
    void refreshMarketplaceListings();
  }, [refreshMarketplaceListings]);

  const triggerRefetches = useCallback(async () => {
    await Promise.all([
      onRefetch?.(),
      refetchPlots?.(),
      refetchLandBalance?.(),
      refetchInventory(),
      refreshMarketplaceListings(),
    ]);
  }, [
    onRefetch,
    refetchInventory,
    refetchLandBalance,
    refetchPlots,
    refreshMarketplaceListings,
  ]);

  const runMarketplaceTx = useCallback(
    async (key: string, runner: () => Promise<unknown>) => {
      if (!account) {
        toast.error("Hubungkan wallet terlebih dahulu");
        return;
      }
      try {
        setPendingKey(key);
        await toast.promise(
          (async () => {
            await runner();
            await triggerRefetches();
          })(),
          {
            loading: "Mengirim transaksi…",
            success: "Transaksi berhasil",
            error: (err) => resolveErrorMessage(err),
          },
        );
      } catch (err) {
        toast.error(resolveErrorMessage(err));
      } finally {
        setPendingKey(null);
      }
    },
    [resolveErrorMessage, triggerRefetches],
  );

  const getListingDraft = useCallback(
    (tokenId: number) =>
      listingDrafts[tokenId] ?? { amount: "1", price: "", expiry: "" },
    [listingDrafts],
  );

  const updateListingDraft = useCallback(
    (tokenId: number, patch: Partial<{ amount: string; price: string; expiry: string }>) => {
      setListingDrafts((prev) => {
        const current = prev[tokenId] ?? { amount: "1", price: "", expiry: "" };
        return {
          ...prev,
          [tokenId]: { ...current, ...patch },
        };
      });
    },
    [],
  );

  const handleSubmitListing = useCallback(
    async (tokenId: number, maxAmount: bigint) => {
      const draft = getListingDraft(tokenId);
      const amountValue = Number(draft.amount.trim());
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        toast.error("Jumlah tidak valid");
        return;
      }
      if (BigInt(amountValue) > maxAmount) {
        toast.error("Jumlah melebihi stok");
        return;
      }

      const priceTrimmed = draft.price.trim();
      if (!priceTrimmed) {
        toast.error("Harga wajib diisi");
        return;
      }

      let priceWei: bigint;
      try {
        priceWei = parseEther(priceTrimmed);
      } catch {
        toast.error("Format harga tidak valid");
        return;
      }
      if (priceWei <= 0n) {
        toast.error("Harga harus lebih dari 0");
        return;
      }

      let expiryValue = 0n;
      const expiryTrimmed = draft.expiry.trim();
      if (expiryTrimmed) {
        const parsedNumber = Number(expiryTrimmed);
        if (!Number.isFinite(parsedNumber) || parsedNumber < 0) {
          toast.error("Expiry tidak valid");
          return;
        }
        if (parsedNumber > 0) {
          const nowSeconds = Math.floor(Date.now() / 1000);
          // Treat small numbers as duration (minutes) for UX, otherwise expect unix timestamp.
          const unixTimestampThreshold = 1e10; // ~Sat Nov 20 2286
          if (parsedNumber >= unixTimestampThreshold) {
            const parsedTimestamp = BigInt(Math.floor(parsedNumber));
            if (parsedTimestamp <= BigInt(nowSeconds)) {
              toast.error("Expiry harus lebih besar dari waktu saat ini");
              return;
            }
            expiryValue = parsedTimestamp;
          } else {
            const durationMinutes = parsedNumber;
            if (durationMinutes === 0) {
              expiryValue = 0n;
            } else {
              const durationSeconds = Math.floor(durationMinutes * 60);
              if (durationSeconds <= 0) {
                toast.error("Expiry tidak valid");
                return;
              }
              expiryValue = BigInt(nowSeconds + durationSeconds);
            }
          }
        }
      }

      await runMarketplaceTx(`list-1155-${tokenId}`, () =>
        actions.listMarketplace1155(tokenId, amountValue, priceWei, expiryValue),
      );
      setListingDrafts((prev) => ({
        ...prev,
        [tokenId]: { amount: "1", price: "", expiry: "" },
      }));
    },
    [actions, getListingDraft, runMarketplaceTx],
  );

  const getBuyDraft = useCallback(
    (listingId: number, maxAvailable: bigint) => {
      const stored = buyDrafts[listingId];
      if (stored) return stored;
      const defaultQty = maxAvailable > 0n ? "1" : "";
      return defaultQty;
    },
    [buyDrafts],
  );

  const updateBuyDraft = useCallback((listingId: number, value: string) => {
    setBuyDrafts((prev) => ({
      ...prev,
      [listingId]: value,
    }));
  }, []);

  const handleSubmitBuy = useCallback(
    async (listing: MarketplaceListingInfo) => {
      const rawQty = getBuyDraft(listing.listingId, listing.amount).trim();
      const qtyValue = Number(rawQty);
      if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
        toast.error("Qty tidak valid");
        return;
      }
      if (BigInt(qtyValue) > listing.amount) {
        toast.error("Qty melebihi stok listing");
        return;
      }
      await runMarketplaceTx(`quick-buy-${listing.listingId}`, () =>
        actions.buyMarketplace1155(listing.listingId, qtyValue),
      );
      setBuyDrafts((prev) => ({
        ...prev,
        [listing.listingId]: "1",
      }));
    },
    [actions, getBuyDraft, runMarketplaceTx],
  );

  if (!isWalletConnected) {
    return (
      <p className="text-xs text-[#cc5b42]">
        Hubungkan wallet untuk membuat listing atau melakukan pembelian.
      </p>
    );
  }

  if (needsChainSwitch) {
    return (
      <div className="space-y-2 text-xs text-[#cc5b42]">
        <p>
          Switch ke {targetChainLabel} terlebih dahulu sebelum menggunakan
          marketplace.
        </p>
        <button
          type="button"
          onClick={() => {
            void onSwitchChain?.();
          }}
          className="rounded-[12px] border-2 border-[#45311f] bg-[#ffe0a6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition hover:-translate-y-[1px]"
        >
          Switch ke {targetChainLabel}
        </button>
      </div>
    );
  }

  if (!account) {
    return (
      <p className="text-xs text-[#cc5b42]">
        Alamat wallet tidak tersedia. Silakan pilih wallet lain.
      </p>
    );
  }

  return (
    <div className="space-y-5 text-[#45311f]">
      <section className="rounded-[18px] border-4 border-[#d7b07b] bg-[#fff3c8] px-4 py-4">
        <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
          Cara Cepat Marketplace
        </h4>
        <ul className="mt-2 space-y-1 text-[12px] text-[#45311f]">
          <li>
            1. Pastikan kamu sudah approve Item1155 & Land721 sekali saja. Tombol
            persetujuan ada di bawah.
          </li>
          <li>
            2. Pilih item di “Stok Siap Listing”, isi jumlah, harga, dan expiry
            langsung di kartu, lalu klik List Item.
          </li>
          <li>
            3. Cek daftar “Listing Pemain Lain” untuk membeli stok komunitas—
            isi qty lalu tekan tombol “Beli” untuk transaksi instan.
          </li>
        </ul>
      </section>

      <section className="rounded-[18px] border-4 border-[#d7b07b] bg-[#fffdf4] px-4 py-4">
        <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
          Inventory Siap Listing
        </h4>
        {listableInventory.seeds.length === 0 &&
        !waterItem &&
        listableInventory.tools.length === 0 ? (
          <p className="mt-3 text-sm text-[#6d5138]">
            Tidak ada item yang siap listing saat ini.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-[14px] border-2 border-[#d7b07b] bg-[#fffdf9] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
                Seeds
              </p>
              <ul className="mt-2 space-y-2 text-[12px]">
                {listableInventory.seeds.length === 0 ? (
                  <li className="text-[#6d5138]">Tidak ada stok seed</li>
                ) : (
                  listableInventory.seeds.map((seed) => (
                    <li
                      key={seed.seedType}
                      className="space-y-2 rounded-[10px] border border-[#d7b07b] bg-[#fffdf4] px-3 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <span>Seed #{seed.seedType}</span>
                        <span className="font-semibold">
                          {seed.balance.toString()}
                        </span>
                      </div>
                      <div className="grid gap-2 text-[11px] text-[#45311f]">
                        <label className="flex items-center justify-between gap-2">
                          <span>Jumlah</span>
                          <input
                            type="number"
                            min={1}
                            max={seed.balance.toString()}
                            value={getListingDraft(seed.tokenId).amount}
                            onChange={(event) =>
                              updateListingDraft(seed.tokenId, {
                                amount: event.target.value,
                              })
                            }
                            className="w-20 rounded border border-[#d7b07b] px-2 py-1 text-[11px]"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2">
                          <span>Harga (ETH)</span>
                          <input
                            type="text"
                            placeholder="0.001"
                            value={getListingDraft(seed.tokenId).price}
                            onChange={(event) =>
                              updateListingDraft(seed.tokenId, {
                                price: event.target.value,
                              })
                            }
                            className="w-24 rounded border border-[#d7b07b] px-2 py-1 text-[11px]"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2">
                          <span>Expiry (menit / unix timestamp)</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="contoh: 30"
                            value={getListingDraft(seed.tokenId).expiry}
                            onChange={(event) =>
                              updateListingDraft(seed.tokenId, {
                                expiry: event.target.value,
                              })
                            }
                            className="w-24 rounded border border-[#d7b07b] px-2 py-1 text-[11px]"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSubmitListing(seed.tokenId, seed.balance)}
                        className="w-full rounded-[8px] border-2 border-[#45311f] bg-[#ffe0a6] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition hover:-translate-y-[1px]"
                      >
                        List Item
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-[14px] border-2 border-[#d7b07b] bg-[#fffdf9] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
                Water
              </p>
              {waterItem ? (
                <div className="mt-2 space-y-2 rounded-[10px] border border-[#d7b07b] bg-[#fffdf4] px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span>Water Token</span>
                    <span className="font-semibold">
                      {waterItem.balance.toString()}
                    </span>
                  </div>
                  <div className="grid gap-2 text-[11px] text-[#45311f]">
                    <label className="flex items-center justify-between gap-2">
                      <span>Jumlah</span>
                      <input
                        type="number"
                        min={1}
                        max={waterItem.balance.toString()}
                        value={getListingDraft(waterItem.tokenId).amount}
                        onChange={(event) =>
                          updateListingDraft(waterItem.tokenId, {
                            amount: event.target.value,
                          })
                        }
                        className="w-20 rounded border border-[#d7b07b] px-2 py-1 text-[11px]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Harga (ETH)</span>
                      <input
                        type="text"
                        placeholder="0.001"
                        value={getListingDraft(waterItem.tokenId).price}
                        onChange={(event) =>
                          updateListingDraft(waterItem.tokenId, {
                            price: event.target.value,
                          })
                        }
                        className="w-24 rounded border border-[#d7b07b] px-2 py-1 text-[11px]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Expiry (menit / unix timestamp)</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="contoh: 30"
                        value={getListingDraft(waterItem.tokenId).expiry}
                        onChange={(event) =>
                          updateListingDraft(waterItem.tokenId, {
                            expiry: event.target.value,
                          })
                        }
                        className="w-24 rounded border border-[#d7b07b] px-2 py-1 text-[11px]"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleSubmitListing(waterItem.tokenId, waterItem.balance)
                    }
                    className="w-full rounded-[8px] border-2 border-[#45311f] bg-[#ffe0a6] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition hover:-translate-y-[1px]"
                  >
                    List Item
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-[#6d5138]">
                  Tidak ada stok water
                </p>
              )}
            </div>
            <div className="rounded-[14px] border-2 border-[#d7b07b] bg-[#fffdf9] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
                Tools (non-aktif)
              </p>
              <ul className="mt-2 space-y-2 text-[12px]">
                {listableInventory.tools.length === 0 ? (
                  <li className="text-[#6d5138]">
                    Tidak ada alat cadangan untuk listing
                  </li>
                ) : (
                  listableInventory.tools.map((tool) => (
                    <li
                      key={tool.rarity}
                      className="space-y-2 rounded-[10px] border border-[#d7b07b] bg-[#fffdf4] px-3 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <span>Rarity {tool.rarity}</span>
                        <span className="font-semibold">
                          {tool.balance.toString()}
                        </span>
                      </div>
                      <div className="grid gap-2 text-[11px] text-[#45311f]">
                        <label className="flex items-center justify-between gap-2">
                          <span>Jumlah</span>
                          <input
                            type="number"
                            min={1}
                            max={tool.balance.toString()}
                            value={getListingDraft(tool.tokenId).amount}
                            onChange={(event) =>
                              updateListingDraft(tool.tokenId, {
                                amount: event.target.value,
                              })
                            }
                            className="w-20 rounded border border-[#d7b07b] px-2 py-1 text-[11px]"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2">
                          <span>Harga (ETH)</span>
                          <input
                            type="text"
                            placeholder="0.001"
                            value={getListingDraft(tool.tokenId).price}
                            onChange={(event) =>
                              updateListingDraft(tool.tokenId, {
                                price: event.target.value,
                              })
                            }
                            className="w-24 rounded border border-[#d7b07b] px-2 py-1 text-[11px]"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2">
                          <span>Expiry (menit / unix timestamp)</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="contoh: 30"
                            value={getListingDraft(tool.tokenId).expiry}
                            onChange={(event) =>
                              updateListingDraft(tool.tokenId, {
                                expiry: event.target.value,
                              })
                            }
                            className="w-24 rounded border border-[#d7b07b] px-2 py-1 text-[11px]"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSubmitListing(tool.tokenId, tool.balance)}
                        className="w-full rounded-[8px] border-2 border-[#45311f] bg-[#ffe0a6] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition hover:-translate-y-[1px]"
                      >
                        List Item
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[18px] border-4 border-[#d7b07b] bg-[#fff3c8] px-4 py-4">
        <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
          Approval Marketplace
        </h4>
        <p className="mt-2 text-[12px] text-[#6d5138]">
          Marketplace memerlukan persetujuan transfer sebelum listing. Jalankan
          perintah berikut sekali untuk memberi izin.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pendingKey === "approve-1155"}
            onClick={() =>
              runMarketplaceTx("approve-1155", () =>
                actions.approveMarketplace1155(),
              )
            }
            className="rounded-[12px] border-2 border-[#45311f] bg-[#ffe0a6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingKey === "approve-1155" ? "Memproses…" : "Approve Item1155"}
          </button>
        </div>
      </section>

      <section className="rounded-[18px] border-4 border-[#d7b07b] bg-[#fffdf4] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
            Listing Pemain Lain
          </h4>
          <button
            type="button"
            onClick={() => {
              void refreshMarketplaceListings();
            }}
            disabled={marketListingsLoading}
            className="rounded-[10px] border-2 border-[#45311f] bg-[#ffe0a6] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {marketListingsLoading ? "Memuat…" : "Refresh"}
          </button>
        </div>
        {marketListingsLoading ? (
          <p className="mt-3 text-sm text-[#6d5138]">
            Mengambil listing marketplace pemain lain…
          </p>
        ) : otherListings.length === 0 ? (
          <p className="mt-3 text-sm text-[#6d5138]">
            Belum ada listing dari pemain lain di rentang blok terbaru.
          </p>
        ) : (
          <ul className="mt-3 space-y-3 text-[12px]">
            {otherListings.map((listing) => {
              const shortSeller = `${listing.seller.slice(0, 6)}…${listing.seller.slice(-4)}`;
              const quick1155Key = `quick-buy-${listing.listingId}`;
              return (
                <li
                  key={listing.listingId}
                  className="rounded-[14px] border-2 border-[#d7b07b] bg-[#fffdf4] px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6d5138]">
                      Listing #{listing.listingId}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#2f5c23]">
                      {listing.is1155 ? "ERC-1155" : "ERC-721"}
                    </span>
                  </div>
                  <p className="mt-1 text-[#45311f]">Penjual: {shortSeller}</p>
                  <p className="text-[#45311f]">
                    Item: {describeListingAsset(listing)}
                  </p>
                  {listing.is1155 && (
                    <p className="text-[#45311f]">
                      Qty tersedia: {listing.amount.toString()}
                    </p>
                  )}
                  <p className="text-[#45311f]">
                    Harga per unit: {formatEther(listing.pricePerUnitWei)} ETH
                  </p>
                  <p className="text-[#45311f]">
                    Expiry: {formatListingExpiry(listing.expiry)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-[10px] text-[#45311f]">
                      Qty
                      <input
                        type="number"
                        min={1}
                        max={listing.amount.toString()}
                        value={getBuyDraft(listing.listingId, listing.amount)}
                        onChange={(event) =>
                          updateBuyDraft(listing.listingId, event.target.value)
                        }
                        className="w-16 rounded border border-[#d7b07b] px-2 py-1 text-[10px]"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={
                        listing.amount <= 0n || pendingKey === quick1155Key
                      }
                      onClick={() => {
                        if (listing.amount <= 0n) return;
                        void handleSubmitBuy(
                          listing
                        );
                      }}
                      className="rounded-[10px] border-2 border-[#2f5c23] bg-[#d4f0c2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#2f5c23] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingKey === quick1155Key ? "Memproses…" : "Beli"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateBuyDraft(
                          listing.listingId,
                          listing.amount.toString(),
                        )
                      }
                      className="rounded-[10px] border-2 border-[#45311f] bg-[#fff3c8] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition hover:-translate-y-[1px]"
                    >
                      Max
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[18px] border-4 border-[#d7b07b] bg-[#fffdf4] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6d5138]">
            Listing Aktif Kamu
          </h4>
          <button
            type="button"
            onClick={() => {
              void refreshMarketplaceListings();
            }}
            disabled={marketListingsLoading}
            className="rounded-[10px] border-2 border-[#45311f] bg-[#ffe0a6] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#45311f] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {marketListingsLoading ? "Memuat…" : "Refresh"}
          </button>
        </div>
        {marketListingsError && (
          <p className="mt-2 text-xs text-red-600">{marketListingsError}</p>
        )}
        {marketListingsLoading ? (
          <p className="mt-3 text-sm text-[#6d5138]">
            Memuat listing aktif…
          </p>
        ) : ownedListings.length === 0 ? (
          <p className="mt-3 text-sm text-[#6d5138]">
            Belum ada listing aktif. Gunakan form di bawah untuk membuat listing
            baru.
          </p>
        ) : (
          <ul className="mt-3 space-y-3 text-[12px]">
            {ownedListings.map((listing) => (
              <li
                key={listing.listingId}
                className="rounded-[14px] border-2 border-[#d7b07b] bg-[#fffdf4] px-3 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6d5138]">
                    Listing #{listing.listingId}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#cc5b42]">
                    {listing.is1155 ? "ERC-1155" : "ERC-721"}
                  </span>
                </div>
                <p className="mt-1 text-[#45311f]">
                  Asset: {describeListingAsset(listing)}
                </p>
                {listing.is1155 && (
                  <p className="text-[#45311f]">
                    Qty tersisa: {listing.amount.toString()}
                  </p>
                )}
                <p className="text-[#45311f]">
                  Harga per unit: {formatEther(listing.pricePerUnitWei)} ETH
                </p>
                <p className="text-[#45311f]">
                  Expiry: {formatListingExpiry(listing.expiry)}
                </p>
                {listing.expiry !== 0n && listing.expiry <= nowSeconds && (
                  <p className="text-[11px] text-[#cc5b42]">
                    Listing sudah kedaluwarsa. Cancel untuk mengembalikan item.
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pendingKey === `cancel-${listing.listingId}`}
                    onClick={() =>
                      runMarketplaceTx(`cancel-${listing.listingId}`, () =>
                        actions.cancelMarketplaceListing(listing.listingId),
                      )
                    }
                    className="rounded-[10px] border-2 border-[#cc5b42] bg-[#ffe0a6] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#cc5b42] transition enabled:hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingKey === `cancel-${listing.listingId}`
                      ? "Membatalkan…"
                      : "Cancel Listing"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
