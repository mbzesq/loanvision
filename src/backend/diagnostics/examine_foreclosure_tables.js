const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the backend directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Create database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'loanvision_db',
  user: process.env.DB_USER || 'nplvision_user',
  password: process.env.DB_PASSWORD || 'devonly_82928',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function examineForeclosureTables() {
  console.log('=== FORECLOSURE DATABASE ANALYSIS ===\n');
  
  try {
    // 1. Check which tables exist
    console.log('1. CHECKING TABLE EXISTENCE');
    console.log('---------------------------');
    const tableExistsQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('foreclosure_events', 'foreclosure_events_history', 'foreclosure_milestone_statuses', 'daily_metrics_current')
      ORDER BY table_name;
    `;
    
    const tablesResult = await pool.query(tableExistsQuery);
    console.log('Existing tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    console.log('\n');

    // 2. Analyze each table schema
    const tables = ['foreclosure_events', 'foreclosure_events_history', 'foreclosure_milestone_statuses', 'daily_metrics_current'];
    
    for (const tableName of tables) {
      console.log(`2. ANALYZING TABLE: ${tableName.toUpperCase()}`);
      console.log('='.repeat(40));
      
      try {
        // Get table schema
        const schemaQuery = `
          SELECT 
            column_name, 
            data_type, 
            is_nullable,
            column_default,
            character_maximum_length
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `;
        
        const schemaResult = await pool.query(schemaQuery, [tableName]);
        
        if (schemaResult.rows.length === 0) {
          console.log(`  Table ${tableName} does not exist.\n`);
          continue;
        }
        
        console.log(`  Schema (${schemaResult.rows.length} columns):`);
        schemaResult.rows.forEach(row => {
          const length = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
          const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
          console.log(`    ${row.column_name}: ${row.data_type}${length} ${nullable}${defaultVal}`);
        });
        
        // Get row count
        const countQuery = `SELECT COUNT(*) as row_count FROM ${tableName};`;
        const countResult = await pool.query(countQuery);
        console.log(`  Row count: ${countResult.rows[0].row_count}`);
        
        // Get sample data (if table has data)
        if (parseInt(countResult.rows[0].row_count) > 0) {
          console.log(`  Sample data (first 3 rows):`);
          const sampleQuery = `SELECT * FROM ${tableName} LIMIT 3;`;
          const sampleResult = await pool.query(sampleQuery);
          
          sampleResult.rows.forEach((row, index) => {
            console.log(`    Row ${index + 1}:`);
            Object.entries(row).forEach(([key, value]) => {
              // Truncate long values
              let displayValue = value;
              if (typeof value === 'string' && value.length > 50) {
                displayValue = value.substring(0, 50) + '...';
              }
              console.log(`      ${key}: ${displayValue}`);
            });
          });
        }
        
        console.log('\n');
        
      } catch (error) {
        console.log(`  Error examining table ${tableName}: ${error.message}\n`);
      }
    }

    // 3. Check for foreign key relationships
    console.log('3. CHECKING FOREIGN KEY RELATIONSHIPS');
    console.log('------------------------------------');
    const fkQuery = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('foreclosure_events', 'foreclosure_events_history', 'foreclosure_milestone_statuses', 'daily_metrics_current')
      ORDER BY tc.table_name;
    `;
    
    const fkResult = await pool.query(fkQuery);
    if (fkResult.rows.length > 0) {
      console.log('Foreign key relationships:');
      fkResult.rows.forEach(row => {
        console.log(`  ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
      });
    } else {
      console.log('No foreign key relationships found for these tables.');
    }
    console.log('\n');

    // 4. Check for indexes
    console.log('4. CHECKING INDEXES');
    console.log('------------------');
    const indexQuery = `
      SELECT
        t.relname AS table_name,
        i.relname AS index_name,
        a.attname AS column_name
      FROM pg_class t,
           pg_class i,
           pg_index ix,
           pg_attribute a
      WHERE t.oid = ix.indrelid
        AND i.oid = ix.indexrelid
        AND a.attrelid = t.oid
        AND a.attnum = ANY(ix.indkey)
        AND t.relkind = 'r'
        AND t.relname IN ('foreclosure_events', 'foreclosure_events_history', 'foreclosure_milestone_statuses', 'daily_metrics_current')
      ORDER BY t.relname, i.relname;
    `;
    
    const indexResult = await pool.query(indexQuery);
    if (indexResult.rows.length > 0) {
      console.log('Indexes:');
      let currentTable = '';
      indexResult.rows.forEach(row => {
        if (row.table_name !== currentTable) {
          currentTable = row.table_name;
          console.log(`  ${currentTable}:`);
        }
        console.log(`    ${row.index_name} on ${row.column_name}`);
      });
    } else {
      console.log('No indexes found for these tables.');
    }
    console.log('\n');

    // 5. Check for data patterns in key columns
    console.log('5. ANALYZING KEY DATA PATTERNS');
    console.log('------------------------------');
    
    // Check foreclosure_events unique statuses
    try {
      const statusQuery = `
        SELECT fc_status, COUNT(*) as count 
        FROM foreclosure_events 
        WHERE fc_status IS NOT NULL 
        GROUP BY fc_status 
        ORDER BY count DESC;
      `;
      const statusResult = await pool.query(statusQuery);
      if (statusResult.rows.length > 0) {
        console.log('Foreclosure event statuses:');
        statusResult.rows.forEach(row => {
          console.log(`  ${row.fc_status}: ${row.count} loans`);
        });
      }
    } catch (error) {
      console.log('Could not analyze foreclosure event statuses:', error.message);
    }
    
    // Check milestone statuses
    try {
      const milestoneQuery = `
        SELECT milestone_name, status_flag, COUNT(*) as count 
        FROM foreclosure_milestone_statuses 
        WHERE milestone_name IS NOT NULL 
        GROUP BY milestone_name, status_flag 
        ORDER BY milestone_name, count DESC;
      `;
      const milestoneResult = await pool.query(milestoneQuery);
      if (milestoneResult.rows.length > 0) {
        console.log('\nMilestone statuses:');
        let currentMilestone = '';
        milestoneResult.rows.forEach(row => {
          if (row.milestone_name !== currentMilestone) {
            currentMilestone = row.milestone_name;
            console.log(`  ${currentMilestone}:`);
          }
          console.log(`    ${row.status_flag}: ${row.count}`);
        });
      }
    } catch (error) {
      console.log('Could not analyze milestone statuses:', error.message);
    }
    
    console.log('\n');

  } catch (error) {
    console.error('FATAL ERROR in analysis:', error);
  } finally {
    // Close the pool connection
    await pool.end();
    console.log('=== ANALYSIS COMPLETE ===');
  }
}

// Run the analysis
examineForeclosureTables().catch(error => {
  console.error('Failed to run analysis:', error);
  process.exit(1);
});