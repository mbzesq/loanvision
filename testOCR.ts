import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('=== OCR PIPELINE TEST ===\n');

// Check environment variables
console.log('Environment Check:');
console.log(`AWS_REGION: ${process.env.AWS_REGION || 'us-east-1'}`);
console.log(`AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...` : 'NOT SET'}`);
console.log(`AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET'}`);

// Test if we can read a test PDF
const testPdf = path.join(__dirname, 'docs', 'test_set', '100011939_Hakani_Note.pdf');
console.log(`\nTesting PDF access: ${testPdf}`);

if (fs.existsSync(testPdf)) {
  const buffer = fs.readFileSync(testPdf);
  console.log(`✓ PDF file found, size: ${buffer.length} bytes`);
  
  // Show first few bytes to confirm it's a PDF
  const header = buffer.toString('ascii', 0, 20);
  console.log(`PDF header: "${header}"`);
  
  if (header.startsWith('%PDF')) {
    console.log('✓ Valid PDF file detected');
  } else {
    console.log('⚠️  File does not appear to be a valid PDF');
  }
} else {
  console.log('❌ PDF file not found');
}

// List first few files in test set
console.log('\nTest set files:');
const testSetDir = path.join(__dirname, 'docs', 'test_set');
if (fs.existsSync(testSetDir)) {
  const files = fs.readdirSync(testSetDir)
    .filter(f => f.endsWith('.pdf') || f.endsWith('.PDF'))
    .slice(0, 5);
  files.forEach(file => {
    const filePath = path.join(testSetDir, file);
    const size = fs.statSync(filePath).size;
    console.log(`  ${file} (${size} bytes)`);
  });
  console.log(`  ... and ${fs.readdirSync(testSetDir).filter(f => f.endsWith('.pdf') || f.endsWith('.PDF')).length - 5} more files`);
} else {
  console.log('❌ Test set directory not found');
}