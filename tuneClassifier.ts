import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { DocumentClassifier, DocumentType } from './src/backend/src/ml/documentClassifier';
import { TextractService } from './src/backend/src/ocr/textractClient';
import { config } from './src/backend/src/config';

interface TestCase {
  fileName: string;
  trueType: string;
}

interface ClassificationMetrics {
  accuracy: number;
  precision: Record<string, number>;
  recall: Record<string, number>;
  f1Score: Record<string, number>;
  confusionMatrix: Record<string, Record<string, number>>;
  misclassified: Array<{
    fileName: string;
    trueType: string;
    predictedType: string;
    confidence: number;
  }>;
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
        console.log(`Loaded ${testCases.length} test cases from CSV`);
        resolve(testCases);
      })
      .on('error', reject);
  });
}

// Use real Textract OCR to process PDFs
async function performOCR(fileName: string, textractService: TextractService) {
  const pdfPath = path.join(__dirname, 'docs', 'test_set', fileName);
  
  // Read PDF file
  const pdfBuffer = fs.readFileSync(pdfPath);
  
  // Run actual OCR using Textract
  console.log(`  Running OCR on ${fileName}...`);
  const startTime = Date.now();
  
  try {
    const textractResult = await textractService.analyzeDocument(pdfBuffer);
    const ocrTime = Date.now() - startTime;
    console.log(`  OCR completed in ${ocrTime}ms`);
    return textractResult;
  } catch (error) {
    console.error(`  OCR failed for ${fileName}:`, error);
    throw error;
  }
}

function initializeConfusionMatrix(types: string[]): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};
  
  types.forEach(trueType => {
    matrix[trueType] = {};
    types.forEach(predType => {
      matrix[trueType][predType] = 0;
    });
  });
  
  return matrix;
}

function calculateMetrics(
  confusionMatrix: Record<string, Record<string, number>>,
  misclassified: any[]
): ClassificationMetrics {
  const types = Object.keys(confusionMatrix);
  let totalCorrect = 0;
  let totalSamples = 0;
  
  const precision: Record<string, number> = {};
  const recall: Record<string, number> = {};
  const f1Score: Record<string, number> = {};
  
  types.forEach(type => {
    let truePositives = confusionMatrix[type][type] || 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    
    // Calculate false positives (predicted as this type but actually other types)
    types.forEach(otherType => {
      if (otherType !== type) {
        falsePositives += confusionMatrix[otherType][type] || 0;
      }
    });
    
    // Calculate false negatives (actually this type but predicted as other types)
    types.forEach(otherType => {
      if (otherType !== type) {
        falseNegatives += confusionMatrix[type][otherType] || 0;
      }
    });
    
    // Calculate metrics
    precision[type] = truePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
    recall[type] = truePositives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    f1Score[type] = (precision[type] + recall[type]) > 0 
      ? 2 * (precision[type] * recall[type]) / (precision[type] + recall[type])
      : 0;
    
    totalCorrect += truePositives;
    totalSamples += truePositives + falseNegatives;
  });
  
  const accuracy = totalSamples > 0 ? totalCorrect / totalSamples : 0;
  
  return {
    accuracy,
    precision,
    recall,
    f1Score,
    confusionMatrix,
    misclassified,
  };
}

function printConfusionMatrix(matrix: Record<string, Record<string, number>>) {
  const types = Object.keys(matrix);
  const colWidth = 12;
  
  // Header
  console.log('\n=== CONFUSION MATRIX ===');
  console.log('Rows: True Type, Columns: Predicted Type\n');
  
  // Column headers
  process.stdout.write(''.padEnd(colWidth));
  types.forEach(type => {
    process.stdout.write(type.padEnd(colWidth));
  });
  console.log();
  
  // Separator
  console.log('-'.repeat(colWidth * (types.length + 1)));
  
  // Data rows
  types.forEach(trueType => {
    process.stdout.write(trueType.padEnd(colWidth));
    types.forEach(predType => {
      const count = matrix[trueType][predType] || 0;
      process.stdout.write(count.toString().padEnd(colWidth));
    });
    console.log();
  });
}

