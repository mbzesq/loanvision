import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { MarkdownDocumentClassifier } from './src/ml/markdownDocumentClassifier';
import { MarkdownDocumentClassifierNew } from './src/ml/markdownDocumentClassifierNew';
import { DocumentType } from './src/ml/documentClassifier';

// Set API key from environment
const DOCTLY_API_KEY = process.env.DOCTLYAI_API_KEY;

interface DoctlyResponse {
  id: string;
  status: string;
  download_url?: string;
  output_file_url?: string;
}

// Direct Doctly API implementation
async function processPdfWithDoctly(pdfBuffer: Buffer, fileName: string): Promise<string> {
  console.log(`[Doctly] Processing ${fileName}...`);
  
  // Step 1: Upload document
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
  
  // Step 2: Poll for results
  let attempts = 0;
  while (attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
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

// Test documents mapping
const testDocuments = [
  // NOTES
  { file: '100011939_Hakani_Note.pdf', expectedType: DocumentType.NOTE },
  { file: '1005345774_Lemieux_Note.pdf', expectedType: DocumentType.NOTE },
  { file: '0240610110_NOTE.pdf', expectedType: DocumentType.NOTE },
  { file: 'Note_0000160868_07.15.98.pdf', expectedType: DocumentType.NOTE },
  
  // SECURITY INSTRUMENTS (Mortgages/Deeds of Trust)
  { file: '100011939_Hakani_Recorded_Mortgage.pdf', expectedType: DocumentType.SECURITY_INSTRUMENT },
  { file: 'Deed_of_Trust_0000160868_07.15.98.pdf', expectedType: DocumentType.SECURITY_INSTRUMENT },
  { file: '1005345774_Piller_Recorded_Mortgage.pdf', expectedType: DocumentType.SECURITY_INSTRUMENT },
  
  // ASSIGNMENTS
  { file: '100011939_Recorded_Assignment_to_ATC.pdf', expectedType: DocumentType.ASSIGNMENT },
  { file: '1005188261_Recorded_Assignment_to_ATC.pdf', expectedType: DocumentType.ASSIGNMENT },
  { file: '1004716870_Gately_Recorded_AOM_ETrade_Bank_to_NS182_LLC.PDF', expectedType: DocumentType.ASSIGNMENT },
  
  // ALLONGES
  { file: '100011939Note_Allonge_to_ATC.pdf', expectedType: DocumentType.ALLONGE },
  { file: 'ALLONGE_24381506.PDF', expectedType: DocumentType.ALLONGE },
  { file: '1005855303ALLONGE.pdf', expectedType: DocumentType.ALLONGE },
  { file: '1006344415ALLONGE.pdf', expectedType: DocumentType.ALLONGE },
];

async function testClassifiersWithRealDocs() {
  if (!DOCTLY_API_KEY) {
    console.error('❌ DOCTLYAI_API_KEY not found in environment');
    return;
  }
  
  const oldClassifier = new MarkdownDocumentClassifier();
  const newClassifier = new MarkdownDocumentClassifierNew();
  
  console.log('=== REAL DOCUMENT CLASSIFIER COMPARISON ===\n');
  
  const results = [];
  
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
      // Read PDF
      const pdfBuffer = fs.readFileSync(docPath);
      
      // Process with Doctly
      const markdown = await processPdfWithDoctly(pdfBuffer, test.file);
      
      console.log(`✅ Doctly processed: ${markdown.length} chars`);
      console.log(`First 200 chars: ${markdown.substring(0, 200).replace(/\n/g, ' ')}...`);
      
      // Test OLD classifier
      console.log('\n🔵 OLD Classifier:');
      const oldResult = await oldClassifier.classify(markdown);
      console.log(`  Predicted: ${oldResult.documentType} (confidence: ${oldResult.confidence})`);
      console.log(`  Scores:`, Array.from(oldResult.scores.entries()).map(([k,v]) => `${k}:${v.toFixed(1)}`).join(', '));
      
      // Test NEW classifier  
      console.log('\n🟢 NEW Classifier:');
      // Temporarily silence the debug output
      const originalLog = console.log;
      console.log = () => {};
      const newResult = await newClassifier.classify(markdown);
      console.log = originalLog;
      console.log(`  Predicted: ${newResult.documentType} (confidence: ${newResult.confidence})`);
      console.log(`  Scores:`, Array.from(newResult.scores.entries()).map(([k,v]) => `${k}:${v.toFixed(1)}`).join(', '));
      
      // Compare results
      const oldCorrect = oldResult.documentType === test.expectedType;
      const newCorrect = newResult.documentType === test.expectedType;
      
      console.log('\n📊 Results:');
      console.log(`  Old: ${oldCorrect ? '✅' : '❌'} ${oldResult.documentType} (${oldResult.confidence})${!oldCorrect ? ' <- WRONG' : ''}`);
      console.log(`  New: ${newCorrect ? '✅' : '❌'} ${newResult.documentType} (${newResult.confidence})${!newCorrect ? ' <- WRONG' : ''}`);
      console.log(`  Confidence improvement: ${((newResult.confidence - oldResult.confidence) * 100).toFixed(1)}%`);
      
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
  console.log('Document Type Performance:');
  
  const oldAccuracy = results.filter(r => r.oldCorrect).length / results.length;
  const newAccuracy = results.filter(r => r.newCorrect).length / results.length;
  
  console.log(`\nOLD Classifier: ${(oldAccuracy * 100).toFixed(1)}% accuracy`);
  console.log(`NEW Classifier: ${(newAccuracy * 100).toFixed(1)}% accuracy`);
  
  console.log('\nConfidence Statistics:');
  const avgOldConfidence = results.reduce((sum, r) => sum + r.oldConfidence, 0) / results.length;
  const avgNewConfidence = results.reduce((sum, r) => sum + r.newConfidence, 0) / results.length;
  console.log(`Average OLD confidence: ${avgOldConfidence.toFixed(3)}`);
  console.log(`Average NEW confidence: ${avgNewConfidence.toFixed(3)}`);
}

testClassifiersWithRealDocs().catch(console.error);