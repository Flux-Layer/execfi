import { createPublicClient, http, decodeEventLog } from "viem";
import { baseSepolia } from "viem/chains";
import XPRegistryArtifact from "../../contracts/xp-registry/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const XP_REGISTRY_PROXY = "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

async function findAdmin() {
  console.log("🔍 Finding XPRegistry admin...\n");

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });

  // Get deployment/initialization logs
  console.log("Fetching initialization logs...\n");
  
  const deploymentTxHash = "0x7cc4ee53d245afb7e52f8c4b68dec1d8381758c06601e7c226d863e8b9cdd7df" as `0x${string}`;
  
  const receipt = await publicClient.getTransactionReceipt({
    hash: deploymentTxHash,
  });

  console.log(`Transaction: ${deploymentTxHash}`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Logs found: ${receipt.logs.length}\n`);

  // Look for RoleGranted event
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: XPRegistryAbi,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === "RoleGranted") {
        const role = (decoded.args as any).role;
        const account = (decoded.args as any).account;
        const sender = (decoded.args as any).sender;

        if (role === DEFAULT_ADMIN_ROLE) {
          console.log("✅ Found DEFAULT_ADMIN_ROLE grant:");
          console.log(`   Admin Address: ${account}`);
          console.log(`   Granted by: ${sender}\n`);
        }
      }
    } catch (e) {
      // Skip non-matching logs
    }
  }

  // Also try reading directly from contract
  console.log("Checking specific addresses...\n");

  const addresses = [
    "0x1C79F0Bbe94cE84a3052BCea50FEf817765d53B1", // Deployer
    "0x237244ec3248718D3228062dE7b17A54B97B573A", // Implementation
    "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b", // Proxy
  ];

  for (const addr of addresses) {
    const hasRole = await publicClient.readContract({
      address: XP_REGISTRY_PROXY,
      abi: XPRegistryAbi,
      functionName: "hasRole",
      args: [DEFAULT_ADMIN_ROLE, addr as `0x${string}`],
    });

    console.log(`${addr}: ${hasRole ? "✅ HAS ADMIN" : "❌ no admin"}`);
  }

  console.log("\n💡 If deployer doesn't have admin, check the deployment script.");
  console.log("The initialize() function sets the admin during deployment.");
}

findAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
