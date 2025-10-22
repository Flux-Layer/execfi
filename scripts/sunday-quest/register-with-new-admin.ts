import { createWalletClient, http, createPublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import XPRegistryArtifact from "../../contracts/out/XPRegistry.sol/XPRegistry.json";

const XPRegistryAbi = XPRegistryArtifact.abi;
const SUNDAY_QUEST_GAME_ID = 99n;
const XP_REGISTRY_ADDRESS =
  "0xBf227816Afc11b5DD720d601ECC14Fc5901C380b" as `0x${string}`;

async function registerWithNewAdmin() {
  console.log("🎮 Registering Sunday Quest with new admin key...\n");

  // Try to read admin key from contracts/.env or main .env
  const adminPrivateKey =
    (process.env.NEW_ADMIN_PRIVATE_KEY as `0x${string}`) ||
    (process.env.ADMIN_PRIVATE_KEY as `0x${string}`);

  if (!adminPrivateKey) {
    throw new Error(
      "NEW_ADMIN_PRIVATE_KEY or ADMIN_PRIVATE_KEY not set.\n\n" +
        "Set it in your environment:\n" +
        "export NEW_ADMIN_PRIVATE_KEY=0x...\n" +
        "or add it to contracts/.env"
    );
  }

  const adminAccount = privateKeyToAccount(adminPrivateKey);

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

  console.log(`Admin Address: ${adminAccount.address}`);

  // Check if this admin has the role
  const DEFAULT_ADMIN_ROLE =
    "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  const hasRole = await publicClient.readContract({
    address: XP_REGISTRY_ADDRESS,
    abi: XPRegistryAbi,
    functionName: "hasRole",
    args: [DEFAULT_ADMIN_ROLE, adminAccount.address],
  });

  console.log(`Has Admin Role: ${hasRole ? "✅ YES" : "❌ NO"}\n`);

  if (!hasRole) {
    console.error("❌ This account does NOT have admin role!");
    console.error(
      "Please use an account that has DEFAULT_ADMIN_ROLE in XPRegistry."
    );
    process.exit(1);
  }

  // Quest signer address (can be same or different from admin)
  const questSignerKey =
    (process.env.QUEST_SIGNER_PRIVATE_KEY as `0x${string}`) ||
    adminPrivateKey; // Use admin key as fallback

  const questSignerAccount = privateKeyToAccount(questSignerKey);
  console.log(`Quest Signer: ${questSignerAccount.address}`);
  console.log(
    `(This address will sign XP awards for Sunday Quest)\n`
  );

  // Check if already registered
  try {
    const gameData = await publicClient.readContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XPRegistryAbi,
      functionName: "games",
      args: [SUNDAY_QUEST_GAME_ID],
    });

    if (gameData && (gameData as any).name) {
      console.log("✅ Sunday Quest already registered!");
      console.log(`   Name: ${(gameData as any).name}`);
      console.log(`   Signer: ${(gameData as any).signer}`);
      console.log(`   Active: ${(gameData as any).isActive}`);
      return;
    }
  } catch (error) {
    console.log("Game not registered yet, proceeding...\n");
  }

  // Register game
  console.log("📝 Registering game 99...");
  const hash = await walletClient.writeContract({
    address: XP_REGISTRY_ADDRESS,
    abi: XPRegistryAbi,
    functionName: "registerGame",
    args: [SUNDAY_QUEST_GAME_ID, "Sunday Quest", questSignerAccount.address],
  });

  console.log(`Transaction submitted: ${hash}`);
  console.log("Waiting for confirmation...\n");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === "success") {
    console.log("✅ Sunday Quest registered successfully!");
    console.log(`   Game ID: ${SUNDAY_QUEST_GAME_ID}`);
    console.log(`   Name: Sunday Quest`);
    console.log(`   Signer: ${questSignerAccount.address}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed}`);
    console.log(
      `\n🔍 View on Blockscout: https://base-sepolia.blockscout.com/tx/${hash}`
    );
    console.log("\n✨ Next steps:");
    console.log("1. Update .env: SUNDAY_QUEST_GAME_ID=99");
    console.log("2. Update src/lib/sunday-quest/constants.ts if needed");
    console.log("3. Restart your application");
  } else {
    console.error("❌ Registration failed!");
    process.exit(1);
  }
}

registerWithNewAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    if (error.message.includes("AccessControl")) {
      console.error(
        "\nThis account doesn't have admin rights. Options:"
      );
      console.error("1. Use the correct admin account");
      console.error("2. Grant admin role to this account first");
      console.error("3. Continue with game ID 1 for now");
    }
    process.exit(1);
  });
