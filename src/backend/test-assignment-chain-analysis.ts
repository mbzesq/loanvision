import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { MarkdownDocumentClassifierNew } from './src/ml/markdownDocumentClassifierNew';
import { DocumentType } from './src/ml/documentClassifier';

const DOCTLY_API_KEY = 'sk-p1SvuMS7MvZhAVjkt3-Gui88Eo93fhFCpAzDAkvG4jWCXK7ot5D-M8Rik2VZKkNydFGM';
const TEST_DIR = '/Users/michaelzimmerman/Documents/nplvision-rebuild/nplvision-clean/docs/test_set';

interface DoctlyResponse {
  id: string;
  status: string;
  download_url?: string;
  output_file_url?: string;
}

interface AssignmentTestResult {
  file: string;
  expectedType: DocumentType;
  prediction: DocumentType;
  confidence: number;
  correct: boolean;
  hasAssignmentChain: boolean;
  assignmentCount: number;
  endsWithCurrentInvestor: boolean;
  chainDetails: any[];
}

async function processPdfWithDoctly(pdfBuffer: Buffer, fileName: string): Promise<string> {
  console.log(`[Doctly] Processing ${fileName}...`);
  
  const formData = new FormData();
  formData.append('file', pdfBuffer, {
    filename: fileName,
    contentType: 'application/pdf'
  });
  
  const uploadResponse = await axios.post(
    'https://api.doctly.ai/api/v1/documents/',
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${DOCTLY_API_KEY}`,
      },
      timeout: 60000
    }
  );
  
  const documentId = (uploadResponse.data as any).id;
  console.log(`[Doctly] Document ID: ${documentId}, polling...`);
  
  let attempts = 0;
  while (attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusResponse = await axios.get(
      `https://api.doctly.ai/api/v1/documents/${documentId}`,
      {
        headers: {
          'Authorization': `Bearer ${DOCTLY_API_KEY}`,
        }
      }
    );
    
    const data = statusResponse.data as DoctlyResponse;
    
    if (data.status === 'COMPLETED' || data.status === 'SUCCESS') {
      const downloadUrl = data.download_url || data.output_file_url;
      if (downloadUrl) {
        const markdownResponse = await axios.get(downloadUrl, { responseType: 'text' });
        return markdownResponse.data as string;
      }
    }
    
    attempts++;
  }
  
  throw new Error('Doctly processing timed out');
}

function getExpectedType(filename: string): DocumentType {
  const lower = filename.toLowerCase();
  
  if (lower.includes('assignment') || lower.includes('aom')) {
    return DocumentType.ASSIGNMENT;
  } else if (lower.includes('note')) {
    return DocumentType.NOTE;
  } else if (lower.includes('mortgage') || lower.includes('deed_of_trust')) {
    return DocumentType.SECURITY_INSTRUMENT;
  } else {
    return DocumentType.OTHER;
  }
}

