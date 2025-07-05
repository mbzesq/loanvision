import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import SOLDataImporter from './importSOLData';

async function setupSOL() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  console.log('🚀 Starting SOL setup process...\n');

  try {
    // Step 1: Check if tables already exist
    console.log('1️⃣ Checking existing SOL tables...');
    const existingTables = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'sol_jurisdictions';
    `);

    if (existingTables.rows[0].count === '0') {
      // Step 2: Run migration
      console.log('2️⃣ Creating SOL tables...');
      const migrationPath = path.join(__dirname, '../database/migrations/012_create_sol_tables.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      await pool.query(migrationSQL);
      console.log('✅ SOL tables created successfully!\n');
    } else {
      console.log('✅ SOL tables already exist.\n');
    }

    // Step 3: Check if data already exists
    console.log('3️⃣ Checking existing SOL data...');
    const existingData = await pool.query('SELECT COUNT(*) as count FROM sol_jurisdictions');
    
    if (existingData.rows[0].count === '0') {
      // Step 4: Import SOL data
      console.log('4️⃣ Importing SOL jurisdiction data...');
      const importer = new SOLDataImporter();
      const jsonPath = process.env.SOL_JSON_PATH || path.join(__dirname, '../../../../projects/sol-database-extracted.json');
      
      await importer.importData(jsonPath);
      await importer.close();
      console.log('✅ SOL data imported successfully!\n');
    } else {
      console.log(`✅ SOL data already exists (${existingData.rows[0].count} jurisdictions).\n`);
    }

    // Step 5: Run initial portfolio SOL calculations (optional)
    const runCalculations = process.env.RUN_SOL_CALCULATIONS === 'true';
    if (runCalculations) {
      console.log('5️⃣ Running portfolio SOL calculations...');
      // This would call the calculation service
      console.log('⏭️  Skipping calculations (set RUN_SOL_CALCULATIONS=true to enable)\n');
    }

    // Final summary
    const summary = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM sol_jurisdictions) as jurisdictions,
        (SELECT COUNT(*) FROM sol_trigger_events) as trigger_events,
        (SELECT COUNT(*) FROM sol_tolling_provisions) as tolling_provisions,
        (SELECT COUNT(*) FROM loan_sol_calculations) as calculations
    `);

    console.log('📊 SOL System Summary:');
    console.log(`  - Jurisdictions: ${summary.rows[0].jurisdictions}`);
    console.log(`  - Trigger Events: ${summary.rows[0].trigger_events}`);
    console.log(`  - Tolling Provisions: ${summary.rows[0].tolling_provisions}`);
    console.log(`  - Loan Calculations: ${summary.rows[0].calculations}`);

  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  setupSOL()
    .then(() => {
      console.log('\n✅ SOL setup completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ SOL setup failed:', error);
      process.exit(1);
    });
}

export default setupSOL;