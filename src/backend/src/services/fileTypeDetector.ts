// File Type Detection Service
export type FileType = 'loan_portfolio' | 'foreclosure_data' | 'daily_metrics' | 'unknown';

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

const LOAN_PORTFOLIO_KEY_HEADERS = [
  'Loan ID', 'First Name', 'Last Name', 'Address', 'City', 'State',
  'Prin Bal', 'Legal Status', 'Investor Name'
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
  
  // Check for standard loan portfolio file
  const loanMatches = LOAN_PORTFOLIO_KEY_HEADERS.filter(keyHeader =>
    normalizedHeaders.some(header => 
      header.toLowerCase() === keyHeader.toLowerCase() ||
      header.toLowerCase().includes(keyHeader.toLowerCase())
    )
  );
  
  // Calculate confidence scores
  const foreclosureConfidence = (foreclosureMatches.length / FORECLOSURE_KEY_HEADERS.length) * 100;
  const metricsConfidence = (metricsMatches.length / DAILY_METRICS_KEY_HEADERS.length) * 100;
  const loanConfidence = (loanMatches.length / LOAN_PORTFOLIO_KEY_HEADERS.length) * 100;
  
  // Determine the best match, prioritizing the most specific formats
  const confidences = [
    { type: 'foreclosure_data', score: foreclosureConfidence },
    { type: 'daily_metrics', score: metricsConfidence },
    { type: 'loan_portfolio', score: loanConfidence },
  ];

  // Sort by confidence score, descending
  confidences.sort((a, b) => b.score - a.score);

  // Find the first type that meets the minimum confidence threshold
  const bestMatch = confidences.find(c => c.score >= 60);

  if (bestMatch) {
    let matchedHeaders: string[] = [];
    let missingHeaders: string[] = [];

    switch (bestMatch.type) {
      case 'foreclosure_data':
        matchedHeaders = foreclosureMatches;
        missingHeaders = FORECLOSURE_KEY_HEADERS.filter(h => !foreclosureMatches.includes(h));
        break;
      case 'daily_metrics':
        matchedHeaders = metricsMatches;
        missingHeaders = DAILY_METRICS_KEY_HEADERS.filter(h => !metricsMatches.includes(h));
        break;
      case 'loan_portfolio':
        matchedHeaders = loanMatches;
        missingHeaders = LOAN_PORTFOLIO_KEY_HEADERS.filter(h => !loanMatches.includes(h));
        break;
    }

    return {
      fileType: bestMatch.type as FileType,
      confidence: bestMatch.score,
      matchedHeaders: matchedHeaders,
      missingHeaders: missingHeaders,
    };
  }

  // If no clear match, return unknown
  return {
    fileType: 'unknown',
    confidence: confidences[0]?.score || 0, // Highest score even if below threshold
    matchedHeaders: [],
    missingHeaders: [],
  };
}