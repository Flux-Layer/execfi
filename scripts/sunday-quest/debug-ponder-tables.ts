import { queryPonder } from "@/lib/indexer/client";

async function main() {
  console.log("🔍 Checking Ponder database tables...\n");

  try {
    // List all tables in all schemas
    const allTables = await queryPonder(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema IN ('public', 'ponder')
      AND table_name LIKE '%xp%' OR table_name LIKE '%event%' OR table_name LIKE '%22ac%'
      ORDER BY table_schema, table_name;
    `);

    console.log("📋 Available tables with 'xp', 'event', or '22ac':");
    allTables.forEach((t: any) => console.log(`  - ${t.table_schema}.${t.table_name}`));

    // List all tables in ponder schema
    const tables = await queryPonder(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'ponder'
      ORDER BY table_name;
    `);

    console.log("📋 Available tables:");
    tables.forEach((t: any) => console.log(`  - ${t.table_name}`));

    // Check xp_event table columns
    console.log("\n🔍 Checking xp_event table structure...");
    const xpEventCols = await queryPonder(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'ponder' 
      AND table_name LIKE '%xp_event%'
      ORDER BY table_name, ordinal_position;
    `);

    console.log("\n📊 XP Event columns:");
    xpEventCols.forEach((c: any) => 
      console.log(`  - ${c.column_name}: ${c.data_type}`)
    );

    // Check for user's transactions
    const userAddress = "0xa6df968112f5de6f96718858d867a3bbf4d395f2";
    
    console.log(`\n🔍 Checking transactions for ${userAddress}...\n`);

    // Check the actual table: public.6135__xp_event
    console.log(`\n📊 Checking public.6135__xp_event structure...`);
    const cols = await queryPonder(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = '6135__xp_event'
      ORDER BY ordinal_position;
    `);

    console.log("\nColumns:");
    cols.forEach((c: any) => console.log(`  - ${c.column_name}: ${c.data_type}`));

    // Query user's transactions
    console.log(`\n📊 Querying public."6135__xp_event" for user...`);
    const events = await queryPonder(`
      SELECT * FROM public."6135__xp_event"
      WHERE "user_address" = $1
      ORDER BY "timestamp" DESC
      LIMIT 10;
    `, [userAddress.toLowerCase()]);

    console.log(`\n✅ Found ${events.length} events!`);
    
    if (events.length > 0) {
      console.log("\nSample events:");
      events.forEach((e: any, i: number) => {
        console.log(`\n  Event ${i + 1}:`);
        console.log(`    - Event Type: ${e.eventType}`);
        console.log(`    - Timestamp: ${new Date(Number(e.timestamp) * 1000).toISOString()}`);
        console.log(`    - Value (ETH): ${e.valueInEth}`);
        console.log(`    - Game ID: ${e.gameId}`);
        console.log(`    - Chain ID: ${e.chainId}`);
      });
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }

  process.exit(0);
}

main();
