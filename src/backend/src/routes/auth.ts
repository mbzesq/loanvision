import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { User, UserRole, RegisterRequest, LoginRequest, AuthResponse } from '../types/auth';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import { sessionService } from '../services/sessionService';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-me-in-production';
const SALT_ROUNDS = 10;

router.post('/register', async (req: Request<{}, {}, RegisterRequest>, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new user with default 'user' role and assign to Shelton Partners, LLC
    const systemOrgResult = await pool.query('SELECT id FROM organizations WHERE slug = $1', ['system']);
    const systemOrgId = systemOrgResult.rows[0]?.id;
    
    const newUser = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, organization_id) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, first_name, last_name, role, organization_id, created_at, updated_at`,
      [email, passwordHash, firstName || null, lastName || null, 'user', systemOrgId]
    );

    const user = newUser.rows[0];

    // Create user object (exclude password hash)
    const userResponse: User = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      organizationId: user.organization_id,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };

    res.status(201).json({ 
      message: 'User registered successfully',
      user: userResponse 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

router.post('/login', async (req: Request<{}, {}, LoginRequest>, res: Response<AuthResponse | { error: string }>) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const userQuery = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, role, organization_id, created_at, updated_at 
       FROM users WHERE email = $1`,
      [email]
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userQuery.rows[0];

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token with unique identifier for session tracking
    const tokenId = `${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        organizationId: user.organization_id,
        tokenId // Add token ID for session tracking
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create login session record
    try {
      await sessionService.createLoginSession(user.id, tokenId, req);
    } catch (sessionError) {
      console.warn('[Auth] Failed to create session record:', sessionError);
      // Continue with login even if session tracking fails
    }

    // Create user object (exclude password hash)
    const userResponse: User = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      organizationId: user.organization_id,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };

    res.json({
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /api/auth/logout - Record logout
router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tokenId = req.user?.tokenId;
    
    if (tokenId) {
      await sessionService.recordLogout(tokenId, 'manual');
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// GET /api/auth/sessions/:userId - Get session history for a user (admin only)
router.get('/sessions/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const requestingUserRole = req.user?.role;
    const requestingUserId = req.user?.id;

    // Only allow admins or the user themselves to view session history
    if (requestingUserRole !== 'admin' && requestingUserRole !== 'super_user' && requestingUserId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Unauthorized to view session history' });
    }

    const sessions = await sessionService.getSessionHistory(parseInt(userId), 100);
    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching session history:', error);
    res.status(500).json({ error: 'Failed to fetch session history' });
  }
});

// GET /api/auth/analytics - Get session analytics (admin only)
router.get('/analytics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const requestingUserRole = req.user?.role;

    // Only allow admins to view analytics
    if (requestingUserRole !== 'admin' && requestingUserRole !== 'super_user') {
      return res.status(403).json({ error: 'Unauthorized to view analytics' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const analytics = await sessionService.getSessionAnalytics(days);
    res.json({ analytics });
  } catch (error) {
    console.error('Error fetching session analytics:', error);
    res.status(500).json({ error: 'Failed to fetch session analytics' });
  }
});

// GET /api/auth/users - Get list of users for task assignment
router.get('/users', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const usersQuery = await pool.query(
      `SELECT id, email, first_name, last_name, role 
       FROM users 
       WHERE role != 'admin' 
       ORDER BY first_name, last_name, email`
    );

    const users = usersQuery.rows.map(user => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      name: user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}` 
        : user.email
    }));

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;