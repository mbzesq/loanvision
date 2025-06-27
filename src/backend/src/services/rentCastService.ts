import axios from 'axios';
import { savePropertyData, PropertyData } from './propertyDataService';

/**
 * Enriches a loan with property data from RentCast API
 * @param loanId The loan identifier
 * @param address The property address to enrich (should be pre-formatted)
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
    
    // Use the pre-formatted address as provided by the caller
    console.log(`[RentCast] Using formatted address: ${address}`);
    
    // Construct the RentCast API URL
    const apiUrl = `https://api.rentcast.io/v1/properties/${encodeURIComponent(address)}`;
    
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