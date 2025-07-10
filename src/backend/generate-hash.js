const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.log('Usage: node generate-hash.js "your_password"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('\nPassword hash:');
console.log(hash);
console.log('\nReady to use in SQL!');