import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';
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

async function testThresholdFix() {
  const classifier = new MarkdownDocumentClassifierNew();
  const fileName = 'ALLONGE_24381506.PDF';
  
  console.log('=== TESTING THRESHOLD FIX FOR STANDALONE ALLONGE ===\n');
  
  const docPath = path.join('/Users/michaelzimmerman/Documents/nplvision-rebuild/nplvision-clean/docs/test_set', fileName);
  
  if (!fs.existsSync(docPath)) {
    console.log(`❌ File not found: ${fileName}`);
    return;
  }
  
  console.log(`📄 Testing: ${fileName}`);
  console.log(`Expected type: Note (with endorsements)`);
  console.log('---');
  
  try {
    const pdfBuffer = fs.readFileSync(docPath);
    const markdown = await processPdfWithDoctly(pdfBuffer, fileName);
    
    console.log(`✅ Processed: ${markdown.length} chars`);
    console.log(`First 200 chars: ${markdown.substring(0, 200)}`);
    
    console.log('\n🟢 NEW Classifier with enhanced endorsement handling:');
    const result = await classifier.classify(markdown);
    
    const isCorrect = result.documentType === DocumentType.NOTE;
    
    console.log(`\n📊 Results:`);
    console.log(`Prediction: ${isCorrect ? '✅' : '❌'} ${result.documentType} (confidence: ${result.confidence})`);
    
    if (result.hasEndorsements) {
      console.log(`\n🔗 Endorsement Analysis:`);
      console.log(`  Chain Length: ${result.endorsementCount}`);
      console.log(`  Ends in Blank: ${result.endsInBlank ? 'YES' : 'NO'}`);
      console.log(`  Ends with Current Investor: ${result.endsWithCurrentInvestor ? 'YES' : 'NO'}`);
      console.log(`  Chain Details:`);
      result.endorsementChain?.forEach((endorsement, i) => {
        console.log(`    ${i + 1}. ${endorsement.endorser || 'Unknown'} → ${endorsement.endorsee} (${endorsement.endorsementType})`);
      });
    }
    
    console.log(`\nStatus: ${isCorrect ? '🎉 FIXED!' : '❌ Still needs work'}`);
    
  } catch (error) {
    console.error(`❌ Error processing ${fileName}:`, error instanceof Error ? error.message : error);
  }
}

testThresholdFix().catch(console.error);