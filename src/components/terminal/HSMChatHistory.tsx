"use client";

import type { AppState } from "@/cli/state/types";
import { NETWORK_TO_CHAIN_ID } from "@/constants/chainIds";

const CHAIN_ID_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(NETWORK_TO_CHAIN_ID).map(([name, id]) => [id, name])
);

interface HSMChatHistoryProps {
  history: AppState["chatHistory"];
}

const HSMChatHistory = ({ history }: HSMChatHistoryProps) => {
  return (
    <div className="mt-4">
      {history.map((message, index) => (
        <div key={index} className="mb-4">
          {message.role === "user" ? (
            <p className="text-slate-100">
              <span className="text-emerald-400 font-semibold">→ </span>
              {typeof message.content === "string" ? message.content : JSON.stringify(message.content)}
            </p>
          ) : typeof message.content === "string" ? (
            <p className="text-slate-300 ml-4">
              {message.content}
            </p>
          ) : message.content?.type === "intent-summary" ? (
            <div className="space-y-1">
              <p className="text-emerald-300 font-semibold">Parsed Intent:</p>
              <div className="bg-slate-800/50 rounded p-3 space-y-1 text-sm">
                <p><span className="text-cyan-400">Action:</span> {message.content.action}</p>
                <p><span className="text-cyan-400">Chain:</span> {message.content.chain}</p>
                <p><span className="text-cyan-400">Token:</span> {message.content.token}</p>
                <p><span className="text-cyan-400">Amount:</span> {message.content.amount}</p>
                <p><span className="text-cyan-400">Recipient:</span> {message.content.recipient}</p>
              </div>
            </div>
          ) : message.content?.type === "clarification" ? (
            <div className="space-y-2">
              <p className="text-yellow-300 font-semibold">❓ {message.content.question}</p>
              {message.content.missing && message.content.missing.length > 0 && (
                <p className="text-orange-300 text-sm">
                  Missing: {message.content.missing.join(", ")}
                </p>
              )}
            </div>
          ) : message.content?.type === "token-table" ? (
            <div className="space-y-3">
              <p className="text-blue-300 font-semibold">
                {message.content.message || "🪙 Available tokens:"}
              </p>
              {message.content.tokens && (
                <table className="border-collapse border border-slate-700 text-sm w-full">
                  <thead>
                    <tr className="bg-slate-800">
                      <th className="border border-slate-700 px-3 py-2 text-left">#</th>
                      <th className="border border-slate-700 px-3 py-2 text-left">Token</th>
                      <th className="border border-slate-700 px-3 py-2 text-left">Symbol</th>
                      <th className="border border-slate-700 px-3 py-2 text-left">Contract Address</th>
                      <th className="border border-slate-700 px-3 py-2 text-left">Chain</th>
                      <th className="border border-slate-700 px-3 py-2 text-left">Verified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {message.content.tokens?.map((t: any, idx: number) => (
                      <tr key={`${t.id}-${idx}`} className="hover:bg-slate-800/50">
                        <td className="border border-slate-700 px-3 py-2">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-700 px-3 py-2">
                          {t.logoURI ? (
                            <img
                              src={t.logoURI}
                              alt={t.name}
                              className="inline w-4 h-4 mr-2"
                            />
                          ) : (
                            <span className="inline-block w-4 h-4 mr-2 bg-slate-600 rounded-full"></span>
                          )}
                          {t.name}
                        </td>
                        <td className="border border-slate-700 px-3 py-2 font-mono">
                          {t.symbol}
                        </td>
                        <td className="border border-slate-700 px-3 py-2 font-mono text-xs">
                          {t.address ? (
                            <span
                              className="text-slate-300 cursor-pointer hover:text-blue-400 hover:bg-slate-800/50 rounded px-1 transition-colors"
                              title={`${t.address} (click to copy)`}
                              onClick={() => {
                                if (t.address && t.address !== "0x0000000000000000000000000000000000000000") {
                                  navigator.clipboard.writeText(t.address);
                                }
                              }}
                            >
                              {t.address === "0x0000000000000000000000000000000000000000"
                                ? "Native Token"
                                : `${t.address.slice(0, 6)}...${t.address.slice(-4)}`}
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </td>
                        <td className="border border-slate-700 px-3 py-2">
                          {CHAIN_ID_TO_NAME[t.chainId] || `Chain ${t.chainId}`}
                        </td>
                        <td className="border border-slate-700 px-3 py-2">
                          {t.verified ? (
                            <span className="text-green-400">✓</span>
                          ) : (
                            <span className="text-yellow-400">?</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : message.content?.type === "explorer-link" ? (
            <div className="bg-slate-800/30 rounded-lg p-3 border-l-4 border-green-500">
              <p className="text-green-400 font-semibold mb-2">🔗 Transaction Link</p>
              <a
                href={message.content.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline break-all"
              >
                {message.content.text || message.content.url}
              </a>
              {message.content.explorerName && (
                <p className="text-slate-400 text-sm mt-1">
                  View on {message.content.explorerName}
                </p>
              )}
            </div>
          ) : (
            <p className="text-slate-300 ml-4">
              {JSON.stringify(message.content)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default HSMChatHistory;