#!/usr/bin/env node
import bcrypt from 'bcryptjs';
import pool from '../db';
import { UserRole } from '../types/auth';

async function createUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: UserRole = 'user'
) {
  const SALT_ROUNDS = 10;

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.error(`❌ User with email "${email}" already exists.`);
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email, passwordHash, firstName, lastName, role]
    );

    const newUser = result.rows[0];
    console.log('✅ User created successfully!');
    console.log(`ID: ${newUser.id}`);
    console.log(`Email: ${newUser.email}`);
    console.log(`Name: ${newUser.first_name} ${newUser.last_name}`);
    console.log(`Role: ${newUser.role}`);
    console.log(`Created: ${newUser.created_at}`);

  } catch (error) {
    console.error('❌ Failed to create user:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 4) {
  console.log('Usage: npm run create-user <email> <password> <firstName> <lastName> [role]');
  console.log('Example: npm run create-user "user@example.com" "password123" "John" "Doe" "user"');
  console.log('Roles: user, manager, admin, super_user');
  process.exit(1);
}

const [email, password, firstName, lastName, role] = args;
createUser(email, password, firstName, lastName, (role as UserRole) || 'user');