"use client";

import { useState, useMemo } from "react";
import { useProfileContext } from "../ProfileContext";

export function WalletsTab() {
  const { 
    eoaWallets, 
    selectedEoa, 
    selectEoa, 
    copyAddress, 
    copiedAddress, 
    formatAddress, 
    smartAccount,
    baseAccount,
    accountMode,
    setAccountMode,
  } = useProfileContext();
  const [copying, setCopying] = useState<string | null>(null);

  // Filter Privy wallets to match EOAProvider's internal filtering
  const privyWallets = useMemo(() => {
    return eoaWallets.filter((wallet) => wallet.walletClientType === "privy");
  }, [eoaWallets]);

  // Helper to get the correct Privy wallet index
  const getPrivyWalletIndex = (wallet: typeof eoaWallets[0]) => {
    return privyWallets.findIndex(w => w.address === wallet.address);
  };

  const handleCopy = async (address: string) => {
    setCopying(address);
    try {
      await copyAddress(address);
    } finally {
      setTimeout(() => setCopying(null), 400);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Active Wallet Mode Indicator */}
      <section className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-blue-400">Active Wallet Mode</p>
            <h3 className="text-lg font-semibold text-blue-100">{accountMode}</h3>
          </div>
          <div className="rounded-full bg-blue-500/20 px-3 py-1">
            <span className="text-xs text-blue-300">
              {accountMode === "BASE_ACCOUNT" ? "🔑 Passkey" : accountMode === "SMART_ACCOUNT" ? "🤖 Smart" : "👤 EOA"}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Transactions will be executed using this wallet type.
        </p>
      </section>

      {/* Base Account Section */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Base Account</p>
            <h3 className="text-lg font-semibold text-slate-100">Passkey Wallet</h3>
          </div>
          {baseAccount.isConnected && baseAccount.address && (
            <button
              className="rounded-full border border-purple-500/50 px-3 py-1 text-xs text-purple-300 transition hover:bg-purple-500/10"
              onClick={() => handleCopy(baseAccount.address!)}
            >
              {copying === baseAccount.address ? "Copied" : "Copy"}
            </button>
          )}
        </header>
        
        {baseAccount.isConnected && baseAccount.address ? (
          <>
            <p className="text-sm text-slate-300 mb-3">
              {formatAddress(baseAccount.address)}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAccountMode("BASE_ACCOUNT")}
                className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                  accountMode === "BASE_ACCOUNT"
                    ? "bg-purple-600 text-white"
                    : "border border-white/20 text-slate-200 hover:bg-white/10"
                }`}
              >
                {accountMode === "BASE_ACCOUNT" ? "✓ Active" : "Set as Active"}
              </button>
              <span className="text-xs text-slate-500">
                {accountMode === "BASE_ACCOUNT" && "• All transactions will use passkey authentication"}
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-3">
              Not connected. Set up Base Account for passkey authentication and gas-free transactions.
            </p>
            <button
              onClick={baseAccount.promptSetup}
              className="rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:from-purple-700 hover:to-blue-700"
            >
              Set Up Base Account
            </button>
          </>
        )}
      </section>

      {/* Smart Account Section */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Smart Account</p>
            <h3 className="text-lg font-semibold text-slate-100">Default ExecFi Account</h3>
          </div>
          {smartAccount.address && (
            <button
              className="rounded-full border border-emerald-500/50 px-3 py-1 text-xs text-emerald-300 transition hover:bg-emerald-500/10"
              onClick={() => handleCopy(smartAccount.address!)}
            >
              {copying === smartAccount.address ? "Copied" : "Copy"}
            </button>
          )}
        </header>
        {smartAccount.address ? (
          <>
            <p className="text-sm text-slate-300 mb-3">
              {formatAddress(smartAccount.address)}
            </p>
            <button
              onClick={() => setAccountMode("SMART_ACCOUNT")}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                accountMode === "SMART_ACCOUNT"
                  ? "bg-emerald-600 text-white"
                  : "border border-white/20 text-slate-200 hover:bg-white/10"
              }`}
            >
              {accountMode === "SMART_ACCOUNT" ? "✓ Active" : "Set as Active"}
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-500">Smart account not initialized yet.</p>
        )}
      </section>

      {/* EOA Wallets Section */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Externally Owned Wallets</p>
            <h3 className="text-lg font-semibold text-slate-100">Connected EOAs</h3>
          </div>
        </header>
        {eoaWallets.length === 0 ? (
          <p className="text-sm text-slate-500">No EOAs detected. Connect a wallet via Privy to enable EOA mode.</p>
        ) : (
          <ul className="space-y-3">
            {eoaWallets.map((wallet, index) => {
              const isSelected = selectedEoa?.address === wallet.address;
              return (
                <li
                  key={wallet.address}
                  className={`rounded-xl border ${isSelected ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 bg-slate-900/60"} p-4 transition`}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{wallet.type.toUpperCase()}</p>
                      <p className="text-xs text-slate-400">{formatAddress(wallet.address)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                        onClick={() => {
                          const privyIndex = getPrivyWalletIndex(wallet);
                          if (privyIndex >= 0) selectEoa(privyIndex);
                        }}
                      >
                        {isSelected ? "✓ Default EOA" : "Set Default EOA"}
                      </button>
                      <button
                        onClick={() => {
                          const privyIndex = getPrivyWalletIndex(wallet);
                          if (privyIndex >= 0) {
                            selectEoa(privyIndex);
                            setAccountMode("EOA");
                          }
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          accountMode === "EOA" && isSelected
                            ? "bg-blue-600 text-white"
                            : "border border-white/20 text-slate-200 hover:bg-white/10"
                        }`}
                      >
                        {accountMode === "EOA" && isSelected ? "✓ Active" : "Set as Active"}
                      </button>
                      <button
                        className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                        onClick={() => handleCopy(wallet.address)}
                      >
                        {copying === wallet.address || (copiedAddress && wallet.address === selectedEoa?.address) ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
