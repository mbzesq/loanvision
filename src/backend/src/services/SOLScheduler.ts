import { Pool } from 'pg';
import { SOLEventService } from './SOLEventService';

export class SOLScheduler {
  private pool: Pool;
  private solEventService: SOLEventService;
  private dailyUpdateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(pool: Pool) {
    this.pool = pool;
    this.solEventService = new SOLEventService(pool);
  }

  /**
   * Start the SOL scheduler with daily updates
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  SOL scheduler is already running');
      return;
    }

    console.log('🚀 Starting SOL scheduler...');
    this.isRunning = true;

    // Run initial update check
    this.runInitialUpdate();

    // Calculate milliseconds until next 2 AM
    const now = new Date();
    const next2AM = new Date(now);
    next2AM.setHours(2, 0, 0, 0);
    
    // If it's already past 2 AM today, schedule for 2 AM tomorrow
    if (now >= next2AM) {
      next2AM.setDate(next2AM.getDate() + 1);
    }
    
    const msUntilNext2AM = next2AM.getTime() - now.getTime();

    // Set timeout for first scheduled run
    setTimeout(() => {
      this.runDailyUpdate();
      
      // Then run every 24 hours
      this.dailyUpdateInterval = setInterval(() => {
        this.runDailyUpdate();
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    }, msUntilNext2AM);

    console.log(`📅 Next SOL update scheduled for ${next2AM.toISOString()}`);
  }

  /**
   * Stop the SOL scheduler
   */
  stop(): void {
    if (this.dailyUpdateInterval) {
      clearInterval(this.dailyUpdateInterval);
      this.dailyUpdateInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 SOL scheduler stopped');
  }

  /**
   * Run initial update check on startup
   */
  private async runInitialUpdate(): Promise<void> {
    try {
      console.log('🔄 Running initial SOL update check...');
      
      // Check if we need to run today's update
      const lastUpdateQuery = `
        SELECT update_date, loans_updated
        FROM sol_batch_log
        ORDER BY update_date DESC
        LIMIT 1
      `;

      const lastUpdate = await this.pool.query(lastUpdateQuery);
      const today = new Date().toISOString().split('T')[0];
      
      if (lastUpdate.rows.length === 0 || lastUpdate.rows[0].update_date !== today) {
        console.log('📊 Running SOL update for today...');
        const result = await this.solEventService.runDailySOLUpdate();
        console.log(`🎉 Initial update completed: ${result.updated} loans updated, ${result.errors} errors`);
      } else {
        console.log(`ℹ️  SOL update already completed today (${lastUpdate.rows[0].loans_updated} loans)`);
      }

      // Show current alerts
      const alerts = await this.solEventService.checkExpirationAlerts();
      if (alerts.length > 0) {
        console.log('\n⚠️  Current SOL Alerts:');
        alerts.slice(0, 5).forEach(alert => console.log(`   ${alert}`));
        if (alerts.length > 5) {
          console.log(`   ... and ${alerts.length - 5} more alerts`);
        }
      }

    } catch (error) {
      console.error('❌ Initial SOL update failed:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; nextRun?: string } {
    const status: any = { isRunning: this.isRunning };
    
    if (this.isRunning) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0);
      status.nextRun = tomorrow.toISOString();
    }
    
    return status;
  }

  /**
   * Manually trigger daily update
   */
  async triggerUpdate(): Promise<{updated: number; errors: number}> {
    console.log('🔄 Manually triggering SOL update...');
    return await this.runDailyUpdate();
  }

  /**
   * Run the daily SOL update
   */
  private async runDailyUpdate(): Promise<{updated: number; errors: number}> {
    try {
      console.log(`🕒 [${new Date().toISOString()}] Running scheduled SOL update...`);
      
      const result = await this.solEventService.runDailySOLUpdate();
      
      // Check for critical alerts
      const alerts = await this.solEventService.checkExpirationAlerts();
      if (alerts.length > 0) {
        console.log('🚨 SOL Expiration Alerts:');
        alerts.forEach(alert => console.log(`  ${alert}`));
        
        // In production, you could send these alerts via email, Slack, etc.
        // await this.sendAlerts(alerts);
      }
      
      console.log(`✅ Scheduled SOL update completed: ${result.updated} updated, ${result.errors} errors`);
      return result;
      
    } catch (error) {
      console.error('❌ Scheduled SOL update failed:', error);
      return { updated: 0, errors: 1 };
    }
  }

  /**
   * Send alerts to external systems (email, Slack, etc.)
   * TODO: Implement based on your notification preferences
   */
  private async sendAlerts(alerts: string[]): Promise<void> {
    // Example implementation - replace with your preferred notification system
    console.log('📧 Sending SOL alerts to notification system...');
    
    // Could integrate with:
    // - Email service (SendGrid, AWS SES)
    // - Slack webhooks
    // - Microsoft Teams
    // - SMS (Twilio)
    // - Push notifications
    
    // For now, just log them
    alerts.forEach(alert => {
      console.log(`🔔 ALERT: ${alert}`);
    });
  }
}