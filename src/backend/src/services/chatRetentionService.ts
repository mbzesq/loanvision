import { Pool } from 'pg';

interface RetentionConfig {
  enabled: boolean;
  retentionHours: number; // Hours to retain messages (24 by default)
  cleanupIntervalHours: number; // How often to run cleanup (1 hour by default)
  batchSize: number; // Maximum messages to delete per batch
  retryAttempts: number;
  retryDelayMs: number;
}

interface CleanupResult {
  messagesDeleted: number;
  reactionsDeleted: number;
  errors: number;
}

export class ChatRetentionService {
  private pool: Pool;
  private config: RetentionConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(pool: Pool, config: Partial<RetentionConfig> = {}) {
    this.pool = pool;
    
    // Default configuration
    this.config = {
      enabled: process.env.CHAT_RETENTION_ENABLED === 'true' || true,
      retentionHours: parseInt(process.env.CHAT_RETENTION_HOURS || '24'),
      cleanupIntervalHours: parseInt(process.env.CHAT_CLEANUP_INTERVAL_HOURS || '1'),
      batchSize: parseInt(process.env.CHAT_CLEANUP_BATCH_SIZE || '1000'),
      retryAttempts: parseInt(process.env.CHAT_CLEANUP_RETRY_ATTEMPTS || '3'),
      retryDelayMs: parseInt(process.env.CHAT_CLEANUP_RETRY_DELAY_MS || '5000'),
      ...config
    };

    console.log('💬 Chat Retention Service initialized with config:', this.config);
  }

  /**
   * Start the retention service
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('⏸️ Chat Retention Service is disabled');
      return;
    }

    if (this.isRunning) {
      console.log('⚠️ Chat Retention Service is already running');
      return;
    }

    console.log('🚀 Starting Chat Retention Service...');
    this.isRunning = true;
    this.scheduleNextCleanup();
  }

  /**
   * Stop the retention service
   */
  stop(): void {
    console.log('🛑 Stopping Chat Retention Service...');
    this.isRunning = false;
    
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    console.log('✅ Chat Retention Service stopped');
  }

  /**
   * Schedule the next cleanup
   */
  private scheduleNextCleanup(): void {
    if (!this.isRunning) return;

    const intervalMs = this.config.cleanupIntervalHours * 60 * 60 * 1000;
    const nextRun = new Date(Date.now() + intervalMs);
    
    console.log(`⏰ Next chat cleanup scheduled for: ${nextRun.toISOString()}`);
    console.log(`   (in ${this.config.cleanupIntervalHours} hour(s))`);

    this.cleanupTimer = setTimeout(async () => {
      await this.runCleanup();
      this.scheduleNextCleanup(); // Schedule the next run
    }, intervalMs);
  }

