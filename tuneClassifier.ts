import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import * as dotenv from 'dotenv';
import { TextractClient, AnalyzeDocumentCommand, Block, AnalyzeDocumentCommandInput } from '@aws-sdk/client-textract';
import { DocumentClassifier, DocumentType } from './src/backend/src/ml/documentClassifier';
import { TextractResult } from './src/backend/src/ocr/textractClient';

// Load environment variables from multiple possible locations
dotenv.config(); // Load from root .env
dotenv.config({ path: path.join(__dirname, 'src', 'backend', '.env') }); // Load from backend .env
dotenv.config({ path: path.join(__dirname, '.env.local') }); // Load from root .env.local

// Standalone TextractService for tuning script to avoid config path dependencies
class TuningTextractService {
  private client: TextractClient;

  constructor() {
    this.client = new TextractClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async analyzeDocument(pdfBuffer: Buffer): Promise<TextractResult> {
    const params: AnalyzeDocumentCommandInput = {
      Document: {
        Bytes: pdfBuffer,
      },
      FeatureTypes: ['FORMS', 'TABLES'],
    };

    try {
      const command = new AnalyzeDocumentCommand(params);
      const response = await this.client.send(command);
      
      if (!response.Blocks) {
        throw new Error('No blocks returned from Textract');
      }

      return this.processTextractResponse(response.Blocks);
    } catch (error: unknown) {
      console.error('Textract analysis failed:', error);
      if (error instanceof Error) {
        throw new Error(`OCR processing failed: ${error.message}`);
      }
      throw new Error('OCR processing failed: Unknown error');
    }
  }

  private processTextractResponse(blocks: Block[]): TextractResult {
    const keyValuePairs = new Map<string, string>();
    const tables: any[] = [];
    let fullText = '';
    let totalConfidence = 0;
    let confidenceCount = 0;

    // Build block map for relationship lookups
    const blockMap = new Map<string, Block>();
    blocks.forEach(block => {
      if (block.Id) {
        blockMap.set(block.Id, block);
      }
    });

    // Process each block
    blocks.forEach(block => {
      // Extract text
      if (block.BlockType === 'LINE' && block.Text) {
        fullText += block.Text + '\n';
      }

      // Track confidence
      if (block.Confidence) {
        totalConfidence += block.Confidence;
        confidenceCount++;
      }

      // Extract key-value pairs
      if (block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY')) {
        const key = this.getTextFromRelationships(block, blockMap, 'VALUE');
        const value = this.getValueFromKey(block, blocks, blockMap);
        if (key && value) {
          keyValuePairs.set(key, value);
        }
      }

      // Extract tables (simplified for MVP)
      if (block.BlockType === 'TABLE') {
        tables.push(this.extractTable(block, blockMap));
      }
    });

    return {
      text: fullText.trim(),
      keyValuePairs,
      tables,
      confidence: confidenceCount > 0 ? totalConfidence / confidenceCount / 100 : 0, // Convert to 0-1 scale
      blocks,
    };
  }

  private getTextFromRelationships(block: Block, blockMap: Map<string, Block>, relationshipType: string): string {
    if (!block.Relationships) return '';

    const relationship = block.Relationships.find(r => r.Type === relationshipType);
    if (!relationship || !relationship.Ids) return '';

    let text = '';
    relationship.Ids.forEach(id => {
      const relatedBlock = blockMap.get(id);
      if (relatedBlock && relatedBlock.Text) {
        text += relatedBlock.Text + ' ';
      }
    });

    return text.trim();
  }

  private getValueFromKey(keyBlock: Block, blocks: Block[], blockMap: Map<string, Block>): string {
    if (!keyBlock.Relationships) return '';

    const valueRelationship = keyBlock.Relationships.find(r => r.Type === 'VALUE');
    if (!valueRelationship || !valueRelationship.Ids) return '';

    const valueBlockId = valueRelationship.Ids[0];
    const valueBlock = blocks.find(b => b.Id === valueBlockId && b.BlockType === 'KEY_VALUE_SET');
    
    if (!valueBlock) return '';

    return this.getTextFromRelationships(valueBlock, blockMap, 'CHILD');
  }

  private extractTable(tableBlock: Block, blockMap: Map<string, Block>): any {
    // Simplified table extraction for MVP
    const cells: any[] = [];
    
    if (tableBlock.Relationships) {
      tableBlock.Relationships.forEach(relationship => {
        if (relationship.Type === 'CHILD' && relationship.Ids) {
          relationship.Ids.forEach(cellId => {
            const cellBlock = blockMap.get(cellId);
            if (cellBlock && cellBlock.BlockType === 'CELL') {
              cells.push({
                rowIndex: cellBlock.RowIndex || 0,
                columnIndex: cellBlock.ColumnIndex || 0,
                text: this.getTextFromRelationships(cellBlock, blockMap, 'CHILD'),
              });
            }
          });
        }
      });
    }

    return { cells };
  }
}

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
  ocrFailures: string[];
  ocrFailureRate: number;
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

// Helper function to check if Textract output is empty or unusable
function isTextractOutputEmpty(result: TextractResult): boolean {
  // Check if text is empty or only whitespace
  if (!result.text || result.text.trim().length === 0) {
    return true;
  }
  
  // Check if blocks array is empty or has no meaningful content
  if (!result.blocks || result.blocks.length === 0) {
    return true;
  }
  
  // Check if confidence is too low (below 50%)
  if (result.confidence < 0.5) {
    return true;
  }
  
  // Check if the text is too short to be a real document (less than 50 characters)
  if (result.text.trim().length < 50) {
    return true;
  }
  
  // Count words in the text
  const wordCount = result.text.trim().split(/\s+/).filter(word => word.length > 0).length;
  if (wordCount < 10) {
    return true;
  }
  
  return false;
}

// Create logs directory if it doesn't exist
function ensureLogsDirectory(): void {
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('Created logs directory');
  }
}

