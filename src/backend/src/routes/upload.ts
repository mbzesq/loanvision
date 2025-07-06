import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Placeholder for upload functionality
router.post('/upload', authenticateToken, async (req, res) => {
  res.status(501).json({ error: 'Upload functionality temporarily disabled' });
});

export default router;