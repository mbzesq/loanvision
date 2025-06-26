import '../config'; // Initialize environment variables
import bcrypt from 'bcryptjs';
import pool from '../db';

interface CreateSuperUserArgs {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

function parseArgs(): CreateSuperUserArgs | null {
  const args = process.argv.slice(2);
  const parsedArgs: Partial<CreateSuperUserArgs> = {};

  for (const arg of args) {
    if (arg.startsWith('--email=')) {
      parsedArgs.email = arg.split('=')[1];
    } else if (arg.startsWith('--password=')) {
      parsedArgs.password = arg.split('=')[1];
    } else if (arg.startsWith('--firstName=')) {
      parsedArgs.firstName = arg.split('=')[1];
    } else if (arg.startsWith('--lastName=')) {
      parsedArgs.lastName = arg.split('=')[1];
    }
  }

  // Validate all required arguments are provided
  const requiredFields = ['email', 'password', 'firstName', 'lastName'] as const;
  for (const field of requiredFields) {
    if (!parsedArgs[field]) {
      console.error(`Error: Missing required argument --${field}`);
      console.error('Usage: npm run create-super-user -- --email="founder@example.com" --password="strongPassword" --firstName="Admin" --lastName="Founder"');
      return null;
    }
  }

  return parsedArgs as CreateSuperUserArgs;
}

async function createSuperUser(args: CreateSuperUserArgs): Promise<void> {
  const { email, password, firstName, lastName } = args;
  const SALT_ROUNDS = 10;

  try {
    console.log('Creating super user account...');

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.error(`Error: User with email "${email}" already exists`);
      return;
    }

    // Hash the password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new super user
    console.log('Inserting super user into database...');
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email, passwordHash, firstName, lastName, 'super_user']
    );

    const newUser = result.rows[0];
    console.log('✅ Super user created successfully!');
    console.log(`User ID: ${newUser.id}`);
    console.log(`Email: ${newUser.email}`);
    console.log(`Name: ${newUser.first_name} ${newUser.last_name}`);
    console.log(`Role: ${newUser.role}`);
    console.log(`Created: ${newUser.created_at}`);

  } catch (error) {
    console.error('❌ Failed to create super user:');
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Unknown error occurred');
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!args) {
    process.exit(1);
  }

  try {
    await createSuperUser(args);
    console.log('Script completed successfully.');
  } catch (error) {
    console.error('Script failed.');
    process.exit(1);
  } finally {
    // Close database connection to prevent hanging
    await pool.end();
    console.log('Database connection closed.');
  }
}

// Execute the script
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});