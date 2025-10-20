import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkRotations() {
  const rotations = await prisma.weeklyQuestRotation.findMany({
    orderBy: { id: "asc" },
  });

  console.log(`\n📊 All Rotations in Database (${rotations.length}):\n`);
  
  rotations.forEach((r) => {
    console.log(`ID: ${r.id}`);
    console.log(`  Week Start: ${r.weekStartDate.toISOString().split("T")[0]}`);
    console.log(`  Week End: ${r.weekEndDate.toISOString().split("T")[0]}`);
    console.log(`  Active: ${r.isActive ? "✅" : "❌"}`);
    console.log(`  Seed: ${r.seed}`);
    console.log(`  Quest IDs: ${JSON.stringify(r.questSlots)}`);
    console.log();
  });

  const currentSunday = new Date();
  currentSunday.setUTCDate(currentSunday.getUTCDate() - currentSunday.getUTCDay());
  currentSunday.setUTCHours(0, 0, 0, 0);

  console.log(`📅 Current week start: ${currentSunday.toISOString().split("T")[0]}\n`);

  const activeForCurrentWeek = await prisma.weeklyQuestRotation.findFirst({
    where: {
      weekStartDate: currentSunday,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeForCurrentWeek) {
    console.log(`✅ Active rotation for current week: ID ${activeForCurrentWeek.id}`);
  } else {
    console.log(`❌ No active rotation found for current week!`);
  }
}

checkRotations()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("Error:", error);
    prisma.$disconnect();
    process.exit(1);
  });
