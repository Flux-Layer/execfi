import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixRotation() {
  console.log("🔧 Fixing quest rotation...\n");

  // Get current Sunday
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - dayOfWeek);
  sunday.setUTCHours(0, 0, 0, 0);

  console.log(`Current week start: ${sunday.toISOString().split("T")[0]}`);

  // Deactivate all old rotations
  const deactivated = await prisma.weeklyQuestRotation.updateMany({
    where: {
      weekStartDate: { not: sunday },
    },
    data: { isActive: false },
  });

  console.log(`✅ Deactivated ${deactivated.count} old rotation(s)`);

  // Get the current week's rotation
  const currentRotation = await prisma.weeklyQuestRotation.findFirst({
    where: {
      weekStartDate: sunday,
      isActive: true,
    },
  });

  if (!currentRotation) {
    console.log("❌ No active rotation found for current week!");
    console.log("Run: npx tsx scripts/sunday-quest/regenerate-rotation.ts");
    return;
  }

  console.log(`\n✅ Active Rotation (ID: ${currentRotation.id})`);
  console.log(`   Seed: ${currentRotation.seed}`);
  console.log(`   Quest IDs: ${JSON.stringify(currentRotation.questSlots)}`);

  // Get quest details
  const questIds = currentRotation.questSlots as number[];
  const quests = await prisma.questTemplate.findMany({
    where: { id: { in: questIds } },
  });

  console.log(`\n📋 This Week's Quests:`);
  quests.forEach((quest, index) => {
    const active = quest.isActive ? "✅" : "❌";
    console.log(`${index + 1}. ${active} ${quest.name} (${quest.difficulty}) - ${quest.baseXpReward} XP`);
  });

  // Check for disabled quests
  const disabledInRotation = quests.filter((q) => !q.isActive);
  if (disabledInRotation.length > 0) {
    console.log(`\n⚠️  Warning: ${disabledInRotation.length} disabled quest(s) in rotation:`);
    disabledInRotation.forEach((q) => {
      console.log(`   - ${q.name} (${q.questKey})`);
    });
    console.log(`\n💡 Recommendation: Run regenerate-rotation.ts to update`);
  }
}

fixRotation()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("Error:", error);
    prisma.$disconnect();
    process.exit(1);
  });
