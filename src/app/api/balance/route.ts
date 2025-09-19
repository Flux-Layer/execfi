import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

// Map chain IDs to RPC URLs
const RPC_URLS: Record<number, string> = {
  8453: `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  1: `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  42161: `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  137: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
};

// Map chain IDs to viem chain configs
const CHAIN_CONFIGS: Record<number, any> = {
  8453: base,
  // Add other chains as needed
};

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

    // Get RPC URL for the chain
    const rpcUrl = RPC_URLS[chainId];
    if (!rpcUrl) {
      return NextResponse.json(
        { error: `Unsupported chain ID: ${chainId}` },
        { status: 400 }
      );
    }

    // Get chain config (fallback to base for now)
    const chain = CHAIN_CONFIGS[chainId] || base;

    // Create public client
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
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