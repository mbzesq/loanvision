/**
 * Business Rules Engine - Makes it easy to configure and modify task creation rules
 * 
 * This service allows users to:
 * 1. Enable/disable rule categories via database config
 * 2. Modify rule parameters without code changes  
 * 3. Add new rules by extending the configuration
 */

import { Pool } from 'pg';
// Simple logger replacement since utils/logger doesn't exist
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[BusinessRules] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[BusinessRules] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[BusinessRules] ${msg}`, ...args)
};

export interface BusinessRuleConfig {
  id: number;
  rule_name: string;
  enabled: boolean;
  config_json: any;
  description: string;
}

export class BusinessRulesEngine {
  constructor(private db: Pool) {}

  /**
   * Get configuration for a specific business rule
   */
  async getRuleConfig(ruleName: string): Promise<BusinessRuleConfig | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM business_rule_config WHERE rule_name = $1',
        [ruleName]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching business rule config:', error);
      return null;
    }
  }

  /**
   * Check if a rule is enabled
   */
  async isRuleEnabled(ruleName: string): Promise<boolean> {
    const config = await this.getRuleConfig(ruleName);
    return config?.enabled || false;
  }

  /**
   * Get all business rule configurations
   */
  async getAllRuleConfigs(): Promise<BusinessRuleConfig[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM business_rule_config ORDER BY rule_name'
      );
      return result.rows;
    } catch (error) {
      logger.error('Error fetching all business rule configs:', error);
      return [];
    }
  }

  /**
   * Update rule configuration
   */
  async updateRuleConfig(
    ruleName: string, 
    enabled: boolean, 
    configJson?: any, 
    description?: string
  ): Promise<boolean> {
    try {
      const updateFields = ['enabled = $2', 'updated_at = NOW()'];
      const values = [ruleName, enabled];
      let paramIndex = 3;

      if (configJson !== undefined) {
        updateFields.push(`config_json = $${paramIndex}`);
        values.push(configJson);
        paramIndex++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        values.push(description);
      }

      await this.db.query(
        `UPDATE business_rule_config SET ${updateFields.join(', ')} WHERE rule_name = $1`,
        values
      );

      logger.info(`Updated business rule config: ${ruleName}`, { enabled, configJson });
      return true;
    } catch (error) {
      logger.error(`Error updating business rule config: ${ruleName}`, error);
      return false;
    }
  }

  /**
   * Document Upload Rules - Configurable via database
   */
  async shouldCreateDocumentUploadTasks(): Promise<boolean> {
    return await this.isRuleEnabled('document_upload_tasks');
  }

  async getDocumentUploadConfig(): Promise<any> {
    const config = await this.getRuleConfig('document_upload_tasks');
    return config?.config_json || {
      security_instrument_days: 7,
      title_report_days: 14,
      enabled_loan_statuses: ['active', 'delinquent'],
      excluded_legal_statuses: ['REO', 'paid_off', 'settled']
    };
  }

  /**
   * Foreclosure Rules - Configurable via database
   */
  async shouldCreateForeclosureTasks(): Promise<boolean> {
    return await this.isRuleEnabled('foreclosure_tasks');
  }

  async getForeclosureConfig(): Promise<any> {
    const config = await this.getRuleConfig('foreclosure_tasks');
    return config?.config_json || {
      urgent_days: 7,
      scheduled_days: 30,
      enabled: true
    };
  }

  /**
   * Document Review Rules - Configurable via database  
   */
  async shouldCreateDocumentReviewTasks(): Promise<boolean> {
    return await this.isRuleEnabled('document_review_tasks');
  }

  async getDocumentReviewConfig(): Promise<any> {
    const config = await this.getRuleConfig('document_review_tasks');
    return config?.config_json || {
      critical_confidence_threshold: 50,
      low_confidence_threshold: 70,
      enabled: true
    };
  }

  /**
   * Helper method to create a new business rule
   */
  async createNewRule(
    ruleName: string,
    enabled: boolean,
    configJson: any,
    description: string
  ): Promise<boolean> {
    try {
      await this.db.query(
        `INSERT INTO business_rule_config (rule_name, enabled, config_json, description) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (rule_name) DO UPDATE SET
         enabled = $2, config_json = $3, description = $4, updated_at = NOW()`,
        [ruleName, enabled, configJson, description]
      );

      logger.info(`Created/updated business rule: ${ruleName}`, { enabled, configJson });
      return true;
    } catch (error) {
      logger.error(`Error creating business rule: ${ruleName}`, error);
      return false;
    }
  }
}

// Example: How to add a new business rule
/*
const businessRules = new BusinessRulesEngine(db);

// Add a new rule for payment investigation
await businessRules.createNewRule(
  'payment_investigation_tasks',
  true,
  {
    minimum_delinquency_months: 6,
    minimum_payment_amount: 100,
    enabled_loan_types: ['residential', 'commercial']
  },
  'Creates tasks when payments are received on significantly delinquent loans'
);
*/