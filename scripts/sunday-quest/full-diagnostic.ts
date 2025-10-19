import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();

const prisma = new PrismaClient();

async function fullDiagnostic() {
  console.log("🔍 COMPLETE SUNDAY QUEST DIAGNOSTIC\n");
  console.log("=" .repeat(60));
  
  // Check both wallet addresses
  const wallets = [
    "0xa6df968112f5de6f96718858d867a3bbf4d395f2", // Original
    "0x850bcbdf06d0798b41414e65ceaf192ad763f88d", // Transaction sender
  ];

  for (const wallet of wallets) {
    console.log(`\n\n👤 Wallet: ${wallet}`);
    console.log("-".repeat(60));

    // 1. Check quest progress
    const progress = await prisma.userQuestProgress.findMany({
      where: {
        userAddress: wallet.toLowerCase(),
      },
      include: {
        questTemplate: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    console.log(`\n📊 Quest Progress Records: ${progress.length}`);
    
    for (const p of progress) {
      console.log(`\n  📋 ${p.questTemplate.name} (${p.questTemplate.questKey})`);
      console.log(`     Status: ${p.status}`);
      console.log(`     Started: ${p.startedAt}`);
      console.log(`     Completed: ${p.completedAt || 'N/A'}`);
      console.log(`     XP Awarded: ${p.xpAwarded || 0}`);
      console.log(`     Claimed At: ${p.claimedAt || 'N/A'}`);
      console.log(`     Progress: ${JSON.stringify(p.progress)}`);
      console.log(`     Rotation ID: ${p.rotationId}`);
    }

    // 2. Check completion events
    const completions = await prisma.questCompletionEvent.findMany({
      where: {
        userAddress: wallet.toLowerCase(),
      },
    });

    console.log(`\n\n🎉 Completion Events: ${completions.length}`);
    for (const c of completions) {
      console.log(`\n  ✅ Quest Template ID: ${c.questTemplateId}`);
      console.log(`     Verified: ${c.verifiedAt}`);
      console.log(`     XP Awarded: ${c.xpAwarded}`);
      console.log(`     Proof: ${JSON.stringify(c.completionProof)}`);
    }
  }

  // 3. Check current rotation
  console.log(`\n\n${"=".repeat(60)}`);
  console.log("📅 CURRENT ROTATION");
  console.log("=".repeat(60));
  
  const rotation = await prisma.weeklyQuestRotation.findFirst({
    where: {
      isActive: true,
    },
    orderBy: {
      weekStartDate: 'desc',
    },
  });

  if (rotation) {
    console.log(`\n  Week: ${rotation.weekStartDate} to ${rotation.weekEndDate}`);
    console.log(`  Active: ${rotation.isActive}`);
    console.log(`  Quest Slots: ${JSON.stringify(rotation.questSlots)}`);
  }

  // 4. Check all quest templates
  console.log(`\n\n${"=".repeat(60)}`);
  console.log("📋 QUEST TEMPLATES");
  console.log("=".repeat(60));
  
  const templates = await prisma.questTemplate.findMany({
    orderBy: {
      id: 'asc',
    },
  });

  for (const t of templates) {
    console.log(`\n  ${t.id}. ${t.name} (${t.questKey})`);
    console.log(`     Active: ${t.isActive}`);
    console.log(`     Requirements: ${JSON.stringify(t.requirements)}`);
  }

  await prisma.$disconnect();
}

fullDiagnostic().catch(console.error);
