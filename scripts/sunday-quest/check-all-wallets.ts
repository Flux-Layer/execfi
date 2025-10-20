import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();

const prisma = new PrismaClient();

async function checkAllWallets() {
  console.log("🔍 Checking all wallets with quest progress...\n");

  const allProgress = await prisma.userQuestProgress.findMany({
    distinct: ['userAddress'],
    select: {
      userAddress: true,
    },
  });

  console.log(`Found ${allProgress.length} unique wallet addresses:\n`);

  for (const p of allProgress) {
    const count = await prisma.userQuestProgress.count({
      where: { userAddress: p.userAddress },
    });
    
    const completedCount = await prisma.userQuestProgress.count({
      where: { 
        userAddress: p.userAddress,
        status: "COMPLETED",
      },
    });

    console.log(`📍 ${p.userAddress}`);
    console.log(`   Total quests: ${count}`);
    console.log(`   Completed: ${completedCount}\n`);
  }

  await prisma.$disconnect();
}

checkAllWallets().catch(console.error);
