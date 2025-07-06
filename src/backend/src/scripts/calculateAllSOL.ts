import pool from '../db';
import { SOLCalculationService } from '../services/SOLCalculationService';

async function calculateAllSOL() {
  console.log('🚀 Starting SOL calculations for all loans...\n');

  const solService = new SOLCalculationService(pool);
  let processed = 0;
  let calculated = 0;
  let errors = 0;

  try {
    // Get all loans with property state
    const loansQuery = `
      SELECT 
        dmc.loan_id,
        dmc.state as property_state,
        dmc.origination_date,
        dmc.maturity_date,
        dmc.next_pymt_due as default_date,  -- Using next payment due as proxy for default
        dmc.last_pymt_received as last_payment_date,
        NULL as charge_off_date,  -- Not available in this table
        fe.fc_status as foreclosure_status,
        fe.complaint_filed_date,
        -- Use complaint_filed_date as acceleration_date when loan is in foreclosure
        CASE 
          WHEN fe.complaint_filed_date IS NOT NULL THEN fe.complaint_filed_date
          ELSE NULL
        END as acceleration_date
      FROM daily_metrics_current dmc
      LEFT JOIN foreclosure_events fe ON fe.loan_id = dmc.loan_id
      WHERE dmc.state IS NOT NULL
      ORDER BY dmc.loan_id
      LIMIT 100  -- Start with first 100 loans
    `;

    const loansResult = await pool.query(loansQuery);
    const totalLoans = loansResult.rows.length;
    
    console.log(`📊 Found ${totalLoans} loans to process\n`);

    for (const loan of loansResult.rows) {
      processed++;
      
      try {
        const result = await solService.calculateLoanSOL(loan);
        
        if (result) {
          await solService.storeCalculationResult(result);
          calculated++;
          
          // Log progress every 10 loans
          if (processed % 10 === 0) {
            console.log(`Progress: ${processed}/${totalLoans} processed, ${calculated} calculated`);
          }
          
          // Log high-risk loans
          if (result.sol_risk_level === 'HIGH') {
            console.log(`⚠️  HIGH RISK: Loan ${loan.loan_id} (${loan.property_state}) - ${result.days_until_expiration} days until expiration`);
          }
        }
      } catch (error) {
        console.error(`Error processing loan ${loan.loan_id}:`, error);
        errors++;
      }
    }

    console.log('\n✅ SOL Calculation Complete!');
    console.log(`📈 Summary:`);
    console.log(`   Total Processed: ${processed}`);
    console.log(`   Successfully Calculated: ${calculated}`);
    console.log(`   Errors: ${errors}`);

    // Show distribution
    const distributionQuery = `
      SELECT 
        sol_risk_level,
        COUNT(*) as count
      FROM loan_sol_calculations
      GROUP BY sol_risk_level
      ORDER BY 
        CASE sol_risk_level
          WHEN 'HIGH' THEN 1
          WHEN 'MEDIUM' THEN 2
          WHEN 'LOW' THEN 3
        END
    `;

    const distribution = await pool.query(distributionQuery);
    
    console.log('\n📊 Risk Distribution:');
    distribution.rows.forEach(row => {
      console.log(`   ${row.sol_risk_level}: ${row.count} loans`);
    });

    // Show some expired loans
    const expiredQuery = `
      SELECT 
        loan_id,
        property_state,
        sol_trigger_event,
        days_until_expiration
      FROM loan_sol_calculations
      WHERE is_expired = true
      LIMIT 5
    `;

    const expired = await pool.query(expiredQuery);
    
    if (expired.rows.length > 0) {
      console.log('\n⏰ Sample Expired Loans:');
      expired.rows.forEach(loan => {
        console.log(`   ${loan.loan_id} (${loan.property_state}): Expired ${Math.abs(loan.days_until_expiration)} days ago`);
      });
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Add the unique constraint first
async function addConstraint() {
  try {
    await pool.query(`
      ALTER TABLE loan_sol_calculations
      ADD CONSTRAINT loan_sol_calculations_loan_id_unique UNIQUE (loan_id)
    `);
    console.log('✅ Added unique constraint on loan_id\n');
  } catch (error: any) {
    if (error.code === '42710') { // Constraint already exists
      console.log('ℹ️  Unique constraint already exists\n');
    } else {
      throw error;
    }
  }
}

// Run the calculation
addConstraint()
  .then(() => calculateAllSOL())
  .catch(console.error);