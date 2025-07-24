#!/usr/bin/env tsx
/**
 * Run RAG Migration Script
 * Applies the RAG tables migration using the same connection as the app
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

async function runRAGMigration() {
  console.log('🚀 Running RAG migration...');
  
  // Create database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection established');
    client.release();
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '20250717_create_rag_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Executing RAG migration...');
    await pool.query(migrationSQL);
    
    console.log('✅ RAG migration completed successfully');
    
    // Verify tables were created
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'rag_%'
      ORDER BY table_name
    `);
    
    console.log('📊 RAG tables created:', tableCheck.rows.map(r => r.table_name));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  runRAGMigration().catch(error => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
}