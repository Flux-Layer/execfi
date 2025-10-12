// Slippage configuration command
import type { CommandDef } from "./types";
import { parseFlags } from "./parser";
import { 
  slippageToDecimal, 
  decimalToSlippage, 
  formatSlippage,
  normalizeSlippage,
  getSlippageWarningMessage 
} from "@/lib/utils/slippage";

/**
 * /slippage command - View or set global default slippage tolerance
 */
export const slippageCmd: CommandDef = {
  name: "/slippage",
  aliases: ["/slip"],
  category: "utility",
  summary: "View or set global default slippage tolerance",
  usage: "/slippage [value] [options]",
  flags: [
    {
      name: "reset",
      alias: "r",
      description: "Reset to default slippage (0.5%)",
      type: "boolean",
      default: false,
    },
  ],
  examples: [
    "/slippage              # View current slippage",
    "/slippage 1.0          # Set slippage to 1%",
    "/slippage 0.1          # Set slippage to 0.1%",
    "/slippage --reset      # Reset to default (0.5%)",
  ],

  parse: (line) => {
    const flags = parseFlags(line);
    const [value] = flags._;
    const { reset } = flags;

    return { ok: true, args: { value, reset } };
  },

  run: async ({ value, reset }, ctx, dispatch) => {
    const STORAGE_KEY = "execfi_slippage_default";
    const DEFAULT_SLIPPAGE = 0.005; // 0.5%

    try {
      // Reset to default
      if (reset) {
        localStorage.setItem(STORAGE_KEY, DEFAULT_SLIPPAGE.toString());
        
        // Update core context
        dispatch({
          type: "APP.INIT",
          coreContext: {
            ...ctx,
            defaultSlippage: DEFAULT_SLIPPAGE,
          },
        });

        dispatch({
          type: "CHAT.ADD",
          message: {
            role: "assistant",
            content: `✅ Slippage reset to default: ${formatSlippage(DEFAULT_SLIPPAGE)}`,
            timestamp: Date.now(),
          },
        });
        return;
      }

      // View current slippage
      if (!value) {
        const currentSlippage = ctx.defaultSlippage ?? DEFAULT_SLIPPAGE;
        const warning = getSlippageWarningMessage(currentSlippage);
        
        let message = `📊 Current default slippage: ${formatSlippage(currentSlippage)}\n`;
        message += `   (${(currentSlippage * 100).toFixed(4)}% decimal)\n\n`;
        message += `Valid range: 0.01% - 99%\n`;
        message += `Default: 0.5%\n\n`;
        
        if (warning) {
          message += `⚠️  ${warning}\n\n`;
        }
        
        message += `💡 Usage:\n`;
        message += `   /slippage 1.0      # Set to 1%\n`;
        message += `   /slippage --reset  # Reset to default`;

        dispatch({
          type: "CHAT.ADD",
          message: {
            role: "assistant",
            content: message,
            timestamp: Date.now(),
          },
        });
        return;
      }

      // Set new slippage
      const numValue = parseFloat(value);
      
      if (isNaN(numValue)) {
        dispatch({
          type: "CHAT.ADD",
          message: {
            role: "assistant",
            content: `❌ Invalid slippage value: "${value}"\n\nPlease provide a number between 0.01 and 99.\n\nExample: /slippage 1.0`,
            timestamp: Date.now(),
          },
        });
        return;
      }

      // Convert percentage to decimal and normalize
      const decimal = normalizeSlippage(numValue, true);
      const actualPercent = decimalToSlippage(decimal);

      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, decimal.toString());

      // Update core context
      dispatch({
        type: "APP.INIT",
        coreContext: {
          ...ctx,
          defaultSlippage: decimal,
        },
      });

      // Prepare success message
      let message = `✅ Default slippage set to ${formatSlippage(decimal)}`;
      
      // Show if value was clamped
      if (Math.abs(actualPercent - numValue) > 0.001) {
        message += `\n   (clamped from ${numValue.toFixed(2)}% to valid range)`;
      }

      // Add warning if applicable
      const warning = getSlippageWarningMessage(decimal);
      if (warning) {
        message += `\n\n${warning}`;
      }

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: message,
          timestamp: Date.now(),
        },
      });

    } catch (error) {
      console.error("Slippage command error:", error);
      
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Failed to update slippage: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};