function printMetrics(metrics: ClassificationMetrics) {
  console.log('\n=== CLASSIFICATION METRICS ===');
  console.log(`Overall Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%`);
  
  console.log('\nPer-Class Metrics:');
  console.log('Type'.padEnd(15) + 'Precision'.padEnd(12) + 'Recall'.padEnd(12) + 'F1-Score');
  console.log('-'.repeat(51));
  
  Object.keys(metrics.precision).forEach(type => {
    console.log(
      type.padEnd(15) +
      `${(metrics.precision[type] * 100).toFixed(1)}%`.padEnd(12) +
      `${(metrics.recall[type] * 100).toFixed(1)}%`.padEnd(12) +
      `${(metrics.f1Score[type] * 100).toFixed(1)}%`
    );
  });
}

function analyzeMisclassifications(misclassified: any[]) {
  console.log('\n=== MISCLASSIFICATION ANALYSIS ===');
  console.log(`Total misclassified: ${misclassified.length}`);
  
  // Group by error pattern
  const errorPatterns: Record<string, number> = {};
  misclassified.forEach(item => {
    const pattern = `${item.trueType} -> ${item.predictedType}`;
    errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
  });
  
  console.log('\nError Patterns (sorted by frequency):');
  Object.entries(errorPatterns)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count} occurrences`);
    });
  
  console.log('\nDetailed Misclassifications:');
  misclassified
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 10)
    .forEach(item => {
      console.log(`  ${item.fileName}`);
      console.log(`    True: ${item.trueType}, Predicted: ${item.predictedType} (confidence: ${(item.confidence * 100).toFixed(1)}%)`);
    });
}

function suggestImprovements(metrics: ClassificationMetrics, misclassified: any[]) {
  console.log('\n=== SUGGESTED IMPROVEMENTS ===');
  
  // Analyze common misclassification patterns
  const errorPatterns: Record<string, string[]> = {};
  misclassified.forEach(item => {
    const pattern = `${item.trueType}_to_${item.predictedType}`;
    if (!errorPatterns[pattern]) {
      errorPatterns[pattern] = [];
    }
    errorPatterns[pattern].push(item.fileName);
  });
  
  // Specific suggestions based on patterns
  console.log('\n1. Pattern-based improvements:');
  
  if (errorPatterns['Allonge_to_Note']) {
    console.log('   - Allonge misclassified as Note: Add more specific Allonge keywords');
    console.log('     Suggested keywords: "attached to note", "endorsement attached", "allonge to note"');
  }
  
  if (errorPatterns['Assignment_to_Other']) {
    console.log('   - Assignment misclassified as Other: Strengthen Assignment detection');
    console.log('     Suggested keywords: "assigns all right", "transfer and assign", "successor and assigns"');
  }
  
  if (errorPatterns['Mortgage_to_Deed of Trust'] || errorPatterns['Deed of Trust_to_Mortgage']) {
    console.log('   - Mortgage/Deed of Trust confusion: Add regional variations');
    console.log('     Consider state-specific terminology and format differences');
  }
  
  // Low precision/recall suggestions
  console.log('\n2. Metric-based improvements:');
  Object.entries(metrics.precision).forEach(([type, precision]) => {
    if (precision < 0.8) {
      console.log(`   - Low precision for ${type} (${(precision * 100).toFixed(1)}%): Too many false positives`);
      console.log(`     Consider increasing required keyword threshold or adding negative patterns`);
    }
  });
  
  Object.entries(metrics.recall).forEach(([type, recall]) => {
    if (recall < 0.8) {
      console.log(`   - Low recall for ${type} (${(recall * 100).toFixed(1)}%): Missing true cases`);
      console.log(`     Consider adding more keyword variations or reducing required keywords`);
    }
  });
  
  console.log('\n3. General recommendations:');
  console.log('   - Consider implementing a two-stage classifier:');
  console.log('     Stage 1: Broad category (Note/Security Instrument/Transfer)');
  console.log('     Stage 2: Specific type within category');
  console.log('   - Add negative keywords to reduce false positives');
  console.log('   - Implement TF-IDF weighting for keywords');
  console.log('   - Consider document structure patterns (e.g., signature blocks)');
}

async function main() {
  console.log('=== DOCUMENT CLASSIFIER TUNING ===\n');
  
  // Check AWS credentials
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('ERROR: AWS credentials not found in environment variables');
    console.error('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
    process.exit(1);
  }
  
  try {
    // Load test cases
    const testCases = await loadTestCases();
    
    // Initialize services
    const textractService = new TextractService();
    const classifier = new DocumentClassifier();
    
    // Initialize metrics
    const documentTypes = Array.from(new Set(testCases.map(tc => tc.trueType)));
    const confusionMatrix = initializeConfusionMatrix(documentTypes);
    const misclassified: any[] = [];
    const ocrFailures: string[] = [];
    
    // Process each test case
    console.log('\nProcessing test cases with real OCR...\n');
    let processed = 0;
    let successfulOCR = 0;
    
    for (const testCase of testCases) {
      console.log(`\n[${processed + 1}/${testCases.length}] Processing: ${testCase.fileName}`);
      
      try {
        // Perform real OCR
        const ocrResult = await performOCR(testCase.fileName, textractService);
        successfulOCR++;
        
        // Classify using real OCR output
        console.log(`  Classifying document...`);
        const classification = await classifier.classify(ocrResult);
        
        // Map back to string type
        const predictedType = classification.documentType;
        const mappedType = Object.entries(labelToDocumentType)
          .find(([label, type]) => type === predictedType)?.[0] || 'Other';
        
        // Log individual result
        console.log(`  True type: ${testCase.trueType}`);
        console.log(`  Predicted: ${mappedType} (confidence: ${(classification.confidence * 100).toFixed(1)}%)`);
        console.log(`  Result: ${mappedType === testCase.trueType ? '✓ CORRECT' : '✗ INCORRECT'}`);
        
        // Update confusion matrix
        confusionMatrix[testCase.trueType][mappedType] = 
          (confusionMatrix[testCase.trueType][mappedType] || 0) + 1;
        
        // Track misclassifications
        if (mappedType !== testCase.trueType) {
          misclassified.push({
            fileName: testCase.fileName,
            trueType: testCase.trueType,
            predictedType: mappedType,
            confidence: classification.confidence,
            ocrTextLength: ocrResult.text.length,
            keyValuePairs: ocrResult.keyValuePairs.size,
          });
        }
        
      } catch (error) {
        console.error(`  Failed to process ${testCase.fileName}:`, error);
        ocrFailures.push(testCase.fileName);
      }
      
      processed++;
    }
    
    console.log(`\n\nProcessing complete!`);
    console.log(`Total files: ${processed}`);
    console.log(`Successful OCR: ${successfulOCR}`);
    console.log(`OCR failures: ${ocrFailures.length}`);
    
    if (ocrFailures.length > 0) {
      console.log('\nFailed files:');
      ocrFailures.forEach(file => console.log(`  - ${file}`));
    }
    
    // Calculate metrics (only for successful OCR)
    const metrics = calculateMetrics(confusionMatrix, misclassified);
    
    // Print results
    printConfusionMatrix(metrics.confusionMatrix);
    printMetrics(metrics);
    analyzeMisclassifications(metrics.misclassified);
    suggestImprovements(metrics, metrics.misclassified);
    
    // Save results to file
    const resultsPath = path.join(__dirname, 'classifier_tuning_results.json');
    const fullResults = {
      ...metrics,
      totalFiles: testCases.length,
      successfulOCR,
      ocrFailures,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(resultsPath, JSON.stringify(fullResults, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);
    
  } catch (error) {
    console.error('Error during classifier tuning:', error);
    process.exit(1);
  }
}

// Run the tuning script
if (require.main === module) {
  main();
}