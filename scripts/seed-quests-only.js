const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedQuests() {
  console.log('🎮 Seeding Sunday Quest templates...\n');

  const quests = [
    {
      questKey: "eth_transfer_3x",
      name: "ETH Enthusiast",
      description: "Transfer ETH 3 times to demonstrate basic transaction skills",
      questType: "TRANSACTION",
      difficulty: "EASY",
      requirements: { type: "eth_transfer", count: 3, minAmount: "0.00001" },
      baseXpReward: 80,
      estimatedTime: 10,
      isActive: true,
    },
    {
      questKey: "any_transaction_5x",
      name: "Transaction Novice",
      description: "Execute 5 successful transactions",
      questType: "TRANSACTION",
      difficulty: "EASY",
      requirements: { type: "any_transaction", count: 5 },
      baseXpReward: 90,
      estimatedTime: 12,
      isActive: true,
    },
    {
      questKey: "swap_any_token",
      name: "Swap Starter",
      description: "Complete your first token swap",
      questType: "TRANSACTION",
      difficulty: "MEDIUM",
      requirements: { type: "swap", count: 1 },
      baseXpReward: 150,
      estimatedTime: 15,
      isActive: true,
    },
    {
      questKey: "transaction_spree",
      name: "Transaction Spree",
      description: "Execute 10 transactions within 24 hours",
      questType: "ACHIEVEMENT",
      difficulty: "HARD",
      requirements: { type: "any_transaction", count: 10, timeLimit: 86400 },
      baseXpReward: 500,
      estimatedTime: 25,
      isActive: true,
    },
    {
      questKey: "play_degenshoot",
      name: "Game Player",
      description: "Play Degenshoot and score at least 10 points",
      questType: "EXPLORATION",
      difficulty: "EASY",
      requirements: { type: "degenshoot", minScore: 10 },
      baseXpReward: 120,
      estimatedTime: 15,
      isActive: false,
    },
    {
      questKey: "vault_deposit",
      name: "Vault Depositor",
      description: "Deposit funds into a vault",
      questType: "TRANSACTION",
      difficulty: "MEDIUM",
      requirements: { type: "vault_deposit", minAmount: "0.01" },
      baseXpReward: 200,
      estimatedTime: 10,
      isActive: false,
    },
    {
      questKey: "gas_optimizer",
      name: "Gas Optimizer",
      description: "Execute 5 transactions with gas under 50k",
      questType: "ACHIEVEMENT",
      difficulty: "HARD",
      requirements: { type: "gas_optimized", count: 5, maxGas: 50000 },
      baseXpReward: 300,
      estimatedTime: 20,
      isActive: false,
    },
    {
      questKey: "bridge_to_base",
      name: "Bridge Builder",
      description: "Bridge assets to Base network",
      questType: "TRANSACTION",
      difficulty: "MEDIUM",
      requirements: { type: "bridge", minAmount: "0.001" },
      baseXpReward: 250,
      estimatedTime: 15,
      isActive: false,
    },
    {
      questKey: "multi_game_player",
      name: "Game Master",
      description: "Play 3 different games",
      questType: "EXPLORATION",
      difficulty: "EPIC",
      requirements: { type: "multi_game", gameCount: 3 },
      baseXpReward: 600,
      estimatedTime: 30,
      isActive: false,
    },
    {
      questKey: "sunday_sweep",
      name: "Sunday Sweep",
      description: "Complete all Sunday quests in one day",
      questType: "ACHIEVEMENT",
      difficulty: "EPIC",
      requirements: { type: "complete_all", timeLimit: 86400 },
      baseXpReward: 1000,
      estimatedTime: 60,
      isActive: false,
    },
  ];

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const quest of quests) {
    try {
      const existing = await prisma.questTemplate.findUnique({
        where: { questKey: quest.questKey },
      });

      if (existing) {
        // Update existing quest
        await prisma.questTemplate.update({
          where: { questKey: quest.questKey },
          data: quest,
        });
        console.log(`  🔄 Updated: ${quest.name}`);
        updated++;
      } else {
        // Create new quest
        await prisma.questTemplate.create({
          data: quest,
        });
        console.log(`  ✅ Created: ${quest.name}`);
        created++;
      }
    } catch (error) {
      console.error(`  ❌ Error with ${quest.name}: ${error.message}`);
      skipped++;
    }
  }

  console.log(`\n📊 Seeding Summary:`);
  console.log(`  ✅ Created: ${created}`);
  console.log(`  🔄 Updated: ${updated}`);
  console.log(`  ❌ Skipped: ${skipped}`);
  console.log(`\n🎉 Quest seeding complete!`);

  await prisma.$disconnect();
}

seedQuests().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
