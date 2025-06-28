import { spawn } from 'child_process';
import path from 'path';
import { savePropertyData, PropertyData } from './propertyDataService';

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

