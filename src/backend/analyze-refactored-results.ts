import * as fs from 'fs';

const results = JSON.parse(fs.readFileSync('test-results-refactored-intermediate.json', 'utf8'));

console.log('=== REFACTORED CLASSIFIER ANALYSIS (24 Documents) ===\n');

// Overall accuracy
const correct = results.filter((r: any) => r.correct).length;
const accuracy = correct / results.length;

console.log(`Total documents tested: ${results.length}`);
console.log(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${results.length})`);

// Per-type breakdown
const types = ['Note', 'Security Instrument', 'Assignment', 'Other'];
console.log('\n=== Per-Type Accuracy ===');
for (const type of types) {
  const typeResults = results.filter((r: any) => r.expectedType === type);
  if (typeResults.length > 0) {
    const typeCorrect = typeResults.filter((r: any) => r.correct).length;
    console.log(`${type}: ${(typeCorrect/typeResults.length*100).toFixed(0)}% (${typeCorrect}/${typeResults.length})`);
  }
}

// Endorsement analysis  
console.log('\n=== Endorsement Analysis ===');
const withEndorsements = results.filter((r: any) => r.hasEndorsements);
console.log(`Documents with endorsements: ${withEndorsements.length}/${results.length}`);

if (withEndorsements.length > 0) {
  const endingInBlank = withEndorsements.filter((r: any) => r.endsInBlank).length;
  const endingWithCurrentInvestor = withEndorsements.filter((r: any) => r.endsWithCurrentInvestor).length;
  const endingWithOther = withEndorsements.length - endingInBlank - endingWithCurrentInvestor;
  
  console.log(`  Ending in BLANK: ${endingInBlank}`);
  console.log(`  Ending with CURRENT INVESTOR: ${endingWithCurrentInvestor}`);
  console.log(`  Ending with OTHER: ${endingWithOther}`);
  
  console.log('\nEndorsement Chain Details:');
  withEndorsements.forEach((r: any) => {
    const endType = r.endsInBlank ? 'BLANK' : r.endsWithCurrentInvestor ? 'CURRENT INVESTOR' : 'OTHER';
    console.log(`  ${r.file}: ${r.endorsementCount} endorsement(s) → ${endType}`);
  });
}

// Misclassifications
const misclassified = results.filter((r: any) => !r.correct);
if (misclassified.length > 0) {
  console.log('\n=== Misclassifications ===');
  for (const miss of misclassified) {
    console.log(`${miss.file}: Expected ${miss.expectedType}, Got ${miss.prediction} (${miss.confidence})`);
  }
}

// Business value summary
console.log('\n=== BUSINESS VALUE DELIVERED ===');
console.log(`✅ Base document classification: ${(accuracy * 100).toFixed(1)}% accurate`);
console.log(`🔗 Endorsement chain analysis: ${withEndorsements.length} documents analyzed`);
console.log(`🎯 Current investor detection: ${withEndorsements.filter((r: any) => r.endsWithCurrentInvestor).length} chains end with current investor`);
console.log(`📝 Blank endorsements: ${withEndorsements.filter((r: any) => r.endsInBlank).length} chains end in blank`);

console.log('\n=== KEY IMPROVEMENTS FROM REFACTOR ===');
console.log('• Removed competing ALLONGE document type');
console.log('• Enhanced endorsement chain analysis for ALL documents');
console.log('• Business-focused results: document type + endorsement status');
console.log('• Fixed Assignment classification issues with AOM/MERS patterns');
console.log('• Standalone allonge documents now classified as Notes with endorsements');