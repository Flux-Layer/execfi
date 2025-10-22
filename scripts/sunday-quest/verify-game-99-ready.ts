import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import XPRegistryArtifact from "../../contracts/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const XP_REGISTRY_ADDRESS =
  "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;

async function verifyGame99() {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(
      process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
    ),
  });

  console.log("🔍 Verifying Game 99 (Sunday Quest) Configuration...\n");
  console.log("XPRegistry Address:", XP_REGISTRY_ADDRESS);
  console.log("Chain: Base Sepolia\n");

  try {
    // Read game data with proper handling
    const gameData = await publicClient.readContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XPRegistryAbi,
      functionName: "games",
      args: [99n],
    });

    console.log("Raw game data:", gameData);
    console.log("\n" + "=".repeat(60));

    // Parse based on struct format
    const [name, signer, isActive, totalXP, rateLimit] = gameData as any[];

    console.log("📊 Game 99 Configuration:");
    console.log(`   Game ID: 99`);
    console.log(`   Name: ${name || "(empty)"}`);
    console.log(`   Signer: ${signer}`);
    console.log(`   Active: ${isActive ? "✅ YES" : "❌ NO"}`);
    console.log(`   Total XP: ${totalXP?.toString() || "0"}`);
    console.log(`   Rate Limit: ${rateLimit?.toString() || "0"}`);
    console.log("=".repeat(60));

    // Check if ready to use
    const isReady = 
      name && 
      name.length > 0 && 
      signer && 
      signer !== "0x0000000000000000000000000000000000000000" && 
      isActive;

    if (isReady) {
      console.log("\n✅ SUCCESS! Game 99 is READY TO USE!\n");
      console.log("📝 Configuration for .env:");
      console.log("─".repeat(60));
      console.log("SUNDAY_QUEST_GAME_ID=99");
      console.log(`QUEST_SIGNER_PRIVATE_KEY=${process.env.XP_SIGNER_PRIVATE_KEY || "<YOUR_SIGNER_KEY>"}`);
      console.log("─".repeat(60));
      console.log("\n✨ Next Steps:");
      console.log("1. Update your .env with the values above");
      console.log("2. Update src/lib/sunday-quest/constants.ts:");
      console.log("   export const SUNDAY_QUEST_GAME_ID = 99;");
      console.log("3. Restart your dev server: npm run dev");
      console.log("4. Visit: http://localhost:3000/sunday-quest");
      console.log("5. Test the quest flow!");
      
      console.log("\n🎯 Your signer address:", signer);
      console.log("   (Make sure you have the private key for this address)");
    } else {
      console.log("\n⚠️  Game 99 needs attention:");
      if (!name || name.length === 0) {
        console.log("   ❌ Name is empty or not set");
      }
      if (!signer || signer === "0x0000000000000000000000000000000000000000") {
        console.log("   ❌ Signer not set");
      }
      if (!isActive) {
        console.log("   ❌ Game is not active");
      }
      
      console.log("\n💡 To fix, run:");
      console.log("   npx tsx scripts/sunday-quest/setup-game-99.ts");
    }

    // Also check recent transactions
    console.log("\n📜 Recent setup transactions:");
    console.log("   Set Signer: https://base-sepolia.blockscout.com/tx/0xa721d4c28638896c22874f3379b03ec61ce142e0a8939d95bc4b49c89e93b65b");
    console.log("   Set Active:  https://base-sepolia.blockscout.com/tx/0x53129c6e3f45784c044cb9ec57da7bf69a80162f0d69bb8dd53a52852a2f6dec");
    
  } catch (error: any) {
    console.error("\n❌ Error reading game data:", error.message);
    console.error("\nThis might mean:");
    console.error("- Game 99 is not properly registered");
    console.error("- RPC connection issue");
    console.error("- Contract ABI mismatch");
  }
}

verifyGame99()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
