import axios from 'axios';
import { savePropertyData, PropertyData } from './propertyDataService';
import { enrichWithPropertyDataPy } from './propertyDataPyService';
import { config } from '../config';

/**
 * Enriches a loan with property data from multiple sources (RentCast API and PropertyData Python service)
 * @param loanId The loan identifier
 * @param address The property address to enrich (should be pre-formatted)
 * @returns Promise containing the enriched property data from all sources
 */
export async function enrichLoanWithRentCast(
  loanId: string,
  address: string
): Promise<PropertyData> {
  try {
    console.log(`[RentCast] Starting enrichment for loan_id: ${loanId}, address: ${address}`);
    
    // Validate API key is available
    if (!config.rentcastApiKey) {
      throw new Error('RENTCAST_API_KEY is not configured in environment variables');
    }
    
    // Use the pre-formatted address as provided by the caller
    console.log(`[RentCast] Using formatted address: ${address}`);
    
    // Set up headers for both API calls
    const headers = {
      'X-Api-Key': config.rentcastApiKey,
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
    
    // --- START: NEW PYTHON SERVICE CALL ---
    try {
      console.log(`[Enrichment] Calling PropertyData Python service for address: ${address}`);
      const pythonApiData = await enrichWithPropertyDataPy(address);
      if (pythonApiData && pythonApiData.properties && pythonApiData.properties.length > 0) {
        // Merge the Python API data into our main data object
        console.log(`[Enrichment] Successfully received ${pythonApiData.properties.length} properties from Python service`);
        mergedData.pythonToolData = pythonApiData.properties;
        mergedData.pythonToolMeta = {
          count: pythonApiData.count,
          success: pythonApiData.success,
          message: pythonApiData.message,
        };
      } else {
        console.log(`[Enrichment] No properties returned from Python service`);
      }
    } catch (e) {
      console.error("Could not fetch data from PropertyData Python API", e);
      // Continue with RentCast data even if Python API fails
    }
    // --- END: NEW PYTHON SERVICE CALL ---
    
    // Check if we got any data at all from any source
    if (Object.keys(mergedData).length === 0) {
      throw new Error('No data could be retrieved from any enrichment source');
    }
    
    console.log(`[Enrichment] Successfully merged data from multiple sources for loan_id: ${loanId}`);
    
    // Save the merged data to database with updated source name
    await savePropertyData(loanId, 'MultiSource', mergedData);
    
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