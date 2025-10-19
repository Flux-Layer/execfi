import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UPDATES = [
  {
    questKey: "eth_transfer_3x",
    oldDescription: "Transfer ETH 3 times to any address (minimum 0.001 ETH each)",
    newDescription: "Transfer ETH 3 times to any address (minimum 0.00001 ETH each)",
  },
  {
    questKey: "vault_deposit",
    oldDescription: "Deposit ETH to WagerVault (minimum 0.005 ETH)",
    newDescription: "Deposit ETH to WagerVault (minimum 0.00001 ETH)",
  },
  {
    questKey: "bridge_to_base",
    oldDescription: "Bridge assets to Base using the app",
    newDescription: "Bridge assets to Base using the app (minimum 0.00001 ETH)",
  },
];

async function updateDescriptions() {
  console.log("📝 Updating quest descriptions to match new amounts...\n");

  for (const { questKey, oldDescription, newDescription } of UPDATES) {
    try {
      const quest = await prisma.questTemplate.findUnique({
        where: { questKey },
      });

      if (!quest) {
        console.log(`⏭️  Quest "${questKey}" not found`);
        continue;
      }

      await prisma.questTemplate.update({
        where: { questKey },
        data: { description: newDescription },
      });

      console.log(`✅ ${quest.name}:`);
      console.log(`   Old: ${oldDescription}`);
      console.log(`   New: ${newDescription}`);
      console.log();
    } catch (error) {
      console.error(`❌ Failed to update "${questKey}":`, error);
    }
  }

  console.log("✨ All descriptions updated!");
}

updateDescriptions()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("Error:", error);
    prisma.$disconnect();
    process.exit(1);
  });
