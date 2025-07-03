import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { DocumentClassifier, DocumentType } from './src/backend/src/ml/documentClassifier';

// Interface for test cases
interface TestCase {
  fileName: string;
  trueType: string;
}

// Map CSV labels to DocumentType enum
const labelToDocumentType: Record<string, DocumentType> = {
  'Note': DocumentType.NOTE,
  'Mortgage': DocumentType.MORTGAGE,
  'Deed of Trust': DocumentType.DEED_OF_TRUST,
  'Allonge': DocumentType.ALLONGE,
  'Assignment': DocumentType.ASSIGNMENT,
  'Other': DocumentType.OTHER,
};

// Create a compatible TextractResult from JSON
function createTextractResult(jsonData: any) {
  const textChunks: string[] = [];
  const keyValuePairs = new Map<string, string>();

  // Process each page in the Textract response
  for (const page of jsonData) {
    const blocks = page.Blocks || [];
    for (const block of blocks) {
      if (block.BlockType === 'LINE' && block.Text) {
        textChunks.push(block.Text);
      }
      if (block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY')) {
        const key = block.Text || block.Id || 'Unknown Key';
        const valueId = block.Relationships?.find((r: any) => r.Type === 'VALUE')?.Ids?.[0];
        keyValuePairs.set(key, valueId || 'Unknown Value');
      }
    }
  }

  return {
    text: textChunks.join(' '),
    keyValuePairs,
    tables: [],
    confidence: 0.9,
    blocks: jsonData[0]?.Blocks || []
  };
}

async function loadTestCases(): Promise<TestCase[]> {
  return new Promise((resolve, reject) => {
    const testCases: TestCase[] = [];
    const csvPath = path.join(__dirname, 'docs', 'test_set', 'document_labels.csv');
    
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => {
        testCases.push({
          fileName: data.file_name,
          trueType: data.true_type,
        });
      })
      .on('end', () => {
        resolve(testCases);
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('=== Testing Classifier Improvements ===\n');
  
  const classifier = new DocumentClassifier();
  const ocrResultsDir = path.join(__dirname, 'ocr_results');
  
  // Check if OCR results directory exists
  if (!fs.existsSync(ocrResultsDir)) {
    console.log('No OCR results directory found. Using available JSON files...');
    return;
  }
  
  // Load test cases
  const testCases = await loadTestCases();
  console.log(`Loaded ${testCases.length} test cases`);
  
  // Initialize metrics
  const confusionMatrix: Record<string, Record<string, number>> = {};
  const allTypes = ['Note', 'Mortgage', 'Deed of Trust', 'Allonge', 'Assignment', 'Other'];
  
  // Initialize confusion matrix
  allTypes.forEach(trueType => {
    confusionMatrix[trueType] = {};
    allTypes.forEach(predType => {
      confusionMatrix[trueType][predType] = 0;
    });
  });
  
  const misclassified: any[] = [];
  let processed = 0;
  let successfulClassifications = 0;
  
  // Process each test case that has OCR results
  for (const testCase of testCases) {
    const ocrFile = testCase.fileName.replace('.pdf', '.json');
    const ocrPath = path.join(ocrResultsDir, ocrFile);
    
    if (!fs.existsSync(ocrPath)) {
      continue; // Skip files without OCR results
    }
    
    try {
      console.log(`Processing: ${testCase.fileName}`);
      
      // Load OCR results
      const ocrData = JSON.parse(fs.readFileSync(ocrPath, 'utf-8'));
      const textractResult = createTextractResult(ocrData);
      
      // Classify
      const classification = await classifier.classify(textractResult);
      
      // Map back to string type
      const predictedType = classification.documentType;
      const mappedType = Object.entries(labelToDocumentType)
        .find(([label, type]) => type === predictedType)?.[0] || 'Other';
      
      console.log(`  True: ${testCase.trueType}, Predicted: ${mappedType} (${(classification.confidence * 100).toFixed(1)}%)`);
      
      // Update confusion matrix
      confusionMatrix[testCase.trueType][mappedType]++;
      
      // Track misclassifications
      if (mappedType !== testCase.trueType) {
        misclassified.push({
          fileName: testCase.fileName,
          trueType: testCase.trueType,
          predictedType: mappedType,
          confidence: classification.confidence,
          ocrTextLength: textractResult.text.length,
          keyValuePairs: textractResult.keyValuePairs.size,
        });
      }
      
      successfulClassifications++;
      
    } catch (error) {
      console.error(`Failed to process ${testCase.fileName}:`, error);
    }
    
    processed++;
  }
  
  console.log(`\nProcessed ${processed} files, ${successfulClassifications} successful classifications\n`);
  
  // Calculate metrics
  const precision: Record<string, number> = {};
  const recall: Record<string, number> = {};
  const f1Score: Record<string, number> = {};
  
  let totalCorrect = 0;
  let totalSamples = 0;
  
  allTypes.forEach(type => {
    let truePositives = confusionMatrix[type][type] || 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    
    // Calculate false positives and negatives
    allTypes.forEach(otherType => {
      if (otherType !== type) {
        falsePositives += confusionMatrix[otherType][type] || 0;
        falseNegatives += confusionMatrix[type][otherType] || 0;
      }
    });
    
    precision[type] = truePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
    recall[type] = truePositives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    f1Score[type] = (precision[type] + recall[type]) > 0 
      ? 2 * (precision[type] * recall[type]) / (precision[type] + recall[type])
      : 0;
    
    totalCorrect += truePositives;
    totalSamples += truePositives + falseNegatives;
  });
  
  const accuracy = totalSamples > 0 ? totalCorrect / totalSamples : 0;
  
  // Print results
  console.log('=== CLASSIFICATION RESULTS ===');
  console.log(`Overall Accuracy: ${(accuracy * 100).toFixed(2)}%\n`);
  
  console.log('Per-Class Metrics:');
  console.log('Type'.padEnd(15) + 'Precision'.padEnd(12) + 'Recall'.padEnd(12) + 'F1-Score');
  console.log('-'.repeat(51));
  
  allTypes.forEach(type => {
    console.log(
      type.padEnd(15) +
      `${(precision[type] * 100).toFixed(1)}%`.padEnd(12) +
      `${(recall[type] * 100).toFixed(1)}%`.padEnd(12) +
      `${(f1Score[type] * 100).toFixed(1)}%`
    );
  });
  
  // Save results
  const results = {
    accuracy,
    precision,
    recall,
    f1Score,
    confusionMatrix,
    misclassified,
    totalFiles: testCases.length,
    successfulOCR: processed,
    successfulClassifications,
    timestamp: new Date().toISOString(),
  };
  
  fs.writeFileSync(path.join(__dirname, 'classifier_tuning_results.json'), JSON.stringify(results, null, 2));
  console.log('\nResults saved to classifier_tuning_results.json');
}

main().catch(console.error);