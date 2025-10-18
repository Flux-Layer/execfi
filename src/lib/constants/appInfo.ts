export const APP_INFO = {
  name: "ExecFi",
  version: "0.1.0",
  buildDate: "2025-10-18",
  description: "Natural Language → Safe On-Chain Actions",

  links: {
    github: "https://github.com/your-org/execfi",
    docs: "https://docs.execfi.com",
    twitter: "https://twitter.com/execfi",
    discord: "https://discord.gg/execfi",
  },

  contracts: {
    xpRegistry: "0xf77678E650a84FcA39aA66cd9EabcD1D28182035",
    degenshoot: "0x640b3AA6FE0B70F67535B0179b0d1d1d941aDf86",
    wagerVault: "0x75123f823ed477DA70a2F1680C0Ddb3d4E1Bb745",
  },

  chains: {
    mainnet: { id: 8453, name: "Base" },
    testnet: { id: 84532, name: "Base Sepolia" },
  },
} as const;
