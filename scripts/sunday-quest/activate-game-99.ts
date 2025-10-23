import { createWalletClient, http, createPublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import XPRegistryArtifact from "../../contracts/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const SUNDAY_QUEST_GAME_ID = 99n;
const XP_REGISTRY_ADDRESS =
  "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;

async function activateGame99() {
  console.log("🎮 Attempting to activate Game 99...\n");

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

  console.log(`Admin: ${adminAccount.address}`);
  console.log(`Quest Signer: ${questSignerAccount.address}\n`);

  // Check current game state
  const gameData = (await publicClient.readContract({
    address: XP_REGISTRY_ADDRESS,
    abi: XPRegistryAbi,
    functionName: "games",
    args: [SUNDAY_QUEST_GAME_ID],
  })) as any;

  console.log("Current state:");
  console.log(`  Name: ${gameData.name || "(empty)"}`);
  console.log(`  Signer: ${gameData.signer}`);
  console.log(`  Active: ${gameData.isActive}\n`);

  // Try to update the game
  console.log("📝 Attempting to update game 99...");
  
  try {
    const hash = await walletClient.writeContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XPRegistryAbi,
      functionName: "updateGame",
      args: [SUNDAY_QUEST_GAME_ID, "Sunday Quest", questSignerAccount.address, true],
    });

    console.log(`Transaction: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      console.log("\n✅ Game 99 updated successfully!");
      console.log(`   Game ID: 99`);
      console.log(`   Name: Sunday Quest`);
      console.log(`   Signer: ${questSignerAccount.address}`);
      console.log(`   Active: true`);
      console.log(`\n🔍 View: https://base-sepolia.blockscout.com/tx/${hash}`);
      
      console.log("\n✨ Next steps:");
      console.log("1. Update .env: SUNDAY_QUEST_GAME_ID=99");
      console.log("2. Restart your application");
    } else {
      console.error("❌ Update failed!");
    }
  } catch (error: any) {
    console.error("\n❌ Update failed:", error.message);
    
    if (error.message.includes("GameNotRegistered")) {
      console.log("\n🔧 Game needs to be registered first. Trying registerGame...");
      
      try {
        const hash = await walletClient.writeContract({
          address: XP_REGISTRY_ADDRESS,
          abi: XPRegistryAbi,
          functionName: "registerGame",
          args: [SUNDAY_QUEST_GAME_ID, "Sunday Quest", questSignerAccount.address],
        });

        console.log(`Transaction: ${hash}`);
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
