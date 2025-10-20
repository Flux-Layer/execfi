import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();

const prisma = new PrismaClient();

async function fixProgressPercentage() {
  console.log("🔧 Fixing progress percentage for COMPLETED quests...\n");

  const userAddress = "0x850bcbdf06d0798b41414e65ceaf192ad763f88d";

  // Find COMPLETED quests
  const completedQuests = await prisma.userQuestProgress.findMany({
    where: {
      userAddress: userAddress.toLowerCase(),
      status: "COMPLETED",
    },
    include: {
      questTemplate: true,
    },
  });

  console.log(`📊 Found ${completedQuests.length} completed quests\n`);

  for (const quest of completedQuests) {
    const progress = quest.progress as any;
    const requirements = quest.questTemplate.requirements as any;

    console.log(`🔧 Fixing: ${quest.questTemplate.name}`);
    console.log(`   Current progress:`, progress);

    // Calculate percentage based on quest type
    let percentage = 0;
    let updatedProgress = { ...progress };

    if (progress.transactionCount !== undefined) {
      const required = requirements.minTransactions || 1;
      const completed = progress.transactionCount;
      percentage = Math.min(100, Math.floor((completed / required) * 100));
      
      updatedProgress = {
        ...progress,
        percentage,
        required,
      };
    }

    console.log(`   New percentage: ${percentage}%`);
    console.log(`   Updated progress:`, updatedProgress);

    // Update the progress
    await prisma.userQuestProgress.update({
      where: { id: quest.id },
      data: {
        progress: updatedProgress,
      },
    });

    console.log(`   ✅ Updated\n`);
  }

  console.log("✨ All COMPLETED quests now have percentage!\n");

  await prisma.$disconnect();
}

fixProgressPercentage().catch(console.error);
