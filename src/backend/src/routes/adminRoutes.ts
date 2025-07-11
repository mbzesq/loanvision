import express from 'express';
import { runSOLMigration } from '../scripts/runSOLMigration';
import { importSOLData } from '../scripts/importSOLData';
import { sessionService } from '../services/sessionService';

const router = express.Router();

// Simple admin key check (for basic security)
const ADMIN_KEY = process.env.ADMIN_KEY || 'temp-admin-key-123';

const checkAdminKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminKey = req.header('X-Admin-Key') || req.query.admin_key;
  
  if (adminKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Invalid admin key' });
  }
  
  next();
};

/**
 * POST /api/admin/sol/migrate
 * Run SOL database migration
 */
router.post('/sol/migrate', checkAdminKey, async (req, res) => {
  try {
    console.log('🔧 Admin endpoint: Starting SOL migration...');
    
    await runSOLMigration();
    
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
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/sol/import-data
 * Import SOL jurisdiction data
 */
router.post('/sol/import-data', checkAdminKey, async (req, res) => {
  try {
    console.log('🔧 Admin endpoint: Starting SOL data import...');
    
    await importSOLData();
    
    res.json({
      success: true,
      message: 'SOL data import completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ SOL data import failed:', error);
    res.status(500).json({
      success: false,
      error: 'SOL data import failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/sol/status
 * Check SOL system status
 */
router.get('/sol/status', checkAdminKey, async (req, res) => {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Check if SOL tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'sol_%'
      ORDER BY table_name
    `);

    // Check jurisdiction count
    let jurisdictionCount = 0;
    try {
      const jurisdictionResult = await pool.query('SELECT COUNT(*) FROM sol_jurisdictions');
      jurisdictionCount = parseInt(jurisdictionResult.rows[0].count);
    } catch (e) {
      // Table doesn't exist yet
    }

    await pool.end();

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
    console.error('❌ SOL status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'SOL status check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/sol/full-setup
 * Run both migration and data import in sequence
 */
router.post('/sol/full-setup', checkAdminKey, async (req, res) => {
  try {
    console.log('🔧 Admin endpoint: Starting full SOL setup...');
    
    // Step 1: Run migration
    console.log('📊 Step 1: Running SOL migration...');
    await runSOLMigration();
    
    // Step 2: Import data
    console.log('📊 Step 2: Importing SOL data...');
    await importSOLData();
    
    res.json({
      success: true,
      message: 'Full SOL setup completed successfully (migration + data import)',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Full SOL setup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Full SOL setup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/setup-investor-mapping
 * Set up organization-investor mapping for scalable access control
 */
router.post('/setup-investor-mapping', checkAdminKey, async (req, res) => {
  try {
    console.log('🔧 Admin endpoint: Setting up investor mapping...');
    
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Run the migration script
    const fs = await import('fs');
    const path = await import('path');
    
    const migrationPath = path.join(__dirname, '../migrations/add_organization_investors.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    // Check results
    const resultQuery = `
      SELECT 
        o.name as organization_name,
        COUNT(oi.id) as investor_count
      FROM organizations o
      LEFT JOIN organization_investors oi ON o.id = oi.organization_id AND oi.is_active = true
      GROUP BY o.id, o.name
      ORDER BY o.name
    `;
    
    const result = await pool.query(resultQuery);
    await pool.end();
    
    res.json({
      success: true,
      message: 'Investor mapping setup completed successfully',
      data: {
        organizations: result.rows,
        migration_applied: true
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Investor mapping setup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Investor mapping setup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/sessions
 * Get user sessions with names for admin monitoring
 */
router.get('/sessions', checkAdminKey, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    console.log(`🔧 Admin endpoint: Fetching ${limit} recent sessions with user names...`);
    
    const sessions = await sessionService.getAllSessionsWithUsers(limit);
    
    res.json({
      success: true,
      data: {
        sessions,
        count: sessions.length,
        message: `Retrieved ${sessions.length} recent sessions with user information`
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;