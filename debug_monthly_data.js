// Simple diagnostic to check monthly cashflow data
const { Pool } = require('pg');

// Basic connection - you'll need to set DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/nplvision'
});

async function debugMonthlyData() {
  try {
    console.log('=== DEBUGGING MONTHLY CASHFLOW DATA ===\n');
    
    // 1. Check if table exists and has data
    console.log('1. Table Overview:');
    const tableCheck = await pool.query(`
      SELECT COUNT(*) as total_rows FROM daily_metrics_current;
    `);
    console.log(`   Total rows in daily_metrics_current: ${tableCheck.rows[0].total_rows}`);
    
    // 2. Check if monthly columns have data
    console.log('\n2. Monthly Column Data Count:');
    const monthlyCheck = await pool.query(`
      SELECT 
        COUNT(january_2025) as jan_count,
        COUNT(february_2025) as feb_count,
        COUNT(march_2025) as mar_count,
        COUNT(april_2025) as apr_count,
        COUNT(may_2025) as may_count,
        COUNT(june_2025) as jun_count
      FROM daily_metrics_current;
    `);
    console.log(`   January: ${monthlyCheck.rows[0].jan_count} non-null values`);
    console.log(`   February: ${monthlyCheck.rows[0].feb_count} non-null values`);
    console.log(`   March: ${monthlyCheck.rows[0].mar_count} non-null values`);
    console.log(`   April: ${monthlyCheck.rows[0].apr_count} non-null values`);
    console.log(`   May: ${monthlyCheck.rows[0].may_count} non-null values`);
    console.log(`   June: ${monthlyCheck.rows[0].jun_count} non-null values`);
    
    // 3. Check actual values (sample)
    console.log('\n3. Sample Data (first 3 rows):');
    const sampleData = await pool.query(`
      SELECT loan_id, january_2025, february_2025, march_2025
      FROM daily_metrics_current 
      WHERE january_2025 IS NOT NULL OR february_2025 IS NOT NULL OR march_2025 IS NOT NULL
      LIMIT 3;
    `);
    
    sampleData.rows.forEach((row, index) => {
      console.log(`   Row ${index + 1}:`);
      console.log(`     loan_id: ${row.loan_id}`);
      console.log(`     january_2025: ${row.january_2025} (type: ${typeof row.january_2025})`);
      console.log(`     february_2025: ${row.february_2025} (type: ${typeof row.february_2025})`);
      console.log(`     march_2025: ${row.march_2025} (type: ${typeof row.march_2025})`);
    });
    
    // 4. Test the actual SUM queries
    console.log('\n4. Testing SUM Queries:');
    const janSum = await pool.query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(january_2025) as non_null_rows,
        SUM(january_2025) as total_sum,
        AVG(january_2025) as avg_value,
        MIN(january_2025) as min_value,
        MAX(january_2025) as max_value
      FROM daily_metrics_current 
      WHERE january_2025 IS NOT NULL;
    `);
    
    console.log(`   January Analysis:`);
    console.log(`     Total rows: ${janSum.rows[0].total_rows}`);
    console.log(`     Non-null january_2025: ${janSum.rows[0].non_null_rows}`);
    console.log(`     SUM: ${janSum.rows[0].total_sum}`);
    console.log(`     AVG: ${janSum.rows[0].avg_value}`);
    console.log(`     MIN: ${janSum.rows[0].min_value}`);
    console.log(`     MAX: ${janSum.rows[0].max_value}`);
    
    // 5. Test the exact query from the endpoint
    console.log('\n5. Testing Exact API Query:');
    const apiQuery = await pool.query(`
      SELECT
        'Jan' as month, 1 as month_order, COALESCE(SUM(january_2025), 0) as cashflow
      FROM daily_metrics_current
      WHERE january_2025 IS NOT NULL
    `);
    
    console.log(`   API Query Result:`);
    console.log(`     Month: ${apiQuery.rows[0].month}`);
    console.log(`     Cashflow: ${apiQuery.rows[0].cashflow}`);
    
  } catch (error) {
    console.error('Error in diagnostic:', error);
  } finally {
    await pool.end();
  }
}

debugMonthlyData();