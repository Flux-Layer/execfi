// Direct test of Alchemy API
import { config } from "dotenv";
config();

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || process.env.ALCHEMY_KEY;
const ALCHEMY_BASE_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

async function testAlchemy() {
  // Use the CORRECT wallet that sent the transactions
  const userAddress = "0x850bcbdf06d0798b41414e65ceaf192ad763f88d";

  console.log("🔍 Testing Alchemy API...");
  console.log(`📍 API URL: ${ALCHEMY_BASE_URL.substring(0, 60)}...`);
  console.log(`👤 User: ${userAddress}\n`);

  try {
    // Test all categories
    const categories = [
      ["external"], 
      ["internal"], 
      ["external", "internal"],
      ["erc20", "erc721", "erc1155"]
    ];

    for (const category of categories) {
      console.log(`\n📊 Testing category: ${category.join(", ")}`);
      
      const response = await fetch(ALCHEMY_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromAddress: userAddress,
              category,
              maxCount: "0x5", // Just 5 for testing
              order: "desc",
            },
          ],
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        console.error(`  ❌ Error: ${data.error.message}`);
        continue;
      }

      console.log(`  ✅ Found ${data.result?.transfers?.length || 0} transfers`);
      
      if (data.result?.transfers?.length > 0) {
        data.result.transfers.slice(0, 2).forEach((tx: any, i: number) => {
          console.log(`    ${i + 1}. ${tx.hash.substring(0, 20)}... | ${tx.value || tx.rawContract?.value} | ${tx.asset || 'ETH'}`);
        });
      }
    }

    // Now fetch the specific transaction hashes we know about
    console.log("\n\n🔍 Checking specific transaction we made:");
    const knownTx = "0x0faa961a28a52cebdd04a3952d88de645f203360fa589de93db27f28e4eb620f";
    
    const txResponse = await fetch(ALCHEMY_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionByHash",
        params: [knownTx],
      }),
    });

    const txData = await txResponse.json();
    
    if (txData.result) {
      const tx = txData.result;
      console.log(`  Transaction found!`);
      console.log(`  From: ${tx.from}`);
      console.log(`  To: ${tx.to}`);
      console.log(`  Value: ${parseInt(tx.value, 16) / 1e18} ETH`);
      console.log(`  Block: ${parseInt(tx.blockNumber, 16)}`);
      
      if (tx.from.toLowerCase() === userAddress.toLowerCase()) {
        console.log(`  ✅ Matches user address!`);
      } else {
        console.log(`  ⚠️ Different from address! Expected ${userAddress}, got ${tx.from}`);
        console.log(`  This means the app is using a different wallet!`);
      }
    } else {
      console.log(`  ❌ Transaction not found`);
    }

    console.log("\n✅ Test complete!");

  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testAlchemy();
