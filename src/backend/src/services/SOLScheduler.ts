import { Pool } from 'pg';
import { SOLEventService } from './SOLEventService';

interface SchedulerConfig {
  enabled: boolean;
  dailyUpdateHour: number; // 0-23, UTC hour to run daily updates
  batchSize: number; // Maximum loans to process per batch
  retryAttempts: number;
  retryDelayMs: number;
}

export class SOLScheduler {
  private pool: Pool;
  private solEventService: SOLEventService;
  private config: SchedulerConfig;
  private dailyTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(pool: Pool, config: Partial<SchedulerConfig> = {}) {
    this.pool = pool;
    this.solEventService = new SOLEventService(pool);
    
    // Default configuration
    this.config = {
      enabled: process.env.SOL_SCHEDULER_ENABLED === 'true' || true,
      dailyUpdateHour: parseInt(process.env.SOL_DAILY_UPDATE_HOUR || '2'), // 2 AM UTC by default
      batchSize: parseInt(process.env.SOL_BATCH_SIZE || '1000'),
      retryAttempts: parseInt(process.env.SOL_RETRY_ATTEMPTS || '3'),
      retryDelayMs: parseInt(process.env.SOL_RETRY_DELAY_MS || '5000'),
      ...config
    };

    console.log('🕒 SOL Scheduler initialized with config:', this.config);
  }

  /**
   * Start the SOL scheduler
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('⏸️ SOL Scheduler is disabled');
      return;
    }

    if (this.isRunning) {
      console.log('⚠️ SOL Scheduler is already running');
      return;
    }

    console.log('🚀 Starting SOL Scheduler...');
    this.isRunning = true;
    this.scheduleDailyUpdate();
  }

  /**
   * Stop the SOL scheduler
   */
  stop(): void {
    console.log('🛑 Stopping SOL Scheduler...');
    this.isRunning = false;
    
    if (this.dailyTimer) {
      clearTimeout(this.dailyTimer);
      this.dailyTimer = null;
    }
    
    console.log('✅ SOL Scheduler stopped');
  }

  /**
   * Schedule the next daily update
   */
  private scheduleDailyUpdate(): void {
    if (!this.isRunning) return;

    const now = new Date();
    const nextRun = new Date();
    
    // Set to today at the configured hour
    nextRun.setUTCHours(this.config.dailyUpdateHour, 0, 0, 0);
    
    // If we've already passed today's time, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    const timeUntilRun = nextRun.getTime() - now.getTime();
    
    console.log(`⏰ Next SOL daily update scheduled for: ${nextRun.toISOString()}`);
    console.log(`   (in ${Math.round(timeUntilRun / 1000 / 60)} minutes)`);

    this.dailyTimer = setTimeout(async () => {
      await this.runDailyUpdate();
      this.scheduleDailyUpdate(); // Schedule the next run
    }, timeUntilRun);
  }

