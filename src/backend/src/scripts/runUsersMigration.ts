import { Pool } from 'pg';
// @ts-ignore - Migration files are outside src directory
import { up, down } from '../../migrations/20250626103408_create_users_table';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const action = process.argv[2] || 'up';
  
  try {
    console.log(`[UsersMigration] Starting ${action} migration...`);
    
    if (action === 'up') {
      await up(pool);
      console.log('[UsersMigration] ✅ Migration completed successfully');
      console.log('[UsersMigration] Created:');
      console.log('  - users table');
      console.log('  - user_role enum type');
    } else if (action === 'down') {
      await down(pool);
      console.log('[UsersMigration] ✅ Rollback completed successfully');
    } else {
      console.error('Invalid action. Use "up" or "down"');
      process.exit(1);
    }
  } catch (error) {
    console.error(`[UsersMigration] ❌ Migration failed:`, error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();