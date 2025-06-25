import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Register new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name, company } = req.body;

    // Validate required fields
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, password, first_name, last_name' 
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }

    const result = await AuthService.register({
      email,
      password,
      first_name,
      last_name,
      company
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Registration error:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const result = await AuthService.login({ email, password }, ipAddress);

    // Set HTTP-only cookie
    res.cookie('authToken', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      user: result.user,
      token: result.token
    });
  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error.message.includes('Invalid') || error.message.includes('locked') || error.message.includes('not active')) {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.substring(7) || req.cookies?.authToken;
    
    if (req.user && token) {
      await AuthService.logout(req.user.userId, token);
    }

    // Clear cookie
    res.clearCookie('authToken');
    
    res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await AuthService.getUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

// Change password
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Old password and new password are required' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'New password must be at least 8 characters long' 
      });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await AuthService.changePassword(req.user.userId, oldPassword, newPassword);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    
    if (error.message.includes('incorrect')) {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Admin: Activate user
router.post('/admin/activate-user/:userId', authenticate, requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await AuthService.activateUser(userId, req.user.userId);
    
    res.json({ message: 'User activated successfully' });
  } catch (error: any) {
    console.error('Activate user error:', error);
    res.status(500).json({ error: 'Failed to activate user' });
  }
});

// Admin: Get pending users
router.get('/admin/pending-users', authenticate, requireRole(['admin', 'super_admin']), async (req: Request, res: Response) => {
  try {
    const pool = require('../db').default;
    
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, company, created_at
       FROM users 
       WHERE role = 'pending' AND is_active = false
       ORDER BY created_at DESC`
    );

    res.json({ users: result.rows });
  } catch (error: any) {
    console.error('Get pending users error:', error);
    res.status(500).json({ error: 'Failed to get pending users' });
  }
});

export default router;