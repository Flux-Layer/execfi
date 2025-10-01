import { usePrivy } from "@privy-io/react-auth";
import SmartAccountInfo from "./SmartAccountInfo";

const InitialText = () => {
  const { authenticated, user } = usePrivy();

  return !authenticated ? (
    <>
      <p>
        👋 Hey there! Welcome to{" "}
        <span className="text-emerald-400">ExecFi Terminal</span>.
      </p>
      <p>💬 You can explore and ask questions without logging in.</p>
      <p>
        🔐 <span className="text-blue-200">Log in</span> to execute transactions
        and manage your assets.
      </p>
      <p className="whitespace-nowrap overflow-hidden font-light">
        ------------------------------------------------------------------------
      </p>

      <div className="mt-3 space-y-1">
        <p className="text-cyan-300 font-semibold">🚀 Explore Without Login:</p>
        <p className="text-slate-300 ml-2">
          • Type <span className="text-emerald-400">/help</span> to see all
          available commands
        </p>
        <p className="text-slate-300 ml-2">
          • Use <span className="text-emerald-400">/chain list</span> to see
          supported networks
        </p>
        <p className="text-slate-300 ml-2">
          • Try <span className="text-emerald-400">/accountinfo</span> to see
          system status
        </p>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-purple-300 font-semibold">💬 Ask Questions:</p>
        <p className="text-slate-300 ml-2">
          • General:{" "}
          <span className="text-yellow-300">&ldquo;What is DeFi?&rdquo;</span>
        </p>
        <p className="text-slate-300 ml-2">
          • Learning:{" "}
          <span className="text-yellow-300">
            &ldquo;How do blockchains work?&rdquo;
          </span>
        </p>
        <p className="text-slate-300 ml-2">
          • Help:{" "}
          <span className="text-yellow-300">
            &ldquo;Explain gas fees&rdquo;
          </span>
        </p>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-orange-300 font-semibold">
          🔗 Transaction Examples (Login Required):
        </p>
        <p className="text-slate-300 ml-2">
          • Send native:{" "}
          <span className="text-yellow-300">
            &ldquo;Send 0.001 ETH to vitalik.eth&rdquo;
          </span>
        </p>
        <p className="text-slate-300 ml-2">
          • Send tokens:{" "}
          <span className="text-yellow-300">
            &ldquo;Send 100 USDC to 0x123...&rdquo;
          </span>
        </p>
        <p className="text-slate-300 ml-2">
          • Cross-chain:{" "}
          <span className="text-yellow-300">
            &ldquo;Swap 0.1 ETH to USDC on polygon&rdquo;
          </span>
        </p>
        <p className="text-slate-300 ml-2">
          • Specific amount:{" "}
          <span className="text-yellow-300">
            &ldquo;Transfer 50 DAI to alice.eth on ethereum&rdquo;
          </span>
        </p>
      </div>

      <div className="mt-4 p-2 bg-blue-800/20 border-l-2 border-blue-400 rounded">
        <p className="text-blue-300 text-sm">
          🔐 <strong>Ready to transact?</strong>{" "}
          <span className="text-blue-400">Login</span> to unlock wallet features
          and start making secure DeFi transactions across multiple chains.
        </p>
      </div>

      <p className="whitespace-nowrap overflow-hidden font-light mt-4">
        ------------------------------------------------------------------------
      </p>
    </>
  ) : (
    <>
      <p>
        🔓 <span className="text-blue-200">Access</span> granted.
      </p>
      <p className="whitespace-nowrap overflow-hidden font-light">
        ------------------------------------------------------------------------
      </p>
      <p>Logged in with email, {String(user?.email?.address || "")}.</p>
      <p className="mt-2">
        ✅ <span className="text-green-400">Session initialized</span> - Ready
        for DeFi operations
      </p>

      <div className="mt-3 space-y-1">
        <p className="text-cyan-300 font-semibold">🚀 Getting Started:</p>
        <p className="text-slate-300 ml-2">
          • Type <span className="text-emerald-400">/help</span> to see all
          available commands
        </p>
        <p className="text-slate-300 ml-2">
          • Use <span className="text-emerald-400">/balance</span> to check your
          token balances
        </p>
        <p className="text-slate-300 ml-2">
          • Try <span className="text-emerald-400">/chain list</span> to see
          supported networks
        </p>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-purple-300 font-semibold">💬 Ask Questions:</p>
        <p className="text-slate-300 ml-2">
          • General:{" "}
          <span className="text-yellow-300">&ldquo;What is DeFi?&rdquo;</span>
        </p>
        <p className="text-slate-300 ml-2">
          • Learning:{" "}
          <span className="text-yellow-300">
            &ldquo;How do I swap tokens?&rdquo;
          </span>
        </p>
        <p className="text-slate-300 ml-2">
          • Help:{" "}
          <span className="text-yellow-300">
            &ldquo;Explain gas fees&rdquo;
          </span>
        </p>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-orange-300 font-semibold">
          🔗 Transaction Examples:
        </p>
        <p className="text-slate-300 ml-2">
          • Send native:{" "}
          <span className="text-yellow-300">
            &ldquo;Send 0.001 ETH to vitalik.eth&rdquo;
          </span>
        </p>
        <p className="text-slate-300 ml-2">
          • Send tokens:{" "}
          <span className="text-yellow-300">
            &ldquo;Send 100 USDC to 0x123...&rdquo;
          </span>
        </p>
        <p className="text-slate-300 ml-2">
          • Cross-chain:{" "}
          <span className="text-yellow-300">
            &ldquo;Swap 0.1 ETH to USDC on polygon&rdquo;
          </span>
        </p>
        <p className="text-slate-300 ml-2">
          • Specific amount:{" "}
          <span className="text-yellow-300">
            &ldquo;Transfer 50 DAI to alice.eth on ethereum&rdquo;
          </span>
        </p>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-blue-300 font-semibold">🌐 Multi-Chain Ready:</p>
        <p className="text-slate-300 ml-2">
          • Default: <span className="text-blue-400">Base (8453)</span> - Low
          fees, fast transactions
        </p>
        <p className="text-slate-300 ml-2">
          • Supported: Ethereum, Polygon, Arbitrum, Optimism, Avalanche +
          Testnets
        </p>
        <p className="text-slate-300 ml-2">
          • Switch networks:{" "}
          <span className="text-emerald-400">/chain switch ethereum</span>
        </p>
      </div>

      <div className="mt-4 p-2 bg-slate-800/30 border-l-2 border-emerald-500 rounded">
        <p className="text-emerald-300 text-sm">
          💡 <strong>Pro Tip:</strong> Start with{" "}
          <span className="text-emerald-400">/accountinfo</span> to see your
          wallet details, then{" "}
          <span className="text-emerald-400">/balance</span> to check your
          assets before making transactions.
        </p>
      </div>

      <p className="whitespace-nowrap overflow-hidden font-light mt-4">
        ------------------------------------------------------------------------
      </p>
    </>
  );
};

export default InitialText;
