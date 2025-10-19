import { useCallback } from "react";
import {
  type Address,
  type Hex,
  zeroAddress,
  createWalletClient,
  custom,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import type { ConnectedWallet } from "@privy-io/react-auth";

import {
  FARMING_CHAIN_ID,
  FARMING_CORE_ADDRESS,
  SHOP_ADDRESS,
  MARKETPLACE_ADDRESS,
  ITEM1155_ADDRESS,
  LAND721_ADDRESS,
} from "@/lib/contracts/addresses";

const SHOP_ABI = [
  {
    type: "function",
    name: "buyTool",
    stateMutability: "payable",
    inputs: [
      { name: "toolRarity", type: "uint256" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "buySeed",
    stateMutability: "payable",
    inputs: [
      { name: "seedType", type: "uint256" },
      { name: "quantity", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "buyWater",
    stateMutability: "payable",
    inputs: [{ name: "quantity", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "buyLand",
    stateMutability: "payable",
    inputs: [{ name: "quantity", type: "uint256" }],
    outputs: [{ name: "tokenIds", type: "uint256[]" }],
  },
] as const;

const FARMING_CORE_ABI = [
  {
    type: "function",
    name: "setActiveTool",
    stateMutability: "nonpayable",
    inputs: [{ name: "toolTokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "dig",
    stateMutability: "nonpayable",
    inputs: [{ name: "landId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "plant",
    stateMutability: "nonpayable",
    inputs: [
      { name: "landId", type: "uint256" },
      { name: "seedTypes", type: "uint32[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "water",
    stateMutability: "nonpayable",
    inputs: [{ name: "landId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "harvestAndClaimXP",
    stateMutability: "nonpayable",
    inputs: [
      { name: "landIds", type: "uint256[]" },
      { name: "expAmount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const ITEM1155_ABI = [
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;

const LAND721_ABI = [
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;

const MARKETPLACE_ABI = [
  {
    type: "function",
    name: "list1155",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "amount", type: "uint64" },
      { name: "pricePerUnit", type: "uint128" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "function",
    name: "list721",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint128" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "function",
    name: "buy1155",
    stateMutability: "payable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "quantity", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "buy721",
    stateMutability: "payable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelListing",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      {
        components: [
          { name: "seller", type: "address" },
          { name: "asset", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "pricePerUnit", type: "uint128" },
          { name: "amount", type: "uint64" },
          { name: "expiry", type: "uint64" },
          { name: "is1155", type: "bool" },
        ],
        type: "tuple",
      },
    ],
  },
] as const;

export type HarvestPayload = {
  landIds: Array<number | bigint>;
  expAmount: bigint;
  deadline: bigint;
  signature: Hex;
};

export type MarketplaceListingInfo = {
  listingId: number;
  seller: `0x${string}`;
  asset: `0x${string}`;
  tokenId: number;
  pricePerUnitWei: bigint;
  amount: bigint;
  expiry: bigint;
  is1155: boolean;
};

type UseGreenvaleActionsOptions = {
  account?: Address | null;
  connectedWallet?: ConnectedWallet | null;
};

const FARMING_CHAIN =
  FARMING_CHAIN_ID === base.id
    ? base
    : FARMING_CHAIN_ID === baseSepolia.id
      ? baseSepolia
      : baseSepolia;

export function useGreenvaleActions(options: UseGreenvaleActionsOptions = {}) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: FARMING_CHAIN_ID });
  const { data: walletClient } = useWalletClient({
    chainId: FARMING_CHAIN_ID,
  });

  const ensureWallet = useCallback(async () => {
    const resolvedAccount = (options.account ?? address) as Address | undefined;
    if (!resolvedAccount) throw new Error("WALLET_NOT_CONNECTED");

    if (walletClient) {
      return { wallet: walletClient, account: resolvedAccount };
    }

    if (options.connectedWallet) {
      const provider = await options.connectedWallet.getEthereumProvider();
      const client = createWalletClient({
        account: resolvedAccount,
        chain: FARMING_CHAIN,
        transport: custom(provider),
      });
      return { wallet: client, account: resolvedAccount };
    }

    throw new Error("WALLET_CLIENT_UNAVAILABLE");
  }, [
    address,
    options.account,
    options.connectedWallet,
    publicClient,
    walletClient,
  ]);

  const writeAndWait = useCallback(
    async ({
      address: contract,
      abi,
      functionName,
      args = [],
      value,
    }: {
      address: Address;
      abi: any;
      functionName: string;
      args?: unknown[];
      value?: bigint;
    }) => {
      if (!contract) throw new Error("CONTRACT_NOT_CONFIGURED");
      if (!publicClient) throw new Error("PUBLIC_CLIENT_UNAVAILABLE");
      const { wallet, account } = await ensureWallet();
      const hash = await wallet.writeContract({
        address: contract,
        abi,
        functionName,
        args,
        account,
        value,
        chain: wallet.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    },
    [ensureWallet, publicClient],
  );

  const buyTool = useCallback(
    async (rarity: number, quantity: number, priceWei: bigint) => {
      if (!SHOP_ADDRESS) throw new Error("SHOP_NOT_CONFIGURED");
      const qty = BigInt(quantity);
      return writeAndWait({
        address: SHOP_ADDRESS,
        abi: SHOP_ABI,
        functionName: "buyTool",
        args: [BigInt(rarity), qty],
        value: priceWei * qty,
      });
    },
    [writeAndWait],
  );

  const buySeed = useCallback(
    async (seedType: number, quantity: number, priceWei: bigint) => {
      if (!SHOP_ADDRESS) throw new Error("SHOP_NOT_CONFIGURED");
      const qty = BigInt(quantity);
      return writeAndWait({
        address: SHOP_ADDRESS,
        abi: SHOP_ABI,
        functionName: "buySeed",
        args: [BigInt(seedType), qty],
        value: priceWei * qty,
      });
    },
    [writeAndWait],
  );

  const buyWater = useCallback(
    async (quantity: number, priceWei: bigint) => {
      if (!SHOP_ADDRESS) throw new Error("SHOP_NOT_CONFIGURED");
      const qty = BigInt(quantity);
      return writeAndWait({
        address: SHOP_ADDRESS,
        abi: SHOP_ABI,
        functionName: "buyWater",
        args: [qty],
        value: priceWei * qty,
      });
    },
    [writeAndWait],
  );

  const buyLand = useCallback(
    async (quantity: number, priceWei: bigint) => {
      if (!SHOP_ADDRESS) throw new Error("SHOP_NOT_CONFIGURED");
      const qty = BigInt(quantity);
      return writeAndWait({
        address: SHOP_ADDRESS,
        abi: SHOP_ABI,
        functionName: "buyLand",
        args: [qty],
        value: priceWei * qty,
      });
    },
    [writeAndWait],
  );

  const setActiveTool = useCallback(
    async (toolTokenId: number | bigint) => {
      if (!FARMING_CORE_ADDRESS) throw new Error("FARMING_CORE_NOT_CONFIGURED");
      return writeAndWait({
        address: FARMING_CORE_ADDRESS,
        abi: FARMING_CORE_ABI,
        functionName: "setActiveTool",
        args: [BigInt(toolTokenId)],
      });
    },
    [writeAndWait],
  );

  const dig = useCallback(
    async (landId: number | bigint) => {
      if (!FARMING_CORE_ADDRESS) throw new Error("FARMING_CORE_NOT_CONFIGURED");
      return writeAndWait({
        address: FARMING_CORE_ADDRESS,
        abi: FARMING_CORE_ABI,
        functionName: "dig",
        args: [BigInt(landId)],
      });
    },
    [writeAndWait],
  );

  const plant = useCallback(
    async (landId: number | bigint, seedTypes: number[]) => {
      if (!FARMING_CORE_ADDRESS) throw new Error("FARMING_CORE_NOT_CONFIGURED");
      if (seedTypes.length === 0) throw new Error("MISSING_SEEDS");
      return writeAndWait({
        address: FARMING_CORE_ADDRESS,
        abi: FARMING_CORE_ABI,
        functionName: "plant",
        args: [
          BigInt(landId),
          seedTypes.map((seed) => Number(seed)),
        ],
      });
    },
    [writeAndWait],
  );

  const water = useCallback(
    async (landId: number | bigint) => {
      if (!FARMING_CORE_ADDRESS) throw new Error("FARMING_CORE_NOT_CONFIGURED");
      return writeAndWait({
        address: FARMING_CORE_ADDRESS,
        abi: FARMING_CORE_ABI,
        functionName: "water",
        args: [BigInt(landId)],
      });
    },
    [writeAndWait],
  );

  const harvestAndClaimXP = useCallback(
    async ({ landIds, expAmount, deadline, signature }: HarvestPayload) => {
      if (!FARMING_CORE_ADDRESS) throw new Error("FARMING_CORE_NOT_CONFIGURED");
      if (!signature) throw new Error("MISSING_SIGNATURE");

      return writeAndWait({
        address: FARMING_CORE_ADDRESS,
        abi: FARMING_CORE_ABI,
        functionName: "harvestAndClaimXP",
        args: [
          landIds.map((landId) => BigInt(landId)),
          expAmount,
          deadline,
          signature,
        ],
      });
    },
    [writeAndWait],
  );

  const approveMarketplace1155 = useCallback(async () => {
    if (!ITEM1155_ADDRESS || !MARKETPLACE_ADDRESS) {
      throw new Error("MARKETPLACE_NOT_CONFIGURED");
    }
    return writeAndWait({
      address: ITEM1155_ADDRESS,
      abi: ITEM1155_ABI,
      functionName: "setApprovalForAll",
      args: [MARKETPLACE_ADDRESS, true],
    });
  }, [writeAndWait]);

  const approveMarketplaceLand = useCallback(async () => {
    if (!LAND721_ADDRESS || !MARKETPLACE_ADDRESS) {
      throw new Error("MARKETPLACE_NOT_CONFIGURED");
    }
    return writeAndWait({
      address: LAND721_ADDRESS,
      abi: LAND721_ABI,
      functionName: "setApprovalForAll",
      args: [MARKETPLACE_ADDRESS, true],
    });
  }, [writeAndWait]);

  const listMarketplace1155 = useCallback(
    async (
      tokenId: number,
      amount: number,
      priceWei: bigint,
      expiry?: number | bigint,
    ) => {
      if (!MARKETPLACE_ADDRESS) throw new Error("MARKETPLACE_NOT_CONFIGURED");
      const qty = BigInt(amount);
      if (qty <= 0n) throw new Error("INVALID_AMOUNT");
      if (priceWei <= 0n) throw new Error("INVALID_PRICE");
      const expiryValue = expiry ? BigInt(expiry) : 0n;
      return writeAndWait({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "list1155",
        args: [BigInt(tokenId), qty, priceWei, expiryValue],
      });
    },
    [writeAndWait],
  );

  const listMarketplace721 = useCallback(
    async (tokenId: number, priceWei: bigint, expiry?: number | bigint) => {
      if (!MARKETPLACE_ADDRESS) throw new Error("MARKETPLACE_NOT_CONFIGURED");
      if (priceWei <= 0n) throw new Error("INVALID_PRICE");
      const expiryValue = expiry ? BigInt(expiry) : 0n;
      return writeAndWait({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "list721",
        args: [BigInt(tokenId), priceWei, expiryValue],
      });
    },
    [writeAndWait],
  );

  const getMarketplaceListing = useCallback(
    async (listingId: number | bigint): Promise<MarketplaceListingInfo | null> => {
      if (!MARKETPLACE_ADDRESS) throw new Error("MARKETPLACE_NOT_CONFIGURED");
      if (!publicClient) throw new Error("PUBLIC_CLIENT_UNAVAILABLE");

      const result = (await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "getListing",
        args: [BigInt(listingId)],
      })) as {
        seller: `0x${string}`;
        asset: `0x${string}`;
        tokenId: bigint;
        pricePerUnit: bigint;
        amount: bigint;
        expiry: bigint;
        is1155: boolean;
      };

      const {
        seller,
        asset,
        tokenId,
        pricePerUnit,
        amount,
        expiry,
        is1155,
      } = result;

      if (seller === zeroAddress) {
        return null;
      }

      return {
        listingId: Number(listingId),
        seller,
        asset,
        tokenId: Number(tokenId),
        pricePerUnitWei: pricePerUnit,
        amount,
        expiry,
        is1155,
      };
    },
    [publicClient],
  );

  const buyMarketplace1155 = useCallback(
    async (listingId: number | bigint, quantity: number) => {
      if (!MARKETPLACE_ADDRESS) throw new Error("MARKETPLACE_NOT_CONFIGURED");
      const qty = BigInt(quantity);
      if (qty <= 0n) throw new Error("INVALID_AMOUNT");

      const listing = await getMarketplaceListing(listingId);
      if (!listing) throw new Error("LISTING_NOT_FOUND");
      if (!listing.is1155) throw new Error("LISTING_NOT_1155");
      if (qty > listing.amount) throw new Error("QTY_EXCEEDS_AVAILABLE");

      const totalCost = listing.pricePerUnitWei * qty;
      return writeAndWait({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "buy1155",
        args: [BigInt(listingId), qty],
        value: totalCost,
      });
    },
    [getMarketplaceListing, writeAndWait],
  );

  const buyMarketplace721 = useCallback(
    async (listingId: number | bigint) => {
      if (!MARKETPLACE_ADDRESS) throw new Error("MARKETPLACE_NOT_CONFIGURED");

      const listing = await getMarketplaceListing(listingId);
      if (!listing) throw new Error("LISTING_NOT_FOUND");
      if (listing.is1155) throw new Error("LISTING_NOT_721");

      const totalCost = listing.pricePerUnitWei;
      return writeAndWait({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "buy721",
        args: [BigInt(listingId)],
        value: totalCost,
      });
    },
    [getMarketplaceListing, writeAndWait],
  );

  const cancelMarketplaceListing = useCallback(
    async (listingId: number | bigint) => {
      if (!MARKETPLACE_ADDRESS) throw new Error("MARKETPLACE_NOT_CONFIGURED");
      return writeAndWait({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [BigInt(listingId)],
      });
    },
    [writeAndWait],
  );

  return {
    buyTool,
    buySeed,
    buyWater,
    buyLand,
    setActiveTool,
    dig,
    plant,
    water,
    harvestAndClaimXP,
    approveMarketplace1155,
    approveMarketplaceLand,
    listMarketplace1155,
    listMarketplace721,
    buyMarketplace1155,
    buyMarketplace721,
    cancelMarketplaceListing,
    getMarketplaceListing,
  };
}

export default useGreenvaleActions;
