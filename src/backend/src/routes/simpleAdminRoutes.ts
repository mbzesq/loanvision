import express from 'express';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const router = express.Router();

// Simple admin key check
const ADMIN_KEY = process.env.ADMIN_KEY || 'temp-admin-key-123';

const checkAdminKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminKey = req.header('X-Admin-Key') || req.query.admin_key;
  
  if (adminKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Invalid admin key' });
  }
  
  next();
};

// Database pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'nplvision'
});

/**
 * GET /api/simple-admin/test
 * Simple test endpoint
 */
router.get('/test', checkAdminKey, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Simple admin route is working!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/simple-admin/db-test
 * Test database connection
 */
router.get('/db-test', checkAdminKey, async (req, res) => {
  try {
    const result = await pool.query('SELECT version(), NOW()');
    
    res.json({
      success: true,
      message: 'Database connection successful',
      database_version: result.rows[0].version,
      current_time: result.rows[0].now,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/simple-admin/sol-status
 * Check SOL tables status
 */
router.get('/sol-status', checkAdminKey, async (req, res) => {
  try {
    // Check if SOL tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'sol_%'
      ORDER BY table_name
    `);

    // Check jurisdiction count if table exists
    let jurisdictionCount = 0;
    try {
      const jurisdictionResult = await pool.query('SELECT COUNT(*) FROM sol_jurisdictions');
      jurisdictionCount = parseInt(jurisdictionResult.rows[0].count);
    } catch (e) {
      // Table doesn't exist yet
    }

    res.json({
      success: true,
      status: {
        tables_created: tablesResult.rows.length,
        table_names: tablesResult.rows.map(r => r.table_name),
        jurisdictions_loaded: jurisdictionCount,
        migration_needed: tablesResult.rows.length === 0,
        data_import_needed: jurisdictionCount === 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'SOL status check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : 'No stack' : undefined
    });
  }
});

/**
 * POST /api/simple-admin/sol-migrate
 * Run SOL migration directly
 */
router.post('/sol-migrate', checkAdminKey, async (req, res) => {
  try {
    console.log('🔧 Simple admin: Starting SOL migration...');
    
    // Read the migration file directly
    const migrationPath = join(__dirname, '../database/migrations/012_create_sol_tables.sql');
    console.log('📂 Reading migration from:', migrationPath);
    
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    console.log('📄 Migration SQL loaded, length:', migrationSQL.length);
    
    // Execute the migration
    console.log('⚡ Executing SOL table creation...');
    await pool.query(migrationSQL);
    
    console.log('✅ SOL migration completed successfully!');
    
    res.json({
      success: true,
      message: 'SOL migration completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ SOL migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'SOL migration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : 'No stack' : undefined
    });
  }
});

export default router;