async function testAssignmentChainAnalysis() {
  // Get actual assignment documents from test directory
  const allFiles = fs.readdirSync(TEST_DIR);
  const assignmentFiles = allFiles.filter(f => 
    // Focus on actual assignment documents, not notes/allonges
    (f.toLowerCase().includes('assignment') && !f.toLowerCase().includes('note')) || 
    f.toLowerCase().includes('aom') || // Assignment of Mortgage
    (f.toLowerCase().includes('recorded') && (f.includes('_to_ATC') || f.includes('_to_SRP') || f.includes('_to_NS')))
  ).filter(f => 
    // Exclude Note and Allonge documents even if they have assignment-like names
    !f.toLowerCase().includes('note') && 
    !f.toLowerCase().includes('allonge')
  );
  
  console.log(`=== TESTING ASSIGNMENT CHAIN ANALYSIS ON ${assignmentFiles.length} DOCUMENTS ===\n`);
  
  const classifier = new MarkdownDocumentClassifierNew();
  const results: AssignmentTestResult[] = [];
  let processed = 0;
  
  for (const file of assignmentFiles.slice(0, 8)) { // Test first 8 to avoid timeout
    const expectedType = getExpectedType(file);
    console.log(`\n[${++processed}/${Math.min(assignmentFiles.length, 8)}] Testing: ${file}`);
    console.log(`Expected: ${expectedType}`);
    
    try {
      const docPath = path.join(TEST_DIR, file);
      const pdfBuffer = fs.readFileSync(docPath);
      const markdown = await processPdfWithDoctly(pdfBuffer, file);
      
      console.log(`✅ Processed: ${markdown.length} chars`);
      
      // Test classifier (silence debug logs for clarity)
      const originalLog = console.log;
      console.log = () => {};
      const result = await classifier.classify(markdown);
      console.log = originalLog;
      
      const correct = result.documentType === expectedType;
      console.log(`📊 Classification: ${correct ? '✅' : '❌'} ${result.documentType} (${result.confidence})`);
      
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
      } else {
        console.log(`❌ No assignment chain detected`);
      }
      
      // Expected result based on filename - should end with current investor if filename indicates so
      const expectedEndsWithCurrentInvestor = file.includes('_to_ATC') || 
                                              file.includes('_to_SRP') || 
                                              file.includes('_to_NS') ||
                                              file.toLowerCase().includes('atc') ||
                                              file.toLowerCase().includes('srp') ||
                                              file.toLowerCase().includes('ns');
      
      const chainAnalysisCorrect = result.assignmentEndsWithCurrentInvestor === expectedEndsWithCurrentInvestor;
      console.log(`🎯 Chain Analysis: ${chainAnalysisCorrect ? 'CORRECT' : 'INCORRECT'} (Expected ends with current investor: ${expectedEndsWithCurrentInvestor})`);
      
      results.push({
        file,
        expectedType,
        prediction: result.documentType,
        confidence: result.confidence,
        correct,
        hasAssignmentChain: result.hasAssignmentChain || false,
        assignmentCount: result.assignmentCount || 0,
        endsWithCurrentInvestor: result.assignmentEndsWithCurrentInvestor || false,
        chainDetails: result.assignmentChain || []
      });
      
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error instanceof Error ? error.message : error);
      results.push({
        file,
        expectedType,
        prediction: DocumentType.OTHER,
        confidence: 0,
        correct: false,
        hasAssignmentChain: false,
        assignmentCount: 0,
        endsWithCurrentInvestor: false,
        chainDetails: []
      });
    }
  }
  
  // Final analysis
  console.log('\n\n========== ASSIGNMENT CHAIN ANALYSIS RESULTS ==========\n');
  
  const correctClassifications = results.filter(r => r.correct);
  const assignmentDocs = results.filter(r => r.prediction === DocumentType.ASSIGNMENT);
  const chainsDetected = results.filter(r => r.hasAssignmentChain);
  const endsWithCurrentInvestor = results.filter(r => r.endsWithCurrentInvestor);
  
  console.log(`Total documents tested: ${results.length}`);
  console.log(`Classification accuracy: ${(correctClassifications.length / results.length * 100).toFixed(1)}% (${correctClassifications.length}/${results.length})`);
  console.log(`Classified as Assignment: ${assignmentDocs.length}`);
  console.log(`Assignment chains detected: ${chainsDetected.length}`);
  console.log(`Chains ending with current investor: ${endsWithCurrentInvestor.length}`);
  
  console.log('\n=== Assignment Chain Details ===');
  for (const result of chainsDetected) {
    console.log(`\n${result.file}:`);
    console.log(`  Expected: ${result.expectedType}, Got: ${result.prediction} (${result.confidence})`);
    console.log(`  Chain Length: ${result.assignmentCount}`);
    console.log(`  Ends with Current Investor: ${result.endsWithCurrentInvestor ? 'YES' : 'NO'}`);
    result.chainDetails.forEach((assignment, i) => {
      console.log(`    ${i + 1}. ${assignment.assignor || 'Unknown'} → ${assignment.assignee}`);
    });
  }
  
  // Show misclassifications
  const misclassified = results.filter(r => !r.correct);
  if (misclassified.length > 0) {
    console.log('\n=== Misclassifications ===');
    for (const miss of misclassified) {
      console.log(`${miss.file}: Expected ${miss.expectedType}, Got ${miss.prediction} (${miss.confidence})`);
    }
  }
  
  // Save results
  fs.writeFileSync('assignment-chain-test-results.json', JSON.stringify(results, null, 2));
  console.log(`\nFull results saved to assignment-chain-test-results.json`);
  
  return results;
}

testAssignmentChainAnalysis().catch(console.error);