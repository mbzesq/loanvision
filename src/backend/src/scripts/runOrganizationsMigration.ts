import { Pool } from 'pg';
// @ts-ignore - Migration files are outside src directory
import { up, down } from '../../migrations/20250710_create_organizations';

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
    console.log(`[OrganizationsMigration] Starting ${action} migration...`);
    
    if (action === 'up') {
      await up(pool);
      console.log('[OrganizationsMigration] ✅ Migration completed successfully');
      console.log('[OrganizationsMigration] Created:');
      console.log('  - organizations table');
      console.log('  - organization_loan_access table');
      console.log('  - organization_invitations table');
      console.log('  - Added organization_id to users table');
      console.log('  - Created default "Shelton Partners, LLC"');
    } else if (action === 'down') {
      await down(pool);
      console.log('[OrganizationsMigration] ✅ Rollback completed successfully');
    } else {
      console.error('Invalid action. Use "up" or "down"');
      process.exit(1);
    }
  } catch (error) {
    console.error(`[OrganizationsMigration] ❌ Migration failed:`, error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();