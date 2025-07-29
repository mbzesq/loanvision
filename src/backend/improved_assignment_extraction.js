// Improved assignment extraction that avoids legal boilerplate

const testDocument = `
ASSIGNMENT OF MORTGAGE

Assignor: Cypress Waters Blvd
Assignee: Veripro Solutions Inc

This assignment is executed on the date set forth below.

The assignor, being the present holder of a certain mortgage...
`;

const testDocumentWithBoilerplate = `
ASSIGNMENT OF MORTGAGE

The assignor known as Cypress Waters Blvd, a limited liability company, and has duly executed 
this assignment on the date hereinafter written and hereby assigns to the assignee known as 
Veripro Solutions Inc all right, title and interest in the mortgage described herein.
`;

const testDocumentMixed = `
ASSIGNMENT OF MORTGAGE

**Assignor:** Cypress Waters Blvd
**Assignee:** Veripro Solutions Inc Coppell

Missing link between Cypress Waters Blvd Veripro Solutions Inc Coppell and has duly executed 
this assignment for good and valuable consideration...
`;

// Improved extraction function
function extractAssignmentEntities(text) {
  const entities = { assignor: null, assignee: null };
  
  // Enhanced text cleaning function
  function cleanCompanyName(name) {
    if (!name) return null;
    
    return name
      .replace(/^\s*\*\*|\*\*\s*$/g, '') // Remove markdown bold
      .replace(/\s*\([^)]+\)\s*/g, ' ') // Remove parenthetical content
      // Remove common legal boilerplate phrases
      .replace(/\s*(a\s+limited\s+liability\s+company|LLC|L\.L\.C\.|Inc\.?|Corp\.?|Corporation|Company|Co\.?|Trust)\s*/gi, ' $1 ')
      .replace(/\s*(known\s+as|being\s+the|hereby\s+assigns?|has\s+duly\s+executed|and\s+has\s+duly|on\s+the\s+date|hereinafter\s+written)/gi, '')
      .replace(/\s*(missing\s+link\s+between|duly\s+executed\s+this\s+assignment)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // Enhanced patterns for assignor extraction
  const assignorPatterns = [
    // Simple colon format with markdown
    /\*\*assignor:\*\*\s*([A-Z][A-Za-z\s&]+?)(?=\s*[\n\r]|\*\*|$)/gi,
    
    // Simple colon format
    /assignor:\s*([A-Z][A-Za-z\s&]+?)(?=\s*[\n\r]|assignee|$)/gi,
    
    // Structured format with stops at common legal phrases
    /(?:the\s+)?assignor[:\s]+([A-Z][A-Za-z\s&]+?)(?=\s*,?\s*(?:a\s+limited|LLC|Inc|Corp|hereby|known\s+as|and\s+has|being\s+the))/gi,
    
    // Fallback: capture up to first meaningful stop
    /assignor[:\s]*([A-Z][A-Za-z\s&]+?)(?=\s*(?:,|and|hereby|known|being|\n))/gi
  ];
  
  // Enhanced patterns for assignee extraction  
  const assigneePatterns = [
    // Simple colon format with markdown
    /\*\*assignee:\*\*\s*([A-Z][A-Za-z\s&]+?)(?=\s*[\n\r]|\*\*|$)/gi,
    
    // Simple colon format
    /assignee:\s*([A-Z][A-Za-z\s&]+?)(?=\s*[\n\r]|all\s+right|$)/gi,
    
    // After "assigns to" language
    /assigns?\s+to\s+(?:the\s+)?assignee[:\s]*([A-Z][A-Za-z\s&]+?)(?=\s*(?:all\s+right|,|\n))/gi,
    
    // Fallback
    /assignee[:\s]*([A-Z][A-Za-z\s&]+?)(?=\s*(?:all|,|\n|$))/gi
  ];
  
  // Extract assignor
  for (const pattern of assignorPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      const cleaned = cleanCompanyName(match[1]);
      if (cleaned && cleaned.length > 2 && cleaned.length < 100) {
        entities.assignor = cleaned;
        console.log(`Found assignor with pattern: ${pattern.source.substring(0, 30)}...`);
        console.log(`Raw match: "${match[1]}"`);
        console.log(`Cleaned: "${cleaned}"`);
        break;
      }
    }
  }
  
  // Extract assignee
  for (const pattern of assigneePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match && match[1]) {
      const cleaned = cleanCompanyName(match[1]);
      if (cleaned && cleaned.length > 2 && cleaned.length < 100) {
        entities.assignee = cleaned;
        console.log(`Found assignee with pattern: ${pattern.source.substring(0, 30)}...`);
        console.log(`Raw match: "${match[1]}"`);
        console.log(`Cleaned: "${cleaned}"`);
        break;
      }
    }
  }
  
  return entities;
}

// Test the improved extraction
console.log('=== Testing Improved Assignment Extraction ===\n');

console.log('1. Clean document:');
const result1 = extractAssignmentEntities(testDocument);
console.log('Result:', result1);
console.log();

console.log('2. Document with boilerplate:');
const result2 = extractAssignmentEntities(testDocumentWithBoilerplate);
console.log('Result:', result2);
console.log();

console.log('3. Mixed document with garbled text:');
const result3 = extractAssignmentEntities(testDocumentMixed);
console.log('Result:', result3);
console.log();

// Test with the actual problematic text you mentioned
const problematicText = `
ASSIGNMENT OF MORTGAGE

Missing link between Cypress Waters Blvd Veripro Solutions Inc Coppell and has duly executed 
this assignment on the date hereinafter written and hereby assigns to the assignee known as 
NS194 Investment Trust all right, title and interest in the mortgage described herein.
`;

console.log('4. Problematic text from user report:');
const result4 = extractAssignmentEntities(problematicText);
console.log('Result:', result4);

// Also test a cleaned version of the text to show what should be captured
const cleanedProblematicText = `
ASSIGNMENT OF MORTGAGE

Assignor: Cypress Waters Blvd  
Assignee: Veripro Solutions Inc

The assignor hereby assigns to the assignee all right, title and interest in the mortgage.
`;

console.log('\n5. Same content but properly formatted:');
const result5 = extractAssignmentEntities(cleanedProblematicText);
console.log('Result:', result5);