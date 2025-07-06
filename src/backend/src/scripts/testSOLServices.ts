import pool from '../db';
import { SOLEventService } from '../services/SOLEventService';
import { SOLScheduler } from '../services/SOLScheduler';

async function testSOLServices() {
  console.log('🧪 Testing SOL Backend Services...\n');

  const solEventService = new SOLEventService(pool);
  const solScheduler = new SOLScheduler(pool);

  try {
    // Test 1: Get SOL Summary
    console.log('📊 Testing SOL Summary...');
    const summary = await solEventService.getSOLSummary();
    console.log('✅ SOL Summary:', summary);
    console.log();

    // Test 2: Check Expiration Alerts
    console.log('⚠️  Testing Expiration Alerts...');
    const alerts = await solEventService.checkExpirationAlerts();
    console.log(`✅ Found ${alerts.length} alerts:`);
    alerts.slice(0, 5).forEach(alert => console.log(`   ${alert}`));
    if (alerts.length > 5) console.log(`   ... and ${alerts.length - 5} more`);
    console.log();

    // Test 3: Trigger SOL Update for Specific Loan
    console.log('🔄 Testing Individual Loan Update...');
    const testLoanId = '0000359981'; // From our previous results
    const updateSuccess = await solEventService.triggerSOLUpdateForLoan(testLoanId);
    console.log(`✅ Loan ${testLoanId} update success: ${updateSuccess}`);
    console.log();

    // Test 4: Test Scheduler Status
    console.log('⏰ Testing Scheduler Status...');
    const schedulerStatus = solScheduler.getStatus();
    console.log('✅ Scheduler Status:', schedulerStatus);
    console.log();

    // Test 5: Run Daily Update (small batch)
    console.log('🕒 Testing Daily Update Process...');
    const dailyResult = await solEventService.runDailySOLUpdate();
    console.log(`✅ Daily Update Result: ${dailyResult.updated} updated, ${dailyResult.errors} errors`);
    console.log();

    // Test 6: Get updated summary after changes
    console.log('📈 Testing Updated Summary...');
    const updatedSummary = await solEventService.getSOLSummary();
    console.log('✅ Updated Summary:', updatedSummary);

    console.log('\n🎉 All SOL service tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the tests
testSOLServices().catch(console.error);