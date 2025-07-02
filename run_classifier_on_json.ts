import fs from 'fs';
import path from 'path';
import { DocumentClassifier, DocumentType } from './src/backend/src/ml/documentClassifier';

const OCR_RESULTS_DIR = path.resolve(__dirname, 'ocr_results');

interface TextractResult {
  text: string;
  keyValuePairs: Map<string, string>;
}

async function main() {
  console.log('=== Running Classification on Textract JSONs ===');
  const classifier = new DocumentClassifier();

  const files = fs.readdirSync(OCR_RESULTS_DIR).filter(file => file.endsWith('.json'));
  if (files.length === 0) {
    console.log('⚠️ No JSON files found in ocr_results/.');
    return;
  }

  for (const file of files) {
    const filePath = path.join(OCR_RESULTS_DIR, file);
    const rawJson = fs.readFileSync(filePath, 'utf-8');

    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      console.error(`❌ Failed to parse ${file}: ${err}`);
      continue;
    }

    // Flatten Textract blocks into plain text and key-value map
    const textChunks: string[] = [];
    const keyValuePairs: Map<string, string> = new Map();

    for (const page of parsed) {
      const blocks = page.Blocks || [];
      for (const block of blocks) {
        if (block.BlockType === 'LINE' && block.Text) {
          textChunks.push(block.Text);
        }
        if (block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY')) {
          const key = block.Text || block.Id || 'Unknown Key';
          const valueId = block.Relationships?.find(r => r.Type === 'VALUE')?.Ids?.[0];
          keyValuePairs.set(key, valueId || 'Unknown Value');
        }
      }
    }

    const textractResult: TextractResult = {
      text: textChunks.join(' '),
      keyValuePairs,
    };

    const result = await classifier.classify(textractResult);

    console.log(`📄 ${file}`);
    console.log(`   → Predicted Type: ${result.documentType}`);
    console.log(`   → Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   → Score Breakdown:`);

    for (const [docType, score] of result.scores.entries()) {
      console.log(`      - ${docType}: ${score.toFixed(2)}`);
    }

    console.log('');
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
});
