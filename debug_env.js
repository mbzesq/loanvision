// Simple debug script to check environment
console.log('Current working directory:', process.cwd());
console.log('Node version:', process.version);
console.log('NODE_PATH:', process.env.NODE_PATH);
console.log('PATH:', process.env.PATH);

// Try to find pg module
try {
  const { Pool } = require('pg');
  console.log('pg module found successfully');
} catch (e) {
  console.log('pg module not found:', e.message);
}

// Check if we can access the backend package.json
try {
  const fs = require('fs');
  const pkgContent = fs.readFileSync('/tmp/nplvision/src/backend/package.json', 'utf8');
  const pkg = JSON.parse(pkgContent);
  console.log('Backend package.json scripts:', Object.keys(pkg.scripts));
} catch (e) {
  console.log('Error reading backend package.json:', e.message);
}

// Check the workspace setup
try {
  const fs = require('fs');
  const pkgContent = fs.readFileSync('/tmp/nplvision/package.json', 'utf8');
  const pkg = JSON.parse(pkgContent);
  console.log('Root package.json workspaces:', pkg.workspaces);
} catch (e) {
  console.log('Error reading root package.json:', e.message);
}