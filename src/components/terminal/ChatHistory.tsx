import { ChatMessage } from "./types";

const ChatHistory = ({ chat }: { chat: ChatMessage[] }) => {
  return (
    <div className="mt-4">
      {chat.map((c, i) => (
        <div key={i} className="mb-4">
          {c.role === "assistant" ? "🤖 " : "🧑 "}
          {typeof c.content === "string" ? (
            <p
              className={
                c.role === "assistant"
                  ? "text-emerald-300"
                  : "text-cyan-300"
              }
            >
              {c.content}
            </p>
          ) : c.content?.type === "token-table" ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-700 text-sm">
                <thead className="bg-slate-800 text-slate-200">
                  <tr>
                    <th>No</th>
                    <th>Logo</th>
                    <th>Name</th>
                    <th>Symbol</th>
                    <th>Chain</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {c.content.tokens.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/50">
                      <td>{t.id}</td>
                      <td>
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
                      <td>{t.name}</td>
                      <td>
                        {t.symbol}
                        {t.verified && (
                          <span className="ml-1 text-emerald-400">✔</span>
                        )}
                      </td>
                      <td>{t.chainId}</td>
                      <td className="font-mono text-xs break-all">{t.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default ChatHistory;
