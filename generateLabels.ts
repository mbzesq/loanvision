import fs from 'fs';
import path from 'path';

// Correct path to test_set directory
const TEST_SET_DIR = path.join(__dirname, 'docs', 'test_set');
const OUTPUT_CSV = path.join(TEST_SET_DIR, 'document_labels.csv');

// Read all PDF files in the directory
const files = fs.readdirSync(TEST_SET_DIR).filter(file => file.endsWith('.pdf'));

// Create CSV content
const header = 'file_name,true_type\n';
const rows = files.map(file => `${file},UNKNOWN`).join('\n');

// Write to document_labels.csv
fs.writeFileSync(OUTPUT_CSV, header + rows);

console.log(`✅ Created document_labels.csv with ${files.length} entries.`);
