import pool from '../db';

export interface PropertyData {
  [key: string]: any;
}

/**
 * Saves property data to both current and history tables within a transaction
 * @param loan_id The loan identifier
 * @param source The data source (e.g., "HomeHarvest_Zillow", "RentCast")
 * @param data The property data JSON object
 */
export async function savePropertyData(
  loan_id: string,
  source: string,
  data: PropertyData
): Promise<void> {
  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    // 1. Insert into history table (immutable record)
    const historyQuery = `
      INSERT INTO property_data_history (
        loan_id,
        source,
        property_data,
        enrichment_date
      ) VALUES ($1, $2, $3, NOW())
    `;
    
    await client.query(historyQuery, [loan_id, source, JSON.stringify(data)]);

    // 2. Upsert into current table (latest state)
    const currentQuery = `
      INSERT INTO property_data_current (
        loan_id,
        source,
        property_data,
        last_updated
      ) VALUES ($1, $2, $3, NOW())
      ON CONFLICT (loan_id) DO UPDATE SET
        source = EXCLUDED.source,
        property_data = EXCLUDED.property_data,
        last_updated = NOW()
    `;
    
    await client.query(currentQuery, [loan_id, source, JSON.stringify(data)]);

    // Commit transaction
    await client.query('COMMIT');
    
    console.log(`[PropertyDataService] Successfully saved property data for loan_id: ${loan_id} from source: ${source}`);
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('[PropertyDataService] Error saving property data:', error);
    throw error;
  } finally {
    // Release the client back to the pool
    client.release();
  }
}

/**
 * Retrieves the current property data for a loan
 * @param loan_id The loan identifier
 * @returns The current property data or null if not found
 */
export async function getCurrentPropertyData(loan_id: string): Promise<PropertyData | null> {
  const query = `
    SELECT property_data
    FROM property_data_current
    WHERE loan_id = $1
  `;
  
  const result = await pool.query(query, [loan_id]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0].property_data;
}

/**
 * Retrieves the property data history for a loan
 * @param loan_id The loan identifier
 * @returns Array of historical property data entries
 */
export async function getPropertyDataHistory(loan_id: string): Promise<Array<{
  enrichment_date: Date;
  source: string;
  property_data: PropertyData;
}>> {
  const query = `
    SELECT enrichment_date, source, property_data
    FROM property_data_history
    WHERE loan_id = $1
    ORDER BY enrichment_date DESC
  `;
  
  const result = await pool.query(query, [loan_id]);
  
  return result.rows;
}