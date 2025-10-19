const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🎮 Applying Sunday Quest migration...\n');

  const sqlPath = path.join(__dirname, '../prisma/migrations/manual_sunday_quest/migration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split by semicolons but keep DO blocks together
  const statements = sql
    .split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/) // Split by semicolons not in strings
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let skipCount = 0;

  for (const statement of statements) {
    if (!statement) continue;

    try {
      await prisma.$executeRawUnsafe(statement + ';');
      successCount++;
      
      // Log what was created
      if (statement.includes('CREATE TABLE')) {
        const match = statement.match(/CREATE TABLE.*?"(\w+)"/);
        if (match) console.log(`  ✅ Created table: ${match[1]}`);
      } else if (statement.includes('CREATE TYPE')) {
        const match = statement.match(/CREATE TYPE.*?"(\w+)"/);
        if (match) console.log(`  ✅ Created enum: ${match[1]}`);
      } else if (statement.includes('CREATE INDEX') || statement.includes('CREATE UNIQUE INDEX')) {
        // Skip logging individual indexes to reduce noise
      }
    } catch (error) {
      // Check if error is about already existing objects
      if (error.message.includes('already exists') || error.message.includes('duplicate_object')) {
        skipCount++;
      } else {
        console.error(`  ❌ Error: ${error.message}`);
        console.error(`  Statement: ${statement.substring(0, 100)}...`);
      }
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`  ✅ Successfully executed: ${successCount} statements`);
  console.log(`  ⏭️  Skipped (already exists): ${skipCount} statements`);

  await prisma.$disconnect();
}

runMigration()
  .then(() => {
    console.log('\n✅ Sunday Quest migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
