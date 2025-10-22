import { createPublicClient, http, decodeEventLog } from "viem";
import { baseSepolia } from "viem/chains";
import XPRegistryArtifact from "../../contracts/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const XP_REGISTRY_PROXY = "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

async function checkRoleHistory() {
  console.log("🔍 Checking admin role history...\n");

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });

  // Get all logs from deployment to now
  const deploymentBlock = 32295323n;
  const latestBlock = await publicClient.getBlockNumber();

  console.log(`Scanning from block ${deploymentBlock} to ${latestBlock}...\n`);

  // Get all events related to DEFAULT_ADMIN_ROLE
  const logs = await publicClient.getLogs({
    address: XP_REGISTRY_PROXY,
    fromBlock: deploymentBlock,
    toBlock: latestBlock,
  });

  console.log(`Found ${logs.length} total logs\n`);
  console.log("Role-related events:\n");

  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: XPRegistryAbi,
        data: log.data,
        topics: log.topics,
      });

      if (
        decoded.eventName === "RoleGranted" ||
        decoded.eventName === "RoleRevoked" ||
        decoded.eventName === "RoleAdminChanged" ||
        decoded.eventName === "AdminTransferred"
      ) {
        const args = decoded.args as any;
        
        console.log(`📋 ${decoded.eventName}`);
        console.log(`   Block: ${log.blockNumber}`);
        console.log(`   Role: ${args.role || "N/A"}`);
        console.log(`   Account: ${args.account || args.newAdmin || args.previousAdmin || "N/A"}`);
        console.log(`   Sender: ${args.sender || "N/A"}`);
        console.log();
      }

      if (decoded.eventName === "Upgraded") {
        const upgradeArgs = decoded.args as any;
        console.log(`🔄 Contract Upgraded`);
        console.log(`   Block: ${log.blockNumber}`);
        console.log(`   New Implementation: ${upgradeArgs.implementation}`);
        console.log();
      }
    } catch (e) {
      // Skip non-matching logs
    }
  }

  // Check current state
  console.log("\n📊 Current state check:");
  
  const targetAddress = "0x1C79F0Bbe94cE84a3052BCea50FEf817765d53B1" as `0x${string}`;
  
  try {
    const hasRole = await publicClient.readContract({
      address: XP_REGISTRY_PROXY,
      abi: XPRegistryAbi,
      functionName: "hasRole",
      args: [DEFAULT_ADMIN_ROLE, targetAddress],
    });

    console.log(`${targetAddress} has admin role: ${hasRole}`);
  } catch (error: any) {
    console.error(`❌ Error checking role: ${error.message}`);
  }

  // Try calling games() to see if contract is working
  console.log("\n🎮 Testing contract functionality:");
  try {
    const game1 = await publicClient.readContract({
      address: XP_REGISTRY_PROXY,
      abi: XPRegistryAbi,
      functionName: "games",
      args: [1n],
    });
    console.log(`Game 1 data: ${JSON.stringify(game1, null, 2)}`);
  } catch (error: any) {
    console.error(`❌ Error reading game 1: ${error.shortMessage || error.message}`);
  }
}

checkRoleHistory()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
