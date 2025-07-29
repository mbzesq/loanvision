const { MarkdownFieldExtractor } = require('./dist/extraction/markdownFieldExtractor');

// Test the improved extraction with problematic text
const problematicText = `
ASSIGNMENT OF MORTGAGE

Missing link between Cypress Waters Blvd Veripro Solutions Inc Coppell and has duly executed 
this assignment on the date hereinafter written and hereby assigns to the assignee known as 
Veripro Solutions Inc all right, title and interest in the mortgage described herein.
`;

const cleanStructuredText = `
ASSIGNMENT OF MORTGAGE

**Assignor:** Cypress Waters Blvd  
**Assignee:** Veripro Solutions Inc

This assignment is executed on the date set forth below.
`;

const mixedText = `
ASSIGNMENT OF MORTGAGE

Assignor: Cypress Waters Blvd and has duly executed this assignment

Assignee: Veripro Solutions Inc Coppell

The assignor hereby assigns all rights to the assignee.
`;

async function testImprovedExtraction() {
  console.log('=== Testing Improved Assignment Extraction ===\n');
  
  const extractor = new MarkdownFieldExtractor();
  
  // Test 1: Problematic text that was causing garbled results
  console.log('1. Testing problematic text:');
  console.log('Text:', problematicText.substring(0, 100) + '...');
  const result1 = await extractor.extractFields(problematicText, 'Assignment');
  console.log('Assignor:', result1.assignor);
  console.log('Assignee:', result1.assignee);
  console.log('Quality check:', 
    result1.assignor && result1.assignor.length < 100 ? 'PASS' : 'FAIL',
    result1.assignee && result1.assignee.length < 100 ? 'PASS' : 'FAIL'
  );
  console.log();
  
  // Test 2: Clean structured text
  console.log('2. Testing clean structured text:');
  const result2 = await extractor.extractFields(cleanStructuredText, 'Assignment');
  console.log('Assignor:', result2.assignor);
  console.log('Assignee:', result2.assignee);
  console.log('Quality check:', 
    result2.assignor && result2.assignor.length < 100 ? 'PASS' : 'FAIL',
    result2.assignee && result2.assignee.length < 100 ? 'PASS' : 'FAIL'
  );
  console.log();
  
  // Test 3: Mixed text with some noise
  console.log('3. Testing mixed text with noise:');
  const result3 = await extractor.extractFields(mixedText, 'Assignment');
  console.log('Assignor:', result3.assignor);
  console.log('Assignee:', result3.assignee);
  console.log('Quality check:', 
    result3.assignor && result3.assignor.length < 100 ? 'PASS' : 'FAIL',
    result3.assignee && result3.assignee.length < 100 ? 'PASS' : 'FAIL'
  );
  console.log();
  
  // Summary
  console.log('=== Summary ===');
  const results = [result1, result2, result3];
  let cleanExtractions = 0;
  let successfulExtractions = 0;
  
  results.forEach((result, i) => {
    if (result.assignor && result.assignee) {
      successfulExtractions++;
      if (result.assignor.length < 100 && result.assignee.length < 100 &&
          !result.assignor.includes('has duly executed') &&
          !result.assignee.includes('has duly executed')) {
        cleanExtractions++;
      }
    }
  });
  
  console.log(`Successful extractions: ${successfulExtractions}/${results.length}`);
  console.log(`Clean extractions (no boilerplate): ${cleanExtractions}/${results.length}`);
  
  if (cleanExtractions === results.length) {
    console.log('✅ All extractions are clean - fixes successful!');
  } else {
    console.log('⚠️  Some extractions still contain boilerplate text');
  }
}

testImprovedExtraction().catch(console.error);