import pool from '../db';
import fs from 'fs';
import path from 'path';

async function updateSOLCategories() {
  console.log('📊 Updating SOL categories from JSON data...\n');

  try {
    // Load the SOL data JSON
    const jsonPath = path.join(__dirname, '../../../../projects/sol-database-extracted.json');
    const solData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    let updated = 0;

    for (const [state, data] of Object.entries(solData)) {
      if (data && typeof data === 'object' && 'sol_category' in data) {
        const result = await pool.query(
          'UPDATE sol_jurisdictions SET sol_category = $1 WHERE state_code = $2',
          [(data as any).sol_category, state]
        );
        
        if (result.rowCount && result.rowCount > 0) {
          updated++;
          console.log(`✅ Updated ${state}: Category ${(data as any).sol_category}`);
        }
      }
    }

    console.log(`\n✨ Updated ${updated} jurisdictions with SOL categories`);

    // Verify the update
    const categoryCount = await pool.query(`
      SELECT sol_category, COUNT(*) as count
      FROM sol_jurisdictions
      GROUP BY sol_category
      ORDER BY sol_category
    `);

    console.log('\n📈 SOL Category Distribution:');
    categoryCount.rows.forEach(row => {
      console.log(`   ${row.sol_category || 'NULL'}: ${row.count} states`);
    });

  } catch (error) {
    console.error('❌ Error updating SOL categories:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the update
updateSOLCategories().catch(console.error);