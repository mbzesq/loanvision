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
    
    // Set up headers for both API calls
    const headers = {
      'X-Api-Key': process.env.RENTCAST_API_KEY,
    };
    
    const params = {
      address: address
    };
    
    // Initialize merged data object
    let mergedData: any = {};
    
    console.log(`[RentCast] Making API calls to both AVM and Properties endpoints`);
    
    // Call 1: Get valuation data from AVM endpoint
    try {
      console.log(`[RentCast] Calling AVM endpoint: https://api.rentcast.io/v1/avm/value`);
      const valuationResponse = await axios.get(
        'https://api.rentcast.io/v1/avm/value',
        { params, headers }
      );
      console.log(`[RentCast] AVM endpoint successful for loan_id: ${loanId}`);
      mergedData = { ...mergedData, ...valuationResponse.data };
    } catch (error) {
      console.error(`[RentCast] Could not fetch AVM data for loan_id: ${loanId}:`, error);
      // Continue with properties call even if AVM fails
    }
    
    // Call 2: Get property record data from Properties endpoint
    try {
      console.log(`[RentCast] Calling Properties endpoint: https://api.rentcast.io/v1/properties`);
      const propertyResponse = await axios.get(
        'https://api.rentcast.io/v1/properties',
        { params, headers }
      );
      console.log(`[RentCast] Properties endpoint successful for loan_id: ${loanId}`);
      
      // The property response is an array, take the first result
      if (propertyResponse.data && propertyResponse.data.length > 0) {
        mergedData = { ...mergedData, ...propertyResponse.data[0] };
      }
    } catch (error) {
      console.error(`[RentCast] Could not fetch Property record for loan_id: ${loanId}:`, error);
      // Continue with whatever data we have
    }
    
    // Check if we got any data at all
    if (Object.keys(mergedData).length === 0) {
      throw new Error('No data could be retrieved from either RentCast endpoint');
    }
    
    console.log(`[RentCast] Successfully merged data from both endpoints for loan_id: ${loanId}`);
    
    // Save the merged data to database
    await savePropertyData(loanId, 'RentCast', mergedData);
    
    console.log(`[RentCast] Enrichment completed for loan_id: ${loanId}`);
    
    // Return the merged data
    return mergedData;
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