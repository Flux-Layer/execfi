import { NextResponse } from "next/server";
import { lifiService } from "@/services/lifiService";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const fromChain = Number(searchParams.get("fromChain"));
    const toChain = Number(searchParams.get("toChain"));
    const fromToken = searchParams.get("fromToken");
    const toToken = searchParams.get("toToken");
    const fromAmount = searchParams.get("fromAmount");
    const fromAddress = searchParams.get("fromAddress");
    const toAddress = searchParams.get("toAddress") ?? undefined;
    const order = (searchParams.get("order") as "FASTEST" | "CHEAPEST") ?? "CHEAPEST";
    // const slippage =     0;

    if (!fromChain || !toChain || !fromToken || !toToken || !fromAmount || !fromAddress) {
      return NextResponse.json(
        { error: "Missing required query parameters" },
        { status: 400 }
      );
    }

    const quote = await lifiService({
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount,
      fromAddress,
      toAddress,
      order,
      // slippage,
    });

    return NextResponse.json(quote);
  } catch (err: any) {
    console.error("Swap API error:", err);

    let errorMessage = "Failed to get swap quote";
    if (err?.message) {
      errorMessage = `Swap service error: ${err.message}`;
    } else if (typeof err === 'string') {
      errorMessage = `Swap service error: ${err}`;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        code: err?.code || "SWAP_ERROR",
        details: err?.details || null
      },
      { status: 500 }
    );
  }
}
