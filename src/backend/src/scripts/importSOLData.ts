import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface SOLDatabase {
  metadata: {
    document_title: string;
    extraction_date: string;
    total_jurisdictions: number;
    version: string;
  };
  jurisdictions: Record<string, any>;
}

class SOLDataImporter {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost/nplvision',
      ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com') 
        ? { rejectUnauthorized: false }
        : false
    });
  }

  async importData(jsonFilePath: string) {
    console.log('📚 Starting SOL data import...');
    
    try {
      // Load JSON data
      const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
      const solData: SOLDatabase = JSON.parse(jsonData);
      
      console.log(`Found ${Object.keys(solData.jurisdictions).length} jurisdictions to import`);
      
      // Begin transaction
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        
        // Clear existing data
        await this.clearExistingData(client);
        
        // Import each jurisdiction
        let importedCount = 0;
        for (const [stateCode, jurisdiction] of Object.entries(solData.jurisdictions)) {
          await this.importJurisdiction(client, stateCode, jurisdiction);
          importedCount++;
          
          if (importedCount % 10 === 0) {
            console.log(`  Imported ${importedCount} jurisdictions...`);
          }
        }
        
        await client.query('COMMIT');
        console.log(`✅ Successfully imported ${importedCount} jurisdictions`);
        
        // Display summary
        await this.displaySummary();
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  }

  private async clearExistingData(client: any) {
    console.log('🧹 Clearing existing SOL data...');
    
    const tables = [
      'loan_sol_calculations',
      'sol_notes',
      'sol_key_cases',
      'sol_statute_citations',
      'sol_special_provisions',
      'sol_expiration_effects',
      'sol_revival_methods',
      'sol_tolling_provisions',
      'sol_trigger_events',
      'sol_periods',
      'sol_jurisdictions'
    ];
    
    for (const table of tables) {
      await client.query(`DELETE FROM ${table}`);
    }
  }

  private async importJurisdiction(client: any, stateCode: string, jurisdiction: any) {
    // Insert jurisdiction
    const jurisdictionResult = await client.query(
      `INSERT INTO sol_jurisdictions (state_code, state_name, foreclosure_types, risk_level, last_updated)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        stateCode,
        jurisdiction.state_name,
        jurisdiction.foreclosure_types || [],
        jurisdiction.risk_level || 'MEDIUM',
        jurisdiction.last_updated || new Date().toISOString().split('T')[0]
      ]
    );
    
    const jurisdictionId = jurisdictionResult.rows[0].id;
    
    // Insert SOL periods
    if (jurisdiction.sol_periods) {
      await client.query(
        `INSERT INTO sol_periods (jurisdiction_id, lien_years, note_years, foreclosure_years, deficiency_years, additional_periods)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          jurisdictionId,
          jurisdiction.sol_periods.lien_years || null,
          jurisdiction.sol_periods.note_years || null,
          jurisdiction.sol_periods.foreclosure_years || null,
          jurisdiction.sol_periods.deficiency_years || null,
          jurisdiction.sol_periods.additional_periods ? JSON.stringify(jurisdiction.sol_periods.additional_periods) : null
        ]
      );
    }
    
    // Insert trigger events
    if (jurisdiction.trigger_events && Array.isArray(jurisdiction.trigger_events)) {
      for (const event of jurisdiction.trigger_events) {
        await client.query(
          `INSERT INTO sol_trigger_events (jurisdiction_id, event_type)
           VALUES ($1, $2)`,
          [jurisdictionId, event]
        );
      }
    }
    
    // Insert tolling provisions
    if (jurisdiction.tolling_provisions && Array.isArray(jurisdiction.tolling_provisions)) {
      for (const provision of jurisdiction.tolling_provisions) {
        await client.query(
          `INSERT INTO sol_tolling_provisions (jurisdiction_id, provision_type)
           VALUES ($1, $2)`,
          [jurisdictionId, provision]
        );
      }
    }
    
    // Insert revival methods
    if (jurisdiction.revival_methods) {
      await client.query(
        `INSERT INTO sol_revival_methods (jurisdiction_id, partial_payment, written_acknowledgment, new_promise, other_methods)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          jurisdictionId,
          jurisdiction.revival_methods.partial_payment || false,
          jurisdiction.revival_methods.written_acknowledgment || false,
          jurisdiction.revival_methods.new_promise || false,
          jurisdiction.revival_methods.other || []
        ]
      );
    }
    
    // Insert expiration effects
    if (jurisdiction.effect_of_expiration) {
      await client.query(
        `INSERT INTO sol_expiration_effects (jurisdiction_id, lien_extinguished, foreclosure_barred, deficiency_barred, becomes_unsecured, special_effects)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          jurisdictionId,
          jurisdiction.effect_of_expiration.lien_extinguished || false,
          jurisdiction.effect_of_expiration.foreclosure_barred || false,
          jurisdiction.effect_of_expiration.deficiency_barred || false,
          jurisdiction.effect_of_expiration.becomes_unsecured || false,
          jurisdiction.effect_of_expiration.special_effects || []
        ]
      );
    }
    
    // Insert special provisions
    if (jurisdiction.special_provisions && Array.isArray(jurisdiction.special_provisions)) {
      for (const provision of jurisdiction.special_provisions) {
        await client.query(
          `INSERT INTO sol_special_provisions (jurisdiction_id, provision)
           VALUES ($1, $2)`,
          [jurisdictionId, provision]
        );
      }
    }
    
    // Insert statute citations
    if (jurisdiction.statute_citations && Array.isArray(jurisdiction.statute_citations)) {
      for (const citation of jurisdiction.statute_citations) {
        await client.query(
          `INSERT INTO sol_statute_citations (jurisdiction_id, citation)
           VALUES ($1, $2)`,
          [jurisdictionId, citation]
        );
      }
    }
    
    // Insert key cases
    if (jurisdiction.key_cases && Array.isArray(jurisdiction.key_cases)) {
      for (const caseRef of jurisdiction.key_cases) {
        // Extract year from case citation if possible
        const yearMatch = caseRef.match(/\b(19|20)\d{2}\b/);
        const caseYear = yearMatch ? parseInt(yearMatch[0]) : null;
        
        await client.query(
          `INSERT INTO sol_key_cases (jurisdiction_id, case_citation, case_year)
           VALUES ($1, $2, $3)`,
          [jurisdictionId, caseRef, caseYear]
        );
      }
    }
    
    // Insert notes
    if (jurisdiction.notes && Array.isArray(jurisdiction.notes)) {
      for (const note of jurisdiction.notes) {
        await client.query(
          `INSERT INTO sol_notes (jurisdiction_id, note)
           VALUES ($1, $2)`,
          [jurisdictionId, note]
        );
      }
    }
  }

  private async displaySummary() {
    console.log('\n📊 Import Summary:');
    
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT sj.id) as total_jurisdictions,
        COUNT(DISTINCT CASE WHEN sj.risk_level = 'HIGH' THEN sj.id END) as high_risk,
        COUNT(DISTINCT CASE WHEN sj.risk_level = 'MEDIUM' THEN sj.id END) as medium_risk,
        COUNT(DISTINCT CASE WHEN sj.risk_level = 'LOW' THEN sj.id END) as low_risk,
        COUNT(DISTINCT ste.id) as total_trigger_events,
        COUNT(DISTINCT stp.id) as total_tolling_provisions
      FROM sol_jurisdictions sj
      LEFT JOIN sol_trigger_events ste ON ste.jurisdiction_id = sj.id
      LEFT JOIN sol_tolling_provisions stp ON stp.jurisdiction_id = sj.id
    `;
    
    const result = await this.pool.query(summaryQuery);
    const summary = result.rows[0];
    
    console.log(`Total jurisdictions: ${summary.total_jurisdictions}`);
    console.log(`  - High risk: ${summary.high_risk}`);
    console.log(`  - Medium risk: ${summary.medium_risk}`);
    console.log(`  - Low risk: ${summary.low_risk}`);
    console.log(`Total trigger events: ${summary.total_trigger_events}`);
    console.log(`Total tolling provisions: ${summary.total_tolling_provisions}`);
    
    // Show some high-risk states
    const highRiskQuery = `
      SELECT state_code, state_name, sp.foreclosure_years, see.lien_extinguished
      FROM sol_jurisdictions sj
      JOIN sol_periods sp ON sp.jurisdiction_id = sj.id
      JOIN sol_expiration_effects see ON see.jurisdiction_id = sj.id
      WHERE sj.risk_level = 'HIGH'
      ORDER BY sp.foreclosure_years ASC NULLS LAST
      LIMIT 5
    `;
    
    const highRiskResult = await this.pool.query(highRiskQuery);
    console.log('\n⚠️  Top 5 highest risk jurisdictions:');
    highRiskResult.rows.forEach(row => {
      console.log(`  ${row.state_name} (${row.state_code}): ${row.foreclosure_years || 'N/A'} years, Lien extinguished: ${row.lien_extinguished ? 'Yes' : 'No'}`);
    });
  }

  async close() {
    await this.pool.end();
  }
}

// Run the import
if (require.main === module) {
  const importer = new SOLDataImporter();
  const jsonFilePath = process.env.SOL_JSON_PATH || '/tmp/nplvision/projects/sol-database-extracted.json';
  
  importer.importData(jsonFilePath)
    .then(() => {
      console.log('\n✅ SOL data import completed successfully!');
      return importer.close();
    })
    .catch(error => {
      console.error('❌ Import failed:', error);
      process.exit(1);
    });
}

export default SOLDataImporter;