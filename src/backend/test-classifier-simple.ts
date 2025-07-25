import { MarkdownDocumentClassifier } from './src/ml/markdownDocumentClassifier';
import { MarkdownDocumentClassifierNew } from './src/ml/markdownDocumentClassifierNew';
import { DocumentType } from './src/ml/documentClassifier';

async function testWithMockData() {
  const oldClassifier = new MarkdownDocumentClassifier();
  const newClassifier = new MarkdownDocumentClassifierNew();
  
  // Mock markdown for a Note
  const mockNoteMarkdown = `
# PROMISSORY NOTE

**Date:** January 15, 2020  
**Loan Amount:** $250,000.00  
**Interest Rate:** 5.5%  

FOR VALUE RECEIVED, the undersigned ("Borrower") promises to pay to the order of 
ABC LENDING CORP ("Lender"), the principal sum of TWO HUNDRED FIFTY THOUSAND DOLLARS 
($250,000.00), together with interest at the rate of 5.5% per annum.

**Monthly Payment:** $1,500.00  
**Maturity Date:** January 15, 2050  

The borrower agrees to make monthly installments of principal and interest. This loan 
is for the purchase of real property located at 123 Main Street, Anytown, USA.

In case of default, the entire unpaid balance shall become immediately due and payable.
`;

  // Mock markdown for an Assignment
  const mockAssignmentMarkdown = `
**ASSIGNMENT OF MORTGAGE**

For value received, ACME BANK, N.A. ("Assignor") hereby assigns and transfers to 
XYZ SERVICING LLC ("Assignee") all right, title and interest in and to that certain 
mortgage dated January 15, 2020, executed by John Doe as mortgagor.

Said mortgage was recorded on January 20, 2020 as Instrument Number 2020-12345 in the 
County Clerk's office. This assignment is executed and acknowledged before me this 
15th day of March, 2023.

Assignor: ACME BANK, N.A.
Assignee: XYZ SERVICING LLC
`;

  // Mock markdown for an Allonge
  const mockAllongeMarkdown = `
**ALLONGE TO PROMISSORY NOTE**

This allonge is affixed to and made part of the promissory note dated January 15, 2020 
in the original principal amount of $250,000.00.

PAY TO THE ORDER OF ABC TRUST COMPANY

Without Recourse

By: _____________________
    ACME BANK, N.A.
`;

  console.log('=== CLASSIFIER COMPARISON TEST ===\n');
  
  // Test Note
  console.log('📄 Testing NOTE document');
  console.log('---');
  
  console.log('\n🔵 OLD Classifier:');
  let oldResult = await oldClassifier.classify(mockNoteMarkdown);
  console.log(`  Predicted: ${oldResult.documentType} (confidence: ${oldResult.confidence})`);
  console.log(`  Scores:`, Array.from(oldResult.scores.entries()).map(([k,v]) => `${k}:${v.toFixed(1)}`).join(', '));
  
  console.log('\n🟢 NEW Classifier:');
  let newResult = await newClassifier.classify(mockNoteMarkdown);
  console.log(`  Predicted: ${newResult.documentType} (confidence: ${newResult.confidence})`);
  
  // Test Assignment
  console.log('\n\n📄 Testing ASSIGNMENT document');
  console.log('---');
  
  console.log('\n🔵 OLD Classifier:');
  oldResult = await oldClassifier.classify(mockAssignmentMarkdown);
  console.log(`  Predicted: ${oldResult.documentType} (confidence: ${oldResult.confidence})`);
  console.log(`  Scores:`, Array.from(oldResult.scores.entries()).map(([k,v]) => `${k}:${v.toFixed(1)}`).join(', '));
  
  console.log('\n🟢 NEW Classifier:');
  newResult = await newClassifier.classify(mockAssignmentMarkdown);
  console.log(`  Predicted: ${newResult.documentType} (confidence: ${newResult.confidence})`);
  
  // Test Allonge
  console.log('\n\n📄 Testing ALLONGE document');
  console.log('---');
  
  console.log('\n🔵 OLD Classifier:');
  oldResult = await oldClassifier.classify(mockAllongeMarkdown);
  console.log(`  Predicted: ${oldResult.documentType} (confidence: ${oldResult.confidence})`);
  console.log(`  Scores:`, Array.from(oldResult.scores.entries()).map(([k,v]) => `${k}:${v.toFixed(1)}`).join(', '));
  
  console.log('\n🟢 NEW Classifier:');
  newResult = await newClassifier.classify(mockAllongeMarkdown);
  console.log(`  Predicted: ${newResult.documentType} (confidence: ${newResult.confidence})`);
}

testWithMockData().catch(console.error);