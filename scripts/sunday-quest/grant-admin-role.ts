import { createWalletClient, http, createPublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import XPRegistryArtifact from "../../contracts/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const XP_REGISTRY_ADDRESS = "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

async function grantAdminRole() {
  console.log("🔑 Granting admin role...\n");

  // Current admin (must already have DEFAULT_ADMIN_ROLE)
  const currentAdminKey = process.env.REAL_ADMIN_PRIVATE_KEY as `0x${string}`;
  if (!currentAdminKey) {
    throw new Error("REAL_ADMIN_PRIVATE_KEY not set");
  }

  const currentAdmin = privateKeyToAccount(currentAdminKey);
  
  // Account to grant admin to
  const newAdminAddress = process.env.NEW_ADMIN_ADDRESS as `0x${string}`;
  if (!newAdminAddress) {
    throw new Error("NEW_ADMIN_ADDRESS not set");
  }

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });

  const walletClient = createWalletClient({
    account: currentAdmin,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });

  console.log(`Current Admin: ${currentAdmin.address}`);
  console.log(`New Admin: ${newAdminAddress}\n`);

  // Check if current admin actually has the role
  const hasRole = await publicClient.readContract({
    address: XP_REGISTRY_ADDRESS,
    abi: XPRegistryAbi,
    functionName: "hasRole",
    args: [DEFAULT_ADMIN_ROLE, currentAdmin.address],
  });

  if (!hasRole) {
    console.error(`❌ ${currentAdmin.address} does NOT have admin role!`);
    console.error("You need to use the real admin account.");
    process.exit(1);
  }

  console.log("✅ Current admin verified\n");

  // Grant role
  const hash = await walletClient.writeContract({
    address: XP_REGISTRY_ADDRESS,
    abi: XPRegistryAbi,
    functionName: "grantRole",
    args: [DEFAULT_ADMIN_ROLE, newAdminAddress],
  });

  console.log(`Transaction submitted: ${hash}`);
  console.log("Waiting for confirmation...\n");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === "success") {
    console.log("✅ Admin role granted successfully!");
    console.log(`   New Admin: ${newAdminAddress}`);
    console.log(`\n🔍 View on Blockscout: https://base-sepolia.blockscout.com/tx/${hash}`);
  } else {
    console.error("❌ Grant failed!");
    process.exit(1);
  }
}

grantAdminRole()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
