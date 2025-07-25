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

// Test diverse document types including former "allonge" documents
const testDocuments = [
  { file: '100011939_Hakani_Note.pdf', expectedType: DocumentType.NOTE },
  { file: '100011939Note_Allonge_to_ATC.pdf', expectedType: DocumentType.NOTE }, // Now expected as Note with endorsements
  { file: 'ALLONGE_24381506.PDF', expectedType: DocumentType.NOTE }, // Now expected as Note with endorsements
  { file: '100011939_Hakani_Recorded_Mortgage.pdf', expectedType: DocumentType.SECURITY_INSTRUMENT },
  { file: '100011939_Recorded_Assignment_to_ATC.pdf', expectedType: DocumentType.ASSIGNMENT },
  { file: '0240610110_NOTE.pdf', expectedType: DocumentType.NOTE }, // The problematic note
];

async function testRefactoredClassifier() {
  const newClassifier = new MarkdownDocumentClassifierNew();
  
  console.log('=== TESTING REFACTORED CLASSIFIER (No ALLONGE Type) ===\n');
  
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
      
      console.log(`✅ Processed: ${markdown.length} chars`);
      
      // Test NEW classifier with debug
      console.log('\\n🟢 NEW Classifier:');
      const result = await newClassifier.classify(markdown);
      
      const isCorrect = result.documentType === test.expectedType;
      
      console.log(`\\n📊 Results:`);
      console.log(`Prediction: ${isCorrect ? '✅' : '❌'} ${result.documentType} (confidence: ${result.confidence})`);
      
      // Enhanced endorsement information
      if (result.hasEndorsements) {
        console.log(`\\n🔗 Endorsement Analysis:`);
        console.log(`  Chain Length: ${result.endorsementCount}`);
        console.log(`  Ends in Blank: ${result.endsInBlank ? 'YES' : 'NO'}`);
        console.log(`  Ends with Current Investor: ${result.endsWithCurrentInvestor ? 'YES' : 'NO'}`);
        console.log(`  Chain Details:`);
        result.endorsementChain?.forEach((endorsement, i) => {
          console.log(`    ${i + 1}. ${endorsement.endorser || 'Unknown'} → ${endorsement.endorsee} (${endorsement.endorsementType})`);
        });
      } else {
        console.log(`\\n🔗 No endorsements found`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${test.file}:`, error instanceof Error ? error.message : error);
    }
  }
}

testRefactoredClassifier().catch(console.error);