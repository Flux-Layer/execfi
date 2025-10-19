import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import XPRegistryArtifact from "../../contracts/xp-registry/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const XP_REGISTRY_PROXY = "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

async function simpleCheck() {
  console.log("🔍 Simple admin check...\n");

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  });

  const deployer = "0x1C79F0Bbe94cE84a3052BCea50FEf817765d53B1" as `0x${string}`;

  console.log(`Proxy: ${XP_REGISTRY_PROXY}`);
  console.log(`Deployer: ${deployer}\n`);

  // Test 1: Can we read basic data?
  try {
    console.log("Test 1: Reading paused state...");
    const paused = await publicClient.readContract({
      address: XP_REGISTRY_PROXY,
      abi: XPRegistryAbi,
      functionName: "paused",
    });
    console.log(`✅ Contract is ${paused ? "PAUSED" : "ACTIVE"}\n`);
  } catch (error: any) {
    console.error(`❌ Failed: ${error.shortMessage}\n`);
  }

  // Test 2: Check admin role
  try {
    console.log("Test 2: Checking admin role...");
    const hasRole = await publicClient.readContract({
      address: XP_REGISTRY_PROXY,
      abi: XPRegistryAbi,
      functionName: "hasRole",
      args: [DEFAULT_ADMIN_ROLE, deployer],
    });
    console.log(`Result: ${hasRole ? "✅ HAS ADMIN" : "❌ NO ADMIN"}\n`);

    if (!hasRole) {
      console.log("💡 The admin role was revoked or transferred after deployment.");
      console.log("   Check if there's a different address with admin rights.");
    }
  } catch (error: any) {
    console.error(`❌ Failed: ${error.shortMessage}\n`);
  }

  // Test 3: Try to read game 1 (Degenshoot)
  try {
    console.log("Test 3: Reading game 1 (Degenshoot)...");
    const game1 = await publicClient.readContract({
      address: XP_REGISTRY_PROXY,
      abi: XPRegistryAbi,
      functionName: "games",
      args: [1n],
    });

    if (game1) {
      console.log(`✅ Game 1 found:`);
      console.log(`   Name: ${(game1 as any).name || "undefined"}`);
      console.log(`   Signer: ${(game1 as any).signer || "undefined"}`);
      console.log(`   Active: ${(game1 as any).isActive || "undefined"}\n`);
    }
  } catch (error: any) {
    console.error(`❌ Failed: ${error.shortMessage}\n`);
  }

  // Test 4: Check if contract was upgraded
  try {
    console.log("Test 4: Checking proxy implementation...");
    // Read storage slot for UUPS implementation
    const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const implData = await publicClient.getStorageAt({
      address: XP_REGISTRY_PROXY,
      slot: implSlot as `0x${string}`,
    });
    
    if (implData) {
      // Extract address from storage (last 20 bytes)
      const implAddress = "0x" + implData.slice(26);
      console.log(`Implementation: ${implAddress}`);
      console.log(`Expected: 0x237244ec3248718D3228062dE7b17A54B97B573A\n`);

      if (implAddress.toLowerCase() !== "0x237244ec3248718d3228062de7b17a54b97b573a") {
        console.log("⚠️  Implementation changed! Contract was upgraded.");
      } else {
        console.log("✅ Implementation unchanged since deployment.\n");
      }
    }
  } catch (error: any) {
    console.error(`❌ Failed: ${error.shortMessage}\n`);
  }

  console.log("═══════════════════════════════════════");
  console.log("Summary:");
  console.log("If deployer has NO admin role:");
  console.log("1. Admin was transferred after deployment");
  console.log("2. Check deployment script for who was set as admin");
  console.log("3. Look for AdminTransferred or RoleRevoked events");
  console.log("═══════════════════════════════════════");
}

simpleCheck()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
