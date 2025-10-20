// Test verification API directly
import { config } from "dotenv";
config();

const BASE_URL = "http://localhost:3000";

async function testVerification() {
  // Use the correct wallet address (the one that sent transactions)
  const userAddress = "0x850bcbdf06d0798b41414e65ceaf192ad763f88d";
  
  console.log("🧪 Testing Quest Verification API\n");
  console.log(`👤 User Address: ${userAddress}\n`);

  try {
    // 1. Get current quests
    console.log("📊 Step 1: Fetching current quests...");
    const currentRes = await fetch(`${BASE_URL}/api/sunday-quest/current?address=${userAddress}`);
    const currentData = await currentRes.json();
    
    console.log(`✅ Found ${currentData.quests?.length || 0} quests`);
    console.log(`📝 User Progress: ${currentData.userProgress?.length || 0} started\n`);

    if (currentData.quests && currentData.quests.length > 0) {
      // Find ETH transfer quest
      const ethQuest = currentData.quests.find((q: any) => 
        q.questKey === "eth_transfer_3x" || q.name.includes("ETH")
      );
      
      if (ethQuest) {
        console.log(`\n💸 Found ETH Quest: ${ethQuest.name} (ID: ${ethQuest.id})`);
        
        // Check if already started
        const progress = currentData.userProgress?.find((p: any) => p.questTemplateId === ethQuest.id);
        if (progress) {
          console.log(`  Status: ${progress.status}`);
          console.log(`  Started: ${progress.startedAt}`);
        } else {
          console.log(`  Status: NOT STARTED`);
          console.log(`\n📝 Starting quest first...`);
          
          const startRes = await fetch(`${BASE_URL}/api/sunday-quest/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questId: ethQuest.id,
              userAddress,
            }),
          });
          
          const startData = await startRes.json();
          console.log(`  Result: ${JSON.stringify(startData)}`);
        }
        
        // 2. Test verification
        console.log(`\n🔍 Step 2: Testing verification...`);
        
        const verifyRes = await fetch(`${BASE_URL}/api/sunday-quest/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questId: ethQuest.id,
            userAddress,
          }),
        });
        
        const verifyData = await verifyRes.json();
        
        console.log(`\n📊 Verification Result:`);
        console.log(`  Verified: ${verifyData.verified}`);
        console.log(`  Progress: ${verifyData.progress}%`);
        console.log(`  Message: ${verifyData.message}`);
        console.log(`  Can Claim: ${verifyData.canClaim}`);
        
        if (verifyData.error) {
          console.log(`  ❌ Error: ${verifyData.error}`);
        }
      } else {
        console.log(`❌ ETH transfer quest not found in rotation`);
      }
      
      // Find swap quest
      const swapQuest = currentData.quests.find((q: any) => 
        q.questKey === "swap_any_token" || q.name.includes("Swap")
      );
      
      if (swapQuest) {
        console.log(`\n\n🔄 Found Swap Quest: ${swapQuest.name} (ID: ${swapQuest.id})`);
        
        const progress = currentData.userProgress?.find((p: any) => p.questTemplateId === swapQuest.id);
        if (progress) {
          console.log(`  Status: ${progress.status}`);
        } else {
          console.log(`  Status: NOT STARTED`);
        }
      }
    }

    // 3. Check database directly
    console.log(`\n\n🗄️  Step 3: Checking database...`);
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    
    const dbProgress = await prisma.userQuestProgress.findMany({
      where: {
        userAddress: userAddress.toLowerCase(),
      },
      include: {
        questTemplate: true,
      },
    });
    
    console.log(`\n📊 Database Records: ${dbProgress.length}`);
    dbProgress.forEach((p: any) => {
      console.log(`\n  Quest: ${p.questTemplate.name}`);
      console.log(`    Status: ${p.status}`);
      console.log(`    Started: ${p.startedAt}`);
      console.log(`    Progress: ${JSON.stringify(p.progress)}`);
    });
    
    await prisma.$disconnect();

  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    if (error.cause) {
      console.error("   Cause:", error.cause);
    }
  }
}

testVerification();
