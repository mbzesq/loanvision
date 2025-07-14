// Script to run the collateral status trigger fix
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runTriggerFix() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '20250713_fix_collateral_status_trigger.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Running collateral status trigger fix migration...');
    
    // Run the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Test the fix by checking loan 0000667254
    const result = await pool.query(`
      SELECT loan_id, has_mortgage, mortgage_count, completeness_score, missing_documents
      FROM loan_collateral_status 
      WHERE loan_id = '0000667254'
    `);
    
    if (result.rows.length > 0) {
      const status = result.rows[0];
      console.log(`\n📊 Loan 0000667254 status after fix:`);
      console.log(`   has_mortgage: ${status.has_mortgage}`);
      console.log(`   mortgage_count: ${status.mortgage_count}`);
      console.log(`   completeness_score: ${status.completeness_score}`);
      console.log(`   missing_documents: ${status.missing_documents}`);
    } else {
      console.log('❌ No collateral status found for loan 0000667254');
    }
    
    // Check what documents exist for this loan
    const docs = await pool.query(`
      SELECT document_type, confidence_score, created_at
      FROM document_analysis 
      WHERE loan_id = '0000667254'
      ORDER BY created_at DESC
    `);
    
    console.log(`\n📄 Documents for loan 0000667254:`);
    docs.rows.forEach(doc => {
      console.log(`   ${doc.document_type} (${(doc.confidence_score * 100).toFixed(1)}%) - ${doc.created_at}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
runTriggerFix().catch(console.error);