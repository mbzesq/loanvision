const fs = require('fs');
const path = require('path');

// Load the extracted data
const extractedData = JSON.parse(fs.readFileSync('/tmp/nplvision/projects/sol-database-extracted.json', 'utf8'));

// Expected states
const expectedStates = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

// Validation results
const results = {
  metadata: {
    valid: false,
    errors: []
  },
  jurisdictions: {
    count: 0,
    missing: [],
    valid: [],
    invalid: []
  },
  summary: {
    totalValid: 0,
    totalErrors: 0
  }
};

// Validate metadata
if (extractedData.metadata) {
  results.metadata.valid = true;
  console.log('✅ Metadata found:', {
    title: extractedData.metadata.document_title,
    date: extractedData.metadata.extraction_date,
    jurisdictions: extractedData.metadata.total_jurisdictions,
    version: extractedData.metadata.version
  });
} else {
  results.metadata.errors.push('Missing metadata section');
}

// Validate jurisdictions
if (extractedData.jurisdictions) {
  const foundStates = Object.keys(extractedData.jurisdictions);
  results.jurisdictions.count = foundStates.length;
  
  // Check for missing states
  expectedStates.forEach(state => {
    if (!extractedData.jurisdictions[state]) {
      results.jurisdictions.missing.push(state);
    }
  });
  
  // Validate each jurisdiction
  foundStates.forEach(stateCode => {
    const state = extractedData.jurisdictions[stateCode];
    const errors = [];
    
    // Check required fields
    if (!state.state_code) errors.push('Missing state_code');
    if (!state.state_name) errors.push('Missing state_name');
    if (!state.foreclosure_types || !Array.isArray(state.foreclosure_types)) errors.push('Missing/invalid foreclosure_types');
    if (!state.sol_periods || typeof state.sol_periods !== 'object') errors.push('Missing/invalid sol_periods');
    if (!state.trigger_events || !Array.isArray(state.trigger_events)) errors.push('Missing/invalid trigger_events');
    if (!state.tolling_provisions || !Array.isArray(state.tolling_provisions)) errors.push('Missing/invalid tolling_provisions');
    if (!state.effect_of_expiration || typeof state.effect_of_expiration !== 'object') errors.push('Missing/invalid effect_of_expiration');
    if (!state.statute_citations || !Array.isArray(state.statute_citations)) errors.push('Missing/invalid statute_citations');
    
    if (errors.length === 0) {
      results.jurisdictions.valid.push(stateCode);
    } else {
      results.jurisdictions.invalid.push({ stateCode, errors });
    }
  });
}

// Summary
results.summary.totalValid = results.jurisdictions.valid.length;
results.summary.totalErrors = results.jurisdictions.invalid.length + results.jurisdictions.missing.length;

// Display results
console.log('\n📊 Validation Summary:');
console.log(`Total jurisdictions found: ${results.jurisdictions.count}`);
console.log(`Valid jurisdictions: ${results.summary.totalValid}`);
console.log(`Invalid jurisdictions: ${results.jurisdictions.invalid.length}`);
console.log(`Missing jurisdictions: ${results.jurisdictions.missing.length}`);

if (results.jurisdictions.missing.length > 0) {
  console.log('\n❌ Missing states:', results.jurisdictions.missing.join(', '));
}

if (results.jurisdictions.invalid.length > 0) {
  console.log('\n❌ Invalid jurisdictions:');
  results.jurisdictions.invalid.forEach(({ stateCode, errors }) => {
    console.log(`  ${stateCode}: ${errors.join(', ')}`);
  });
}

// Sample some data
console.log('\n📋 Sample data from first 3 states:');
const sampleStates = Object.keys(extractedData.jurisdictions).slice(0, 3);
sampleStates.forEach(stateCode => {
  const state = extractedData.jurisdictions[stateCode];
  console.log(`\n${state.state_name} (${stateCode}):`);
  console.log(`  - Foreclosure types: ${state.foreclosure_types.join(', ')}`);
  console.log(`  - SOL periods: Lien ${state.sol_periods.lien_years}y, Note ${state.sol_periods.note_years}y, Foreclosure ${state.sol_periods.foreclosure_years}y`);
  console.log(`  - Risk level: ${state.risk_level}`);
  console.log(`  - Lien extinguished on expiration: ${state.effect_of_expiration.lien_extinguished ? 'Yes' : 'No'}`);
});

// Check for high-risk states
const highRiskStates = Object.entries(extractedData.jurisdictions)
  .filter(([_, state]) => state.risk_level === 'HIGH')
  .map(([code, state]) => ({ code, name: state.state_name }));

console.log(`\n⚠️  High-risk jurisdictions (${highRiskStates.length}):`);
highRiskStates.forEach(({ code, name }) => {
  console.log(`  - ${name} (${code})`);
});

console.log('\n✅ Validation complete!');