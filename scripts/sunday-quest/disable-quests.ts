import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const QUESTS_TO_DISABLE = [
  "play_degenshoot",      // Game Player
  "vault_deposit",        // Vault Depositor
  "multi_game_player",    // Game Master
];

async function disableQuests() {
  console.log("🔧 Disabling specified quests...\n");

  for (const questKey of QUESTS_TO_DISABLE) {
    try {
      const quest = await prisma.questTemplate.findUnique({
        where: { questKey },
      });

      if (!quest) {
        console.log(`⏭️  Quest "${questKey}" not found`);
        continue;
      }

      if (!quest.isActive) {
        console.log(`⏭️  Quest "${quest.name}" (${questKey}) is already disabled`);
        continue;
      }

      await prisma.questTemplate.update({
        where: { questKey },
        data: { isActive: false },
      });

      console.log(`✅ Disabled: "${quest.name}" (${questKey})`);
    } catch (error) {
      console.error(`❌ Failed to disable "${questKey}":`, error);
    }
  }

  console.log("\n" + "=".repeat(60));

  // Show updated summary
  const all = await prisma.questTemplate.findMany();
  const active = all.filter((q) => q.isActive);
  const inactive = all.filter((q) => !q.isActive);

  console.log(`\n📊 Updated Quest Status:`);
  console.log(`   Total: ${all.length}`);
  console.log(`   Active: ${active.length}`);
  console.log(`   Inactive: ${inactive.length}`);

  console.log(`\n✅ Active Quests:`);
  active.forEach((q) => {
    console.log(`   - ${q.name} (${q.difficulty})`);
  });

  console.log(`\n❌ Inactive Quests:`);
  inactive.forEach((q) => {
    console.log(`   - ${q.name} (${q.difficulty})`);
  });
}

disableQuests()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("Error:", error);
    prisma.$disconnect();
    process.exit(1);
  });
