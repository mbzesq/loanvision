import * as fs from 'fs';
import * as path from 'path';

// Read the raw results
const rawResults = fs.readFileSync('/tmp/nplvision/classifier_tuning_results.json', 'utf-8');

// Parse the results
const lines = rawResults.split('\n');
const results: any[] = [];

let currentResult: any = null;

for (const line of lines) {
  if (line.includes('📄')) {
    if (currentResult) {
      results.push(currentResult);
    }
    const fileName = line.match(/📄 (.+)$/)?.[1] || '';
    currentResult = {
      fileName,
      predicted: '',
      confidence: 0,
      scores: {}
    };
  } else if (line.includes('→ Predicted Type:')) {
    if (currentResult) {
      currentResult.predicted = line.match(/→ Predicted Type: (.+)$/)?.[1] || '';
    }
  } else if (line.includes('→ Confidence:')) {
    if (currentResult) {
      const conf = line.match(/→ Confidence: ([\d.]+)%/)?.[1];
      currentResult.confidence = conf ? parseFloat(conf) / 100 : 0;
    }
  } else if (line.includes('- ') && currentResult) {
    const match = line.match(/- (.+): ([\d.]+)/);
    if (match) {
      currentResult.scores[match[1]] = parseFloat(match[2]);
    }
  }
}

if (currentResult) {
  results.push(currentResult);
}

// Map true labels based on file names
const getTrueType = (fileName: string): string => {
  const fn = fileName.toLowerCase();
  if (fn.includes('note') && !fn.includes('allonge')) return 'Note';
  if (fn.includes('mortgage') && !fn.includes('assignment')) return 'Security Instrument';
  if (fn.includes('deed_of_trust') || fn.includes('deed of trust')) return 'Security Instrument';
  if (fn.includes('allonge')) return 'Allonge';
  if (fn.includes('assignment') || fn.includes('aom')) return 'Assignment';
  return 'Other';
};

// Calculate metrics
const metrics: any = {
  'Note': { tp: 0, fp: 0, fn: 0, total: 0 },
  'Security Instrument': { tp: 0, fp: 0, fn: 0, total: 0 },
  'Allonge': { tp: 0, fp: 0, fn: 0, total: 0 },
  'Assignment': { tp: 0, fp: 0, fn: 0, total: 0 },
  'Other': { tp: 0, fp: 0, fn: 0, total: 0 }
};

// Process each result
for (const result of results) {
  const trueType = getTrueType(result.fileName);
  const predictedType = result.predicted;
  
  metrics[trueType].total++;
  
  if (trueType === predictedType) {
    metrics[trueType].tp++;
  } else {
    metrics[trueType].fn++;
    if (metrics[predictedType]) {
      metrics[predictedType].fp++;
    }
  }
}

// Calculate precision, recall, and F1
const summary: any = {
  totalFiles: results.length,
  overallAccuracy: 0,
  byDocumentType: {}
};

let correctPredictions = 0;

for (const [docType, counts] of Object.entries(metrics) as [string, any][]) {
  const precision = counts.tp / (counts.tp + counts.fp) || 0;
  const recall = counts.tp / (counts.tp + counts.fn) || 0;
  const f1 = 2 * (precision * recall) / (precision + recall) || 0;
  
  correctPredictions += counts.tp;
  
  summary.byDocumentType[docType] = {
    total: counts.total,
    correct: counts.tp,
    precision: parseFloat((precision * 100).toFixed(2)),
    recall: parseFloat((recall * 100).toFixed(2)),
    f1Score: parseFloat((f1 * 100).toFixed(2))
  };
}

summary.overallAccuracy = parseFloat(((correctPredictions / results.length) * 100).toFixed(2));

// Add detailed results
summary.detailedResults = results.map(r => ({
  fileName: r.fileName,
  trueType: getTrueType(r.fileName),
  predictedType: r.predicted,
  confidence: r.confidence,
  correct: getTrueType(r.fileName) === r.predicted
}));

// Write the structured report
fs.writeFileSync(
  '/tmp/nplvision/classifier_tuning_results_v2.json',
  JSON.stringify(summary, null, 2)
);

console.log('V2 Classifier Performance Summary:');
console.log('===================================');
console.log(`Total Files Tested: ${summary.totalFiles}`);
console.log(`Overall Accuracy: ${summary.overallAccuracy}%\n`);

console.log('Performance by Document Type:');
for (const [docType, stats] of Object.entries(summary.byDocumentType) as [string, any][]) {
  if (stats.total > 0) {
    console.log(`\n${docType}:`);
    console.log(`  Total: ${stats.total}`);
    console.log(`  Correct: ${stats.correct}`);
    console.log(`  Precision: ${stats.precision}%`);
    console.log(`  Recall: ${stats.recall}%`);
    console.log(`  F1 Score: ${stats.f1Score}%`);
  }
}

console.log('\n✅ Report saved to classifier_tuning_results_v2.json');