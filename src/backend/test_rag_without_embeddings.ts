#!/usr/bin/env tsx
/**
 * Test RAG Document Generation (without embeddings)
 * This tests the document generation logic without requiring OpenAI API
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testRAGDocumentGeneration() {
  console.log('🧪 Testing RAG document generation (without embeddings)...');
  
  // Create database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection established');
    client.release();
    
    // Check available tables
    console.log('\n📋 Checking available tables:');
    const tablesToCheck = [
      'daily_metrics_current',
      'foreclosure_events', 
      'property_data_current',
      'loan_sol_calculations',
      'monthly_cashflow_data',
      'chain_of_title',
      'loan_collateral_status'
    ];

    const availableTables: string[] = [];
    
    for (const table of tablesToCheck) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
        availableTables.push(table);
        console.log(`✅ ${table}: available`);
      } catch (error) {
        console.log(`❌ ${table}: not available`);
      }
    }
    
    // Test document generation for available tables
    console.log(`\n🔄 Testing document generation for ${availableTables.length} available tables...`);
    
    // Test loan summary generation
    if (availableTables.includes('daily_metrics_current')) {
      console.log('\n📄 Testing loan summary documents:');
      const query = `
        SELECT 
          loan_id,
          CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as borrower_name,
          address, city, state, zip,
          prin_bal, org_amount, int_rate, pi_pmt,
          investor_name, legal_status, loan_type,
          origination_date, maturity_date,
          last_pymt_received, next_pymt_due
        FROM daily_metrics_current
        LIMIT 5
      `;
      
      const result = await pool.query(query);
      console.log(`Found ${result.rows.length} loans for summary documents`);
      
      // Sample document formatting
      if (result.rows.length > 0) {
        const sampleLoan = result.rows[0];
        const sampleContent = `Loan ${sampleLoan.loan_id} for borrower ${sampleLoan.borrower_name} located at ${sampleLoan.address}, ${sampleLoan.city}, ${sampleLoan.state} ${sampleLoan.zip}.`;
        console.log(`Sample content: ${sampleContent.substring(0, 100)}...`);
      }
    }
    
    // Test foreclosure document generation
    if (availableTables.includes('foreclosure_events')) {
      console.log('\n⚖️ Testing foreclosure documents:');
      const query = `
        SELECT 
          fe.loan_id,
          fe.fc_status,
          fe.complaint_filed_date,
          fe.sale_scheduled_date,
          fe.current_attorney,
          dmc.state,
          dmc.investor_name,
          dmc.prin_bal
        FROM foreclosure_events fe
        JOIN daily_metrics_current dmc ON fe.loan_id = dmc.loan_id
        WHERE fe.fc_status IS NOT NULL
        LIMIT 5
      `;
      
      const result = await pool.query(query);
      console.log(`Found ${result.rows.length} foreclosure cases`);
      
      if (result.rows.length > 0) {
        const sampleFC = result.rows[0];
        const sampleContent = `Foreclosure case for loan ${sampleFC.loan_id} in ${sampleFC.state}. Status: ${sampleFC.fc_status}`;
        console.log(`Sample content: ${sampleContent}`);
      }
    }
    
    // Test NY loan count (the specific issue from earlier)
    console.log('\n🗽 Testing NY loan foreclosure detection:');
    const nyQuery = `
      SELECT COUNT(*) as count
      FROM daily_metrics_current dmc
      LEFT JOIN foreclosure_events fe ON dmc.loan_id = fe.loan_id
      WHERE UPPER(dmc.state) = 'NY'
    `;
    
    const nyResult = await pool.query(nyQuery);
    console.log(`Total NY loans: ${nyResult.rows[0].count}`);
    
    const nyForeclosureQuery = `
      SELECT COUNT(*) as count
      FROM daily_metrics_current dmc
      JOIN foreclosure_events fe ON dmc.loan_id = fe.loan_id
      WHERE UPPER(dmc.state) = 'NY' 
      AND fe.fc_status IN ('ACTIVE', 'HOLD', 'PENDING')
    `;
    
    const nyFcResult = await pool.query(nyForeclosureQuery);
    console.log(`NY loans in foreclosure (ACTIVE/HOLD/PENDING): ${nyFcResult.rows[0].count}`);
    
    const nyLegalStatusQuery = `
      SELECT 
        legal_status,
        COUNT(*) as count
      FROM daily_metrics_current 
      WHERE UPPER(state) = 'NY'
      GROUP BY legal_status
      ORDER BY count DESC
    `;
    
    const nyLegalResult = await pool.query(nyLegalStatusQuery);
    console.log('NY loan legal statuses:', nyLegalResult.rows);
    
    console.log('\n✅ Document generation test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
  } finally {
    await pool.end();
  }
}

// Run the test
if (require.main === module) {
  testRAGDocumentGeneration().catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
  });
}