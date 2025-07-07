#!/usr/bin/env ts-node

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'nplvision'
});

interface SOLJurisdictionData {
  state_code: string;
  state_name: string;
  foreclosure_types: string[];
  sol_periods: {
    lien_years?: number;
    note_years?: number;
    foreclosure_years?: number;
    deficiency_years?: number;
    additional_periods?: Record<string, number>;
  };
  trigger_events: string[];
  tolling_provisions: string[];
  revival_methods: {
    partial_payment?: boolean;
    written_acknowledgment?: boolean;
    new_promise?: boolean;
    other?: string[];
  };
  effect_of_expiration: {
    lien_extinguished?: boolean;
    foreclosure_barred?: boolean;
    deficiency_barred?: boolean;
    becomes_unsecured?: boolean;
    special_effects?: string[];
  };
  special_provisions: string[];
  statute_citations: string[];
  key_cases: string[];
  notes: string[];
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  last_updated: string;
}

interface SOLDatabase {
  metadata: {
    document_title: string;
    extraction_date: string;
    total_jurisdictions: number;
    version: string;
    extraction_notes: string;
  };
  jurisdictions: Record<string, SOLJurisdictionData>;
}

async function importSOLData() {
  console.log('🚀 Starting SOL jurisdiction data import...');
  
  try {
    // Read the SOL data file
    const dataPath = join(__dirname, '../../../../projects/sol-database-extracted.json');
    const solDataRaw = readFileSync(dataPath, 'utf8');
    const solData: SOLDatabase = JSON.parse(solDataRaw);
    
    console.log(`📂 Loaded SOL data: ${solData.metadata.total_jurisdictions} jurisdictions`);
    
    let importedCount = 0;
    let errorCount = 0;
    
    // Import each jurisdiction
    for (const [stateCode, jurisdiction] of Object.entries(solData.jurisdictions)) {
      try {
        console.log(`📍 Importing ${stateCode} - ${jurisdiction.state_name}...`);
        
        // Insert jurisdiction
        const jurisdictionResult = await pool.query(`
          INSERT INTO sol_jurisdictions (
            state_code, state_name, lien_years, note_years, foreclosure_years,
            lien_extinguished, foreclosure_barred, risk_level
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (state_code) DO UPDATE SET
            state_name = EXCLUDED.state_name,
            lien_years = EXCLUDED.lien_years,
            note_years = EXCLUDED.note_years,
            foreclosure_years = EXCLUDED.foreclosure_years,
            lien_extinguished = EXCLUDED.lien_extinguished,
            foreclosure_barred = EXCLUDED.foreclosure_barred,
            risk_level = EXCLUDED.risk_level,
            updated_at = NOW()
          RETURNING id
        `, [
          jurisdiction.state_code,
          jurisdiction.state_name,
          jurisdiction.sol_periods.lien_years || null,
          jurisdiction.sol_periods.note_years || null,
          jurisdiction.sol_periods.foreclosure_years || null,
          jurisdiction.effect_of_expiration.lien_extinguished || false,
          jurisdiction.effect_of_expiration.foreclosure_barred || false,
          jurisdiction.risk_level
        ]);
        
        const jurisdictionId = jurisdictionResult.rows[0].id;
        
        // Import time periods
        if (jurisdiction.sol_periods.lien_years) {
          await pool.query(`
            INSERT INTO sol_time_periods (jurisdiction_id, period_type, years, description)
            VALUES ($1, 'lien', $2, 'Statute of limitations for liens')
            ON CONFLICT DO NOTHING
          `, [jurisdictionId, jurisdiction.sol_periods.lien_years]);
        }
        
        if (jurisdiction.sol_periods.note_years) {
          await pool.query(`
            INSERT INTO sol_time_periods (jurisdiction_id, period_type, years, description)
            VALUES ($1, 'note', $2, 'Statute of limitations for promissory notes')
            ON CONFLICT DO NOTHING
          `, [jurisdictionId, jurisdiction.sol_periods.note_years]);
        }
        
        if (jurisdiction.sol_periods.foreclosure_years) {
          await pool.query(`
            INSERT INTO sol_time_periods (jurisdiction_id, period_type, years, description)
            VALUES ($1, 'foreclosure', $2, 'Statute of limitations for foreclosure actions')
            ON CONFLICT DO NOTHING
          `, [jurisdictionId, jurisdiction.sol_periods.foreclosure_years]);
        }
        
        // Import trigger events
        for (const event of jurisdiction.trigger_events) {
          await pool.query(`
            INSERT INTO sol_trigger_events (jurisdiction_id, event_type, description, priority)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING
          `, [jurisdictionId, event, `Trigger event: ${event}`, getEventPriority(event)]);
        }
        
        // Import tolling provisions
        for (const provision of jurisdiction.tolling_provisions) {
          await pool.query(`
            INSERT INTO sol_tolling_provisions (jurisdiction_id, provision_name, description)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `, [jurisdictionId, provision, `Tolling provision: ${provision}`]);
        }
        
        // Import statute citations
        for (const citation of jurisdiction.statute_citations) {
          await pool.query(`
            INSERT INTO sol_statute_citations (jurisdiction_id, statute_code, title)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `, [jurisdictionId, citation, citation]);
        }
        
        // Import key cases
        for (const keyCase of jurisdiction.key_cases) {
          await pool.query(`
            INSERT INTO sol_key_cases (jurisdiction_id, case_name, summary)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `, [jurisdictionId, keyCase, keyCase]);
        }
        
        // Import research notes
        for (const note of jurisdiction.notes) {
          await pool.query(`
            INSERT INTO sol_research_notes (jurisdiction_id, note_type, content)
            VALUES ($1, 'research', $2)
            ON CONFLICT DO NOTHING
          `, [jurisdictionId, note]);
        }
        
        importedCount++;
        console.log(`  ✅ ${stateCode} imported successfully`);
        
      } catch (error) {
        console.error(`  ❌ Failed to import ${stateCode}:`, error);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 SOL data import completed!`);
    console.log(`  ✅ Successfully imported: ${importedCount} jurisdictions`);
    console.log(`  ❌ Errors: ${errorCount} jurisdictions`);
    
    // Verification query
    const verificationResult = await pool.query(`
      SELECT 
        COUNT(*) as jurisdiction_count,
        COUNT(CASE WHEN lien_years IS NOT NULL THEN 1 END) as with_lien_years,
        COUNT(CASE WHEN note_years IS NOT NULL THEN 1 END) as with_note_years,
        COUNT(CASE WHEN foreclosure_years IS NOT NULL THEN 1 END) as with_foreclosure_years
      FROM sol_jurisdictions
    `);
    
    const verification = verificationResult.rows[0];
    console.log(`\n📊 Database verification:`);
    console.log(`  - Total jurisdictions: ${verification.jurisdiction_count}`);
    console.log(`  - With lien years: ${verification.with_lien_years}`);
    console.log(`  - With note years: ${verification.with_note_years}`);
    console.log(`  - With foreclosure years: ${verification.with_foreclosure_years}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Helper function to assign priority to trigger events
function getEventPriority(eventType: string): number {
  const priorities: Record<string, number> = {
    'acceleration_date': 1,
    'default_date': 2,
    'last_payment_date': 3,
    'maturity_date': 4,
    'charge_off_date': 5
  };
  
  return priorities[eventType] || 10;
}

// Run if called directly
if (require.main === module) {
  importSOLData()
    .then(() => {
      console.log('🎉 SOL data import script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Import script failed:', error);
      process.exit(1);
    });
}

export { importSOLData };