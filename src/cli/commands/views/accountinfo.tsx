// Account info view component
import React, { useState } from 'react';
import type { CoreContext } from '../../state/types';

interface AccountInfoViewProps {
  core: CoreContext;
}

export function AccountInfoView({ core }: AccountInfoViewProps) {
  const accountMode = core.accountMode || "EOA";
  const hasEOA = !!core.selectedWallet?.address;
  const hasSA = !!core.saAddress;
  const hasBaseAccount = !!core.baseAccountClients?.address;
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(text);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="p-4 bg-slate-900/70 rounded-lg font-mono text-sm border border-white/10">
      <h2 className="text-lg font-bold mb-4 text-slate-100">🔑 Account Information</h2>

      <div className="space-y-4">
        {/* User Info */}
        <div className="bg-slate-800/50 p-3 rounded border border-white/10">
          <h3 className="font-semibold text-slate-200 mb-2">User</h3>
          <div className="text-xs space-y-1">
            <div>
              <span className="text-slate-400">Status:</span>{' '}
              {core.userId ? (
                <span className="text-emerald-400">✅ Authenticated</span>
              ) : (
                <span className="text-red-400">❌ Not signed in</span>
              )}
            </div>
            {core.userId && (
              <div>
                <span className="text-slate-400">User ID:</span>{' '}
                <code className="text-blue-400">{core.userId}</code>
              </div>
            )}
          </div>
        </div>

        {/* Chain Info */}
        <div className="bg-slate-800/50 p-3 rounded border border-white/10">
          <h3 className="font-semibold text-slate-200 mb-2">Network</h3>
          <div className="text-xs space-y-1">
            <div>
              <span className="text-slate-400">Active Chain:</span>{' '}
              <code className="text-blue-400">{getChainName(core.chainId)} ({core.chainId})</code>
            </div>
            <div>
              <span className="text-slate-400">Mode:</span>{' '}
              <span className={`font-medium ${accountMode === 'EOA' ? 'text-blue-400' : 'text-purple-400'}`}>
                {accountMode}
              </span>
            </div>
          </div>
        </div>

        {/* EOA Info */}
        <div className="bg-slate-800/50 p-3 rounded border border-white/10">
          <h3 className="font-semibold text-slate-200 mb-2">
            EOA Wallet {accountMode === 'EOA' && <span className="text-blue-400 text-xs">(Active)</span>}
          </h3>
          <div className="text-xs space-y-1">
            {hasEOA ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Address:</span>{' '}
                  <code 
                    className="text-emerald-400 cursor-pointer hover:text-emerald-300 hover:underline transition-colors"
                    onClick={() => copyToClipboard(core.selectedWallet.address)}
                    title="Click to copy address"
                  >
                    {core.selectedWallet.address}
                  </code>
                  {copiedAddress === core.selectedWallet.address && (
                    <span className="text-xs text-blue-400 animate-fade-in">
                      ✓ Copied!
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400">Type:</span>{' '}
                  <span className="text-slate-300">Privy Embedded Wallet</span>
                </div>
                <div>
                  <span className="text-slate-400">Send Transaction:</span>{' '}
                  {core.eoaSendTransaction ? (
                    <span className="text-emerald-400">✅ Available</span>
                  ) : (
                    <span className="text-red-400">❌ Not available</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-slate-400">No EOA wallet connected</div>
            )}
          </div>
        </div>

        {/* Smart Account Info */}
        <div className="bg-slate-800/50 p-3 rounded border border-white/10">
          <h3 className="font-semibold text-slate-200 mb-2">
            Smart Account {accountMode === 'SMART_ACCOUNT' && <span className="text-purple-400 text-xs">(Active)</span>}
          </h3>
          <div className="text-xs space-y-1">
            {hasSA ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Address:</span>{' '}
                  <code 
                    className="text-emerald-400 cursor-pointer hover:text-emerald-300 hover:underline transition-colors"
                    onClick={() => copyToClipboard(core.saAddress!)}
                    title="Click to copy address"
                  >
                    {core.saAddress}
                  </code>
                  {copiedAddress === core.saAddress && (
                    <span className="text-xs text-blue-400 animate-fade-in">
                      ✓ Copied!
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400">Type:</span>{' '}
                  <span className="text-slate-300">Privy Smart Wallet (ERC-4337)</span>
                </div>
                <div>
                  <span className="text-slate-400">Client:</span>{' '}
                  {core.smartWalletClient ? (
                    <span className="text-emerald-400">✅ Available</span>
                  ) : (
                    <span className="text-red-400">❌ Not available</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-slate-400">No Smart Account available</div>
            )}
          </div>
        </div>

        {/* Base Account Info */}
        <div className="bg-slate-800/50 p-3 rounded border border-white/10">
          <h3 className="font-semibold text-slate-200 mb-2">
            Base Account {accountMode === 'BASE_ACCOUNT' && <span className="text-purple-400 text-xs">(Active)</span>}
          </h3>
          <div className="text-xs space-y-1">
            {hasBaseAccount && core.baseAccountClients?.address ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Address:</span>{' '}
                  <code 
                    className="text-emerald-400 cursor-pointer hover:text-emerald-300 hover:underline transition-colors"
                    onClick={() => copyToClipboard(core.baseAccountClients?.address || '')}
                    title="Click to copy address"
                  >
                    {core.baseAccountClients.address}
                  </code>
                  {copiedAddress === core.baseAccountClients.address && (
                    <span className="text-xs text-blue-400 animate-fade-in">
                      ✓ Copied!
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400">Type:</span>{' '}
                  <span className="text-slate-300">Base Account (Passkey Wallet)</span>
                </div>
                <div>
                  <span className="text-slate-400">SDK:</span>{' '}
                  {core.baseAccountClients.sdk ? (
                    <span className="text-emerald-400">✅ Available</span>
                  ) : (
                    <span className="text-red-400">❌ Not available</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400">Provider:</span>{' '}
                  {core.baseAccountClients.provider ? (
                    <span className="text-emerald-400">✅ Available</span>
                  ) : (
                    <span className="text-red-400">❌ Not available</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-slate-400">No Base Account connected</div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-blue-900/30 p-3 rounded border border-blue-500/30">
          <h3 className="font-semibold text-blue-300 mb-2">Quick Actions</h3>
          <div className="text-xs space-y-1 text-slate-300">
            <div>
              • Use <code className="text-emerald-400">/balances</code>
              <span className="text-slate-500"> (/balance)</span> to check your
              token balances
            </div>
            <div>• Use <code className="text-emerald-400">/send</code> to transfer tokens</div>
            <div>• Use <code className="text-emerald-400">/chains</code> to see supported networks</div>
            <div>• Use <code className="text-emerald-400">/switch &lt;chain&gt;</code> to change networks</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getChainName(chainId: number): string {
  const chainNames: Record<number, string> = {
    1: "Ethereum",
    8453: "Base",
    84532: "Base Sepolia",
    137: "Polygon",
    42161: "Arbitrum",
    10: "Optimism",
    43114: "Avalanche",
  };

  return chainNames[chainId] || `Chain ${chainId}`;
}
