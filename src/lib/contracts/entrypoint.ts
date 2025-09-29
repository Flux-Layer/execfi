// FeeEntryPoint contract ABI and address mapping
// Deployed deterministically via CREATE2. Add more chain IDs as you deploy.

export const FEE_ENTRYPOINT_ADDRESSES: Record<number, `0x${string}`> = {
  // Lisk Mainnet (chainId 1135)
  1135: "0xCBBB3C78DA7129FfC4DD904d59C33F7C273738ED",
};

export const FEE_ENTRYPOINT_ABI = [
  {
    type: "function",
    name: "transferETH",
    stateMutability: "payable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "transferERC20",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

