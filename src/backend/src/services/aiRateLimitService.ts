import { Pool } from 'pg';

interface RateLimitConfig {
  maxQueriesPerDay: number;
  maxTokensPerDay: number;
  resetHour: number; // Hour (0-23) when daily limits reset
}

interface RateLimitStatus {
  userId: number;
  date: string;
  queriesUsed: number;
  tokensUsed: number;
  queriesRemaining: number;
  tokensRemaining: number;
  resetTime: Date;
  isBlocked: boolean;
  blockedReason?: string;
}

interface RateLimitUpdate {
  queries?: number;
  tokens?: number;
}

export class AIRateLimitService {
  private pool: Pool;
  private config: RateLimitConfig;

  constructor(pool: Pool, config?: Partial<RateLimitConfig>) {
    this.pool = pool;
    
    this.config = {
      maxQueriesPerDay: parseInt(process.env.AI_MAX_QUERIES_PER_DAY || '50'),
      maxTokensPerDay: parseInt(process.env.AI_MAX_TOKENS_PER_DAY || '100000'),
      resetHour: parseInt(process.env.AI_RESET_HOUR || '0'), // Midnight UTC
      ...config
    };

    console.log('🛡️ AI Rate Limit Service initialized:', this.config);
  }

  /**
   * Check if user can make a query
   */
  async checkRateLimit(userId: number): Promise<RateLimitStatus> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get or create today's rate limit record
    let rateLimitRecord = await this.getRateLimitRecord(userId, today);
    
    if (!rateLimitRecord) {
      rateLimitRecord = await this.createRateLimitRecord(userId, today);
    }

    const queriesRemaining = Math.max(0, this.config.maxQueriesPerDay - rateLimitRecord.queries_used);
    const tokensRemaining = Math.max(0, this.config.maxTokensPerDay - rateLimitRecord.tokens_used);
    
    // Calculate reset time (next occurrence of reset hour)
    const resetTime = this.getNextResetTime();
    
    // Check if user is blocked
    const isBlocked = queriesRemaining <= 0 || tokensRemaining <= 0;
    let blockedReason: string | undefined;
    
    if (isBlocked) {
      if (queriesRemaining <= 0) {
        blockedReason = 'Daily query limit exceeded';
      } else if (tokensRemaining <= 0) {
        blockedReason = 'Daily token limit exceeded';
      }
    }

