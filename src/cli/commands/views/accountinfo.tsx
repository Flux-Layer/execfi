// Account info view component
import React from 'react';
import type { CoreContext } from '../../state/types';

interface AccountInfoViewProps {
  core: CoreContext;
}

export function AccountInfoView({ core }: AccountInfoViewProps) {
  const accountMode = core.accountMode || "EOA";
  const hasEOA = !!core.selectedWallet?.address;
  const hasSA = !!core.saAddress;

  return (
    <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
      <h2 className="text-lg font-bold mb-4">🔑 Account Information</h2>

      <div className="space-y-4">
        {/* User Info */}
        <div className="bg-white p-3 rounded border">
          <h3 className="font-semibold text-gray-700 mb-2">User</h3>
          <div className="text-xs space-y-1">
            <div>
              <span className="text-gray-500">Status:</span>{' '}
              {core.userId ? (
                <span className="text-green-600">✅ Authenticated</span>
              ) : (
                <span className="text-red-600">❌ Not signed in</span>
              )}
            </div>
            {core.userId && (
              <div>
                <span className="text-gray-500">User ID:</span>{' '}
                <code className="text-blue-600">{core.userId}</code>
              </div>
            )}
          </div>
        </div>

        {/* Chain Info */}
        <div className="bg-white p-3 rounded border">
          <h3 className="font-semibold text-gray-700 mb-2">Network</h3>
          <div className="text-xs space-y-1">
            <div>
              <span className="text-gray-500">Active Chain:</span>{' '}
              <code className="text-blue-600">{getChainName(core.chainId)} ({core.chainId})</code>
            </div>
            <div>
              <span className="text-gray-500">Mode:</span>{' '}
              <span className={`font-medium ${accountMode === 'EOA' ? 'text-blue-600' : 'text-purple-600'}`}>
                {accountMode}
              </span>
            </div>
          </div>
        </div>

        {/* EOA Info */}
        <div className="bg-white p-3 rounded border">
          <h3 className="font-semibold text-gray-700 mb-2">
            EOA Wallet {accountMode === 'EOA' && <span className="text-blue-600 text-xs">(Active)</span>}
          </h3>
          <div className="text-xs space-y-1">
            {hasEOA ? (
              <>
                <div>
                  <span className="text-gray-500">Address:</span>{' '}
                  <code className="text-green-600">{core.selectedWallet.address}</code>
                </div>
                <div>
                  <span className="text-gray-500">Type:</span>{' '}
                  <span className="text-gray-600">Privy Embedded Wallet</span>
                </div>
                <div>
                  <span className="text-gray-500">Send Transaction:</span>{' '}
                  {core.eoaSendTransaction ? (
                    <span className="text-green-600">✅ Available</span>
                  ) : (
                    <span className="text-red-600">❌ Not available</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-gray-500">No EOA wallet connected</div>
            )}
          </div>
        </div>

        {/* Smart Account Info */}
        <div className="bg-white p-3 rounded border">
          <h3 className="font-semibold text-gray-700 mb-2">
            Smart Account {accountMode === 'SMART_ACCOUNT' && <span className="text-purple-600 text-xs">(Active)</span>}
          </h3>
          <div className="text-xs space-y-1">
            {hasSA ? (
              <>
                <div>
                  <span className="text-gray-500">Address:</span>{' '}
                  <code className="text-green-600">{core.saAddress}</code>
                </div>
                <div>
                  <span className="text-gray-500">Type:</span>{' '}
                  <span className="text-gray-600">Privy Smart Wallet (ERC-4337)</span>
                </div>
                <div>
                  <span className="text-gray-500">Client:</span>{' '}
                  {core.smartWalletClient ? (
                    <span className="text-green-600">✅ Available</span>
                  ) : (
                    <span className="text-red-600">❌ Not available</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-gray-500">No Smart Account available</div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-blue-50 p-3 rounded border">
          <h3 className="font-semibold text-blue-700 mb-2">Quick Actions</h3>
          <div className="text-xs space-y-1">
            <div>• Use <code>/balance</code> to check your native token balance</div>
            <div>• Use <code>/send</code> to transfer tokens</div>
            <div>• Use <code>/chains</code> to see supported networks</div>
            <div>• Use <code>/switch &lt;chain&gt;</code> to change networks</div>
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