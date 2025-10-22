import { PrismaClient } from "@prisma/client";
import { createSeededRng } from "../../src/lib/utils/prng";

const prisma = new PrismaClient();

function getCurrentSunday(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - dayOfWeek);
  sunday.setUTCHours(0, 0, 0, 0);
  return sunday;
}

function generateWeekSeed(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `SUNDAY_QUEST_${year}_${month}_${day}`;
}

async function regenerateRotation() {
  console.log("🔄 Regenerating weekly quest rotation...\n");

  const weekStart = getCurrentSunday();
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  console.log(`Week: ${weekStart.toISOString().split("T")[0]} to ${weekEnd.toISOString().split("T")[0]}`);

  // Delete existing rotation for this week
  const deleted = await prisma.weeklyQuestRotation.deleteMany({
    where: { weekStartDate: weekStart },
  });

  if (deleted.count > 0) {
    console.log(`✅ Deleted ${deleted.count} old rotation(s)`);
  }

  // Get all ACTIVE quests
  const allActiveQuests = await prisma.questTemplate.findMany({
    where: { isActive: true },
  });

  console.log(`\n📋 Available Active Quests: ${allActiveQuests.length}`);
  console.log(`   EASY: ${allActiveQuests.filter((q) => q.difficulty === "EASY").length}`);
  console.log(`   MEDIUM: ${allActiveQuests.filter((q) => q.difficulty === "MEDIUM").length}`);
  console.log(`   HARD: ${allActiveQuests.filter((q) => q.difficulty === "HARD").length}`);
  console.log(`   EPIC: ${allActiveQuests.filter((q) => q.difficulty === "EPIC").length}`);

  const seed = generateWeekSeed(weekStart);
  const rng = createSeededRng(seed);

  const easyQuests = allActiveQuests.filter((q) => q.difficulty === "EASY");
  const mediumQuests = allActiveQuests.filter((q) => q.difficulty === "MEDIUM");
  const hardQuests = allActiveQuests.filter((q) => q.difficulty === "HARD");
  const epicQuests = allActiveQuests.filter((q) => q.difficulty === "EPIC");

  // Select quests
  const selectedQuests = [];

  // 2 EASY
  const shuffledEasy = [...easyQuests].sort(() => rng() - 0.5);
  selectedQuests.push(...shuffledEasy.slice(0, 2));

  // 2 MEDIUM
  const shuffledMedium = [...mediumQuests].sort(() => rng() - 0.5);
  selectedQuests.push(...shuffledMedium.slice(0, 2));

  // 1 HARD or EPIC (based on week number)
  const weekNumber = Math.floor((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  const isEvenWeek = weekNumber % 2 === 0;

  if (isEvenWeek && epicQuests.length > 0) {
    const shuffledEpic = [...epicQuests].sort(() => rng() - 0.5);
    selectedQuests.push(shuffledEpic[0]);
  } else if (hardQuests.length > 0) {
    const shuffledHard = [...hardQuests].sort(() => rng() - 0.5);
    selectedQuests.push(shuffledHard[0]);
  }

  console.log(`\n✨ Selected ${selectedQuests.length} Quests for This Week:\n`);
  selectedQuests.forEach((quest, index) => {
    console.log(`${index + 1}. ${quest.name} (${quest.difficulty}) - ${quest.baseXpReward} XP`);
  });

  // Save rotation
  const questSlots = selectedQuests.map((q) => q.id);

  const rotation = await prisma.weeklyQuestRotation.create({
    data: {
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      questSlots: questSlots,
      seed: seed,
      isActive: true,
    },
  });

  console.log(`\n✅ New rotation created (ID: ${rotation.id})`);
  console.log(`   Seed: ${seed}`);
  console.log(`   Quest IDs: [${questSlots.join(", ")}]`);
}

regenerateRotation()
  .then(() => {
    console.log("\n🎉 Rotation regenerated successfully!");
    prisma.$disconnect();
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    prisma.$disconnect();
    process.exit(1);
  });
