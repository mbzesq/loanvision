import { Router } from 'express';
import { Pool } from 'pg';
import { AIQueryProcessorRAG } from '../services/aiQueryProcessorRAG';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import { RAGIndexingJob } from '../jobs/ragIndexingJob';

const router = Router();
let aiProcessor: AIQueryProcessorRAG;
let ragIndexingJob: RAGIndexingJob;

export function createAIAssistantRAGRouter(dbPool: Pool): Router {
  aiProcessor = new AIQueryProcessorRAG(dbPool);
  ragIndexingJob = new RAGIndexingJob(dbPool);
  
  // Start the indexing job
  ragIndexingJob.start();

  /**
   * Send a query to the AI assistant (RAG mode)
   * POST /api/ai/rag/query
   */
  router.post('/query', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { query, conversationId, includeContext, maxResults } = req.body;
      const user = req.user!;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ 
          error: 'Query is required and must be a string' 
        });
      }

      const userContext = {
        userId: user.id,
        organizationId: user.organizationId || 0,
        permissions: [], // TODO: Get from user profile
        firstName: '', // TODO: Get from user profile
        lastName: '' // TODO: Get from user profile
      };

      const request = {
        query: query.trim(),
        conversationId,
        includeContext: includeContext !== false, // Default true
        maxResults: maxResults || 10
      };

      console.log(`📨 RAG AI query from user ${user.id}: "${query}"`);

      const response = await aiProcessor.processQuery(userContext, request);

      res.json({
        success: true,
        ...response
      });

    } catch (error) {
      console.error('AI RAG query error:', error);
      
      if (error instanceof Error && error.message.includes('Rate limit')) {
        return res.status(429).json({ 
          error: error.message 
        });
      }

      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'AI service error' 
      });
    }
  });

  /**
   * Get RAG indexing status
   * GET /api/ai/rag/index/status
   */
  router.get('/index/status', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const jobStatus = ragIndexingJob.getStatus();
      // Create indexing service instance to check health
      const { RAGIndexingService } = await import('../services/ragIndexingService');
      const indexingService = new RAGIndexingService(dbPool);
      const indexHealth = await indexingService.healthCheck();
      const indexStats = await indexingService.getIndexStats();

      res.json({
        success: true,
        job: jobStatus,
        health: indexHealth,
        stats: indexStats
      });

    } catch (error) {
      console.error('Failed to get RAG index status:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve index status' 
      });
    }
  });

  /**
   * Trigger manual RAG indexing (admin only)
   * POST /api/ai/rag/index/rebuild
   */
  router.post('/index/rebuild', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      
      // TODO: implement proper admin check when permissions are available
      // For now, allow all authenticated users to trigger reindexing
      // if (!user.permissions?.includes('admin')) {
      //   return res.status(403).json({ 
      //     error: 'Admin permission required' 
      //   });
      // }

      console.log(`🔧 Manual RAG indexing triggered by user ${user.id}`);

      // Trigger in background
      const result = await ragIndexingJob.triggerManualIndexing();
      
      res.json({
        success: result.success,
        message: result.message,
        stats: result.stats
      });

    } catch (error) {
      console.error('Manual indexing error:', error);
      res.status(500).json({ 
        error: 'Failed to trigger manual indexing' 
      });
    }
  });

  /**
   * Get retrieval statistics
   * GET /api/ai/rag/stats
   */
  router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const stats = await aiProcessor['ragRetrievalService'].getRetrievalStats(days);

      res.json({
        success: true,
        period: `${days} days`,
        stats
      });

    } catch (error) {
      console.error('Failed to get retrieval stats:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve statistics' 
      });
    }
  });

  /**
   * Compare token usage between RAG and non-RAG
   * GET /api/ai/rag/comparison
   */
  router.get('/comparison', authenticateToken, async (req: AuthRequest, res) => {
    try {
      
      const comparisonQuery = `
        SELECT 
          CASE 
            WHEN action = 'ai_query_success_rag' THEN 'RAG'
            WHEN action = 'ai_query_success' THEN 'Non-RAG'
          END as approach,
          COUNT(*) as query_count,
          AVG((details->>'tokenUsage')::jsonb->>'totalTokens')::int as avg_tokens,
          AVG((details->>'responseTimeMs')::int) as avg_response_time,
          MIN((details->>'tokenUsage')::jsonb->>'totalTokens')::int as min_tokens,
          MAX((details->>'tokenUsage')::jsonb->>'totalTokens')::int as max_tokens
        FROM ai_audit_log
        WHERE action IN ('ai_query_success', 'ai_query_success_rag')
        AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY approach
      `;

      const result = await dbPool.query(comparisonQuery);
      
      const comparison = {
        rag: result.rows.find(r => r.approach === 'RAG') || { 
          query_count: 0, 
          avg_tokens: 0, 
          avg_response_time: 0 
        },
        nonRag: result.rows.find(r => r.approach === 'Non-RAG') || { 
          query_count: 0, 
          avg_tokens: 0, 
          avg_response_time: 0 
        }
      };

      // Calculate savings
      const tokenReduction = comparison.nonRag.avg_tokens > 0 
        ? ((comparison.nonRag.avg_tokens - comparison.rag.avg_tokens) / comparison.nonRag.avg_tokens * 100).toFixed(1)
        : 0;

      res.json({
        success: true,
        comparison,
        savings: {
          tokenReductionPercent: tokenReduction,
          avgTokensSaved: comparison.nonRag.avg_tokens - comparison.rag.avg_tokens,
          estimatedCostSavingsPercent: tokenReduction // Rough estimate
        }
      });

    } catch (error) {
      console.error('Failed to get comparison data:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve comparison data' 
      });
    }
  });

  return router;
}