import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import { AIQueryProcessor } from '../services/aiQueryProcessor';
import { AIRateLimitService } from '../services/aiRateLimitService';
import pool from '../db';

const router = express.Router();
const aiQueryProcessor = new AIQueryProcessor(pool);
const aiRateLimitService = new AIRateLimitService(pool);

/**
 * POST /api/ai/query
 * Process an AI query with privacy protection
 */
router.post('/query', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { query, conversationId, includeContext, maxResults } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }

    const userContext = {
      userId: req.user!.id,
      organizationId: req.user!.organizationId || 0,
      permissions: [], // TODO: Get from user profile
      firstName: '', // TODO: Get from user profile
      lastName: '' // TODO: Get from user profile
    };

    const response = await aiQueryProcessor.processQuery(userContext, {
      query,
      conversationId,
      includeContext: includeContext || false,
      maxResults: maxResults || 100
    });

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('AI query error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = errorMessage.includes('rate limit') ? 429 : 
                      errorMessage.includes('Invalid query') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * GET /api/ai/conversations
 * Get user's AI conversations
 */
router.get('/conversations', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const conversations = await aiQueryProcessor.getUserConversations(req.user!.id);
    
    res.json({
      success: true,
      data: { conversations }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversations'
    });
  }
});

/**
 * GET /api/ai/conversations/:id/messages
 * Get messages for a specific conversation
 */
router.get('/conversations/:id/messages', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const messages = await aiQueryProcessor.getConversationMessages(conversationId, req.user!.id);
    
    res.json({
      success: true,
      data: { messages }
    });

  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversation messages'
    });
  }
});

/**
 * DELETE /api/ai/conversations/:id
 * Delete (archive) a conversation
 */
router.delete('/conversations/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    await aiQueryProcessor.deleteConversation(conversationId, req.user!.id);
    
    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation'
    });
  }
});

/**
 * GET /api/ai/rate-limit
 * Get current user's rate limit status
 */
router.get('/rate-limit', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const status = await aiRateLimitService.checkRateLimit(req.user!.id);
    
    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Rate limit check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check rate limit'
    });
  }
});

/**
 * GET /api/ai/rate-limit/history
 * Get user's rate limit history
 */
router.get('/rate-limit/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const rateLimitInfo = await aiRateLimitService.getUserRateLimitInfo(req.user!.id);
    
    res.json({
      success: true,
      data: rateLimitInfo
    });

  } catch (error) {
    console.error('Rate limit history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limit history'
    });
  }
});

/**
 * GET /api/ai/stats
 * Get AI assistant statistics for organization
 */
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const stats = await aiQueryProcessor.getAIStats(req.user!.organizationId || 0);
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('AI stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve AI statistics'
    });
  }
});

/**
 * POST /api/ai/test
 * Test AI assistant connectivity (admin only)
 */
router.post('/test', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Check if user has admin permissions
    if (req.user!.role !== 'admin' && req.user!.role !== 'super_user') {
      return res.status(403).json({
        success: false,
        error: 'Admin permissions required'
      });
    }

    const openaiService = new (require('../services/openAIService').OpenAIService)(pool);
    const testResult = await openaiService.testConnection();
    
    res.json({
      success: true,
      data: testResult
    });

  } catch (error) {
    console.error('AI test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test AI connection'
    });
  }
});

/**
 * POST /api/ai/admin/reset-limits
 * Reset rate limits for a user (admin only)
 */
router.post('/admin/reset-limits', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Check if user has admin permissions
    if (req.user!.role !== 'admin' && req.user!.role !== 'super_user') {
      return res.status(403).json({
        success: false,
        error: 'Admin permissions required'
      });
    }

    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    await aiRateLimitService.resetUserLimits(userId, req.user!.id);
    
    res.json({
      success: true,
      message: 'Rate limits reset successfully'
    });

  } catch (error) {
    console.error('Reset limits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset rate limits'
    });
  }
});

/**
 * GET /api/ai/admin/stats
 * Get comprehensive AI statistics (admin only)
 */
router.get('/admin/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Check if user has admin permissions
    if (req.user!.role !== 'admin' && req.user!.role !== 'super_user') {
      return res.status(403).json({
        success: false,
        error: 'Admin permissions required'
      });
    }

    const days = parseInt(req.query.days as string) || 30;
    const rateLimitStats = await aiRateLimitService.getRateLimitStats(days);
    
    const openaiService = new (require('../services/openAIService').OpenAIService)(pool);
    const openaiStats = await openaiService.getServiceStats(days);
    
    res.json({
      success: true,
      data: {
        rateLimits: rateLimitStats,
        openai: openaiStats
      }
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin statistics'
    });
  }
});

export default router;