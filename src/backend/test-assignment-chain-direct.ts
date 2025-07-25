import { MarkdownDocumentClassifierNew } from './src/ml/markdownDocumentClassifierNew';
import { DocumentType } from './src/ml/documentClassifier';

// Sample assignment document markdown content for testing
const sampleAssignmentMarkdown = `
# ASSIGNMENT OF MORTGAGE

## PARTIES
**Assignor:** MERS (Mortgage Electronic Registration Systems, Inc.)  
**Assignee:** ATC Trust

## ASSIGNMENT DETAILS

MERS hereby assigns and transfers to ATC Trust all right, title and interest in and to the mortgage dated January 15, 2020, recorded in Book 1234, Page 567.

The mortgage secures a promissory note in the original principal amount of $250,000.00.

**Recording Information:**
- Document Number: 2024-123456
- Recording Date: March 15, 2024
- Recorded in: County Clerk's Office

MERS assigns to ATC Trust all rights under said mortgage.

**Signatures:**
MERS, as Assignor
By: John Smith, Vice President

ATC Trust, as Assignee
By: Jane Doe, Trustee
`;

const sampleAOMMarkdown = `
# ASSIGNMENT OF MORTGAGE (AOM)

This Assignment of Mortgage is made between ETrade Bank, a national banking association ("Assignor") and NS182 LLC, a limited liability company ("Assignee").

## ASSIGNMENT
ETrade Bank hereby assigns and transfers to NS182 LLC all right, title and interest in the mortgage dated June 1, 2019, recorded as Instrument No. 2019-456789.

The mortgage was given by John Q. Borrower to secure a note in the amount of $180,000.00.

**Assignment Details:**
- Original Mortgagee: ETrade Bank
- New Mortgagee: NS182 LLC
- Property: 123 Main Street, Anytown, ST 12345

This assignment is made for valuable consideration.

IN WITNESS WHEREOF, the parties have executed this Assignment.

ETrade Bank
By: /s/ Mary Johnson
Title: Vice President

NS182 LLC  
By: /s/ Robert Wilson
Title: Manager
`;

const sampleChainAssignmentMarkdown = `
# ASSIGNMENT OF MORTGAGE

## CHAIN OF ASSIGNMENTS

**First Assignment:**
Wells Fargo Bank assigns to MERS all right, title and interest in the mortgage dated March 1, 2018.

**Second Assignment:**  
MERS hereby assigns to SRP 20137 LLC all right, title and interest in said mortgage.

**Final Assignment:**
SRP 20137 LLC assigns to ATC Trust all rights under the mortgage.

**Property:** 456 Oak Avenue, Somewhere, CA 90210
**Original Principal:** $320,000.00
**Recording:** This assignment recorded as Document 2024-789012

ATC Trust is now the holder of the mortgage and note.
`;

async function testAssignmentChainDirect() {
  console.log('=== TESTING ASSIGNMENT CHAIN ANALYSIS WITH SAMPLE DOCUMENTS ===\n');
  
  const classifier = new MarkdownDocumentClassifierNew();
  
  const testCases = [
    { name: 'Simple Assignment (MERS to ATC)', markdown: sampleAssignmentMarkdown, expectedEndsWithCurrentInvestor: true },
    { name: 'AOM (ETrade to NS182)', markdown: sampleAOMMarkdown, expectedEndsWithCurrentInvestor: true },
    { name: 'Chain Assignment (Wells→MERS→SRP→ATC)', markdown: sampleChainAssignmentMarkdown, expectedEndsWithCurrentInvestor: true }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log('─'.repeat(50));
    
    try {
      const result = await classifier.classify(testCase.markdown);
      
      console.log(`📊 Classification: ${result.documentType} (confidence: ${result.confidence})`);
      
      if (result.hasAssignmentChain) {
        console.log(`🔗 Assignment Chain Analysis:`);
        console.log(`  Chain Length: ${result.assignmentCount}`);
        console.log(`  Ends with Current Investor: ${result.assignmentEndsWithCurrentInvestor ? 'YES' : 'NO'}`);
        console.log(`  Chain Details:`);
        result.assignmentChain?.forEach((assignment, i) => {
          console.log(`    ${i + 1}. ${assignment.assignor || 'Unknown'} → ${assignment.assignee}`);
          if (assignment.recordingInfo) {
            console.log(`       Recording: ${assignment.recordingInfo}`);
          }
        });
        
        const chainCorrect = result.assignmentEndsWithCurrentInvestor === testCase.expectedEndsWithCurrentInvestor;
        console.log(`🎯 Chain Analysis: ${chainCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
      } else {
        console.log(`❌ No assignment chain detected`);
        console.log(`🎯 Chain Analysis: ❌ INCORRECT (Expected assignment chain)`);
      }
      
    } catch (error) {
      console.error(`❌ Error:`, error instanceof Error ? error.message : error);
    }
  }
  
  console.log('\n=== SUMMARY ===');
  console.log('This test validates assignment chain detection logic with controlled sample data.');
  console.log('The patterns should detect assignor→assignee relationships and determine if chains end with current investors (ATC, SRP, NS).');
}

testAssignmentChainDirect().catch(console.error);