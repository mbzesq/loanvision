import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  company?: string;
  created_at: Date;
  updated_at: Date;
}

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  company?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  static async register(data: RegisterData): Promise<{ user: Partial<User>; message: string }> {
    const { email, password, first_name, last_name, company } = data;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create verification token
    const verification_token = uuidv4();
    const verification_expires = new Date();
    verification_expires.setHours(verification_expires.getHours() + 24);

    // Insert new user with pending status
    const result = await pool.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, company,
        role, is_active, is_verified, verification_token, verification_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, email, first_name, last_name, role, company, created_at`,
      [
        email, password_hash, first_name, last_name, company,
        'pending', false, false, verification_token, verification_expires
      ]
    );

    const newUser = result.rows[0];

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: newUser.role,
        company: newUser.company,
      },
      message: 'Registration successful. Your account is pending approval from an administrator.'
    };
  }

  static async login(data: LoginData, ipAddress?: string): Promise<{ user: User; token: string }> {
    const { email, password } = data;

    // Get user with password hash
    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, role, 
              is_active, is_verified, company, created_at, updated_at,
              failed_login_attempts, locked_until
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new Error('Account is temporarily locked due to too many failed login attempts');
    }

    // Check if account is active
    if (!user.is_active) {
      throw new Error('Account is not active. Please contact an administrator.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      await pool.query(
        `UPDATE users 
         SET failed_login_attempts = failed_login_attempts + 1,
             locked_until = CASE 
               WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '30 minutes'
               ELSE NULL
             END
         WHERE id = $1`,
        [user.id]
      );

      throw new Error('Invalid email or password');
    }

    // Reset failed login attempts on successful login
    await pool.query(
      `UPDATE users 
       SET failed_login_attempts = 0, 
           locked_until = NULL,
           last_login_at = NOW(),
           last_login_ip = $2
       WHERE id = $1`,
      [user.id, ipAddress]
    );

    // Generate JWT token
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Create session record
    const token_hash = await bcrypt.hash(token, 5); // Light hashing for session lookup
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7);

    await pool.query(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [user.id, token_hash, expires_at, ipAddress]
    );

    // Log activity
    await pool.query(
      `INSERT INTO user_activity_log (user_id, action, ip_address, metadata)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'login', ipAddress, JSON.stringify({ email: user.email })]
    );

    // Remove sensitive data before returning
    delete user.password_hash;
    delete user.failed_login_attempts;
    delete user.locked_until;

    return { user, token };
  }

  static async logout(userId: number, token: string): Promise<void> {
    // Hash the token to find the session
    const token_hash = await bcrypt.hash(token, 5);

    // Revoke the session
    await pool.query(
      `UPDATE user_sessions 
       SET revoked = true, revoked_at = NOW()
       WHERE user_id = $1 AND revoked = false`,
      [userId]
    );

    // Log activity
    await pool.query(
      `INSERT INTO user_activity_log (user_id, action)
       VALUES ($1, $2)`,
      [userId, 'logout']
    );
  }

  static async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
      
      // Check if user is still active
      const result = await pool.query(
        'SELECT is_active FROM users WHERE id = $1',
        [payload.userId]
      );

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        throw new Error('User not found or inactive');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  static async getUserById(id: number): Promise<User | null> {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, is_active, 
              is_verified, company, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  static async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    // Get current password hash
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!isOldPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Log activity
    await pool.query(
      `INSERT INTO user_activity_log (user_id, action)
       VALUES ($1, $2)`,
      [userId, 'password_change']
    );
  }

  static async activateUser(userId: number, adminId: number): Promise<void> {
    await pool.query(
      'UPDATE users SET is_active = true, role = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3',
      ['user', adminId, userId]
    );

    // Log activity
    await pool.query(
      `INSERT INTO user_activity_log (user_id, action, metadata)
       VALUES ($1, $2, $3)`,
      [adminId, 'activate_user', JSON.stringify({ activated_user_id: userId })]
    );
  }
}