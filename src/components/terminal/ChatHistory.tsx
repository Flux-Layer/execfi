import { ChatMessage } from "./types";
import { NETWORK_TO_CHAIN_ID } from "@/constants/chainIds";

const CHAIN_ID_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(NETWORK_TO_CHAIN_ID).map(([name, id]) => [id, name])
);

const ChatHistory = ({ chat }: { chat: ChatMessage[] }) => {
  return (
    <div className="mt-4">
      {chat.map((c, i) => (
        <div key={i} className="mb-4">
          {c.role === "assistant" ? "🤖 " : "🧑 "}
          {typeof c.content === "string" ? (
            <p
              className={
                c.role === "assistant" ? "text-emerald-300" : "text-cyan-300"
              }
            >
              {c.content}
            </p>
          ) : c.content?.type === "intent-summary" ? (
            <div className="space-y-1">
              <p className="text-emerald-300 font-semibold">Parsed Intent:</p>
              <div className="bg-slate-800/50 rounded p-3 space-y-1 text-sm">
                <p><span className="text-cyan-400">Action:</span> {c.content.action}</p>
                <p><span className="text-cyan-400">Chain:</span> {c.content.chain}</p>
                <p><span className="text-cyan-400">Token:</span> {c.content.token}</p>
                <p><span className="text-cyan-400">Amount:</span> {c.content.amount}</p>
                <p><span className="text-cyan-400">Recipient:</span> {c.content.recipient}</p>
              </div>
            </div>
          ) : c.content?.type === "clarification" ? (
            <div className="space-y-2">
              <p className="text-yellow-300 font-semibold">❓ {c.content.question}</p>
              {c.content.missing.length > 0 && (
                <p className="text-orange-300 text-sm">
                  Missing: {c.content.missing.join(", ")}
                </p>
              )}
            </div>
          ) : c.content?.type === "token-table" ? (
            <div className="overflow-x-auto space-y-2">
              {c.content.message && (
                <p className="text-yellow-300 font-semibold">
                  {c.content.message}
                </p>
              )}
              <table className="w-full border-collapse border border-slate-700 text-sm">
                <thead className="bg-slate-800 text-slate-200">
                  <tr>
                    <th className="border border-slate-700 px-3 py-2">No</th>
                    <th className="border border-slate-700 px-3 py-2">Logo</th>
                    <th className="border border-slate-700 px-3 py-2">Name</th>
                    <th className="border border-slate-700 px-3 py-2">
                      Symbol
                    </th>
                    <th className="border border-slate-700 px-3 py-2">
                      Network
                    </th>
                    <th className="border border-slate-700 px-3 py-2">
                      Address
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.content.tokens.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/50">
                      <td className="border border-slate-700 px-3 py-2">
                        {t.id}
                      </td>
                      <td className="border border-slate-700 px-3 py-2">
                        {t.logoURI ? (
                          <img
                            src={t.logoURI}
                            alt={t.symbol}
                            className="w-6 h-6 mx-auto rounded-full"
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="border border-slate-700 px-3 py-2">
                        {t.name}
                      </td>
                      <td className="border border-slate-700 px-3 py-2">
                        {t.symbol}
                        {t.verified && (
                          <span className="ml-1 text-emerald-400">✔</span>
                        )}
                      </td>
                      <td className="border border-slate-700 px-3 py-2">
                        {CHAIN_ID_TO_NAME[t.chainId] || `Chain ${t.chainId}`}
                      </td>
                      <td className="border border-slate-700 px-3 py-2 font-mono text-[0.6rem] break-all">
                        {t.address}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : c.content?.type === "explorer-link" ? (
            <div className="space-y-2">
              <a
                href={c.content.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 underline transition-colors"
              >
                🔗 {c.content.text}
              </a>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default ChatHistory;
