import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { MarkdownDocumentClassifier } from './src/ml/markdownDocumentClassifier';
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
  oldPrediction: DocumentType;
  oldConfidence: number;
  newPrediction: DocumentType;
  newConfidence: number;
  oldCorrect: boolean;
  newCorrect: boolean;
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
  
  console.log(`Found ${pdfFiles.length} PDF files to test\n`);
  
  const oldClassifier = new MarkdownDocumentClassifier();
  const newClassifier = new MarkdownDocumentClassifierNew();
  
  const results: TestResult[] = [];
  let processed = 0;
  
  // Process files in batches of 5 to avoid timeouts
  const batchSize = 5;
  for (let i = 0; i < pdfFiles.length; i += batchSize) {
    const batch = pdfFiles.slice(i, Math.min(i + batchSize, pdfFiles.length));
    console.log(`\n=== Processing Batch ${Math.floor(i/batchSize) + 1} (${batch.length} files) ===\n`);
    
    for (const file of batch) {
      const expectedType = getExpectedType(file);
      console.log(`\n[${++processed}/${pdfFiles.length}] Testing: ${file}`);
      console.log(`Expected type: ${expectedType}`);
      
      try {
        const docPath = path.join(TEST_DIR, file);
        const pdfBuffer = fs.readFileSync(docPath);
        const markdown = await processPdfWithDoctly(pdfBuffer, file);
        
        console.log(`✅ Processed: ${markdown.length} chars`);
        
        // Test OLD classifier (silence logs)
        const originalLog = console.log;
        console.log = () => {};
        const oldResult = await oldClassifier.classify(markdown);
        const newResult = await newClassifier.classify(markdown);
        console.log = originalLog;
        
        const oldCorrect = oldResult.documentType === expectedType;
        const newCorrect = newResult.documentType === expectedType;
        
        console.log(`OLD: ${oldCorrect ? '✅' : '❌'} ${oldResult.documentType} (${oldResult.confidence.toFixed(3)})`);
        console.log(`NEW: ${newCorrect ? '✅' : '❌'} ${newResult.documentType} (${newResult.confidence.toFixed(3)})`);
        
        results.push({
          file,
          expectedType,
          oldPrediction: oldResult.documentType,
          oldConfidence: oldResult.confidence,
          newPrediction: newResult.documentType,
          newConfidence: newResult.confidence,
          oldCorrect,
          newCorrect
        });
        
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : error}`);
        results.push({
          file,
          expectedType,
          oldPrediction: DocumentType.OTHER,
          oldConfidence: 0,
          newPrediction: DocumentType.OTHER,
          newConfidence: 0,
          oldCorrect: false,
          newCorrect: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Save intermediate results
    fs.writeFileSync(
      'test-results-intermediate.json', 
      JSON.stringify(results, null, 2)
    );
    console.log(`\nSaved intermediate results (${results.length} files processed)`);
  }
  
  // Final summary
  console.log('\n\n========== FINAL SUMMARY ==========\n');
  
  const successfulTests = results.filter(r => !r.error);
  const oldAccuracy = successfulTests.filter(r => r.oldCorrect).length / successfulTests.length;
  const newAccuracy = successfulTests.filter(r => r.newCorrect).length / successfulTests.length;
  
  console.log(`Total files tested: ${results.length}`);
  console.log(`Successful tests: ${successfulTests.length}`);
  console.log(`Failed tests: ${results.filter(r => r.error).length}`);
  console.log(`\nOLD Classifier: ${(oldAccuracy * 100).toFixed(1)}% accuracy (${successfulTests.filter(r => r.oldCorrect).length}/${successfulTests.length})`);
  console.log(`NEW Classifier: ${(newAccuracy * 100).toFixed(1)}% accuracy (${successfulTests.filter(r => r.newCorrect).length}/${successfulTests.length})`);
  
  // Per-type analysis
  console.log('\nPer-Type Performance:');
  for (const docType of [DocumentType.NOTE, DocumentType.SECURITY_INSTRUMENT, DocumentType.ASSIGNMENT]) {
    const typeResults = successfulTests.filter(r => r.expectedType === docType);
    if (typeResults.length > 0) {
      const oldTypeAccuracy = typeResults.filter(r => r.oldCorrect).length / typeResults.length;
      const newTypeAccuracy = typeResults.filter(r => r.newCorrect).length / typeResults.length;
      console.log(`  ${docType}: ${typeResults.length} files`);
      console.log(`    OLD: ${(oldTypeAccuracy * 100).toFixed(0)}% (${typeResults.filter(r => r.oldCorrect).length}/${typeResults.length})`);
      console.log(`    NEW: ${(newTypeAccuracy * 100).toFixed(0)}% (${typeResults.filter(r => r.newCorrect).length}/${typeResults.length})`);
    }
  }
  
  // Misclassifications
  const newMisclassified = successfulTests.filter(r => !r.newCorrect);
  if (newMisclassified.length > 0) {
    console.log('\nNEW Classifier Misclassifications:');
    for (const miss of newMisclassified) {
      console.log(`  ${miss.file}: Expected ${miss.expectedType}, Got ${miss.newPrediction} (${miss.newConfidence.toFixed(3)})`);
    }
  }
  
  // Save final results
  fs.writeFileSync('test-results-final.json', JSON.stringify(results, null, 2));
  console.log('\nFull results saved to test-results-final.json');
}

testAllDocuments().catch(console.error);