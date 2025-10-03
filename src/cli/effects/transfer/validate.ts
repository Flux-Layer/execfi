// cli/effects/transfer/validate.ts - Transfer-specific validation effect

import type { StepDef } from "../../state/types";
import { validateTransfer } from "@/lib/transfer/validation";
import { checkPolicy } from "@/lib/policy/checker";
import type { NormalizedTransfer } from "@/lib/transfer/types";

export const transferValidateFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  console.log("🔍 [Transfer Effect] Starting validation");

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

  // Validate this is a transfer operation
  if (ctx.norm.kind !== "native-transfer" && ctx.norm.kind !== "erc20-transfer") {
    dispatch({
      type: "VALIDATE.FAIL",
      error: {
        code: "INVALID_OPERATION",
        message: `Expected transfer operation, got ${ctx.norm.kind}`,
        phase: "validate",
      },
    });
    return;
  }

  // Determine the correct address based on account mode
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
    console.log("🔍 [Transfer Effect] Validating transfer:", ctx.norm, "using", accountMode, "mode with address:", fromAddress);

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

    // Step 3: Transfer-specific validation (isolated)
    const { gasEstimate, gasCost } = await validateTransfer(
      ctx.norm as NormalizedTransfer,
      fromAddress,
      core.policy.config
    );

    if (signal.aborted) return;

    console.log("✅ [Transfer Effect] Validation passed", { gasEstimate, gasCost, accountMode });
    dispatch({ type: "VALIDATE.OK" });
  } catch (error: any) {
    if (signal.aborted) return;

    console.error("[Transfer Effect] Validation error:", error);

    dispatch({
      type: "VALIDATE.FAIL",
      error: {
        code: error.code || "VALIDATION_ERROR",
        message: error.message || "Transfer validation failed",
        detail: error,
        phase: "validate",
      },
    });
  }
};
