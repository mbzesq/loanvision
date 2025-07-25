import * as fs from 'fs';

const results = JSON.parse(fs.readFileSync('test-results-intermediate.json', 'utf8'));

console.log('=== TEST RESULTS ANALYSIS (35 Documents) ===\n');

// Overall accuracy
const oldCorrect = results.filter((r: any) => r.oldCorrect).length;
const newCorrect = results.filter((r: any) => r.newCorrect).length;

console.log(`Total documents tested: ${results.length}`);
console.log(`OLD Classifier: ${oldCorrect}/${results.length} correct (${(oldCorrect/results.length*100).toFixed(1)}%)`);
console.log(`NEW Classifier: ${newCorrect}/${results.length} correct (${(newCorrect/results.length*100).toFixed(1)}%)`);

// Per-type breakdown
const types = ['Note', 'Security Instrument', 'Assignment', 'Other'];
console.log('\n=== Per-Type Accuracy ===');
for (const type of types) {
  const typeResults = results.filter((r: any) => r.expectedType === type);
  if (typeResults.length > 0) {
    const oldTypeCorrect = typeResults.filter((r: any) => r.oldCorrect).length;
    const newTypeCorrect = typeResults.filter((r: any) => r.newCorrect).length;
    console.log(`\n${type}: ${typeResults.length} documents`);
    console.log(`  OLD: ${oldTypeCorrect}/${typeResults.length} (${(oldTypeCorrect/typeResults.length*100).toFixed(0)}%)`);
    console.log(`  NEW: ${newTypeCorrect}/${typeResults.length} (${(newTypeCorrect/typeResults.length*100).toFixed(0)}%)`);
  }
}

// NEW classifier misclassifications
console.log('\n=== NEW Classifier Misclassifications ===');
const newMisclassified = results.filter((r: any) => !r.newCorrect);
console.log(`Total: ${newMisclassified.length} documents\n`);

for (const miss of newMisclassified) {
  console.log(`${miss.file}:`);
  console.log(`  Expected: ${miss.expectedType}`);
  console.log(`  Got: ${miss.newPrediction} (confidence: ${miss.newConfidence})`);
  console.log(`  OLD prediction: ${miss.oldPrediction} (${miss.oldCorrect ? '✅' : '❌'})`);
  console.log();
}

// Confidence comparison
const avgOldConfidence = results.reduce((sum: number, r: any) => sum + r.oldConfidence, 0) / results.length;
const avgNewConfidence = results.reduce((sum: number, r: any) => sum + r.newConfidence, 0) / results.length;
console.log('=== Average Confidence ===');
console.log(`OLD: ${avgOldConfidence.toFixed(3)}`);
console.log(`NEW: ${avgNewConfidence.toFixed(3)}`);

// Improvements and regressions
const improvements = results.filter((r: any) => !r.oldCorrect && r.newCorrect);
const regressions = results.filter((r: any) => r.oldCorrect && !r.newCorrect);

console.log('\n=== Changes ===');
console.log(`Improvements (OLD wrong → NEW correct): ${improvements.length}`);
console.log(`Regressions (OLD correct → NEW wrong): ${regressions.length}`);

if (regressions.length > 0) {
  console.log('\nRegression details:');
  for (const reg of regressions) {
    console.log(`- ${reg.file}: ${reg.expectedType} → ${reg.newPrediction}`);
  }
}