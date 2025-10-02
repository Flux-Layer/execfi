import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { formatBalanceDisplay } from "@/lib/utils/balance";

interface TokenBalance {
  symbol: string;
  balance: bigint;
  decimals: number;
  formatted: string;
}

interface SmartAccountInfoProps {
  address: string;
}

const SmartAccountInfo = ({ address }: SmartAccountInfoProps) => {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  // Truncate address for display
  const displayAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  useEffect(() => {
    const fetchBalances = async () => {
      if (!address) return;

      try {
        setLoading(true);
        setError(undefined);

        // Fetch ETH balance using public RPC
        const response = await fetch("/api/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            chainId: 8453 // Base mainnet
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        const ethBalance: TokenBalance = {
          symbol: "ETH",
          balance: BigInt(data.balance || "0"),
          decimals: 18,
          formatted: formatEther(BigInt(data.balance || "0"))
        };

        setBalances([ethBalance]);

      } catch (err: any) {
        console.error("Failed to fetch balances:", err);
        setError(err.message || "Failed to fetch balances");

        // Set default zero balance on error
        setBalances([{
          symbol: "ETH",
          balance: BigInt(0),
          decimals: 18,
          formatted: "0"
        }]);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [address]);

  return (
    <div className="mt-3 text-sm">
      <p className="whitespace-nowrap overflow-hidden font-light mb-2">
        ------------------------------------------------------------------------
      </p>

      <div className="space-y-1">
        <p className="text-green-400">
          📧 Smart Account:
          <span
            className="text-white font-mono ml-1 cursor-pointer hover:text-blue-300 transition-colors"
            onClick={copyToClipboard}
            title={`Click to copy: ${address}`}
          >
            {displayAddress}
          </span>
          {copied && <span className="text-green-300 ml-2 text-xs">✓ Copied!</span>}
        </p>

        <div className="ml-4">
          <p className="text-yellow-400 mb-1">💰 Balances:</p>

          {loading ? (
            <p className="ml-4 text-gray-400">⏳ Loading balances...</p>
          ) : error ? (
            <p className="ml-4 text-red-400">⚠️ {error}</p>
          ) : balances.length === 0 ? (
            <p className="ml-4 text-gray-400">No balances found</p>
          ) : (
            <div className="ml-4 space-y-0.5">
              {balances.map((token) => (
                <p key={token.symbol} className="text-blue-200 font-mono">
                  {token.symbol}: {formatBalanceDisplay(token.balance, token.decimals, "")}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="whitespace-nowrap overflow-hidden font-light mt-2">
        ------------------------------------------------------------------------
      </p>
    </div>
  );
};

export default SmartAccountInfo;