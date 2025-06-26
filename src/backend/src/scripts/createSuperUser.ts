import bcrypt from 'bcryptjs';
import pool from '../db';

export async function seedSuperUser(): Promise<boolean> {
  // Hardcoded credentials for one-time seeding (will be removed after initial deployment)
  const superUserCredentials = {
    email: 'admin@loanvision.com',
    password: 'SuperSecure2025!',
    firstName: 'System',
    lastName: 'Administrator'
  };

  const { email, password, firstName, lastName } = superUserCredentials;
  const SALT_ROUNDS = 10;

  try {
    console.log('[Seed] Creating super user account...');

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log(`[Seed] Super user with email "${email}" already exists. Skipping creation.`);
      return false;
    }

    // Hash the password
    console.log('[Seed] Hashing password...');
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new super user
    console.log('[Seed] Inserting super user into database...');
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email, passwordHash, firstName, lastName, 'super_user']
    );

    const newUser = result.rows[0];
    console.log('[Seed] ✅ Super user created successfully!');
    console.log(`[Seed] User ID: ${newUser.id}`);
    console.log(`[Seed] Email: ${newUser.email}`);
    console.log(`[Seed] Name: ${newUser.first_name} ${newUser.last_name}`);
    console.log(`[Seed] Role: ${newUser.role}`);
    console.log(`[Seed] Created: ${newUser.created_at}`);

    return true;

  } catch (error) {
    console.error('[Seed] ❌ Failed to create super user:');
    if (error instanceof Error) {
      console.error(`[Seed] ${error.message}`);
    } else {
      console.error('[Seed] Unknown error occurred');
    }
    throw error;
  }
}