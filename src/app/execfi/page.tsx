import React from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Docs",
  description:
    "Learn how ExecFi turns natural language intents into secure onchain execution with Privy smart accounts.",
  path: "/execfi",
  keywords: [
    "ExecFi documentation",
    "ExecFi notes",
    "onchain automation overview",
    "Privy smart accounts",
  ],
});

export default function ExecFiDocsPage() {
  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-3xl px-6 py-10 font-mono">
        <h1 className="text-xl font-semibold text-slate-100">execFi.md</h1>
        <p className="text-slate-400 text-xs mt-1">Notes and overview</p>

        <section className="mt-6 space-y-4">
          <p>
            ExecFi turns natural language into safe, verifiable on‑chain actions
            via Privy Smart Accounts (ERC‑4337) and a structured intent
            pipeline.
          </p>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-100 mb-2">
              How it works
            </h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
              <li>
                Intent parse → normalize → validate → simulate → execute →
                monitor
              </li>
              <li>
                Smart‑accounts‑only (non‑custodial), JSON contracts over prose
              </li>
              <li>Idempotency guard to prevent duplicate sends</li>
              <li>Explorer link and concise UX copy after execution</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-100 mb-2">
              What you can try now
            </h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
              <li>Native ETH transfers on Base / Base Sepolia</li>
              <li>Smart Account execution via Privy</li>
              <li>AI‑assisted prompts with clarification if needed</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-100 mb-2">
              Coming next
            </h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
              <li>ERC‑20 transfers, approvals/permits</li>
              <li>Swap/bridge via LI.FI with route policies</li>
              <li>Session keys, daily caps, journaling persistence</li>
            </ul>
          </div>

          <p className="text-xs text-slate-400">
            Tip: Open the Terminal from the Dock to run prompts like
            <span className="ml-1 text-slate-300">
              &quot;send 0.01 ETH on base to 0x...&quot;
            </span>
          </p>
        </section>
      </div>
    </main>
  );
}
