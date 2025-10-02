import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { getChainConfig, isChainSupported } from "@/lib/chains/registry";

export async function POST(request: NextRequest) {
  try {
    const { address, chainId } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    if (!chainId) {
      return NextResponse.json(
        { error: "Chain ID is required" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    // Validate chain is supported
    if (!isChainSupported(chainId)) {
      return NextResponse.json(
        { error: `Unsupported chain ID: ${chainId}. Use '/chain list' to see supported chains.` },
        { status: 400 }
      );
    }

    // Get chain configuration
    const chainConfig = getChainConfig(chainId)!;

    // Create public client with chain config from registry
    const publicClient = createPublicClient({
      chain: chainConfig.wagmiChain,
      transport: http(chainConfig.rpcUrl),
    });

    // Fetch ETH balance
    const balance = await publicClient.getBalance({
      address: address as `0x${string}`,
    });

    return NextResponse.json({
      address,
      chainId,
      balance: balance.toString(),
      formatted: (Number(balance) / 1e18).toFixed(6)
    });

  } catch (error: any) {
    console.error("Balance API error:", error);

    return NextResponse.json(
      {
        error: error.message || "Failed to fetch balance",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}