  /**
   * Execute the daily SOL update
   */
  private async runDailyUpdate(): Promise<void> {
    if (!this.isRunning) return;

    console.log('🕒 Starting scheduled daily SOL update...');
    
    let attempt = 1;
    let success = false;

    while (attempt <= this.config.retryAttempts && !success && this.isRunning) {
      try {
        console.log(`📊 Daily SOL update attempt ${attempt}/${this.config.retryAttempts}`);
        
        const result = await this.solEventService.runDailySOLUpdate();
        
        console.log(`✅ Daily SOL update completed successfully:`);
        console.log(`   - Updated: ${result.updated} loans`);
        console.log(`   - Errors: ${result.errors} loans`);
        
        // Check for critical alerts after update
        await this.checkAndLogAlerts();
        
        success = true;
        
      } catch (error) {
        console.error(`❌ Daily SOL update attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.retryAttempts) {
          console.log(`⏳ Retrying in ${this.config.retryDelayMs / 1000} seconds...`);
          await this.sleep(this.config.retryDelayMs);
        }
        
        attempt++;
      }
    }

    if (!success) {
      console.error('💥 Daily SOL update failed after all retry attempts');
      await this.logCriticalError('Daily SOL update failed after all retries');
    }
  }

  /**
   * Check for critical SOL alerts and log them
   */
  private async checkAndLogAlerts(): Promise<void> {
    try {
      const alerts = await this.solEventService.checkExpirationAlerts();
      
      if (alerts.length > 0) {
        console.log(`🚨 Found ${alerts.length} SOL expiration alerts:`);
        
        // Log critical alerts (< 30 days)
        const criticalAlerts = alerts.filter(alert => alert.startsWith('CRITICAL'));
        if (criticalAlerts.length > 0) {
          console.log(`⚠️ CRITICAL ALERTS (${criticalAlerts.length}):`);
          criticalAlerts.forEach(alert => console.log(`   ${alert}`));
        }
        
        // Log high priority alerts (30-60 days)
        const highAlerts = alerts.filter(alert => alert.startsWith('HIGH'));
        if (highAlerts.length > 0) {
          console.log(`🔶 HIGH PRIORITY ALERTS (${highAlerts.length}):`);
          highAlerts.slice(0, 5).forEach(alert => console.log(`   ${alert}`));
          if (highAlerts.length > 5) {
            console.log(`   ... and ${highAlerts.length - 5} more`);
          }
        }
      } else {
        console.log('✅ No SOL expiration alerts found');
      }
    } catch (error) {
      console.error('❌ Error checking SOL alerts:', error);
    }
  }

  /**
   * Log critical errors to database
   */
  private async logCriticalError(message: string): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO sol_batch_log (update_date, loans_updated, errors, created_at)
        VALUES (CURRENT_DATE, 0, -1, NOW())
        ON CONFLICT (update_date) DO UPDATE SET
          errors = sol_batch_log.errors + 1,
          created_at = NOW()
      `);
      
      console.log(`📝 Critical SOL error logged: ${message}`);
    } catch (error) {
      console.error('❌ Failed to log critical SOL error:', error);
    }
  }

  /**
   * Manually trigger a daily update (for testing or immediate execution)
   */
  async triggerManualUpdate(): Promise<{ updated: number; errors: number }> {
    console.log('🔄 Manual SOL update triggered...');
    
    try {
      const result = await this.solEventService.runDailySOLUpdate();
      await this.checkAndLogAlerts();
      
      console.log(`✅ Manual SOL update completed: ${result.updated} updated, ${result.errors} errors`);
      return result;
      
    } catch (error) {
      console.error('❌ Manual SOL update failed:', error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    config: SchedulerConfig;
    nextRunTime: string | null;
  } {
    let nextRunTime: string | null = null;
    
    if (this.dailyTimer && this.isRunning) {
      const now = new Date();
      const nextRun = new Date();
      nextRun.setUTCHours(this.config.dailyUpdateHour, 0, 0, 0);
      
      if (nextRun <= now) {
        nextRun.setUTCDate(nextRun.getUTCDate() + 1);
      }
      
      nextRunTime = nextRun.toISOString();
    }

    return {
      isRunning: this.isRunning,
      config: this.config,
      nextRunTime
    };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    console.log('⚙️ SOL Scheduler config updated:', {
      old: oldConfig,
      new: this.config
    });

    // Restart scheduler if it was running and config changed
    if (this.isRunning && (
      oldConfig.dailyUpdateHour !== this.config.dailyUpdateHour ||
      oldConfig.enabled !== this.config.enabled
    )) {
      console.log('🔄 Restarting scheduler due to config change...');
      this.stop();
      this.start();
    }
  }

  /**
   * Utility function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global scheduler instance
let schedulerInstance: SOLScheduler | null = null;

/**
 * Initialize and start the global SOL scheduler
 */
export function initializeSOLScheduler(pool: Pool, config?: Partial<SchedulerConfig>): SOLScheduler {
  if (schedulerInstance) {
    console.log('⚠️ SOL Scheduler already initialized');
    return schedulerInstance;
  }

  schedulerInstance = new SOLScheduler(pool, config);
  schedulerInstance.start();
  
  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, stopping SOL Scheduler...');
    schedulerInstance?.stop();
  });

  process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, stopping SOL Scheduler...');
    schedulerInstance?.stop();
  });

  return schedulerInstance;
}

/**
 * Get the global scheduler instance
 */
export function getSOLScheduler(): SOLScheduler | null {
  return schedulerInstance;
}