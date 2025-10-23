#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  const migrationPath = path.join(
    __dirname,
    '../prisma/migrations/20251021223032_add_tx_tracking_and_verification/migration.sql'
  );

  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration...');
  console.log(sql);

  try {
    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
      console.log('✓ Executed:', statement.substring(0, 60) + '...');
    }

    console.log('\n✓ Migration applied successfully!');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
