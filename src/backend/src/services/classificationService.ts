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