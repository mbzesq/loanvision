import pool from '../db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runInboxMigration() {
  try {
    console.log('🚀 Starting inbox system migration...');
    
    // Check if inbox_items table already exists
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'inbox_items'
      );
    `);
    
    if (result.rows[0].exists) {
      console.log('⚠️ Inbox tables already exist. Skipping migration.');
      return;
    }
    
    // Read and execute the SQL migration file
    const migrationPath = join(__dirname, '../database/migrations/create_inbox_system.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Inbox system migration completed successfully!');
    console.log('📋 Created tables:');
    console.log('   - inbox_items (main inbox table)');
    console.log('   - inbox_recipients (multi-user messaging)');
    console.log('   - inbox_attachments (file attachments)');
    console.log('   - inbox_activity_log (audit trail)');
    console.log('📝 Created enum types:');
    console.log('   - inbox_item_type, inbox_priority, inbox_status, inbox_source');
    
  } catch (error) {
    console.error('❌ Error running inbox migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  runInboxMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { runInboxMigration };