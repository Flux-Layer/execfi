import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 0.01 USD ≈ 0.00001 ETH (assuming ~$3000/ETH)
// In wei: 10000000000000 (10^13)
const MIN_AMOUNT_WEI = "10000000000000"; // 0.00001 ETH ≈ $0.03

async function lowerMinimumAmounts() {
  console.log("🔧 Lowering minimum amounts in quests to ~$0.01 USD...\n");
  console.log(`Using: ${MIN_AMOUNT_WEI} wei (0.00001 ETH)\n`);

  const questsToUpdate = [
    {
      questKey: "eth_transfer_3x",
      field: "minAmount",
      oldValue: "1000000000000000", // 0.001 ETH
    },
    {
      questKey: "vault_deposit",
      field: "minWagerAmount",
      oldValue: "5000000000000000", // 0.005 ETH
    },
    {
      questKey: "bridge_to_base",
      field: "minAmount",
      oldValue: "1000000000000000", // 0.001 ETH
    },
  ];

  for (const { questKey, field, oldValue } of questsToUpdate) {
    try {
      const quest = await prisma.questTemplate.findUnique({
        where: { questKey },
      });

      if (!quest) {
        console.log(`⏭️  Quest "${questKey}" not found`);
        continue;
      }

      const requirements = quest.requirements as any;
      const currentValue = requirements[field];

      if (currentValue === MIN_AMOUNT_WEI) {
        console.log(`⏭️  ${quest.name}: Already set to ${MIN_AMOUNT_WEI}`);
        continue;
      }

      // Update the requirement
      requirements[field] = MIN_AMOUNT_WEI;

      await prisma.questTemplate.update({
        where: { questKey },
        data: { requirements },
      });

      console.log(`✅ ${quest.name}:`);
      console.log(`   Field: ${field}`);
      console.log(`   Old: ${oldValue} wei (${parseFloat(oldValue) / 1e18} ETH)`);
      console.log(`   New: ${MIN_AMOUNT_WEI} wei (${parseFloat(MIN_AMOUNT_WEI) / 1e18} ETH)`);
      console.log();
    } catch (error) {
      console.error(`❌ Failed to update "${questKey}":`, error);
    }
  }

  console.log("=".repeat(60));
  console.log("\n📊 Updated Quest Requirements:\n");

  // Show all quests with amount requirements
  const allQuests = await prisma.questTemplate.findMany({
    orderBy: { id: "asc" },
  });

  allQuests.forEach((quest) => {
    const reqs = quest.requirements as any;
    if (reqs.minAmount || reqs.minWagerAmount) {
      const amount = reqs.minAmount || reqs.minWagerAmount;
      const ethAmount = parseFloat(amount) / 1e18;
      const approxUSD = (ethAmount * 3000).toFixed(4); // Assuming $3000/ETH
      
      console.log(`${quest.name}:`);
      console.log(`  Amount: ${amount} wei`);
      console.log(`  ETH: ${ethAmount} ETH`);
      console.log(`  ~USD: $${approxUSD} (at $3000/ETH)`);
      console.log();
    }
  });

  console.log("✨ Done!");
}

lowerMinimumAmounts()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error("Error:", error);
    prisma.$disconnect();
    process.exit(1);
  });
