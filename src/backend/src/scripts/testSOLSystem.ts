#!/usr/bin/env ts-node

import { Pool } from 'pg';
import { runSOLMigration } from './runSOLMigration';
import { importSOLData } from './importSOLData';
import { SOLCalculationService } from '../services/SOLCalculationService';
import { SOLEventService } from '../services/SOLEventService';

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'nplvision'
});

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
}

class SOLSystemTester {
  private pool: Pool;
  private results: TestResult[] = [];

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting SOL System Integration Tests...\n');

    await this.test1_VerifyDatabase();
    await this.test2_RunMigration();
    await this.test3_ImportData();
    await this.test4_VerifyJurisdictions();
    await this.test5_TestCalculationService();
    await this.test6_TestEventService();
    await this.test7_TestAPIEndpoints();
    await this.test8_TestScheduler();

    this.printResults();
  }

  private async addResult(test: string, success: boolean, message: string, data?: any): Promise<void> {
    this.results.push({ test, success, message, data });
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${test}: ${message}`);
    if (data && Object.keys(data).length > 0) {
      console.log(`   Data: ${JSON.stringify(data)}`);
    }
  }

  async test1_VerifyDatabase(): Promise<void> {
    try {
      const result = await this.pool.query('SELECT version()');
      await this.addResult(
        'Database Connection',
        true,
        'Successfully connected to PostgreSQL',
        { version: result.rows[0].version.split(' ').slice(0, 2).join(' ') }
      );
    } catch (error) {
      await this.addResult(
        'Database Connection',
        false,
        `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async test2_RunMigration(): Promise<void> {
    try {
      await runSOLMigration();
      
      // Verify tables were created
      const tablesResult = await this.pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'sol_%'
        ORDER BY table_name
      `);
      
      const expectedTables = [
        'sol_audit_log',
        'sol_batch_log',
        'sol_expiration_effects',
        'sol_jurisdictions',
        'sol_key_cases',
        'sol_research_notes',
        'sol_revival_methods',
        'sol_special_provisions',
        'sol_statute_citations',
        'sol_time_periods',
        'sol_tolling_provisions',
        'sol_trigger_events',
        'loan_sol_calculations'
      ];
      
      const createdTables = tablesResult.rows.map(r => r.table_name);
      const missingTables = expectedTables.filter(t => !createdTables.includes(t));
      
      if (missingTables.length === 0) {
        await this.addResult(
          'SOL Migration',
          true,
          `Successfully created ${createdTables.length} SOL tables`,
          { tables: createdTables }
        );
      } else {
        await this.addResult(
          'SOL Migration',
          false,
          `Missing tables: ${missingTables.join(', ')}`,
          { created: createdTables, missing: missingTables }
        );
      }
    } catch (error) {
      await this.addResult(
        'SOL Migration',
        false,
        `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async test3_ImportData(): Promise<void> {
    try {
      await importSOLData();
      
      const countResult = await this.pool.query('SELECT COUNT(*) FROM sol_jurisdictions');
      const count = parseInt(countResult.rows[0].count);
      
      if (count >= 50) { // Should have 51 jurisdictions (50 states + DC)
        await this.addResult(
          'SOL Data Import',
          true,
          `Successfully imported ${count} jurisdictions`,
          { count }
        );
      } else {
        await this.addResult(
          'SOL Data Import',
          false,
          `Only imported ${count} jurisdictions, expected 51`
        );
      }
    } catch (error) {
      await this.addResult(
        'SOL Data Import',
        false,
        `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async test4_VerifyJurisdictions(): Promise<void> {
    try {
      // Test specific jurisdiction lookups
      const testStates = ['TX', 'CA', 'FL', 'NY'];
      let foundStates = 0;
      
      for (const state of testStates) {
        const result = await this.pool.query('SELECT * FROM sol_jurisdictions WHERE state_code = $1', [state]);
        if (result.rows.length > 0) {
          foundStates++;
        }
      }
      
      if (foundStates === testStates.length) {
        await this.addResult(
          'Jurisdiction Verification',
          true,
          `Found all test jurisdictions: ${testStates.join(', ')}`,
          { found: foundStates, tested: testStates.length }
        );
      } else {
        await this.addResult(
          'Jurisdiction Verification',
          false,
          `Only found ${foundStates}/${testStates.length} test jurisdictions`
        );
      }
    } catch (error) {
      await this.addResult(
        'Jurisdiction Verification',
        false,
        `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async test5_TestCalculationService(): Promise<void> {
    try {
      const calculationService = new SOLCalculationService(this.pool);
      
      // Get a sample loan for testing
      const loanResult = await this.pool.query(`
        SELECT 
          loan_id,
          state as property_state,
          origination_date,
          maturity_date,
          next_pymt_due as default_date,
          last_pymt_received as last_payment_date,
          NULL as charge_off_date,
          NULL as acceleration_date
        FROM daily_metrics_current
        WHERE state IS NOT NULL
        LIMIT 1
      `);
      
      if (loanResult.rows.length === 0) {
        await this.addResult(
          'SOL Calculation Service',
          false,
          'No loans found in daily_metrics_current for testing'
        );
        return;
      }
      
      const testLoan = loanResult.rows[0];
      const solResult = await calculationService.calculateLoanSOL(testLoan);
      
      if (solResult) {
        await this.addResult(
          'SOL Calculation Service',
          true,
          `Successfully calculated SOL for loan ${testLoan.loan_id}`,
          {
            loan_id: solResult.loan_id,
            risk_level: solResult.sol_risk_level,
            days_until_expiration: solResult.days_until_expiration,
            is_expired: solResult.is_expired
          }
        );
      } else {
        await this.addResult(
          'SOL Calculation Service',
          false,
          `Failed to calculate SOL for loan ${testLoan.loan_id}`
        );
      }
    } catch (error) {
      await this.addResult(
        'SOL Calculation Service',
        false,
        `Service test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async test6_TestEventService(): Promise<void> {
    try {
      const eventService = new SOLEventService(this.pool);
      
      // Test summary
      const summary = await eventService.getSOLSummary();
      
      const summaryValid = summary && 
        typeof summary.total_loans === 'number' &&
        typeof summary.expired_count === 'number' &&
        Array.isArray(summary.alerts);
      
      if (summaryValid) {
        await this.addResult(
          'SOL Event Service',
          true,
          'Successfully retrieved SOL summary',
          {
            total_loans: summary.total_loans,
            expired_count: summary.expired_count,
            alert_count: summary.alerts.length
          }
        );
      } else {
        await this.addResult(
          'SOL Event Service',
          false,
          'Invalid summary data structure'
        );
      }
    } catch (error) {
      await this.addResult(
        'SOL Event Service',
        false,
        `Service test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async test7_TestAPIEndpoints(): Promise<void> {
    try {
      // Since we can't make HTTP requests in this context, we'll test the route logic directly
      const eventService = new SOLEventService(this.pool);
      
      // Test the core functionality that the API endpoints would use
      const summary = await eventService.getSOLSummary();
      const alerts = await eventService.checkExpirationAlerts();
      
      const endpointTests = [
        { name: 'summary', result: summary },
        { name: 'alerts', result: alerts }
      ];
      
      let passedTests = 0;
      for (const test of endpointTests) {
        if (test.result !== null && test.result !== undefined) {
          passedTests++;
        }
      }
      
      if (passedTests === endpointTests.length) {
        await this.addResult(
          'API Endpoint Logic',
          true,
          `All ${passedTests} endpoint logic tests passed`,
          { tested_endpoints: endpointTests.map(t => t.name) }
        );
      } else {
        await this.addResult(
          'API Endpoint Logic',
          false,
          `Only ${passedTests}/${endpointTests.length} endpoint logic tests passed`
        );
      }
    } catch (error) {
      await this.addResult(
        'API Endpoint Logic',
        false,
        `Endpoint test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async test8_TestScheduler(): Promise<void> {
    try {
      // Import scheduler here to avoid circular dependencies
      const { SOLScheduler } = await import('../services/SOLScheduler');
      
      const scheduler = new SOLScheduler(this.pool, { enabled: false }); // Don't actually start it
      const status = scheduler.getStatus();
      
      const schedulerValid = status && 
        typeof status.isRunning === 'boolean' &&
        status.config &&
        typeof status.config.dailyUpdateHour === 'number';
      
      if (schedulerValid) {
        await this.addResult(
          'SOL Scheduler',
          true,
          'Scheduler initialized successfully',
          {
            is_running: status.isRunning,
            daily_hour: status.config.dailyUpdateHour,
            enabled: status.config.enabled
          }
        );
      } else {
        await this.addResult(
          'SOL Scheduler',
          false,
          'Invalid scheduler status structure'
        );
      }
    } catch (error) {
      await this.addResult(
        'SOL Scheduler',
        false,
        `Scheduler test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 SOL SYSTEM INTEGRATION TEST RESULTS');
    console.log('='.repeat(80));
    
    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const successRate = ((passed / total) * 100).toFixed(1);
    
    console.log(`\n📊 SUMMARY: ${passed}/${total} tests passed (${successRate}%)\n`);
    
    // Group results
    const passedTests = this.results.filter(r => r.success);
    const failedTests = this.results.filter(r => !r.success);
    
    if (passedTests.length > 0) {
      console.log('✅ PASSED TESTS:');
      passedTests.forEach(result => {
        console.log(`   • ${result.test}: ${result.message}`);
      });
    }
    
    if (failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      failedTests.forEach(result => {
        console.log(`   • ${result.test}: ${result.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
    if (passed === total) {
      console.log('🎉 ALL TESTS PASSED! SOL system is ready for production.');
    } else {
      console.log('⚠️  Some tests failed. Review and fix issues before deploying.');
    }
    
    console.log('='.repeat(80));
  }
}

async function runSOLSystemTests() {
  const tester = new SOLSystemTester(pool);
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('💥 Test suite failed:', error);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runSOLSystemTests()
    .then(() => {
      console.log('\n🎯 SOL system test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test script failed:', error);
      process.exit(1);
    });
}

export { runSOLSystemTests, SOLSystemTester };