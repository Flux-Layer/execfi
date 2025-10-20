import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import XPRegistryArtifact from "../../contracts/xp-registry/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const XP_REGISTRY_ADDRESS =
  "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;

async function checkGame99() {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(
      process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
    ),
  });

  console.log("🔍 Checking Game 99 (Sunday Quest) status...\n");

  const gameData = (await publicClient.readContract({
    address: XP_REGISTRY_ADDRESS,
    abi: XPRegistryAbi,
    functionName: "games",
    args: [99n],
  })) as any;

  console.log("📊 Game 99 Details:");
  console.log(`   Game ID: 99`);
  console.log(`   Name: ${gameData.name || "(empty)"}`);
  console.log(`   Signer: ${gameData.signer || "(none)"}`);
  console.log(`   Active: ${gameData.isActive ? "✅ YES" : "❌ NO"}`);
  console.log(`   Total XP: ${gameData.totalXP || 0n}`);
  
  console.log("\n" + "=".repeat(60));
  
  if (gameData.name && gameData.signer && gameData.isActive) {
    console.log("✅ Game 99 is READY TO USE!");
    console.log("\n📝 Action Items:");
    console.log("1. Update your .env:");
    console.log("   SUNDAY_QUEST_GAME_ID=99");
    console.log("   QUEST_SIGNER_PRIVATE_KEY=<private key for " + gameData.signer + ">");
    console.log("\n2. Restart your application");
    console.log("\n3. Test at http://localhost:3000/sunday-quest");
  } else {
    console.log("⚠️  Game 99 needs attention:");
    if (!gameData.name) console.log("   - Name is empty");
    if (!gameData.signer || gameData.signer === "0x0000000000000000000000000000000000000000") {
      console.log("   - Signer not set");
    }
    if (!gameData.isActive) console.log("   - Game not active");
  }
}

checkGame99()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
