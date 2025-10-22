import { createWalletClient, http, createPublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import XPRegistryArtifact from "../../contracts/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const SUNDAY_QUEST_GAME_ID = 99n;
const XP_REGISTRY_ADDRESS =
  "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;

async function registerSundayQuest() {
  console.log("🎮 Registering Sunday Quest in XPRegistry...\n");

  // Admin account (must have DEFAULT_ADMIN_ROLE)
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY as `0x${string}`;
  if (!adminPrivateKey) {
    throw new Error("ADMIN_PRIVATE_KEY not set");
  }

  const adminAccount = privateKeyToAccount(adminPrivateKey);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });

  const walletClient = createWalletClient({
    account: adminAccount,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });

  console.log(`Admin Address: ${adminAccount.address}`);

  // Quest signer address
  const questSignerKey = process.env
    .QUEST_SIGNER_PRIVATE_KEY as `0x${string}`;
  if (!questSignerKey) {
    throw new Error("QUEST_SIGNER_PRIVATE_KEY not set");
  }

  const questSignerAccount = privateKeyToAccount(questSignerKey);
  console.log(`Quest Signer: ${questSignerAccount.address}\n`);

  try {
    // Check if already registered
    const gameData = await publicClient.readContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XPRegistryAbi,
      functionName: "games",
      args: [SUNDAY_QUEST_GAME_ID],
    });

    if (gameData && (gameData as any).name && (gameData as any).name !== "") {
      console.log("✅ Sunday Quest already registered!");
      console.log(`   Name: ${(gameData as any).name}`);
      console.log(`   Signer: ${(gameData as any).signer}`);
      console.log(`   Active: ${(gameData as any).isActive}`);
      return;
    }
  } catch (error) {
    console.log("Game not registered yet, proceeding with registration...\n");
  }

  // Register game
  const hash = await walletClient.writeContract({
    address: XP_REGISTRY_ADDRESS,
    abi: XPRegistryAbi,
    functionName: "registerGame",
    args: [SUNDAY_QUEST_GAME_ID, "Sunday Quest", questSignerAccount.address],
  });

  console.log(`Transaction submitted: ${hash}`);
  console.log("Waiting for confirmation...\n");

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === "success") {
    console.log("✅ Sunday Quest registered successfully!");
    console.log(`   Game ID: ${SUNDAY_QUEST_GAME_ID}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed}`);
    console.log(
      `\n🔍 View on Blockscout: https://base-sepolia.blockscout.com/tx/${hash}`
    );
  } else {
    console.error("❌ Registration failed!");
    process.exit(1);
  }
}

registerSundayQuest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