// Log OCR failure to file
function logOCRFailure(fileName: string, reason: string): void {
  const logPath = path.join(__dirname, 'logs', 'ocr_failures.log');
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${fileName} - ${reason}\n`;
  
  fs.appendFileSync(logPath, logEntry);
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
        console.log(`Loaded ${testCases.length} test cases from CSV`);
        resolve(testCases);
      })
      .on('error', reject);
  });
}

// Use real Textract OCR to process PDFs
async function performOCR(fileName: string, textractService: TuningTextractService) {
  const pdfPath = path.join(__dirname, 'docs', 'test_set', fileName);
  
  // Check if file exists
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }
  
  // Read PDF file
  const pdfBuffer = fs.readFileSync(pdfPath);
  console.log(`  PDF file size: ${pdfBuffer.length} bytes`);
  
  // Run actual OCR using Textract
  console.log(`  Running OCR on ${fileName}...`);
  const startTime = Date.now();
  
  try {
    const textractResult = await textractService.analyzeDocument(pdfBuffer);
    const ocrTime = Date.now() - startTime;
    console.log(`  OCR completed in ${ocrTime}ms`);
    console.log(`  Extracted text preview: "${textractResult.text.substring(0, 100)}..."`);
    console.log(`  Blocks found: ${textractResult.blocks?.length || 0}`);
    console.log(`  Key-value pairs: ${textractResult.keyValuePairs?.size || 0}`);
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
    ocrFailures: [], // Will be populated in main()
    ocrFailureRate: 0, // Will be populated in main()
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
  
  // Ensure logs directory exists
  ensureLogsDirectory();
  
  // Clear previous OCR failures log
  const ocrFailuresLogPath = path.join(__dirname, 'logs', 'ocr_failures.log');
  if (fs.existsSync(ocrFailuresLogPath)) {
    fs.unlinkSync(ocrFailuresLogPath);
  }
  
  // Check AWS credentials and provide detailed debugging
  console.log('AWS Region:', process.env.AWS_REGION || 'us-east-1');
  console.log('AWS Access Key ID:', process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...` : 'NOT SET');
  console.log('AWS Secret Access Key:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
  
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('\nERROR: AWS credentials not found in environment variables');
    console.error('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
    console.error('\nYou can set them by:');
    console.error('1. Creating a .env file in the project root with:');
    console.error('   AWS_ACCESS_KEY_ID=your_key');
    console.error('   AWS_SECRET_ACCESS_KEY=your_secret');
    console.error('   AWS_REGION=us-east-1');
    console.error('2. Or export them as environment variables');
    process.exit(1);
  }
  
  try {
    // Load test cases
    const testCases = await loadTestCases();
    
    // Initialize services with explicit AWS config
    // Create TuningTextractService with environment variables directly to avoid config path issues
    const textractService = new TuningTextractService();
    const classifier = new DocumentClassifier();
    
    console.log('✓ TuningTextractService initialized with direct environment variables');
    console.log('✓ DocumentClassifier initialized');
    console.log('\nAWS Configuration:');
    console.log(`  Region: ${process.env.AWS_REGION || 'us-east-1'}`);
    console.log(`  Using credentials: ${process.env.AWS_ACCESS_KEY_ID ? 'YES' : 'NO'}`);
    
    // Initialize metrics
    const documentTypes = Array.from(new Set(testCases.map(tc => tc.trueType)));
    const confusionMatrix = initializeConfusionMatrix(documentTypes);
    const misclassified: any[] = [];
    const ocrFailures: string[] = [];
    const emptyOCRFiles: string[] = [];
    
    // Process each test case
    console.log('\nProcessing test cases with real OCR...\n');
    let processed = 0;
    let successfulOCR = 0;
    let successfulClassifications = 0;
    
    for (const testCase of testCases) {
      console.log(`\n[${processed + 1}/${testCases.length}] Processing: ${testCase.fileName}`);
      
      try {
        // Perform real OCR
        const ocrResult = await performOCR(testCase.fileName, textractService);
        
        // Check if OCR output is empty or unusable
        if (isTextractOutputEmpty(ocrResult)) {
          console.log(`  ⚠️  OCR returned empty/unusable content`);
          console.log(`  Text length: ${ocrResult.text?.length || 0}, Confidence: ${(ocrResult.confidence * 100).toFixed(1)}%`);
          console.log(`  Blocks count: ${ocrResult.blocks?.length || 0}`);
          emptyOCRFiles.push(testCase.fileName);
          logOCRFailure(testCase.fileName, `Empty OCR output - text length: ${ocrResult.text?.length || 0}, confidence: ${ocrResult.confidence}, blocks: ${ocrResult.blocks?.length || 0}`);
          processed++;
          continue;
        }
        
        successfulOCR++;
        console.log(`  OCR successful - extracted ${ocrResult.text.length} characters`);
        
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
        
        successfulClassifications++;
        
      } catch (error) {
        console.error(`  Failed to process ${testCase.fileName}:`, error);
        ocrFailures.push(testCase.fileName);
        logOCRFailure(testCase.fileName, `Processing error: ${error}`);
      }
      
      processed++;
    }
    
    console.log(`\n\nProcessing complete!`);
    console.log(`Total files: ${processed}`);
    console.log(`Successful OCR: ${successfulOCR}`);
    console.log(`Empty/Unusable OCR: ${emptyOCRFiles.length}`);
    console.log(`Processing failures: ${ocrFailures.length}`);
    console.log(`Successful classifications: ${successfulClassifications}`);
    
    const totalOCRFailures = ocrFailures.length + emptyOCRFiles.length;
    const ocrFailureRate = totalOCRFailures / processed;
    console.log(`\nOCR failure rate: ${(ocrFailureRate * 100).toFixed(1)}% (${totalOCRFailures}/${processed})`);
    
    if (emptyOCRFiles.length > 0) {
      console.log('\nFiles with empty/unusable OCR:');
      emptyOCRFiles.forEach(file => console.log(`  - ${file}`));
    }
    
    if (ocrFailures.length > 0) {
      console.log('\nFiles with processing errors:');
      ocrFailures.forEach(file => console.log(`  - ${file}`));
    }
    
    // Calculate metrics (only for successful classifications)
    const metrics = calculateMetrics(confusionMatrix, misclassified);
    
    // Add OCR failure information to metrics
    metrics.ocrFailures = [...ocrFailures, ...emptyOCRFiles];
    metrics.ocrFailureRate = ocrFailureRate;
    
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
      successfulClassifications,
      emptyOCRFiles,
      processingErrors: ocrFailures,
      totalOCRFailures,
      ocrFailureRate,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(resultsPath, JSON.stringify(fullResults, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);
    
    // Also save a structured OCR failures JSON
    const ocrFailuresJsonPath = path.join(__dirname, 'logs', 'failed_ocr_files.json');
    const ocrFailuresData = {
      emptyOCR: emptyOCRFiles,
      processingErrors: ocrFailures,
      total: totalOCRFailures,
      rate: ocrFailureRate,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(ocrFailuresJsonPath, JSON.stringify(ocrFailuresData, null, 2));
    console.log(`OCR failures saved to: ${ocrFailuresJsonPath}`);
    
  } catch (error) {
    console.error('Error during classifier tuning:', error);
    process.exit(1);
  }
}

// Run the tuning script
if (require.main === module) {
  main();
}