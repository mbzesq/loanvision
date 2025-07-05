import { SOLEventService } from './SOLEventService';
import { Pool } from 'pg';

export class SOLScheduler {
  private solEventService: SOLEventService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(pool: Pool) {
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

    // Run immediately on startup
    this.runDailyUpdate();

    // Calculate milliseconds until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // Run at 2 AM to avoid peak hours
    
    const msUntilTomorrow = tomorrow.getTime() - now.getTime();

    // Set timeout for first scheduled run
    setTimeout(() => {
      this.runDailyUpdate();
      
      // Then run every 24 hours
      this.intervalId = setInterval(() => {
        this.runDailyUpdate();
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    }, msUntilTomorrow);

    console.log(`📅 Next SOL update scheduled for ${tomorrow.toISOString()}`);
  }

  /**
   * Stop the SOL scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 SOL scheduler stopped');
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