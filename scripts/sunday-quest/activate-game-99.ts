import { createWalletClient, http, createPublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import XPRegistryArtifact from "../../contracts/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const SUNDAY_QUEST_GAME_ID = 99n;
const XP_REGISTRY_ADDRESS =
  "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;

async function activateGame99() {

  const adminPrivateKey =
    (process.env.NEW_ADMIN_PRIVATE_KEY as `0x${string}`) ||
    (process.env.XP_REGISTRY_ADMIN_PRIVATE_KEY as `0x${string}`);

  if (!adminPrivateKey) {
    throw new Error("Admin private key not found");
  }

  const adminAccount = privateKeyToAccount(adminPrivateKey);
  const questSignerKey = process.env.XP_SIGNER_PRIVATE_KEY as `0x${string}`;
  const questSignerAccount = privateKeyToAccount(questSignerKey);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(
      process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
    ),
  });

  const walletClient = createWalletClient({
    account: adminAccount,
    chain: baseSepolia,
    transport: http(
      process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
    ),
  });

  // Check current game state
  const gameData = (await publicClient.readContract({
    address: XP_REGISTRY_ADDRESS,
    abi: XPRegistryAbi,
    functionName: "games",
    args: [SUNDAY_QUEST_GAME_ID],
  })) as any;

  try {
    const hash = await walletClient.writeContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XPRegistryAbi,
      functionName: "updateGame",
      args: [SUNDAY_QUEST_GAME_ID, "Sunday Quest", questSignerAccount.address, true],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      console.log("\n✅ Game 99 updated successfully!");
    } else {
      console.error("❌ Update failed!");
    }
  } catch (error: any) {
    console.error("\n❌ Update failed:", error.message);
    
    if (error.message.includes("GameNotRegistered")) {
      
      try {
        const hash = await walletClient.writeContract({
          address: XP_REGISTRY_ADDRESS,
          abi: XPRegistryAbi,
          functionName: "registerGame",
          args: [SUNDAY_QUEST_GAME_ID, "Sunday Quest", questSignerAccount.address],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === "success") {
          console.log("\n✅ Game 99 registered successfully!");
        }
      } catch (regError: any) {
        console.error("Registration also failed:", regError.message);
      }
    }
  }
}

activateGame99()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
