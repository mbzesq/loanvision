import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { MarkdownDocumentClassifier } from './src/ml/markdownDocumentClassifier';
import { MarkdownDocumentClassifierNew } from './src/ml/markdownDocumentClassifierNew';
import { DocumentType } from './src/ml/documentClassifier';

const DOCTLY_API_KEY = 'sk-p1SvuMS7MvZhAVjkt3-Gui88Eo93fhFCpAzDAkvG4jWCXK7ot5D-M8Rik2VZKkNydFGM';

interface DoctlyResponse {
  id: string;
  status: string;
  download_url?: string;
  output_file_url?: string;
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
  console.log(`[Doctly] Document ID: ${documentId}, polling for results...`);
  
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
        console.log(`[Doctly] Downloading markdown...`);
        const markdownResponse = await axios.get(downloadUrl, { responseType: 'text' });
        return markdownResponse.data as string;
      }
    }
    
    attempts++;
  }
  
  throw new Error('Doctly processing timed out');
}

// Balanced test set - 2 of each type
const testDocuments = [
  // NOTES
  { file: '100011939_Hakani_Note.pdf', expectedType: DocumentType.NOTE },
  { file: 'Note_0000160868_07.15.98.pdf', expectedType: DocumentType.NOTE },
  
  // SECURITY INSTRUMENTS
  { file: '100011939_Hakani_Recorded_Mortgage.pdf', expectedType: DocumentType.SECURITY_INSTRUMENT },
  { file: 'Deed_of_Trust_0000160868_07.15.98.pdf', expectedType: DocumentType.SECURITY_INSTRUMENT },
  
  // ASSIGNMENTS
  { file: '100011939_Recorded_Assignment_to_ATC.pdf', expectedType: DocumentType.ASSIGNMENT },
  { file: '1005188261_Recorded_Assignment_to_ATC.pdf', expectedType: DocumentType.ASSIGNMENT },
  
  // ALLONGES
  { file: '100011939Note_Allonge_to_ATC.pdf', expectedType: DocumentType.ALLONGE },
  { file: 'ALLONGE_24381506.PDF', expectedType: DocumentType.ALLONGE },
];

async function testBalancedClassifier() {
  const oldClassifier = new MarkdownDocumentClassifier();
  const newClassifier = new MarkdownDocumentClassifierNew();
  
  console.log('=== BALANCED CLASSIFIER TEST (2 OF EACH TYPE) ===\n');
  
  const results: any[] = [];
  
  for (const test of testDocuments) {
    const docPath = path.join('/Users/michaelzimmerman/Documents/nplvision-rebuild/nplvision-clean/docs/test_set', test.file);
    
    if (!fs.existsSync(docPath)) {
      console.log(`❌ File not found: ${test.file}`);
      continue;
    }
    
    console.log(`\n📄 Testing: ${test.file}`);
    console.log(`Expected type: ${test.expectedType}`);
    console.log('---');
    
    try {
      const pdfBuffer = fs.readFileSync(docPath);
      const markdown = await processPdfWithDoctly(pdfBuffer, test.file);
      
      console.log(`✅ Doctly processed: ${markdown.length} chars`);
      
      // Test OLD classifier
      const oldResult = await oldClassifier.classify(markdown);
      
      // Test NEW classifier (silence debug output)
      const originalLog = console.log;
      console.log = () => {};
      const newResult = await newClassifier.classify(markdown);
      console.log = originalLog;
      
      const oldCorrect = oldResult.documentType === test.expectedType;
      const newCorrect = newResult.documentType === test.expectedType;
      
      console.log(`🔵 OLD: ${oldCorrect ? '✅' : '❌'} ${oldResult.documentType} (${oldResult.confidence.toFixed(3)})`);
      console.log(`🟢 NEW: ${newCorrect ? '✅' : '❌'} ${newResult.documentType} (${newResult.confidence.toFixed(3)})`);
      
      results.push({
        file: test.file,
        expected: test.expectedType,
        oldPrediction: oldResult.documentType,
        oldConfidence: oldResult.confidence,
        newPrediction: newResult.documentType,
        newConfidence: newResult.confidence,
        oldCorrect,
        newCorrect
      });
      
    } catch (error) {
      console.error(`❌ Error processing ${test.file}:`, error instanceof Error ? error.message : error);
    }
  }
  
  // Summary
  console.log('\n\n=== SUMMARY ===');
  const oldAccuracy = results.filter(r => r.oldCorrect).length / results.length;
  const newAccuracy = results.filter(r => r.newCorrect).length / results.length;
  
  console.log(`OLD Classifier: ${(oldAccuracy * 100).toFixed(1)}% accuracy (${results.filter(r => r.oldCorrect).length}/${results.length})`);
  console.log(`NEW Classifier: ${(newAccuracy * 100).toFixed(1)}% accuracy (${results.filter(r => r.newCorrect).length}/${results.length})`);
  
  const avgOldConfidence = results.reduce((sum, r) => sum + r.oldConfidence, 0) / results.length;
  const avgNewConfidence = results.reduce((sum, r) => sum + r.newConfidence, 0) / results.length;
  console.log(`Average OLD confidence: ${avgOldConfidence.toFixed(3)}`);
  console.log(`Average NEW confidence: ${avgNewConfidence.toFixed(3)}`);
  
  // Per-type analysis
  console.log('\nPer-Type Performance:');
  for (const docType of [DocumentType.NOTE, DocumentType.SECURITY_INSTRUMENT, DocumentType.ASSIGNMENT, DocumentType.ALLONGE]) {
    const typeResults = results.filter(r => r.expected === docType);
    if (typeResults.length > 0) {
      const oldTypeAccuracy = typeResults.filter(r => r.oldCorrect).length / typeResults.length;
      const newTypeAccuracy = typeResults.filter(r => r.newCorrect).length / typeResults.length;
      console.log(`  ${docType}: OLD ${(oldTypeAccuracy * 100).toFixed(0)}% | NEW ${(newTypeAccuracy * 100).toFixed(0)}%`);
    }
  }
}

testBalancedClassifier().catch(console.error);