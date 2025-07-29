// Test to demonstrate the assignment extraction issue with garbled text

const testText = `
ASSIGNMENT OF MORTGAGE

Assignor: Cypress Waters Blvd Veripro Solutions Inc Coppell and has duly executed this assignment 
on the date hereinafter written and hereby assigns to the following entity known as the

Assignee: NS194 Investment Trust

all rights, title and interest in the mortgage described herein.
`;

const testTextWithLegalBoilerplate = `
ASSIGNMENT OF MORTGAGE

The assignor known as Cypress Waters Blvd Veripro Solutions Inc Coppell, a limited liability company 
organized under the laws of Texas, has duly executed this assignment on the date hereinafter written 
and hereby assigns, transfers, and conveys to the assignee known as NS194 Investment Trust, all rights, 
titles, and interests in and to the mortgage described herein, together with all notes and other 
instruments secured thereby.
`;

// Current problematic regex pattern
const problematicPattern = /assignor[:\s]*([A-Z][A-Za-z\s&,.']*(?:LLC|L\.L\.C\.|Inc|Corp|Corporation|Trust|Company|Co\.?|MERS))[^.]*?assignee[:\s]*([A-Z][A-Za-z\s&,.']*(?:LLC|L\.L\.C\.|Inc|Corp|Corporation|Trust|Company|Co\.?))/gi;

// Test the problematic pattern
console.log('Testing problematic regex pattern:');
console.log('=====================================');

console.log('\n1. Test with normal text:');
const match1 = problematicPattern.exec(testText);
if (match1) {
  console.log('Assignor:', match1[1]);
  console.log('Assignee:', match1[2]);
} else {
  console.log('No match found');
}

console.log('\n2. Test with legal boilerplate text:');
problematicPattern.lastIndex = 0; // Reset regex
const match2 = problematicPattern.exec(testTextWithLegalBoilerplate);
if (match2) {
  console.log('Assignor:', match2[1]);
  console.log('Assignee:', match2[2]);
} else {
  console.log('No match found');
}

// Better patterns that are more conservative
const improvedPatterns = [
  // Pattern 1: Direct assignor/assignee with limited context
  /assignor[:\s]*([A-Z][A-Za-z\s&,.']*(?:LLC|L\.L\.C\.|Inc|Corp|Corporation|Trust|Company|Co\.?|MERS))[\s,]*(?:and|,|[\r\n])/gi,
  
  // Pattern 2: Look for assignee separately
  /assignee[:\s]*([A-Z][A-Za-z\s&,.']*(?:LLC|L\.L\.C\.|Inc|Corp|Corporation|Trust|Company|Co\.?))/gi
];

console.log('\n\n3. Testing improved patterns:');
console.log('=====================================');

// Test improved patterns
for (let i = 0; i < improvedPatterns.length; i++) {
  console.log(`\nPattern ${i + 1} results:`);
  
  improvedPatterns[i].lastIndex = 0;
  const matches = [];
  let match;
  
  while ((match = improvedPatterns[i].exec(testTextWithLegalBoilerplate)) !== null) {
    matches.push(match[1]);
  }
  
  console.log('Matches found:', matches);
}

// Clean company name function to remove legal noise
function cleanCompanyName(name) {
  return name
    .replace(/^\s*\*\*|\*\*\s*$/g, '') // Remove markdown bold formatting
    .replace(/\s*\([^)]+\)\s*/g, ' ') // Remove parenthetical content
    .replace(/\s*(a\s+limited\s+liability\s+company|organized\s+under|has\s+duly\s+executed|hereby\s+assigns|and\s+has\s+duly)/i, '') // Remove legal boilerplate
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('\n\n4. Testing improved text cleaning:');
console.log('=====================================');

const noisyText = "Cypress Waters Blvd Veripro Solutions Inc Coppell and has duly executed this assignment";
console.log('Original:', noisyText);
console.log('Cleaned:', cleanCompanyName(noisyText));

// Proposed solution
function extractAssignmentEntities(text) {
  const entities = {};
  
  // Look for assignor
  const assignorPatterns = [
    /(?:the\s+)?assignor[:\s]+([A-Z][A-Za-z\s&,.']*(?:LLC|L\.L\.C\.|Inc|Corp|Corporation|Trust|Company|Co\.?|MERS))(?:\s*,|\s+(?:a|an|is|has|hereby))/gi,
    /assignor[:\s]*([A-Z][A-Za-z\s&,.']*(?:LLC|L\.L\.C\.|Inc|Corp|Corporation|Trust|Company|Co\.?|MERS))/gi
  ];
  
  // Look for assignee  
  const assigneePatterns = [
    /(?:the\s+)?assignee[:\s]+([A-Z][A-Za-z\s&,.']*(?:LLC|L\.L\.C\.|Inc|Corp|Corporation|Trust|Company|Co\.?))(?:\s*,|\s+(?:a|an|is|all))/gi,
    /assignee[:\s]*([A-Z][A-Za-z\s&,.']*(?:LLC|L\.L\.C\.|Inc|Corp|Corporation|Trust|Company|Co\.?))/gi
  ];
  
  // Extract assignor
  for (const pattern of assignorPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      entities.assignor = cleanCompanyName(match[1]);
      break;
    }
  }
  
  // Extract assignee
  for (const pattern of assigneePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      entities.assignee = cleanCompanyName(match[1]);
      break;
    }
  }
  
  return entities;
}

console.log('\n\n5. Testing proposed solution:');
console.log('=====================================');

const result1 = extractAssignmentEntities(testText);
console.log('Test 1 - Normal text:');
console.log('Assignor:', result1.assignor);
console.log('Assignee:', result1.assignee);

const result2 = extractAssignmentEntities(testTextWithLegalBoilerplate);
console.log('\nTest 2 - Legal boilerplate text:');
console.log('Assignor:', result2.assignor);
console.log('Assignee:', result2.assignee);