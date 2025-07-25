import * as fs from 'fs';
import * as path from 'path';
import { doctlyService } from './src/services/doctlyService';
import { MarkdownDocumentClassifier } from './src/ml/markdownDocumentClassifier';
import { MarkdownDocumentClassifierNew } from './src/ml/markdownDocumentClassifierNew';
import { DocumentType } from './src/ml/documentClassifier';

// Test documents mapping
const testDocuments = [
  { file: '100011939_Hakani_Note.pdf', expectedType: DocumentType.NOTE },
  { file: '100011939_Hakani_Recorded_Mortgage.pdf', expectedType: DocumentType.SECURITY_INSTRUMENT },
  { file: '100011939_Recorded_Assignment_to_ATC.pdf', expectedType: DocumentType.ASSIGNMENT },
  { file: '100011939Note_Allonge_to_ATC.pdf', expectedType: DocumentType.ALLONGE },
  { file: 'ALLONGE_24381506.PDF', expectedType: DocumentType.ALLONGE },
  { file: '1005345774_Lemieux_Note.pdf', expectedType: DocumentType.NOTE },
];

async function testClassifiers() {
  const oldClassifier = new MarkdownDocumentClassifier();
  const newClassifier = new MarkdownDocumentClassifierNew();
  
  console.log('=== CLASSIFIER COMPARISON TEST ===\n');
  
  for (const test of testDocuments.slice(0, 3)) { // Test first 3 documents
    const docPath = path.join('/Users/michaelzimmerman/Documents/nplvision-rebuild/nplvision-clean/docs/test_set', test.file);
    
    if (!fs.existsSync(docPath)) {
      console.log(`❌ File not found: ${test.file}`);
      continue;
    }
    
    console.log(`\n📄 Testing: ${test.file}`);
    console.log(`Expected type: ${test.expectedType}`);
    console.log('---');
    
    try {
      // Read PDF
      const pdfBuffer = fs.readFileSync(docPath);
      
      // Process with Doctly
      console.log('Processing with Doctly...');
      const doctlyResult = await doctlyService.convertPdfToMarkdown(pdfBuffer, test.file, 'precision');
      
      console.log(`✅ Doctly processed: ${doctlyResult.markdown.length} chars, ${doctlyResult.pageCount} pages`);
      console.log(`First 200 chars: ${doctlyResult.markdown.substring(0, 200).replace(/\n/g, ' ')}...`);
      
      // Test OLD classifier
      console.log('\n🔵 OLD Classifier:');
      const oldResult = await oldClassifier.classify(doctlyResult.markdown);
      console.log(`  Predicted: ${oldResult.documentType} (confidence: ${oldResult.confidence})`);
      console.log(`  Scores:`, Array.from(oldResult.scores.entries()).map(([k,v]) => `${k}:${v.toFixed(1)}`).join(', '));
      
      // Test NEW classifier
      console.log('\n🟢 NEW Classifier:');
      const newResult = await newClassifier.classify(doctlyResult.markdown);
      console.log(`  Predicted: ${newResult.documentType} (confidence: ${newResult.confidence})`);
      console.log(`  Scores:`, Array.from(newResult.scores.entries()).map(([k,v]) => `${k}:${v.toFixed(1)}`).join(', '));
      
      // Compare
      const oldCorrect = oldResult.documentType === test.expectedType;
      const newCorrect = newResult.documentType === test.expectedType;
      const confidenceImprovement = newResult.confidence - oldResult.confidence;
      
      console.log('\n📊 Comparison:');
      console.log(`  Old correct: ${oldCorrect ? '✅' : '❌'}`);
      console.log(`  New correct: ${newCorrect ? '✅' : '❌'}`);
      console.log(`  Confidence change: ${confidenceImprovement > 0 ? '+' : ''}${(confidenceImprovement * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.error(`❌ Error processing ${test.file}:`, error);
    }
  }
}

// For testing without Doctly - use mock markdown
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

The borrower agrees to make monthly installments of principal and interest...
`;

  console.log('=== MOCK DATA TEST ===\n');
  console.log('📄 Testing mock Note document');
  
  console.log('\n🔵 OLD Classifier:');
  const oldResult = await oldClassifier.classify(mockNoteMarkdown);
  console.log(`  Predicted: ${oldResult.documentType} (confidence: ${oldResult.confidence})`);
  
  console.log('\n🟢 NEW Classifier:');
  const newResult = await newClassifier.classify(mockNoteMarkdown);
  console.log(`  Predicted: ${newResult.documentType} (confidence: ${newResult.confidence})`);
}

// Check if we have Doctly configured
if (process.env.DOCTLYAI_API_KEY) {
  console.log('🚀 Running test with real Doctly processing...\n');
  testClassifiers().catch(console.error);
} else {
  console.log('⚠️  No DOCTLYAI_API_KEY found, running with mock data...\n');
  testWithMockData().catch(console.error);
}