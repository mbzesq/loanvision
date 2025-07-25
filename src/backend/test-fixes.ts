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

// Test the two problematic documents
const testDocuments = [
  { file: 'Deed_of_Trust_0000160868_07.15.98.pdf', expectedType: DocumentType.SECURITY_INSTRUMENT },
  { file: 'ALLONGE_24381506.PDF', expectedType: DocumentType.ALLONGE },
];

async function testFixes() {
  const oldClassifier = new MarkdownDocumentClassifier();
  const newClassifier = new MarkdownDocumentClassifierNew();
  
  console.log('=== TESTING CLASSIFIER FIXES ===\n');
  
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
      
      // Test NEW classifier with debug info
      console.log('\n🟢 NEW Classifier with debug:');
      const newResult = await newClassifier.classify(markdown);
      
      const oldCorrect = oldResult.documentType === test.expectedType;
      const newCorrect = newResult.documentType === test.expectedType;
      
      console.log('\n📊 Results:');
      console.log(`🔵 OLD: ${oldCorrect ? '✅' : '❌'} ${oldResult.documentType} (${oldResult.confidence.toFixed(3)})`);
      console.log(`🟢 NEW: ${newCorrect ? '✅' : '❌'} ${newResult.documentType} (${newResult.confidence.toFixed(3)})`);
      console.log(`Status: ${newCorrect && !oldCorrect ? 'FIXED!' : newCorrect === oldCorrect ? 'Same' : 'Still wrong'}`);
      
    } catch (error) {
      console.error(`❌ Error processing ${test.file}:`, error instanceof Error ? error.message : error);
    }
  }
}

testFixes().catch(console.error);