import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runSOLMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔄 Running SOL migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/012_create_sol_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ SOL tables created successfully!');
    
    // Verify tables were created
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'sol_%'
      ORDER BY table_name;
    `);
    
    console.log('\n📊 Created tables:');
    tableCheck.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  runSOLMigration()
    .then(() => {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

export default runSOLMigration;