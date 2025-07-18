import { CronJob } from 'cron';
import { Pool } from 'pg';
import { RAGIndexingService } from '../services/ragIndexingService';

/**
 * Daily RAG Indexing Job
 * Runs every day at 2 AM to rebuild the search index with fresh loan data
 */
export class RAGIndexingJob {
  private job: CronJob | null = null;
  private pool: Pool;
  private indexingService: RAGIndexingService;
  private isRunning = false;

  constructor(pool: Pool) {
    this.pool = pool;
    this.indexingService = new RAGIndexingService(pool);
  }

  /**
   * Start the cron job
   */
  start(): void {
    // Run daily at 2 AM
    this.job = new CronJob(
      '0 2 * * *', // Cron expression: 2:00 AM every day
      async () => {
        await this.runIndexing();
      },
      null,
      true, // Start the job right away
      'America/New_York' // Timezone
    );

    console.log('📅 RAG Indexing Job scheduled for 2 AM daily');

    // Check if initial indexing is needed
    this.checkInitialIndexing();
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      console.log('🛑 RAG Indexing Job stopped');
    }
  }

  /**
   * Run the indexing process
   */
  async runIndexing(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ RAG indexing already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🚀 Starting scheduled RAG index rebuild...');
      
      // Send notification that indexing is starting (if notification system exists)
      await this.notifyIndexingStart();

      // Run the indexing
      const stats = await this.indexingService.rebuildIndex();

      // Log success
      const duration = Date.now() - startTime;
      await this.logIndexingResult({
        success: true,
        duration,
        stats,
        error: null
      });

      console.log(`✅ RAG indexing completed successfully in ${duration}ms`);
      
      // Send success notification
      await this.notifyIndexingComplete(stats, duration);

    } catch (error) {
      // Log failure
      const duration = Date.now() - startTime;
      await this.logIndexingResult({
        success: false,
        duration,
        stats: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error('❌ RAG indexing failed:', error);
      
      // Send failure notification
      await this.notifyIndexingFailed(error);

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if initial indexing is needed on startup
   */
  private async checkInitialIndexing(): Promise<void> {
    try {
      const health = await this.indexingService.healthCheck();
      
      if (health.status === 'needs_reindex') {
        console.log('🔄 Initial RAG indexing required:', health.message);
        
        // Run initial indexing in background
        setTimeout(() => {
          this.runIndexing().catch(error => {
            console.error('Initial indexing failed:', error);
          });
        }, 5000); // Wait 5 seconds for system to stabilize
      } else if (health.status === 'healthy') {
        console.log('✅ RAG index is healthy:', health.message);
      }
    } catch (error) {
      console.error('Failed to check index health:', error);
    }
  }

  /**
   * Log indexing result to database
   */
  private async logIndexingResult(result: {
    success: boolean;
    duration: number;
    stats: any | null;
    error: string | null;
  }): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO rag_indexing_logs (
          success, duration_ms, documents_indexed, error_message,
          started_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        result.success,
        result.duration,
        result.stats?.totalDocuments || 0,
        result.error,
        new Date(Date.now() - result.duration),
        new Date()
      ]);
    } catch (error) {
      console.error('Failed to log indexing result:', error);
    }
  }

  /**
   * Send notification that indexing is starting
   */
  private async notifyIndexingStart(): Promise<void> {
    // Integration point for notification system
    // Could send email, Slack, or in-app notification
  }

  /**
   * Send notification that indexing completed successfully
   */
  private async notifyIndexingComplete(stats: any, duration: number): Promise<void> {
    // Integration point for success notification
    // Include stats like documents indexed, time taken
  }

  /**
   * Send notification that indexing failed
   */
  private async notifyIndexingFailed(error: any): Promise<void> {
    // Integration point for failure notification
    // Alert admins about the failure
  }

  /**
   * Manually trigger indexing (for admin use)
   */
  async triggerManualIndexing(): Promise<{
    success: boolean;
    message: string;
    stats?: any;
  }> {
    if (this.isRunning) {
      return {
        success: false,
        message: 'Indexing already in progress'
      };
    }

    try {
      console.log('🔧 Manual RAG indexing triggered');
      await this.runIndexing();
      
      const stats = await this.indexingService.getIndexStats();
      return {
        success: true,
        message: 'Manual indexing completed successfully',
        stats
      };
    } catch (error) {
      return {
        success: false,
        message: `Manual indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get job status
   */
  getStatus(): {
    isRunning: boolean;
    nextRun: Date | null;
    lastRun: Date | null;
  } {
    return {
      isRunning: this.isRunning,
      nextRun: this.job?.nextDate().toJSDate() || null,
      lastRun: this.job?.lastDate() || null
    };
  }
}

// Create table for indexing logs
export const createIndexingLogsTableSQL = `
CREATE TABLE IF NOT EXISTS rag_indexing_logs (
  id SERIAL PRIMARY KEY,
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL,
  documents_indexed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rag_indexing_logs_created_at ON rag_indexing_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_indexing_logs_success ON rag_indexing_logs(success);
`;