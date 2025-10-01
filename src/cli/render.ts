// Render utilities for terminal state - headless-friendly
import type { AppState, FlowStep, Overlay } from "./state/types";

/**
 * Main render function - converts state to display lines
 */
export function render(state: AppState): string[] {
  const lines: string[] = [];

  // Header with current mode and status
  lines.push(renderHeader(state));

  // Main content based on mode
  switch (state.mode) {
    case "IDLE":
      lines.push("Type a prompt or /help for assistance...");
      break;

    case "FLOW":
      if (state.flow) {
        lines.push(...renderFlow(state.flow));
      }
      break;

    case "VIEW":
      const currentView = state.viewStack.at(-1);
      if (currentView) {
        lines.push(...renderView(currentView));
      }
      break;

    case "GUIDE":
      lines.push("📖 Interactive guide - Coming soon!");
      break;
  }

  // Overlays
  state.overlays.forEach((overlay) => {
    lines.push(...renderOverlay(overlay));
  });

  return lines;
}

function renderHeader(state: AppState): string {
  const mode = state.mode.toLowerCase();
  const chainName = getChainName(state.core.chainId);

  if (state.flow) {
    const step = state.flow.step;
    const progress = getStepProgress(step);
    return `[${mode}:${step}] ${progress} | ${chainName}`;
  }

  return `[${mode}] ${chainName}`;
}

function renderFlow(flow: NonNullable<AppState["flow"]>): string[] {
  const lines: string[] = [];

  // Flow type and current step
  lines.push(`🔄 ${flow.name} flow - ${getStepDescription(flow.step)}`);

  // Show error if any
  if (flow.error) {
    lines.push(`❌ ${flow.error.message}`);
  }

  // Show progress based on step
  switch (flow.step) {
    case "parse":
      lines.push("Analyzing your request...");
      break;

    case "clarify":
      lines.push("⏳ Waiting for clarification...");
      break;

    case "normalize":
      lines.push("🔧 Processing transaction details...");
      break;

    case "validate":
      lines.push("✅ Validating transaction...");
      break;

    case "plan":
      lines.push("📋 Planning execution...");
      break;

    case "simulate":
      lines.push("🧪 Simulating transaction...");
      break;

    case "confirm":
      lines.push("⏳ Awaiting confirmation...");
      if (flow.norm) {
        if (flow.norm.kind === "native-transfer" || flow.norm.kind === "erc20-transfer") {
          lines.push(`Amount: ${formatAmount(flow.norm.amountWei)} ETH`);
          lines.push(`To: ${flow.norm.to}`);
        } else if (flow.norm.kind === "swap") {
          lines.push(`Swap: ${flow.norm.fromToken.symbol} → ${flow.norm.toToken.symbol}`);
          lines.push(`Chain: ${flow.norm.fromChainId}`);
        } else if (flow.norm.kind === "bridge") {
          lines.push(`Bridge: ${flow.norm.token.symbol}`);
          lines.push(`${flow.norm.fromChainId} → ${flow.norm.toChainId}`);
        } else if (flow.norm.kind === "bridge-swap") {
          lines.push(`Bridge-Swap: ${flow.norm.fromToken.symbol} → ${flow.norm.toToken.symbol}`);
          lines.push(`${flow.norm.fromChainId} → ${flow.norm.toChainId}`);
        }
      }
      break;

    case "execute":
      lines.push("⚡ Executing transaction...");
      break;

    case "monitor":
      lines.push("👀 Monitoring confirmation...");
      if (flow.exec?.hash) {
        lines.push(`Hash: ${flow.exec.hash}`);
      }
      break;

    case "success":
      lines.push("🎉 Transaction successful!");
      if (flow.exec?.hash) {
        lines.push(`Hash: ${flow.exec.hash}`);
      }
      break;

    case "failure":
      lines.push("💥 Transaction failed");
      if (flow.error) {
        lines.push(`Error: ${flow.error.message}`);
      }
      break;
  }

  return lines;
}

function renderView(page: AppState["viewStack"][0]): string[] {
  const lines: string[] = [];

  switch (page.kind) {
    case "balances":
      lines.push("💰 Account Balances");
      lines.push("Coming soon...");
      break;

    case "tx-detail":
      lines.push(`🔍 Transaction: ${page.txHash}`);
      lines.push("Coming soon...");
      break;

    case "logs":
      lines.push("📜 Transaction Logs");
      lines.push("Coming soon...");
      break;

    case "settings":
      lines.push("⚙️ Settings & Commands");
      lines.push("");
      lines.push("📋 Navigation:");
      lines.push("/exit or /close - Exit current view");
      lines.push("/home or /main - Return to main terminal");
      lines.push("/back - Go back one level");
      lines.push("");
      lines.push("🔍 Information:");
      lines.push("/balances - View account balances");
      lines.push("/tx <hash> - View transaction details");
      lines.push("");
      lines.push("⚡ Flow Control:");
      lines.push("/cancel - Cancel current transaction");
      lines.push("/retry - Retry failed transaction");
      lines.push("");
      lines.push("🔧 Settings:");
      lines.push("/chain <name> - Switch blockchain");
      lines.push("");
      lines.push("💡 Tip: Type any transaction command to start a flow!");
      break;
  }

  return lines;
}

function renderOverlay(overlay: Overlay): string[] {
  const lines: string[] = [];

  switch (overlay.kind) {
    case "confirm":
      lines.push(`❓ ${overlay.message}`);
      lines.push("(Press Enter for Yes, Esc for No)");
      break;

    case "toast":
      const emoji = overlay.level === "error" ? "❌" : overlay.level === "warn" ? "⚠️" : "ℹ️";
      lines.push(`${emoji} ${overlay.text}`);
      break;
  }

  return lines;
}

// Helper functions

function getChainName(chainId: number): string {
  switch (chainId) {
    case 1:
      return "Ethereum";
    case 8453:
      return "Base";
    case 84532:
      return "Base Sepolia";
    case 137:
      return "Polygon";
    case 42161:
      return "Arbitrum";
    case 10:
      return "Optimism";
    case 43114:
      return "Avalanche";
    default:
      return `Chain ${chainId}`;
  }
}

function getStepDescription(step: FlowStep): string {
  switch (step) {
    case "parse":
      return "Parsing";
    case "clarify":
      return "Clarifying";
    case "normalize":
      return "Normalizing";
    case "validate":
      return "Validating";
    case "plan":
      return "Planning";
    case "simulate":
      return "Simulating";
    case "confirm":
      return "Confirming";
    case "execute":
      return "Executing";
    case "monitor":
      return "Monitoring";
    case "success":
      return "Success";
    case "failure":
      return "Failed";
    default:
      return step;
  }
}

function getStepProgress(step: FlowStep): string {
  const steps: FlowStep[] = [
    "parse",
    "normalize",
    "validate",
    "plan",
    "simulate",
    "confirm",
    "execute",
    "monitor",
  ];

  const currentIndex = steps.indexOf(step);
  if (currentIndex === -1) return "";

  const total = steps.length;
  const percent = Math.round(((currentIndex + 1) / total) * 100);

  return `${percent}%`;
}

function formatAmount(amountWei: bigint): string {
  // Simple formatting - could be enhanced
  const eth = Number(amountWei) / 1e18;
  return eth.toFixed(6);
}