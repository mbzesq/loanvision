const bcrypt = require('bcryptjs');

async function generatePasswordHash() {
  const password = 'SuperSecure2025!';
  const saltRounds = 10;
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Password hash for "SuperSecure2025!":');
    console.log(hash);
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

generatePasswordHash();