// src/backend/src/services/propertyDataPyService.ts
import axios from 'axios';
import { config } from '../config';

export interface PropertyDataPyResponse {
  success: boolean;
  count: number;
  properties: any[];
  message?: string;
}

export const enrichWithPropertyDataPy = async (address: string): Promise<PropertyDataPyResponse | null> => {
  // This service is deprecated - the collateral analysis API has been replaced with AWS Textract
  console.warn('[PropertyData-Py] This service is deprecated. Property enrichment is not available.');
  return null;
  
  // Original implementation commented out:
  /*
  if (!config.collateralAnalysisApiUrl) {
    console.error('COLLATERAL_ANALYSIS_API_URL environment variable is not set.');
    return null;
  }

  try {
    console.log(`[PropertyData-Py] Calling Python API for address: ${address}`);
    
    const response = await axios.post(`${config.collateralAnalysisApiUrl}/enrich`, {
      address: address,
      listing_type: 'for_sale', // Default to for_sale listings
      limit: 50, // Reasonable limit for property data
    }, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`[PropertyData-Py] Successfully received ${response.data.count || 0} properties`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[PropertyData-Py] API Error: ${error.response?.status} - ${error.response?.statusText}`);
      console.error(`[PropertyData-Py] Error details:`, error.response?.data);
    } else {
      console.error('[PropertyData-Py] Unexpected error:', error);
    }
    return null;
  }
  */
};