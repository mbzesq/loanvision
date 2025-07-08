import pool from './src/db';

async function debugLoanData() {
    try {
        // First, check if we have any loans
        const countResult = await pool.query('SELECT COUNT(*) FROM daily_metrics_current');
        console.log('Total loans in daily_metrics_current:', countResult.rows[0].count);
        
        // Get sample loan data with payment fields
        const sampleResult = await pool.query(`
            SELECT 
                loan_id,
                next_pymt_due,
                last_pymt_received,
                legal_status,
                january_2025,
                february_2025,
                march_2025,
                april_2025,
                may_2025,
                june_2025,
                july_2025,
                august_2025,
                september_2025,
                october_2025,
                november_2025,
                december_2025
            FROM daily_metrics_current 
            LIMIT 5
        `);
        
        console.log('Sample loan data:');
        sampleResult.rows.forEach(loan => {
            console.log(`\nLoan ${loan.loan_id}:`);
            console.log(`  Legal Status: ${loan.legal_status}`);
            console.log(`  Next Payment Due: ${loan.next_pymt_due}`);
            console.log(`  Last Payment Received: ${loan.last_pymt_received}`);
            console.log(`  Payment Data:`);
            console.log(`    Jan 2025: ${loan.january_2025}`);
            console.log(`    Feb 2025: ${loan.february_2025}`);
            console.log(`    Mar 2025: ${loan.march_2025}`);
            console.log(`    Apr 2025: ${loan.april_2025}`);
            console.log(`    May 2025: ${loan.may_2025}`);
            console.log(`    Jun 2025: ${loan.june_2025}`);
            console.log(`    Jul 2025: ${loan.july_2025}`);
            console.log(`    Aug 2025: ${loan.august_2025}`);
            console.log(`    Sep 2025: ${loan.september_2025}`);
            console.log(`    Oct 2025: ${loan.october_2025}`);
            console.log(`    Nov 2025: ${loan.november_2025}`);
            console.log(`    Dec 2025: ${loan.december_2025}`);
        });
        
        // Check foreclosure status
        const foreclosureResult = await pool.query(`
            SELECT COUNT(*) as total_fc, 
                   COUNT(CASE WHEN fc_status IN ('Active', 'Hold', 'FC', 'Foreclosure') THEN 1 END) as active_fc
            FROM daily_metrics_current dmc
            LEFT JOIN foreclosure_events fe ON dmc.loan_id = fe.loan_id
        `);
        
        console.log('\nForeclosure Status:');
        console.log(`  Total loans with foreclosure data: ${foreclosureResult.rows[0].total_fc}`);
        console.log(`  Active foreclosures: ${foreclosureResult.rows[0].active_fc}`);
        
        // Check how many loans have payment data
        const paymentDataResult = await pool.query(`
            SELECT 
                COUNT(CASE WHEN january_2025 IS NOT NULL AND january_2025 > 0 THEN 1 END) as jan_payments,
                COUNT(CASE WHEN february_2025 IS NOT NULL AND february_2025 > 0 THEN 1 END) as feb_payments,
                COUNT(CASE WHEN march_2025 IS NOT NULL AND march_2025 > 0 THEN 1 END) as mar_payments,
                COUNT(CASE WHEN april_2025 IS NOT NULL AND april_2025 > 0 THEN 1 END) as apr_payments,
                COUNT(CASE WHEN may_2025 IS NOT NULL AND may_2025 > 0 THEN 1 END) as may_payments,
                COUNT(CASE WHEN june_2025 IS NOT NULL AND june_2025 > 0 THEN 1 END) as jun_payments,
                COUNT(CASE WHEN july_2025 IS NOT NULL AND july_2025 > 0 THEN 1 END) as jul_payments,
                COUNT(CASE WHEN august_2025 IS NOT NULL AND august_2025 > 0 THEN 1 END) as aug_payments,
                COUNT(CASE WHEN september_2025 IS NOT NULL AND september_2025 > 0 THEN 1 END) as sep_payments,
                COUNT(CASE WHEN october_2025 IS NOT NULL AND october_2025 > 0 THEN 1 END) as oct_payments,
                COUNT(CASE WHEN november_2025 IS NOT NULL AND november_2025 > 0 THEN 1 END) as nov_payments,
                COUNT(CASE WHEN december_2025 IS NOT NULL AND december_2025 > 0 THEN 1 END) as dec_payments
            FROM daily_metrics_current
        `);
        
        console.log('\nPayment Data Summary:');
        const paymentData = paymentDataResult.rows[0];
        console.log(`  Jan 2025 payments: ${paymentData.jan_payments}`);
        console.log(`  Feb 2025 payments: ${paymentData.feb_payments}`);
        console.log(`  Mar 2025 payments: ${paymentData.mar_payments}`);
        console.log(`  Apr 2025 payments: ${paymentData.apr_payments}`);
        console.log(`  May 2025 payments: ${paymentData.may_payments}`);
        console.log(`  Jun 2025 payments: ${paymentData.jun_payments}`);
        console.log(`  Jul 2025 payments: ${paymentData.jul_payments}`);
        console.log(`  Aug 2025 payments: ${paymentData.aug_payments}`);
        console.log(`  Sep 2025 payments: ${paymentData.sep_payments}`);
        console.log(`  Oct 2025 payments: ${paymentData.oct_payments}`);
        console.log(`  Nov 2025 payments: ${paymentData.nov_payments}`);
        console.log(`  Dec 2025 payments: ${paymentData.dec_payments}`);
        
    } catch (error) {
        console.error('Error debugging loan data:', error);
    } finally {
        await pool.end();
    }
}

debugLoanData();