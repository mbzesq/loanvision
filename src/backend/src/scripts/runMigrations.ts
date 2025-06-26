import '../config'; // Initialize environment variables
import pool from '../db';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  console.log('[Migrations] Starting database migrations...');
  
  try {
    // Check if users table exists, if not run the migration
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('[Migrations] Users table does not exist. Running user migrations...');
      
      // Import and run the migrations
      const { up: createUsersUp } = await import('../migrations/20250626103408_create_users_table');
      const { up: createFutureAuthUp } = await import('../migrations/20250626103409_create_future_auth_tables');
      
      await createUsersUp(pool);
      console.log('[Migrations] ✅ Users table migration completed');
      
      await createFutureAuthUp(pool);
      console.log('[Migrations] ✅ Future auth tables migration completed');
    } else {
      console.log('[Migrations] Users table already exists. Skipping migrations.');
    }
    
    console.log('[Migrations] All migrations completed successfully.');
  } catch (error) {
    console.error('[Migrations] ❌ Migration failed:', error);
    throw error;
  }
}

export { runMigrations };