import axios from 'axios';
import { savePropertyData, PropertyData } from './propertyDataService';

/**
 * Converts a string to Title Case for better API compatibility
 * @param str The string to convert
 * @returns The string in Title Case format
 */
function toTitleCase(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/\b(\w)/g, s => s.toUpperCase());
}

/**
 * Enriches a loan with property data from RentCast API
 * @param loanId The loan identifier
 * @param address The property address to enrich
 * @returns Promise containing the enriched property data
 */
export async function enrichLoanWithRentCast(
  loanId: string,
  address: string
): Promise<PropertyData> {
  try {
    console.log(`[RentCast] Starting enrichment for loan_id: ${loanId}, address: ${address}`);
    
    // Validate API key is available
    if (!process.env.RENTCAST_API_KEY) {
      throw new Error('RENTCAST_API_KEY is not configured in environment variables');
    }
    
    // Normalize address to Title Case for better API compatibility
    const normalizedAddress = toTitleCase(address);
    console.log(`[RentCast] Normalized address: ${normalizedAddress}`);
    
    // Construct the RentCast API URL with normalized address
    const apiUrl = `https://api.rentcast.io/v1/properties/${encodeURIComponent(normalizedAddress)}`;
    
    // Set up headers with API key
    const headers = {
      'X-Api-Key': process.env.RENTCAST_API_KEY
    };
    
    console.log(`[RentCast] Making API request to: ${apiUrl}`);
    
    // Make the API request
    const response = await axios.get(apiUrl, { headers });
    
    console.log(`[RentCast] API request successful for loan_id: ${loanId}`);
    
    // Save the enriched data to database
    await savePropertyData(loanId, 'RentCast', response.data);
    
    console.log(`[RentCast] Enrichment completed for loan_id: ${loanId}`);
    
    // Return the enriched data
    return response.data;
  } catch (error) {
    console.error(`[RentCast] Enrichment failed for loan_id: ${loanId}:`, error);
    
    // Provide more specific error messages
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('RentCast API authentication failed. Please check the API key.');
      } else if (error.response?.status === 404) {
        throw new Error('Property not found in RentCast database.');
      } else if (error.response?.status === 429) {
        throw new Error('RentCast API rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`RentCast API error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }
    
    throw error;
  }
}