  /**
   * Execute chat message cleanup
   */
  private async runCleanup(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🧹 Starting scheduled chat message cleanup...');
    
    let attempt = 1;
    let success = false;

    while (attempt <= this.config.retryAttempts && !success && this.isRunning) {
      try {
        console.log(`🗑️ Chat cleanup attempt ${attempt}/${this.config.retryAttempts}`);
        
        const result = await this.deleteOldMessages();
        
        console.log(`✅ Chat cleanup completed successfully:`);
        console.log(`   - Messages deleted: ${result.messagesDeleted}`);
        console.log(`   - Reactions deleted: ${result.reactionsDeleted}`);
        console.log(`   - Errors: ${result.errors}`);
        
        success = true;
        
      } catch (error) {
        console.error(`❌ Chat cleanup attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.retryAttempts) {
          console.log(`⏳ Retrying in ${this.config.retryDelayMs / 1000} seconds...`);
          await this.sleep(this.config.retryDelayMs);
        }
        
        attempt++;
      }
    }

    if (!success) {
      console.error('💥 Chat cleanup failed after all retry attempts');
      await this.logCleanupError('Chat cleanup failed after all retries');
    }
  }

  /**
   * Delete messages older than retention period
   */
  public async deleteOldMessages(): Promise<CleanupResult> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const cutoffTime = new Date(Date.now() - (this.config.retentionHours * 60 * 60 * 1000));
      
      console.log(`🕐 Deleting messages older than: ${cutoffTime.toISOString()}`);
      console.log(`📅 Retention period: ${this.config.retentionHours} hours`);
      
      // First, get the IDs of messages to delete (in batches)
      const messagesToDeleteResult = await client.query(`
        SELECT id FROM chat_messages 
        WHERE created_at < $1 
        ORDER BY created_at ASC 
        LIMIT $2
      `, [cutoffTime, this.config.batchSize]);
      
      const messageIds = messagesToDeleteResult.rows.map(row => row.id);
      
      if (messageIds.length === 0) {
        console.log('✅ No old messages found to delete');
        await client.query('COMMIT');
        return { messagesDeleted: 0, reactionsDeleted: 0, errors: 0 };
      }
      
      console.log(`🎯 Found ${messageIds.length} messages to delete`);
      
      // Delete reactions first (foreign key constraint)
      const reactionsResult = await client.query(`
        DELETE FROM chat_message_reactions 
        WHERE message_id = ANY($1::int[])
      `, [messageIds]);
      
      const reactionsDeleted = reactionsResult.rowCount || 0;
      console.log(`🔗 Deleted ${reactionsDeleted} reactions`);
      
      // Delete the messages (hard delete for compliance)
      const messagesResult = await client.query(`
        DELETE FROM chat_messages 
        WHERE id = ANY($1::int[])
      `, [messageIds]);
      
      const messagesDeleted = messagesResult.rowCount || 0;
      console.log(`💬 Deleted ${messagesDeleted} messages`);
      
      // Log the cleanup activity
      await client.query(`
        INSERT INTO chat_cleanup_log (
          cleanup_date, 
          messages_deleted, 
          reactions_deleted,
          retention_hours,
          created_at
        ) VALUES (CURRENT_DATE, $1, $2, $3, NOW())
        ON CONFLICT (cleanup_date) DO UPDATE SET
          messages_deleted = chat_cleanup_log.messages_deleted + EXCLUDED.messages_deleted,
          reactions_deleted = chat_cleanup_log.reactions_deleted + EXCLUDED.reactions_deleted,
          created_at = NOW()
      `, [messagesDeleted, reactionsDeleted, this.config.retentionHours]);
      
      await client.query('COMMIT');
      
      return {
        messagesDeleted,
        reactionsDeleted,
        errors: 0
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error during chat cleanup:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Log cleanup errors to database
   */
  private async logCleanupError(message: string): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO chat_cleanup_log (
          cleanup_date, 
          messages_deleted, 
          reactions_deleted,
          retention_hours,
          error_message,
          created_at
        ) VALUES (CURRENT_DATE, 0, 0, $1, $2, NOW())
        ON CONFLICT (cleanup_date) DO UPDATE SET
          error_message = EXCLUDED.error_message,
          created_at = NOW()
      `, [this.config.retentionHours, message]);
      
      console.log(`📝 Chat cleanup error logged: ${message}`);
    } catch (error) {
      console.error('❌ Failed to log chat cleanup error:', error);
    }
  }

  /**
   * Manually trigger cleanup (for testing or immediate execution)
   */
  async triggerManualCleanup(): Promise<CleanupResult> {
    console.log('🔄 Manual chat cleanup triggered...');
    
    try {
      const result = await this.deleteOldMessages();
      
      console.log(`✅ Manual chat cleanup completed: ${result.messagesDeleted} messages, ${result.reactionsDeleted} reactions deleted`);
      return result;
      
    } catch (error) {
      console.error('❌ Manual chat cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get retention service status
   */
  getStatus(): {
    isRunning: boolean;
    config: RetentionConfig;
    nextCleanupTime: string | null;
  } {
    let nextCleanupTime: string | null = null;
    
    if (this.cleanupTimer && this.isRunning) {
      const intervalMs = this.config.cleanupIntervalHours * 60 * 60 * 1000;
      nextCleanupTime = new Date(Date.now() + intervalMs).toISOString();
    }

    return {
      isRunning: this.isRunning,
      config: this.config,
      nextCleanupTime
    };
  }

  /**
   * Update retention configuration
   */
  updateConfig(newConfig: Partial<RetentionConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    console.log('⚙️ Chat Retention Service config updated:', {
      old: oldConfig,
      new: this.config
    });

    // Restart service if it was running and config changed
    if (this.isRunning && (
      oldConfig.cleanupIntervalHours !== this.config.cleanupIntervalHours ||
      oldConfig.enabled !== this.config.enabled
    )) {
      console.log('🔄 Restarting retention service due to config change...');
      this.stop();
      this.start();
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(days: number = 30): Promise<{
    totalMessagesDeleted: number;
    totalReactionsDeleted: number;
    cleanupDays: number;
    avgMessagesPerDay: number;
  }> {
    const result = await this.pool.query(`
      SELECT 
        SUM(messages_deleted) as total_messages_deleted,
        SUM(reactions_deleted) as total_reactions_deleted,
        COUNT(DISTINCT cleanup_date) as cleanup_days
      FROM chat_cleanup_log 
      WHERE cleanup_date >= CURRENT_DATE - INTERVAL '${days} days'
      AND error_message IS NULL
    `);
    
    const row = result.rows[0];
    const totalMessagesDeleted = parseInt(row.total_messages_deleted || '0');
    const totalReactionsDeleted = parseInt(row.total_reactions_deleted || '0');
    const cleanupDays = parseInt(row.cleanup_days || '0');
    
    return {
      totalMessagesDeleted,
      totalReactionsDeleted,
      cleanupDays,
      avgMessagesPerDay: cleanupDays > 0 ? Math.round(totalMessagesDeleted / cleanupDays) : 0
    };
  }

  /**
   * Utility function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global retention service instance
let retentionServiceInstance: ChatRetentionService | null = null;

/**
 * Initialize and start the global chat retention service
 */
export function initializeChatRetentionService(pool: Pool, config?: Partial<RetentionConfig>): ChatRetentionService {
  if (retentionServiceInstance) {
    console.log('⚠️ Chat Retention Service already initialized');
    return retentionServiceInstance;
  }

  retentionServiceInstance = new ChatRetentionService(pool, config);
  retentionServiceInstance.start();
  
  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, stopping Chat Retention Service...');
    retentionServiceInstance?.stop();
  });

  process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, stopping Chat Retention Service...');
    retentionServiceInstance?.stop();
  });

  return retentionServiceInstance;
}

/**
 * Get the global retention service instance
 */
export function getChatRetentionService(): ChatRetentionService | null {
  return retentionServiceInstance;
}