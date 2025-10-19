import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();

const prisma = new PrismaClient();

/**
 * Clean up corrupted quest data
 * - Reset CLAIMED quests with xpAwarded=0 back to COMPLETED
 * - Remove invalid completion events
 */
async function cleanupCorruptedData() {
  console.log("🧹 Starting corrupted data cleanup...\n");

  const userAddress = "0x850bcbdf06d0798b41414e65ceaf192ad763f88d";

  // 1. Find ALL CLAIMED quests (need to re-verify on-chain claims)
  const corruptedProgress = await prisma.userQuestProgress.findMany({
    where: {
      userAddress: userAddress.toLowerCase(),
      status: "CLAIMED",
    },
    include: {
      questTemplate: true,
    },
  });

  console.log(`📊 Found ${corruptedProgress.length} corrupted quest progress records\n`);

  for (const progress of corruptedProgress) {
    console.log(`🔧 Fixing: ${progress.questTemplate.name}`);
    console.log(`   Current status: ${progress.status}`);
    console.log(`   XP Awarded: ${progress.xpAwarded}`);
    console.log(`   Progress: ${JSON.stringify(progress.progress)}\n`);

    // Reset to COMPLETED so user can claim again
    await prisma.userQuestProgress.update({
      where: { id: progress.id },
      data: {
        status: "COMPLETED",
        claimedAt: null,
        xpAwarded: 0,
      },
    });

    console.log(`   ✅ Reset to COMPLETED - user can claim again\n`);
  }

  // 2. Remove ALL completion events (need to re-verify on-chain claims)
  const corruptedEvents = await prisma.questCompletionEvent.findMany({
    where: {
      userAddress: userAddress.toLowerCase(),
    },
  });

  console.log(`\n📊 Found ${corruptedEvents.length} corrupted completion events\n`);

  for (const event of corruptedEvents) {
    console.log(`🗑️  Removing corrupted event for quest ${event.questTemplateId}`);
    
    await prisma.questCompletionEvent.delete({
      where: { id: event.id },
    });

    console.log(`   ✅ Deleted\n`);
  }

  console.log("\n✨ Cleanup complete!");
  console.log("User can now claim quests properly.\n");

  await prisma.$disconnect();
}

cleanupCorruptedData().catch(console.error);
