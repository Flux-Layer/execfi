import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkRequirements() {
  console.log("🔍 Checking quest requirements...\n");

  const quests = await prisma.questTemplate.findMany({
    where: {
      questKey: {
        in: ["eth_transfer_3x", "swap_any_token"]
      }
    }
  });

  for (const quest of quests) {
    console.log(`\n📋 Quest: ${quest.name} (ID: ${quest.id})`);
    console.log(`   Key: ${quest.questKey}`);
    console.log(`   Requirements:`, JSON.stringify(quest.requirements, null, 2));
  }

  await prisma.$disconnect();
}

checkRequirements();
