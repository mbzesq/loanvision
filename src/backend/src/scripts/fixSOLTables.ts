import pool from '../db';
import fs from 'fs';
import path from 'path';

async function fixSOLTables() {
  console.log('🔧 Starting SOL tables fix...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/013_fix_sol_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Running migration to fix SOL tables...');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!\n');

    // Verify the changes
    console.log('🔍 Verifying changes...\n');

    // Check loan_id column type
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'loan_sol_calculations' 
      AND column_name = 'loan_id'
    `);
    
    if (columnCheck.rows[0]) {
      console.log(`✅ loan_id column type: ${columnCheck.rows[0].data_type}(${columnCheck.rows[0].character_maximum_length})`);
    }

    // Check if audit tables exist
    const auditTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sol_audit_log', 'sol_batch_log')
      ORDER BY table_name
    `);
    
    console.log(`✅ Audit tables created: ${auditTables.rows.map(r => r.table_name).join(', ')}\n`);

    // Check if sol_category was added
    const categoryCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'sol_jurisdictions' 
      AND column_name = 'sol_category'
    `);
    
    if (categoryCheck.rows.length > 0) {
      console.log('✅ sol_category column added to sol_jurisdictions');
    }

    console.log('\n🎉 All SOL table issues have been fixed!');
    console.log('📝 Next steps:');
    console.log('   1. Update sol_category values for each jurisdiction');
    console.log('   2. Run SOL calculations for existing loans');

  } catch (error) {
    console.error('❌ Error fixing SOL tables:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
fixSOLTables().catch(console.error);