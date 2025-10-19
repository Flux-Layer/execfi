import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import XPRegistryArtifact from "../../contracts/xp-registry/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const XP_REGISTRY_ADDRESS = "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

async function checkAdmin() {
  console.log("🔍 Checking XPRegistry admin status...\n");
  console.log(`Contract: ${XP_REGISTRY_ADDRESS}\n`);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });

  const currentAccount = "0x1C79F0Bbe94cE84a3052BCea50FEf817765d53B1";

  // Check if current account has admin role
  const hasRole = await publicClient.readContract({
    address: XP_REGISTRY_ADDRESS,
    abi: XPRegistryAbi,
    functionName: "hasRole",
    args: [DEFAULT_ADMIN_ROLE, currentAccount],
  });

  console.log(`Current Account: ${currentAccount}`);
  console.log(`Has Admin Role: ${hasRole ? "✅ YES" : "❌ NO"}\n`);

  if (!hasRole) {
    console.log("💡 To find the admin:");
    console.log("1. Visit: https://base-sepolia.blockscout.com/address/0xBf227816Afc11b5DD720d601ECC14Fc5901C380b");
    console.log("2. Check the 'Contract Creation' transaction");
    console.log("3. The deployer address likely has admin rights\n");
  }

  // Check if game 1 (Degenshoot) exists
  console.log("Checking existing games:");
  try {
    const game1 = await publicClient.readContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XPRegistryAbi,
      functionName: "games",
      args: [1n],
    });
    console.log(`  Game 1 (Degenshoot): ${(game1 as any).name} - Signer: ${(game1 as any).signer}`);
  } catch (e) {
    console.log("  Game 1: Not found");
  }

  try {
    const game99 = await publicClient.readContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XPRegistryAbi,
      functionName: "games",
      args: [99n],
    });
    console.log(`  Game 99 (Sunday Quest): ${(game99 as any).name} - Signer: ${(game99 as any).signer}`);
  } catch (e) {
    console.log("  Game 99: ❌ Not registered yet");
  }
}

checkAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
