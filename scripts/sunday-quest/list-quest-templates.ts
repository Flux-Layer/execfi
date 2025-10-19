import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function listQuestTemplates() {
  console.log("📋 All Quest Templates\n");
  console.log("=".repeat(80));

  const quests = await prisma.questTemplate.findMany({
    orderBy: [
      { difficulty: "asc" },
      { id: "asc" },
    ],
  });

  const groupedByDifficulty = {
    EASY: quests.filter((q) => q.difficulty === "EASY"),
    MEDIUM: quests.filter((q) => q.difficulty === "MEDIUM"),
    HARD: quests.filter((q) => q.difficulty === "HARD"),
    EPIC: quests.filter((q) => q.difficulty === "EPIC"),
  };

  for (const [difficulty, questList] of Object.entries(groupedByDifficulty)) {
    if (questList.length === 0) continue;

    console.log(`\n🏆 ${difficulty} QUESTS (${questList.length})`);
    console.log("-".repeat(80));

    questList.forEach((quest) => {
      console.log(`\n📌 ${quest.name} (ID: ${quest.id})`);
      console.log(`   Key: ${quest.questKey}`);
      console.log(`   Description: ${quest.description}`);
      console.log(`   Base XP: ${quest.baseXpReward} | Bonus: ${quest.bonusMultiplier}x`);
      console.log(`   Est. Time: ${quest.estimatedTime} min`);
      console.log(`   Type: ${quest.questType}`);
      console.log(`   Active: ${quest.isActive ? "✅" : "❌"}`);
      
      // Show requirements
      const reqs = quest.requirements as any;
      if (reqs) {
        console.log(`   Requirements:`, JSON.stringify(reqs, null, 2).split('\n').map((line, i) => i === 0 ? line : `     ${line}`).join('\n'));
      }
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   Total Templates: ${quests.length}`);
  console.log(`   EASY: ${groupedByDifficulty.EASY.length}`);
  console.log(`   MEDIUM: ${groupedByDifficulty.MEDIUM.length}`);
  console.log(`   HARD: ${groupedByDifficulty.HARD.length}`);
  console.log(`   EPIC: ${groupedByDifficulty.EPIC.length}`);
  console.log(`   Active: ${quests.filter((q) => q.isActive).length}`);
  console.log(`   Inactive: ${quests.filter((q) => !q.isActive).length}`);
}

listQuestTemplates()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("Error:", error);
    prisma.$disconnect();
    process.exit(1);
  });