    return {
      userId,
      date: today,
      queriesUsed: rateLimitRecord.queries_used,
      tokensUsed: rateLimitRecord.tokens_used,
      queriesRemaining,
      tokensRemaining,
      resetTime,
      isBlocked,
      blockedReason
    };
  }

  /**
   * Check if user can make a query with specific token cost
   */
  async canMakeQuery(userId: number, estimatedTokens: number = 0): Promise<{
    canProceed: boolean;
    status: RateLimitStatus;
    reason?: string;
  }> {
    const status = await this.checkRateLimit(userId);
    
    if (status.isBlocked) {
      return {
        canProceed: false,
        status,
        reason: status.blockedReason
      };
    }

    // Check if estimated tokens would exceed limit
    if (estimatedTokens > 0 && (status.tokensUsed + estimatedTokens) > this.config.maxTokensPerDay) {
      return {
        canProceed: false,
        status,
        reason: 'Query would exceed daily token limit'
      };
    }

    return {
      canProceed: true,
      status
    };
  }

  /**
   * Record usage after a successful query
   */
  async recordUsage(userId: number, usage: RateLimitUpdate): Promise<RateLimitStatus> {
    const today = new Date().toISOString().split('T')[0];
    
    // Update the rate limit record
    await this.pool.query(`
      INSERT INTO ai_rate_limits (user_id, date, queries_used, tokens_used, last_query_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, date) 
      DO UPDATE SET
        queries_used = ai_rate_limits.queries_used + $3,
        tokens_used = ai_rate_limits.tokens_used + $4,
        last_query_at = NOW()
    `, [
      userId,
      today,
      usage.queries || 0,
      usage.tokens || 0
    ]);

    // Log the usage for audit
    await this.logRateLimitEvent(userId, 'usage_recorded', {
      queries: usage.queries || 0,
      tokens: usage.tokens || 0,
      date: today
    });

    return await this.checkRateLimit(userId);
  }

  /**
   * Get rate limit record for a user and date
   */
  private async getRateLimitRecord(userId: number, date: string): Promise<any> {
    const result = await this.pool.query(`
      SELECT * FROM ai_rate_limits 
      WHERE user_id = $1 AND date = $2
    `, [userId, date]);

    return result.rows[0] || null;
  }

  /**
   * Create new rate limit record
   */
  private async createRateLimitRecord(userId: number, date: string): Promise<any> {
    const result = await this.pool.query(`
      INSERT INTO ai_rate_limits (user_id, date, queries_used, tokens_used)
      VALUES ($1, $2, 0, 0)
      RETURNING *
    `, [userId, date]);

    return result.rows[0];
  }

  /**
   * Get next reset time based on configured reset hour
   */
  private getNextResetTime(): Date {
    const now = new Date();
    const resetTime = new Date();
    
    // Set to today at reset hour
    resetTime.setUTCHours(this.config.resetHour, 0, 0, 0);
    
    // If reset time has already passed today, set to tomorrow
    if (resetTime <= now) {
      resetTime.setUTCDate(resetTime.getUTCDate() + 1);
    }
    
    return resetTime;
  }

  /**
   * Reset rate limits for a specific user (admin function)
   */
  async resetUserLimits(userId: number, adminUserId: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    await this.pool.query(`
      UPDATE ai_rate_limits 
      SET queries_used = 0, tokens_used = 0, last_query_at = NULL
      WHERE user_id = $1 AND date = $2
    `, [userId, today]);

    await this.logRateLimitEvent(adminUserId, 'limits_reset', {
      targetUserId: userId,
      date: today
    });

    console.log(`🔄 Rate limits reset for user ${userId} by admin ${adminUserId}`);
  }

  /**
   * Get rate limit statistics for multiple users
   */
  async getRateLimitStats(days: number = 30): Promise<{
    totalUsers: number;
    totalQueries: number;
    totalTokens: number;
    blockedUsers: number;
    topUsers: Array<{
      userId: number;
      totalQueries: number;
      totalTokens: number;
      daysActive: number;
    }>;
    dailyUsage: Array<{
      date: string;
      queries: number;
      tokens: number;
      activeUsers: number;
    }>;
  }> {
    // Get overall statistics
    const statsResult = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT user_id) as total_users,
        SUM(queries_used) as total_queries,
        SUM(tokens_used) as total_tokens,
        COUNT(DISTINCT CASE 
          WHEN queries_used >= $1 OR tokens_used >= $2 THEN user_id 
        END) as blocked_users
      FROM ai_rate_limits 
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
    `, [this.config.maxQueriesPerDay, this.config.maxTokensPerDay]);

    // Get top users
    const topUsersResult = await this.pool.query(`
      SELECT 
        user_id,
        SUM(queries_used) as total_queries,
        SUM(tokens_used) as total_tokens,
        COUNT(DISTINCT date) as days_active
      FROM ai_rate_limits 
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY user_id
      ORDER BY total_queries DESC
      LIMIT 10
    `);

    // Get daily usage
    const dailyUsageResult = await this.pool.query(`
      SELECT 
        date,
        SUM(queries_used) as queries,
        SUM(tokens_used) as tokens,
        COUNT(DISTINCT user_id) as active_users
      FROM ai_rate_limits 
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY date
      ORDER BY date DESC
    `);

    const stats = statsResult.rows[0];
    
    return {
      totalUsers: parseInt(stats.total_users || '0'),
      totalQueries: parseInt(stats.total_queries || '0'),
      totalTokens: parseInt(stats.total_tokens || '0'),
      blockedUsers: parseInt(stats.blocked_users || '0'),
      topUsers: topUsersResult.rows.map(row => ({
        userId: row.user_id,
        totalQueries: parseInt(row.total_queries),
        totalTokens: parseInt(row.total_tokens),
        daysActive: parseInt(row.days_active)
      })),
      dailyUsage: dailyUsageResult.rows.map(row => ({
        date: row.date,
        queries: parseInt(row.queries),
        tokens: parseInt(row.tokens),
        activeUsers: parseInt(row.active_users)
      }))
    };
  }

  /**
   * Clean up old rate limit records
   */
  async cleanupOldRecords(daysToKeep: number = 90): Promise<number> {
    const result = await this.pool.query(`
      DELETE FROM ai_rate_limits 
      WHERE date < CURRENT_DATE - INTERVAL '${daysToKeep} days'
    `);

    const deletedCount = result.rowCount || 0;
    console.log(`🧹 Cleaned up ${deletedCount} old rate limit records`);
    
    return deletedCount;
  }

  /**
   * Log rate limit events for audit
   */
  private async logRateLimitEvent(userId: number, action: string, details: any): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO ai_audit_log (user_id, action, details, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [userId, `rate_limit_${action}`, JSON.stringify(details)]);
    } catch (error) {
      console.error('Failed to log rate limit event:', error);
    }
  }

  /**
   * Get rate limit configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ AI Rate Limit Service config updated:', this.config);
  }

  /**
   * Check if user is currently blocked
   */
  async isUserBlocked(userId: number): Promise<boolean> {
    const status = await this.checkRateLimit(userId);
    return status.isBlocked;
  }

  /**
   * Get detailed rate limit info for a user
   */
  async getUserRateLimitInfo(userId: number): Promise<{
    current: RateLimitStatus;
    history: Array<{
      date: string;
      queries: number;
      tokens: number;
      lastQuery: Date | null;
    }>;
  }> {
    const current = await this.checkRateLimit(userId);
    
    const historyResult = await this.pool.query(`
      SELECT date, queries_used, tokens_used, last_query_at
      FROM ai_rate_limits 
      WHERE user_id = $1 
      ORDER BY date DESC 
      LIMIT 30
    `, [userId]);

    const history = historyResult.rows.map(row => ({
      date: row.date,
      queries: row.queries_used,
      tokens: row.tokens_used,
      lastQuery: row.last_query_at
    }));

    return {
      current,
      history
    };
  }
}