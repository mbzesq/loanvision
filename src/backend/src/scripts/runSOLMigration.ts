#!/usr/bin/env ts-node

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

// Database configuration - use same as main app
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runSOLMigration() {
  console.log('🚀 Starting SOL (Statute of Limitations) migration...');
  
  try {
    // Read the migration file
    const migrationPath = join(__dirname, '../database/migrations/012_create_sol_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📂 Migration file loaded:', migrationPath);
    
    // Execute the migration
    console.log('⚡ Executing SOL table creation...');
    await pool.query(migrationSQL);
    
    console.log('✅ SOL migration completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - sol_jurisdictions');
    console.log('  - sol_time_periods');
    console.log('  - sol_trigger_events');
    console.log('  - sol_tolling_provisions');
    console.log('  - sol_revival_methods');
    console.log('  - sol_expiration_effects');
    console.log('  - sol_special_provisions');
    console.log('  - sol_statute_citations');
    console.log('  - sol_key_cases');
    console.log('  - sol_research_notes');
    console.log('  - loan_sol_calculations');
    console.log('  - sol_audit_log');
    console.log('  - sol_batch_log');
    console.log('\nCreated views:');
    console.log('  - sol_state_summary');
    console.log('  - sol_risk_summary');
    
    // Verify tables were created
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'sol_%'
      ORDER BY table_name;
    `;
    
    const result = await pool.query(tablesQuery);
    console.log(`\n📊 Verification: ${result.rows.length} SOL tables found in database`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runSOLMigration()
    .then(() => {
      console.log('🎉 SOL migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export { runSOLMigration };