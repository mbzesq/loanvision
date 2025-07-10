import pool from '../db';
import { Request } from 'express';

export interface SessionData {
  id?: number;
  userId: number;
  sessionToken?: string;
  loginTime: Date;
  logoutTime?: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  sessionStatus: 'active' | 'logged_out' | 'expired' | 'terminated';
  logoutType?: 'manual' | 'timeout' | 'admin_forced' | 'token_expired';
  sessionDurationMinutes?: number;
}

export interface UserAgentInfo {
  deviceType: string;
  browser: string;
  os: string;
}

export class SessionService {
  /**
   * Parse user agent string to extract device, browser, and OS info
   */
  private parseUserAgent(userAgent: string): UserAgentInfo {
    const ua = userAgent.toLowerCase();
    
    // Detect device type
    let deviceType = 'desktop';
    if (ua.includes('mobile') || ua.includes('android')) {
      deviceType = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      deviceType = 'tablet';
    }
    
    // Detect browser
    let browser = 'Unknown';
    if (ua.includes('chrome') && !ua.includes('edg')) {
      browser = 'Chrome';
    } else if (ua.includes('firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browser = 'Safari';
    } else if (ua.includes('edg')) {
      browser = 'Edge';
    } else if (ua.includes('opera')) {
      browser = 'Opera';
    }
    
    // Detect OS
    let os = 'Unknown';
    if (ua.includes('windows')) {
      os = 'Windows';
    } else if (ua.includes('mac')) {
      os = 'macOS';
    } else if (ua.includes('linux')) {
      os = 'Linux';
    } else if (ua.includes('android')) {
      os = 'Android';
    } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
      os = 'iOS';
    }
    
    return { deviceType, browser, os };
  }

  /**
   * Create a new login session
   */
  async createLoginSession(
    userId: number, 
    sessionToken: string, 
    req: Request
  ): Promise<SessionData> {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress || null;
      const userAgent = req.headers['user-agent'] || '';
      const { deviceType, browser, os } = this.parseUserAgent(userAgent);

      const query = `
        INSERT INTO user_sessions (
          user_id, session_token, login_time, last_activity,
          ip_address, user_agent, device_type, browser, os, session_status
        )
        VALUES ($1, $2, NOW(), NOW(), $3, $4, $5, $6, $7, 'active')
        RETURNING *
      `;

      const result = await pool.query(query, [
        userId,
        sessionToken,
        ipAddress,
        userAgent,
        deviceType,
        browser,
        os
      ]);

      const session = result.rows[0];
      console.log(`[Session] Created login session for user ${userId} from ${ipAddress} (${deviceType}/${browser})`);
      
      return this.mapRowToSessionData(session);
    } catch (error) {
      console.error('[Session] Error creating login session:', error);
      throw error;
    }
  }

  /**
   * Record logout for a session
   */
  async recordLogout(
    sessionToken: string, 
    logoutType: 'manual' | 'timeout' | 'admin_forced' | 'token_expired' = 'manual'
  ): Promise<boolean> {
    try {
      const query = `
        UPDATE user_sessions 
        SET 
          logout_time = NOW(),
          session_status = 'logged_out',
          logout_type = $2,
          updated_at = NOW()
        WHERE session_token = $1 AND session_status = 'active'
        RETURNING id, user_id, session_duration_minutes
      `;

      const result = await pool.query(query, [sessionToken, logoutType]);
      
      if (result.rows.length > 0) {
        const session = result.rows[0];
        console.log(`[Session] Recorded ${logoutType} logout for user ${session.user_id}, duration: ${session.session_duration_minutes || 0} minutes`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Session] Error recording logout:', error);
      throw error;
    }
  }

  /**
   * Update last activity for a session
   */
  async updateLastActivity(sessionToken: string): Promise<boolean> {
    try {
      const query = `
        UPDATE user_sessions 
        SET last_activity = NOW(), updated_at = NOW()
        WHERE session_token = $1 AND session_status = 'active'
      `;

      const result = await pool.query(query, [sessionToken]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('[Session] Error updating last activity:', error);
      return false;
    }
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: number): Promise<SessionData[]> {
    try {
      const query = `
        SELECT * FROM user_sessions 
        WHERE user_id = $1 AND session_status = 'active'
        ORDER BY login_time DESC
      `;

      const result = await pool.query(query, [userId]);
      return result.rows.map(this.mapRowToSessionData);
    } catch (error) {
      console.error('[Session] Error fetching active sessions:', error);
      throw error;
    }
  }

  /**
   * Get session history for a user
   */
  async getSessionHistory(
    userId: number, 
    limit: number = 50
  ): Promise<SessionData[]> {
    try {
      const query = `
        SELECT * FROM user_sessions 
        WHERE user_id = $1
        ORDER BY login_time DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);
      return result.rows.map(this.mapRowToSessionData);
    } catch (error) {
      console.error('[Session] Error fetching session history:', error);
      throw error;
    }
  }

  /**
   * Expire old sessions (cleanup task)
   */
  async expireOldSessions(hoursThreshold: number = 24): Promise<number> {
    try {
      const query = `
        UPDATE user_sessions 
        SET 
          session_status = 'expired',
          logout_time = COALESCE(logout_time, NOW()),
          logout_type = COALESCE(logout_type, 'timeout'),
          updated_at = NOW()
        WHERE 
          session_status = 'active' 
          AND last_activity < NOW() - INTERVAL '${hoursThreshold} hours'
        RETURNING id
      `;

      const result = await pool.query(query);
      const expiredCount = result.rowCount;
      
      if (expiredCount > 0) {
        console.log(`[Session] Expired ${expiredCount} inactive sessions older than ${hoursThreshold} hours`);
      }
      
      return expiredCount;
    } catch (error) {
      console.error('[Session] Error expiring old sessions:', error);
      throw error;
    }
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(days: number = 30) {
    try {
      const query = `
        SELECT 
          DATE(login_time) as date,
          COUNT(*) as total_logins,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(session_duration_minutes) as avg_session_duration,
          COUNT(*) FILTER (WHERE device_type = 'desktop') as desktop_logins,
          COUNT(*) FILTER (WHERE device_type = 'mobile') as mobile_logins,
          COUNT(*) FILTER (WHERE device_type = 'tablet') as tablet_logins
        FROM user_sessions 
        WHERE login_time >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(login_time)
        ORDER BY date DESC
      `;

      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('[Session] Error fetching session analytics:', error);
      throw error;
    }
  }

  /**
   * Map database row to SessionData interface
   */
  private mapRowToSessionData(row: any): SessionData {
    return {
      id: row.id,
      userId: row.user_id,
      sessionToken: row.session_token,
      loginTime: row.login_time,
      logoutTime: row.logout_time,
      lastActivity: row.last_activity,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      deviceType: row.device_type,
      browser: row.browser,
      os: row.os,
      sessionStatus: row.session_status,
      logoutType: row.logout_type,
      sessionDurationMinutes: row.session_duration_minutes
    };
  }
}

export const sessionService = new SessionService();