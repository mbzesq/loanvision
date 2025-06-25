import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface Migration {
  id: number;
  filename: string;
  applied_at: Date;
}

async function ensureMigrationTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<Migration>('SELECT filename FROM migrations');
  return new Set(result.rows.map(row => row.filename));
}

async function runMigration(filename: string): Promise<void> {
  const migrationPath = path.join(__dirname, '..', 'migrations', filename);
  const migration = await import(migrationPath);
  
  if (typeof migration.up !== 'function') {
    throw new Error(`Migration ${filename} does not export an 'up' function`);
  }

  console.log(`Running migration: ${filename}`);
  
  try {
    await pool.query('BEGIN');
    await migration.up(pool);
    await pool.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
    await pool.query('COMMIT');
    console.log(`✓ Migration ${filename} completed`);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(`✗ Migration ${filename} failed:`, error);
    throw error;
  }
}

async function migrate(): Promise<void> {
  try {
    await ensureMigrationTable();
    
    const appliedMigrations = await getAppliedMigrations();
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found');
      return;
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();
    
    const pendingMigrations = migrationFiles.filter(file => !appliedMigrations.has(file));
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migration(s)`);
    
    for (const migration of pendingMigrations) {
      await runMigration(migration);
    }
    
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  migrate();
}