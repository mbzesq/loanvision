import { Pool } from 'pg';
import { SOLCalculationService } from '../services/SOLCalculationService';

async function calculatePortfolioSOL() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com') 
      ? { rejectUnauthorized: false }
      : false
  });

  const solService = new SOLCalculationService(pool);
  
  try {
    console.log('🔄 Starting portfolio SOL calculations...');
    
    // First, let's see how many loans we have
    const loanCountResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM loans 
      WHERE property_state IS NOT NULL
    `);
    
    const totalLoans = parseInt(loanCountResult.rows[0].count);
    console.log(`📊 Found ${totalLoans} loans with property state`);
    
    if (totalLoans === 0) {
      console.log('⚠️  No loans found with property state. SOL calculations cannot be performed.');
      return;
    }
    
    // Calculate SOL for all loans
    const result = await solService.calculatePortfolioSOL();
    console.log(`✅ Calculation completed: ${result.processed} loans processed, ${result.errors} errors`);
    
    // Show summary
    const summaryResult = await pool.query(`
      SELECT 
        COUNT(*) as total_calculations,
        SUM(CASE WHEN is_expired THEN 1 ELSE 0 END) as expired_loans,
        SUM(CASE WHEN days_until_expiration BETWEEN 0 AND 180 THEN 1 ELSE 0 END) as expiring_soon,
        SUM(CASE WHEN sol_risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_risk,
        SUM(CASE WHEN sol_risk_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_risk,
        SUM(CASE WHEN sol_risk_level = 'LOW' THEN 1 ELSE 0 END) as low_risk
      FROM loan_sol_calculations
    `);
    
    const summary = summaryResult.rows[0];
    console.log('\n📊 SOL Calculation Summary:');
    console.log(`  Total calculations: ${summary.total_calculations}`);
    console.log(`  Expired loans: ${summary.expired_loans}`);
    console.log(`  Expiring soon (< 6 months): ${summary.expiring_soon}`);
    console.log(`  High risk: ${summary.high_risk}`);
    console.log(`  Medium risk: ${summary.medium_risk}`);
    console.log(`  Low risk: ${summary.low_risk}`);
    
  } catch (error) {
    console.error('❌ Calculation failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  calculatePortfolioSOL()
    .then(() => {
      console.log('\n✅ Portfolio SOL calculation completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Portfolio SOL calculation failed:', error);
      process.exit(1);
    });
}

export default calculatePortfolioSOL;