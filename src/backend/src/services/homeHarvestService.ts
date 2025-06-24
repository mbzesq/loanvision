import { spawn } from 'child_process';
import pool from '../db';
import path from 'path';

interface PropertyData {
  [key: string]: any;
}

/**
 * Invokes the HomeHarvest Python script to fetch property data
 * @param address The property address to search for
 * @returns Promise containing the property data JSON
 */
export async function invokeHomeHarvest(address: string): Promise<PropertyData> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../vendor/homeharvest/homeharvest/cli.py');
    
    // Spawn the Python process
    const pythonProcess = spawn('python3', [
      scriptPath,
      'sale',
      '--location', address,
      '--site_name', 'zillow',
      '--listing_type', 'for_sale',
      '--output', 'json'
    ]);

    let stdout = '';
    let stderr = '';

    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`HomeHarvest script exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Parse the JSON output
        const propertyData = JSON.parse(stdout);
        resolve(propertyData);
      } catch (error) {
        reject(new Error(`Failed to parse HomeHarvest output: ${error}`));
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to spawn HomeHarvest process: ${error}`));
    });
  });
}

/**
 * Saves property data to both current and history tables within a transaction
 * @param loan_id The loan identifier
 * @param source The data source (e.g., "HomeHarvest_Zillow")
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
    
    console.log(`[HomeHarvest] Successfully saved property data for loan_id: ${loan_id}`);
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('[HomeHarvest] Error saving property data:', error);
    throw error;
  } finally {
    // Release the client back to the pool
    client.release();
  }
}

/**
 * Enriches a loan with property data from HomeHarvest
 * @param loan_id The loan identifier
 * @param address The property address
 * @returns Promise indicating completion
 */
export async function enrichLoanWithPropertyData(
  loan_id: string,
  address: string
): Promise<void> {
  try {
    console.log(`[HomeHarvest] Starting enrichment for loan_id: ${loan_id}, address: ${address}`);
    
    // Fetch property data from HomeHarvest
    const propertyData = await invokeHomeHarvest(address);
    
    // Save to database with source identifier
    await savePropertyData(loan_id, 'HomeHarvest_Zillow', propertyData);
    
    console.log(`[HomeHarvest] Enrichment completed for loan_id: ${loan_id}`);
  } catch (error) {
    console.error(`[HomeHarvest] Enrichment failed for loan_id: ${loan_id}:`, error);
    throw error;
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