// lib/aa/zero-dev.ts
"use client";

import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { providerToSmartAccountSigner /* or toOwner */ } from "permissionless";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { createKernelAccount, createKernelAccountClient } from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";

const entryPoint = getEntryPoint("0.7");
const kernelVersion = KERNEL_V3_1;

export function generatePublicClient(rpc?: string) {
  // Prefer explicit RPC (e.g. your bundler RPC can often act as a public RPC),
  // fall back to viem's default for the chain.
  return createPublicClient({
    transport: http(rpc ?? undefined),
    chain: baseSepolia,
  });
}

export async function generateSignerFromEIP1193Provider(provider: any) {
  // providerToSmartAccountSigner is async
  return providerToSmartAccountSigner(provider);
  // or: return await toOwner({ owner: provider });
}

export async function generateECDSAValidatorFromSigner(
  signer: any,
  publicClient: any,
) {
  return signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint,
    kernelVersion,
  });
}

export async function generateKernelAccount(
  publicClient: any,
  ecdsaValidator: any,
  index = 0,
) {
  return createKernelAccount(publicClient, {
    plugins: { sudo: ecdsaValidator },
    entryPoint,
    kernelVersion,
    index: BigInt(index), // optional multiple accounts per owner
  });
}

type GenKernelClientArgs = {
  account: any;
  client: any;
  bundlerRpc?: string; // required
  paymasterRpc?: string; // optional
};

export function generateKernelAccountClient({
  account,
  client,
  bundlerRpc,
  paymasterRpc,
}: GenKernelClientArgs) {
  if (!bundlerRpc)
    throw new Error("bundlerRpc is required (NEXT_PUBLIC_BUNDLER_RPC)");
  return createKernelAccountClient({
    account,
    chain: baseSepolia,
    client,
    bundlerTransport: http(bundlerRpc),
    ...(paymasterRpc ? { paymaster: { rpcUrl: paymasterRpc as any } as any } : {}),
  });
}
