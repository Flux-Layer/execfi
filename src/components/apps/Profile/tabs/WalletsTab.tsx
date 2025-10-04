"use client";

import { useState } from "react";
import { useProfileContext } from "../ProfileContext";

export function WalletsTab() {
  const { eoaWallets, selectedEoa, selectEoa, copyAddress, copiedAddress, formatAddress, smartAccount } = useProfileContext();
  const [copying, setCopying] = useState<string | null>(null);

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
        <p className="text-sm text-slate-300">
          {smartAccount.address ? formatAddress(smartAccount.address) : "Smart account not initialized yet."}
        </p>
      </section>

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
                        onClick={() => selectEoa(index)}
                      >
                        {isSelected ? "Default" : "Set Default"}
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
