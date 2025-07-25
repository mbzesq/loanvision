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

interface TestResult {
  file: string;
  expectedType: DocumentType;
  prediction: DocumentType;
  confidence: number;
  correct: boolean;
  hasEndorsements: boolean;
  endorsementCount: number;
  endsInBlank: boolean;
  endsWithCurrentInvestor: boolean;
  error?: string;
}

// Map file patterns to expected document types
function getExpectedType(filename: string): DocumentType {
  const lower = filename.toLowerCase();
  
  if (lower.includes('note')) {
    return DocumentType.NOTE; // Notes can have embedded allonges
  } else if (lower.includes('mortgage') || lower.includes('deed_of_trust') || lower.includes('deed of trust')) {
    return DocumentType.SECURITY_INSTRUMENT;
  } else if (lower.includes('assignment') || lower.includes('aom')) {
    return DocumentType.ASSIGNMENT;
  } else if (lower.includes('allonge')) {
    return DocumentType.NOTE; // Allonge files are typically Notes with endorsements
  } else {
    return DocumentType.OTHER;
  }
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

async function testAllDocuments() {
  // Get all PDF files from test directory
  const allFiles = fs.readdirSync(TEST_DIR);
  const pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
  
  console.log(`=== TESTING REFACTORED CLASSIFIER ON ALL ${pdfFiles.length} DOCUMENTS ===\n`);
  
  const classifier = new MarkdownDocumentClassifierNew();
  const results: TestResult[] = [];
  let processed = 0;
  
  // Process files in batches of 8 to avoid timeouts
  const batchSize = 8;
  for (let i = 0; i < pdfFiles.length; i += batchSize) {
    const batch = pdfFiles.slice(i, Math.min(i + batchSize, pdfFiles.length));
    console.log(`\n=== Processing Batch ${Math.floor(i/batchSize) + 1} (${batch.length} files) ===\n`);
    
    for (const file of batch) {
      const expectedType = getExpectedType(file);
      console.log(`\n[${++processed}/${pdfFiles.length}] Testing: ${file}`);
      console.log(`Expected: ${expectedType}`);
      
      try {
        const docPath = path.join(TEST_DIR, file);
        const pdfBuffer = fs.readFileSync(docPath);
        const markdown = await processPdfWithDoctly(pdfBuffer, file);
        
        console.log(`✅ Processed: ${markdown.length} chars`);
        
        // Test classifier (silence debug logs)
        const originalLog = console.log;
        console.log = () => {};
        const result = await classifier.classify(markdown);
        console.log = originalLog;
        
        const correct = result.documentType === expectedType;
        
        console.log(`Prediction: ${correct ? '✅' : '❌'} ${result.documentType} (${result.confidence})`);
        if (result.hasEndorsements) {
          console.log(`Endorsements: ${result.endorsementCount}, ends: ${result.endsInBlank ? 'BLANK' : result.endsWithCurrentInvestor ? 'CURRENT INVESTOR' : 'OTHER'}`);
        }
        
        results.push({
          file,
          expectedType,
          prediction: result.documentType,
          confidence: result.confidence,
          correct,
          hasEndorsements: result.hasEndorsements || false,
          endorsementCount: result.endorsementCount || 0,
          endsInBlank: result.endsInBlank || false,
          endsWithCurrentInvestor: result.endsWithCurrentInvestor || false
        });
        
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : error}`);
        results.push({
          file,
          expectedType,
          prediction: DocumentType.OTHER,
          confidence: 0,
          correct: false,
          hasEndorsements: false,
          endorsementCount: 0,
          endsInBlank: false,
          endsWithCurrentInvestor: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Save intermediate results
    fs.writeFileSync('test-results-refactored-intermediate.json', JSON.stringify(results, null, 2));
    console.log(`\nSaved intermediate results (${results.length} files processed)`);
  }
  
  // Final analysis
  console.log('\n\n========== FINAL ANALYSIS ==========\n');
  
  const successfulTests = results.filter(r => !r.error);
  const accuracy = successfulTests.filter(r => r.correct).length / successfulTests.length;
  
  console.log(`Total files tested: ${results.length}`);
  console.log(`Successful tests: ${successfulTests.length}`);
  console.log(`Failed tests: ${results.filter(r => r.error).length}`);
  console.log(`\nOverall Accuracy: ${(accuracy * 100).toFixed(1)}% (${successfulTests.filter(r => r.correct).length}/${successfulTests.length})`);
  
  // Per-type analysis
  console.log('\n=== Per-Type Performance ===');
  for (const docType of [DocumentType.NOTE, DocumentType.SECURITY_INSTRUMENT, DocumentType.ASSIGNMENT, DocumentType.OTHER]) {
    const typeResults = successfulTests.filter(r => r.expectedType === docType);
    if (typeResults.length > 0) {
      const typeAccuracy = typeResults.filter(r => r.correct).length / typeResults.length;
      console.log(`${docType}: ${(typeAccuracy * 100).toFixed(0)}% (${typeResults.filter(r => r.correct).length}/${typeResults.length})`);
    }
  }
  
  // Endorsement analysis
  console.log('\n=== Endorsement Analysis ===');
  const withEndorsements = successfulTests.filter(r => r.hasEndorsements);
  console.log(`Documents with endorsements: ${withEndorsements.length}/${successfulTests.length}`);
  console.log(`Ending in blank: ${withEndorsements.filter(r => r.endsInBlank).length}`);
  console.log(`Ending with current investor: ${withEndorsements.filter(r => r.endsWithCurrentInvestor).length}`);
  console.log(`Ending with other: ${withEndorsements.filter(r => !r.endsInBlank && !r.endsWithCurrentInvestor).length}`);
  
  // Misclassifications
  const misclassified = successfulTests.filter(r => !r.correct);
  if (misclassified.length > 0) {
    console.log('\n=== Misclassifications ===');
    for (const miss of misclassified.slice(0, 10)) { // Show first 10
      console.log(`${miss.file}: Expected ${miss.expectedType}, Got ${miss.prediction} (${miss.confidence})`);
    }
    if (misclassified.length > 10) {
      console.log(`... and ${misclassified.length - 10} more`);
    }
  }
  
  // Save final results
  fs.writeFileSync('test-results-refactored-final.json', JSON.stringify(results, null, 2));
  console.log(`\nFull results saved to test-results-refactored-final.json`);
  
  return results;
}

testAllDocuments().catch(console.error);