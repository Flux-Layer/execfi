"use client";

import React from "react";
import type { ViewPage, CoreContext } from "@/cli/state/types";
import { HelpView } from "@/cli/commands/views/help";
import { AccountInfoView } from "@/cli/commands/views/accountinfo";

interface HSMViewRendererProps {
  viewStack: ViewPage[];
  core: CoreContext;
}

export default function HSMViewRenderer({ viewStack, core }: HSMViewRendererProps) {
  if (viewStack.length === 0) return null;

  const currentView = viewStack[viewStack.length - 1];

  return (
    <div className="mb-4">
      <ViewContent view={currentView} core={core} />
    </div>
  );
}

interface ViewContentProps {
  view: ViewPage;
  core: CoreContext;
}

function ViewContent({ view, core }: ViewContentProps) {
  switch (view.kind) {
    case "help":
      return <HelpView filter={view.filter} />;

    case "help-detail":
      return <HelpView filter={view.command} />;

    case "accountinfo":
      return <AccountInfoView core={core} />;

    case "balances":
      return (
        <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
          <h2 className="text-lg font-bold mb-4">💰 Token Balances</h2>
          <p className="text-gray-600">Multi-token balance view - Coming in Phase 2</p>
        </div>
      );

    case "chains":
      return (
        <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
          <h2 className="text-lg font-bold mb-4">🌐 Supported Chains</h2>
          <p className="text-gray-600">Chain management view - Coming in Phase 2</p>
        </div>
      );

    case "tx-detail":
      return (
        <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
          <h2 className="text-lg font-bold mb-4">📋 Transaction Details</h2>
          <p className="text-gray-600">Transaction: {view.txHash}</p>
          <p className="text-gray-600 text-xs mt-2">Transaction detail view - Coming in Phase 2</p>
        </div>
      );

    case "settings":
      return (
        <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
          <h2 className="text-lg font-bold mb-4">⚙️ Settings</h2>
          <p className="text-gray-600">Settings view placeholder</p>
        </div>
      );

    case "logs":
      return (
        <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
          <h2 className="text-lg font-bold mb-4">📄 System Logs</h2>
          <p className="text-gray-600">Debug logs view - Coming in Phase 3</p>
        </div>
      );

    default:
      return (
        <div className="p-4 bg-red-50 rounded-lg font-mono text-sm">
          <h2 className="text-lg font-bold mb-2 text-red-700">❌ Unknown View</h2>
          <p className="text-red-600">
            View type &quot;{(view as any).kind}&quot; is not implemented.
          </p>
        </div>
      );
  }
}