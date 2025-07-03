import * as fs from 'fs';
import * as path from 'path';
import { DocumentClassifier, DocumentType } from './src/backend/src/ml/documentClassifier';

// Load all test cases from document_labels.csv data
const testCases = [
  { fileName: '0240610110_NOTE.pdf', trueType: 'Note' },
  { fileName: '03_Mortgages__Deeds_of_Trust_10K_060904.pdf', trueType: 'Mortgage' },
  { fileName: '100011939Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '100011939_Hakani_Note.pdf', trueType: 'Note' },
  { fileName: '100011939_Hakani_Recorded_Mortgage.pdf', trueType: 'Mortgage' },
  { fileName: '100011939_Recorded_Assignment_to_ATC.pdf', trueType: 'Assignment' },
  { fileName: '1005188261Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '1005188261_Recorded_Assignment_to_ATC.pdf', trueType: 'Assignment' },
  { fileName: '1005345774Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '1005345774_Lemieux_AOM_MERS_to_NS181_LLC.pdf', trueType: 'Assignment' },
  { fileName: '1005345774_Lemieux_Note.pdf', trueType: 'Note' },
  { fileName: '1005345774_Recorded_Assignment_to_ATC.pdf', trueType: 'Assignment' },
  { fileName: '1005855303ALLONGE.pdf', trueType: 'Allonge' },
  { fileName: '1006344415ALLONGE.pdf', trueType: 'Allonge' },
  { fileName: '1006344787ALLONGE.pdf', trueType: 'Allonge' },
  { fileName: '1006344787Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '1006344787_Recorded_Assignment_to_ATC.pdf', trueType: 'Assignment' },
  { fileName: '1006344978ALLONGE.pdf', trueType: 'Allonge' },
  { fileName: '1006344978Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '1006344978_Recorded_Assignment_to_ATC.pdf', trueType: 'Assignment' },
  { fileName: '1006346264ALLONGE.pdf', trueType: 'Allonge' },
  { fileName: '1006346471ALLONGE.pdf', trueType: 'Allonge' },
  { fileName: '1098805Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '1098805Recorded_Assignment_to_ATC.pdf', trueType: 'Assignment' },
  { fileName: '1098805_Alvarez_Allonge_to_NS162_LLC.pdf', trueType: 'Allonge' },
  { fileName: '11939_Hakani__aom_SFRV_20111_to_MERS.pdf', trueType: 'Assignment' },
  { fileName: '160868Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '160868_Johnson_Recorded_AOM_Christiana_to_SN.pdf', trueType: 'Assignment' },
  { fileName: '160868_Johnson_Recorded_AOM_SN_to_WFF.pdf', trueType: 'Assignment' },
  { fileName: '160868_Johnson_Recorded_AOM_WFF_to_SRP.pdf', trueType: 'Assignment' },
  { fileName: '160868_Recorded_Assignment_to_ATC.pdf', trueType: 'Assignment' },
  { fileName: '161126Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '161126Recorded_Assignment_to_ATC.pdf', trueType: 'Assignment' },
  { fileName: '179052Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '179052_See_Allonge_to_SRP_20137_LLC.pdf', trueType: 'Allonge' },
  { fileName: '179052_See_Note__Allonge.pdf', trueType: 'Note' },
  { fileName: '179052_See_Note_w_Allonge.pdf', trueType: 'Note' },
  { fileName: '179052_See_Recorded_Mortgage.pdf', trueType: 'Mortgage' },
  { fileName: '197844Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '197844Recorded_Assignment_to_ATC.pdf', trueType: 'Assignment' },
  { fileName: '197844_ROBINSON_REC_AOM_WFF_TO_SRP_2013.2_LLC.pdf', trueType: 'Assignment' },
  { fileName: '197844_revised_allonge_SN_Commercial_to_WFF.pdf', trueType: 'Allonge' },
  { fileName: '20011671COLLATERAL.pdf', trueType: 'Other' },
  { fileName: '20011671Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '20011671_Lalone_Original_Note_Confirm.pdf', trueType: 'Note' },
  { fileName: '20011671_Recorded_Assignment_to_ATC.pdf', trueType: 'Assignment' },
  { fileName: '20011671__aom_to_srp.pdf', trueType: 'Assignment' },
  { fileName: '240610110Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '240610110_Recorded_Assignment_to_ATC.pdf', trueType: 'Assignment' },
  { fileName: '247305968Note_Allonge_to_ATC.pdf', trueType: 'Allonge' },
  { fileName: '247305968___286044___Mortgage_Joachin.pdf', trueType: 'Mortgage' },
  { fileName: '247305968___286044___Note_Joachin.pdf', trueType: 'Note' },
  { fileName: 'Allonge_0000160868_07.15.98.pdf', trueType: 'Allonge' },
  { fileName: 'Credit_File_Documents__01_10258655Note.pdf', trueType: 'Note' },
  { fileName: 'Credit_File_Documents__07_10258719RecMtg.pdf', trueType: 'Mortgage' },
  { fileName: 'Deed_of_Trust_0000160868_07.15.98.pdf', trueType: 'Deed of Trust' },
  { fileName: 'Deed_of_Trust_0000197844_07.06.05.pdf', trueType: 'Deed of Trust' },
  { fileName: 'Deed_of_Trust_RECORDED_0000161126_09.01.98__Copy.pdf', trueType: 'Deed of Trust' },
  { fileName: 'Note_0000160868_07.15.98.pdf', trueType: 'Note' },
  { fileName: 'Note_0000161126_09.01.98__Copy.pdf', trueType: 'Note' }
];

// Map string types to DocumentType enum
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

async function main() {
  console.log('=== Testing Classifier Improvements ===\n');
  
  const classifier = new DocumentClassifier();
  const ocrResultsDir = '/Users/michaelzimmerman/Documents/nplvision/ocr_results';
  
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
  
  // Process each test case
  for (const testCase of testCases) {
    const ocrFile = testCase.fileName.replace('.pdf', '.json');
    const ocrPath = path.join(ocrResultsDir, ocrFile);
    
    if (!fs.existsSync(ocrPath)) {
      console.log(`Skipping ${testCase.fileName} - no OCR results found`);
      continue;
    }
    
    try {
      console.log(`Processing: ${testCase.fileName}`);
      
      // Load OCR results
      const ocrData = JSON.parse(fs.readFileSync(ocrPath, 'utf-8'));
      const textractResult = createTextractResult(ocrData);
      
      console.log(`  Text length: ${textractResult.text.length} characters`);
      console.log(`  Text preview: "${textractResult.text.substring(0, 100)}..."`);
      
      // Classify
      const classification = await classifier.classify(textractResult);
      
      // Map back to string type
      const predictedType = classification.documentType;
      const mappedType = Object.entries(labelToDocumentType)
        .find(([label, type]) => type === predictedType)?.[0] || 'Other';
      
      const isCorrect = mappedType === testCase.trueType;
      console.log(`  True: ${testCase.trueType}, Predicted: ${mappedType} (${(classification.confidence * 100).toFixed(1)}%) ${isCorrect ? '✓' : '✗'}`);
      
      // Show score breakdown
      console.log('  Score breakdown:');
      for (const [docType, score] of classification.scores.entries()) {
        console.log(`    ${docType}: ${score.toFixed(2)}`);
      }
      
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
    console.log('');
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
    if (precision[type] > 0 || recall[type] > 0 || f1Score[type] > 0) {
      console.log(
        type.padEnd(15) +
        `${(precision[type] * 100).toFixed(1)}%`.padEnd(12) +
        `${(recall[type] * 100).toFixed(1)}%`.padEnd(12) +
        `${(f1Score[type] * 100).toFixed(1)}%`
      );
    }
  });
  
  // Print confusion matrix
  console.log('\n=== CONFUSION MATRIX ===');
  console.log('Rows: True Type, Columns: Predicted Type\n');
  
  const colWidth = 12;
  process.stdout.write(''.padEnd(colWidth));
  allTypes.forEach(type => {
    process.stdout.write(type.padEnd(colWidth));
  });
  console.log();
  
  console.log('-'.repeat(colWidth * (allTypes.length + 1)));
  
  allTypes.forEach(trueType => {
    process.stdout.write(trueType.padEnd(colWidth));
    allTypes.forEach(predType => {
      const count = confusionMatrix[trueType][predType] || 0;
      process.stdout.write(count.toString().padEnd(colWidth));
    });
    console.log();
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