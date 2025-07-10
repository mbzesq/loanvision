import { Pool } from 'pg';
// @ts-ignore - Migration files are outside src directory
import { up, down } from '../../migrations/20250710_add_organizational_hierarchy';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const action = process.argv[2] || 'up';
  
  try {
    console.log(`[OrganizationalHierarchyMigration] Starting ${action} migration...`);
    
    if (action === 'up') {
      await up(pool);
      console.log('[OrganizationalHierarchyMigration] ✅ Migration completed successfully');
      console.log('[OrganizationalHierarchyMigration] Added:');
      console.log('  - manager_id relationship to users');
      console.log('  - job_title, department, hierarchy_level to users');
      console.log('  - organization_departments table');
      console.log('  - Various profile fields (phone, bio, etc.)');
    } else if (action === 'down') {
      await down(pool);
      console.log('[OrganizationalHierarchyMigration] ✅ Rollback completed successfully');
    } else {
      console.error('Invalid action. Use "up" or "down"');
      process.exit(1);
    }
  } catch (error) {
    console.error(`[OrganizationalHierarchyMigration] ❌ Migration failed:`, error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();