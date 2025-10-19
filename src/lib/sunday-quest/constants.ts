// Using game ID 99 ("mallware" game registered by friend)
// Signer: 0x1C79F0Bbe94cE84a3052BCea50FEf817765d53B1 (same as Degenshoot game ID 1)
export const SUNDAY_QUEST_GAME_ID = Number(process.env.SUNDAY_QUEST_GAME_ID) || 99;

export const XP_REGISTRY_ADDRESS = process.env
  .NEXT_PUBLIC_XP_REGISTRY_PROXY as `0x${string}`;

export const QUEST_SIGNER_PRIVATE_KEY = process.env
  .QUEST_SIGNER_PRIVATE_KEY as `0x${string}`;

export const XP_REGISTRY_DOMAIN = {
  name: "XPRegistry",
  version: "1",
  chainId: 84532, // Base Sepolia
  verifyingContract: XP_REGISTRY_ADDRESS,
} as const;

export const XP_ADD_TYPES = {
  XPAdd: [
    { name: "user", type: "address" },
    { name: "gameId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
