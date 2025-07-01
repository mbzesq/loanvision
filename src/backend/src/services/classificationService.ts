// src/backend/src/services/classificationService.ts

export const classifyDocumentText = (text: string): string => {
  const textUpper = text.toUpperCase();

  // Use the same prioritized rules we designed for the Python script
  
  // 1. Note (most specific)
  if (textUpper.includes("NOTE") && textUpper.includes("PROMISE TO PAY")) {
    return "Note";
  }
  
  // 2. Allonge (highly specific)
  if (textUpper.includes("ALLONGE")) {
    return "Allonge";
  }
  
  // 3. Assignment (must be more specific than just "assignment")
  if (textUpper.includes("ASSIGNMENT OF MORTGAGE") || textUpper.includes("ASSIGNMENT OF DEED OF TRUST")) {
    return "Assignment";
  }
  
  // 4. Mortgage (check for "THIS MORTGAGE" to avoid confusion with references)
  if (textUpper.includes("MORTGAGE") && textUpper.includes("THIS MORTGAGE")) {
    return "Mortgage";
  }
  
  // 5. Deed of Trust (check for "THIS DEED OF TRUST")
  if (textUpper.includes("DEED OF TRUST") && textUpper.includes("THIS DEED OF TRUST")) {
    return "Deed of Trust";
  }
  
  // 6. Rider (check for specific types)
  if (textUpper.includes("RIDER") && (
    textUpper.includes("ADJUSTABLE RATE") ||
    textUpper.includes("CONDOMINIUM") ||
    textUpper.includes("PLANNED UNIT DEVELOPMENT") ||
    textUpper.includes("BALLOON")
  )) {
    return "Rider";
  }
  
  // 7. Bailee Letter
  if (textUpper.includes("BAILEE LETTER") || 
      (textUpper.includes("BAILEE") && textUpper.includes("CUSTODIAN"))) {
    return "Bailee Letter";
  }
  
  // 8. Default to UNLABELED
  return "UNLABELED";
};

/**
 * Extracts borrower name from document text using multiple patterns
 * @param text - The document text to search
 * @returns The borrower name if found, null otherwise
 */
export const extractBorrowerName = (text: string): string | null => {
  // Look for common patterns of borrower names in mortgage documents
  const patterns = [
    // Pattern: "Borrower: Name" or "Borrower(s): Name"
    /(?:borrower\s*(?:\(s\))?\s*:\s*)([a-z\s,.-]+?)(?:\n|$|and|&)/i,
    // Pattern: Name after "executed by" or "signed by"
    /(?:executed by|signed by)\s+([a-z\s,.-]+?)(?:\n|$|,)/i,
    // Pattern: Name before "borrower" (reverse pattern)
    /([a-z\s,.-]+?)\s+(?:as\s+)?borrower/i,
    // Pattern: Name in signature lines or similar contexts
    /(?:^|\n)\s*([a-z\s,.-]{3,50}?)\s*(?:borrower|mortgagor)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Basic validation: should contain at least first and last name
      if (name.split(/\s+/).length >= 2 && name.length > 3) {
        return name;
      }
    }
  }

  return null;
};

/**
 * Extracts property address from document text using multiple patterns
 * @param text - The document text to search
 * @returns The property address if found, null otherwise
 */
export const extractPropertyAddress = (text: string): string | null => {
  // Look for common patterns of property addresses in mortgage documents
  const patterns = [
    // Pattern: "Property Address:" followed by address
    /(?:property\s+address\s*:\s*)([^\n]+?)(?:\n|$)/i,
    // Pattern: Address after "located at" or "situated at"
    /(?:located at|situated at)\s+([^\n]+?)(?:\n|$|,)/i,
    // Pattern: Address in legal descriptions
    /(?:property\s+(?:known as|described as))\s+([^\n]+?)(?:\n|$)/i,
    // Pattern: Street address format (number + street + city, state zip)
    /(\d+\s+[a-z\s,.-]+?(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|circle|cir|court|ct|boulevard|blvd)[^\n]*(?:city|town)[^\n]*(?:state|st)[^\n]*\d{5})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const address = match[1].trim();
      // Basic validation: should be reasonable length and contain some typical address components
      if (address.length > 10 && address.length < 200) {
        return address;
      }
    }
  }

  return null;
};