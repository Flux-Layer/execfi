// Validation effects using existing orchestrator logic
import type { StepDef } from "../state/types";
import { validateIntent } from "@/lib/validation";
import { checkPolicy } from "@/lib/policy/checker";
import { transferValidateFx } from "./transfer/validate";
import { getActiveWalletAddress, getActiveWallet } from "../utils/getActiveWallet";

export const validateFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  // Route transfers to isolated transfer effect
  if (ctx.norm?.kind === "native-transfer" || ctx.norm?.kind === "erc20-transfer") {
    console.log("🔀 [Main Effect] Routing to isolated transfer validation");
    if (transferValidateFx) {
      return await transferValidateFx(ctx, core, dispatch, signal);
    }
  }
  if (!ctx.norm) {
    dispatch({
      type: "VALIDATE.FAIL",
      error: {
        code: "MISSING_NORM",
        message: "No normalized data to validate",
        phase: "validate",
      },
    });
    return;
  }

  // Determine the correct address to use for validation based on active wallet mode
  const accountMode = core.accountMode || "EOA";
  const activeWallet = getActiveWallet(core);
  const fromAddress = activeWallet.address;

  if (!fromAddress) {
    dispatch({
      type: "VALIDATE.FAIL",
      error: {
        code: "AUTH_REQUIRED",
        message: `${activeWallet.label} not available. Please connect your wallet.`,
        phase: "validate",
      },
    });
    return;
  }

  try {
    console.log("🔄 Validating transaction:", ctx.norm, "using", accountMode, "mode with address:", fromAddress);

    // Step 1: Policy check
    const policyCheck = await checkPolicy(ctx.norm, core.policy, fromAddress);

    if (!policyCheck.allowed) {
      const blockingViolations = policyCheck.violations.filter(v => v.severity === "block");
      const errorMessage = blockingViolations.map(v => v.message).join("\n");
      const suggestions = blockingViolations.map(v => v.suggestion).filter(Boolean).join("\n");

      dispatch({
        type: "VALIDATE.FAIL",
        error: {
          code: "POLICY_VIOLATION",
          message: `Policy violations:\n${errorMessage}\n\nSuggestions:\n${suggestions}`,
          detail: policyCheck.violations,
          phase: "validate",
        },
      });
      return;
    }

    // Step 2: Show warnings for non-blocking violations
    const warnings = policyCheck.violations.filter(v => v.severity === "warn");
    if (warnings.length > 0) {
      warnings.forEach(warning => {
        dispatch({
          type: "OVERLAY.PUSH",
          overlay: {
            kind: "toast",
            level: "warn",
            text: warning.message,
            ttlMs: 5000,
          },
        });
      });
    }

    // Step 3: Standard validation (balance, gas, etc.)
    const { gasEstimate, gasCost } = await validateIntent(ctx.norm, fromAddress, core.policy.config);

    if (signal.aborted) return;

    console.log("✅ Validation passed", { gasEstimate, gasCost, accountMode });
    dispatch({ type: "VALIDATE.OK" });
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("Validation error:", error);

    dispatch({
      type: "VALIDATE.FAIL",
      error: {
        code: error.code || "VALIDATION_ERROR",
        message: error.message || "Transaction validation failed",
        detail: error,
        phase: "validate",
      },
    });
  }
};