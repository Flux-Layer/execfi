import { createConfig } from "@privy-io/wagmi";

import { baseSepolia } from "viem/chains";
import { http } from "wagmi";

export const wagmiConfig = createConfig({
  chains: [baseSepolia], // Pass your required chains as an array
  transports: {
    [baseSepolia.id]: http(),
  },
});
