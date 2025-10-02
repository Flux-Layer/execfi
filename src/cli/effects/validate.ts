// Validation effects using existing orchestrator logic
import type { StepDef } from "../state/types";
import { validateIntent } from "@/lib/validation";
import { checkPolicy } from "@/lib/policy/checker";

export const validateFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
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

  // Determine the correct address to use for validation based on account mode
  const accountMode = core.accountMode || "EOA";
  let fromAddress: `0x${string}` | undefined;

  if (accountMode === "SMART_ACCOUNT") {
    if (!core.saAddress) {
      dispatch({
        type: "VALIDATE.FAIL",
        error: {
          code: "AUTH_REQUIRED",
          message: "Smart Account address not available. Please ensure you're logged in and have a Smart Wallet.",
          phase: "validate",
        },
      });
      return;
    }
    fromAddress = core.saAddress;
  } else {
    // EOA mode
    if (!core.selectedWallet?.address) {
      dispatch({
        type: "VALIDATE.FAIL",
        error: {
          code: "AUTH_REQUIRED",
          message: "Please sign in to execute transactions. Click the sign in button in the top right corner.",
          phase: "validate",
        },
      });
      return;
    }
    fromAddress = core.selectedWallet.address as `0x${string}`;
  }

  try {
    console.log("🔄 Validating transaction:", ctx.norm, "using", accountMode, "mode with address:", fromAddress);

    // Step 1: Policy check
    const policyCheck = checkPolicy(ctx.norm, core.policy, fromAddress);

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