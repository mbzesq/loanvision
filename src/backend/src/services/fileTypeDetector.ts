// File Type Detection Service
export type FileType = 'foreclosure_data' | 'daily_metrics' | 'unknown';

export interface FileTypeDetectionResult {
  fileType: FileType;
  confidence: number;
  matchedHeaders: string[];
  missingHeaders: string[];
}

// Define key headers for each file type
const FORECLOSURE_KEY_HEADERS = [
  'File Date', 'Loan ID', 'Investor ID', 'FC Status', 'FC Jurisdiction',
  'Active FC Days', 'Total FC Days', 'FC Atty POC'
];

const DAILY_METRICS_KEY_HEADERS = [
  'Loan ID', 'Investor', 'Investor Name', 'Prin Bal', 'Int Rate',
  'PI Pmt', 'Origination Date', 'Maturity Date', 'Jan-25', 'Feb-25'
];


export function detectFileType(headers: string[]): FileTypeDetectionResult {
  // Normalize headers (trim and handle case variations)
  const normalizedHeaders = headers.map(h => String(h).trim());
  
  // Check for foreclosure data file
  const foreclosureMatches = FORECLOSURE_KEY_HEADERS.filter(keyHeader =>
    normalizedHeaders.some(header => 
      header.toLowerCase() === keyHeader.toLowerCase() ||
      header.toLowerCase().includes(keyHeader.toLowerCase())
    )
  );
  
  // Check for daily metrics file
  const metricsMatches = DAILY_METRICS_KEY_HEADERS.filter(keyHeader =>
    normalizedHeaders.some(header => 
      header.toLowerCase() === keyHeader.toLowerCase() ||
      header.toLowerCase().includes(keyHeader.toLowerCase())
    )
  );
  
  // Calculate confidence scores
  const foreclosureConfidence = (foreclosureMatches.length / FORECLOSURE_KEY_HEADERS.length) * 100;
  const metricsConfidence = (metricsMatches.length / DAILY_METRICS_KEY_HEADERS.length) * 100;
  
  // Determine file type based on highest confidence (minimum 60% match required)
  if (foreclosureConfidence >= 60 && foreclosureConfidence >= metricsConfidence) {
    return {
      fileType: 'foreclosure_data',
      confidence: foreclosureConfidence,
      matchedHeaders: foreclosureMatches,
      missingHeaders: FORECLOSURE_KEY_HEADERS.filter(h => !foreclosureMatches.includes(h))
    };
  }
  
  if (metricsConfidence >= 60) {
    return {
      fileType: 'daily_metrics',
      confidence: metricsConfidence,
      matchedHeaders: metricsMatches,
      missingHeaders: DAILY_METRICS_KEY_HEADERS.filter(h => !metricsMatches.includes(h))
    };
  }
  
  // If no clear match, return unknown
  return {
    fileType: 'unknown',
    confidence: Math.max(foreclosureConfidence, metricsConfidence),
    matchedHeaders: [],
    missingHeaders: []
  };
}