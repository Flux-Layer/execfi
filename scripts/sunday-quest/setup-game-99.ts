import { createWalletClient, http, createPublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import XPRegistryArtifact from "../../contracts/xp-registry/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const SUNDAY_QUEST_GAME_ID = 99n;
const XP_REGISTRY_ADDRESS =
  "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;

async function setupGame99() {
  console.log("🎮 Setting up Game 99 (Sunday Quest)...\n");

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
  console.log(`  Signer: ${gameData.signer || "0x0000000000000000000000000000000000000000"}`);
  console.log(`  Active: ${gameData.isActive || false}\n`);

  const transactions = [];

  // Step 1: Set the signer if not set
  if (!gameData.signer || gameData.signer === "0x0000000000000000000000000000000000000000") {
    console.log("📝 Step 1: Setting game signer...");
    const hash = await walletClient.writeContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XPRegistryAbi,
      functionName: "setGameSigner",
      args: [SUNDAY_QUEST_GAME_ID, questSignerAccount.address],
    });
    console.log(`   Tx: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   Status: ${receipt.status === "success" ? "✅" : "❌"}\n`);
    transactions.push({ step: "setGameSigner", hash, status: receipt.status });
  } else {
    console.log("✅ Game signer already set\n");
  }

  // Step 2: Activate the game
  if (!gameData.isActive) {
    console.log("📝 Step 2: Activating game...");
    const hash = await walletClient.writeContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XPRegistryAbi,
      functionName: "setGameActive",
      args: [SUNDAY_QUEST_GAME_ID, true],
    });
    console.log(`   Tx: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   Status: ${receipt.status === "success" ? "✅" : "❌"}\n`);
    transactions.push({ step: "setGameActive", hash, status: receipt.status });
  } else {
    console.log("✅ Game already active\n");
  }

  // Final check
  console.log("🔍 Final verification...");
  const finalGameData = (await publicClient.readContract({
    address: XP_REGISTRY_ADDRESS,
    abi: XPRegistryAbi,
    functionName: "games",
    args: [SUNDAY_QUEST_GAME_ID],
  })) as any;

  console.log("\n" + "=".repeat(60));
  console.log("📊 Game 99 Final State:");
  console.log(`   Game ID: 99`);
  console.log(`   Name: ${finalGameData.name || "Sunday Quest"}`);
  console.log(`   Signer: ${finalGameData.signer}`);
  console.log(`   Active: ${finalGameData.isActive ? "✅ YES" : "❌ NO"}`);
  console.log("=".repeat(60));

  if (finalGameData.signer && finalGameData.signer !== "0x0000000000000000000000000000000000000000" && finalGameData.isActive) {
    console.log("\n✅ SUCCESS! Game 99 is ready to use!");
    console.log("\n✨ Next steps:");
    console.log("1. Update your .env file:");
    console.log("   SUNDAY_QUEST_GAME_ID=99");
    console.log(`   QUEST_SIGNER_PRIVATE_KEY=${questSignerKey}`);
    console.log("\n2. Update src/lib/sunday-quest/constants.ts if needed");
    console.log("\n3. Restart your application");
    console.log("\n4. Test at http://localhost:3000/sunday-quest");
    
    if (transactions.length > 0) {
      console.log("\n🔍 View transactions:");
      transactions.forEach(tx => {
        console.log(`   ${tx.step}: https://base-sepolia.blockscout.com/tx/${tx.hash}`);
      });
    }
  } else {
    console.log("\n⚠️  Setup incomplete. Check the steps above.");
  }
}

setupGame99()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
