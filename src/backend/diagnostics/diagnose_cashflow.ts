import pool from '../src/db';

async function runDiagnostics() {
  console.log('=== CASHFLOW DATA DIAGNOSTICS ===\n');
  
  try {
    // Query 1: Inspect Column Data Types
    console.log('1. INSPECTING COLUMN DATA TYPES');
    console.log('--------------------------------');
    const schemaQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'daily_metrics_current' AND column_name LIKE '%_2025'
      ORDER BY column_name;
    `;
    
    const schemaResult = await pool.query(schemaQuery);
    console.log(`Found ${schemaResult.rows.length} columns matching pattern *_2025:`);
    schemaResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    console.log('\n');

    // Query 2: Select Raw Sample Data
    console.log('2. RAW SAMPLE DATA (First 5 rows)');
    console.log('----------------------------------');
    const sampleQuery = `
      SELECT loan_id, january_2025, february_2025, march_2025
      FROM daily_metrics_current
      LIMIT 5;
    `;
    
    const sampleResult = await pool.query(sampleQuery);
    console.log('Sample data:');
    sampleResult.rows.forEach((row, index) => {
      console.log(`\nRow ${index + 1}:`);
      console.log(`  loan_id: ${row.loan_id}`);
      console.log(`  january_2025: ${JSON.stringify(row.january_2025)} (type: ${typeof row.january_2025})`);
      console.log(`  february_2025: ${JSON.stringify(row.february_2025)} (type: ${typeof row.february_2025})`);
      console.log(`  march_2025: ${JSON.stringify(row.march_2025)} (type: ${typeof row.march_2025})`);
    });
    console.log('\n');

    // Query 3: Test Single-Column Aggregation
    console.log('3. TESTING SINGLE-COLUMN AGGREGATION');
    console.log('------------------------------------');
    const aggregationQuery = `
      SELECT
        SUM(CAST(REPLACE(REPLACE(january_2025, ', ', ''), ',', '') AS NUMERIC)) as total_january_cashflow
      FROM daily_metrics_current
      WHERE january_2025 IS NOT NULL AND january_2025 != '';
    `;
    
    try {
      const aggregationResult = await pool.query(aggregationQuery);
      console.log('Aggregation result:');
      console.log(`  Total January 2025 cashflow: ${aggregationResult.rows[0].total_january_cashflow}`);
    } catch (aggError) {
      console.log('ERROR in aggregation query:');
      console.log(`  ${aggError}`);
      
      // Try a simpler aggregation without string manipulation
      console.log('\nTrying simpler aggregation without string manipulation...');
      const simpleAggQuery = `
        SELECT
          COUNT(*) as total_rows,
          COUNT(january_2025) as non_null_january_rows,
          COUNT(CASE WHEN january_2025 = '' THEN NULL ELSE january_2025 END) as non_empty_january_rows
        FROM daily_metrics_current;
      `;
      
      const simpleResult = await pool.query(simpleAggQuery);
      console.log('Simple count results:');
      console.log(`  Total rows: ${simpleResult.rows[0].total_rows}`);
      console.log(`  Non-null january_2025 rows: ${simpleResult.rows[0].non_null_january_rows}`);
      console.log(`  Non-empty january_2025 rows: ${simpleResult.rows[0].non_empty_january_rows}`);
    }
    console.log('\n');

    // Additional diagnostic: Check if columns exist
    console.log('4. ADDITIONAL DIAGNOSTIC - COLUMN EXISTENCE CHECK');
    console.log('------------------------------------------------');
    const columnCheckQuery = `
      SELECT COUNT(*) as column_count
      FROM information_schema.columns
      WHERE table_name = 'daily_metrics_current' 
        AND column_name IN ('january_2025', 'february_2025', 'march_2025', 'april_2025', 
                           'may_2025', 'june_2025', 'july_2025', 'august_2025', 
                           'september_2025', 'october_2025', 'november_2025', 'december_2025');
    `;
    
    const columnCheckResult = await pool.query(columnCheckQuery);
    console.log(`Number of 2025 monthly columns found: ${columnCheckResult.rows[0].column_count} out of 12`);

    // Check if table exists and has data
    const tableCheckQuery = `
      SELECT 
        COUNT(*) as total_rows,
        COUNT(loan_id) as loans_with_id
      FROM daily_metrics_current;
    `;
    
    const tableCheckResult = await pool.query(tableCheckQuery);
    console.log(`\nTable statistics:`);
    console.log(`  Total rows in daily_metrics_current: ${tableCheckResult.rows[0].total_rows}`);
    console.log(`  Rows with loan_id: ${tableCheckResult.rows[0].loans_with_id}`);

  } catch (error) {
    console.error('FATAL ERROR in diagnostics:', error);
  } finally {
    // Close the pool connection
    await pool.end();
    console.log('\n=== DIAGNOSTICS COMPLETE ===');
  }
}

// Run the diagnostics
runDiagnostics().catch(error => {
  console.error('Failed to run diagnostics:', error);
  process.exit(1);
});