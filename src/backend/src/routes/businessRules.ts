/**
 * Business Rules API - Easy management of task creation rules
 * 
 * Allows users to:
 * - View all business rules and their configurations
 * - Enable/disable rule categories 
 * - Modify rule parameters without code changes
 * - Add new rules via API
 */

import express from 'express';
import { BusinessRulesEngine } from '../services/businessRulesEngine';
import { auth } from '../middleware/auth';
import db from '../config/database';

const router = express.Router();
const businessRules = new BusinessRulesEngine(db);

/**
 * GET /api/business-rules
 * Get all business rule configurations
 */
router.get('/', auth, async (req, res) => {
  try {
    const rules = await businessRules.getAllRuleConfigs();
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Error fetching business rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch business rules'
    });
  }
});

/**
 * GET /api/business-rules/:ruleName
 * Get specific business rule configuration
 */
router.get('/:ruleName', auth, async (req, res) => {
  try {
    const { ruleName } = req.params;
    const rule = await businessRules.getRuleConfig(ruleName);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Business rule not found'
      });
    }

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('Error fetching business rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch business rule'
    });
  }
});

/**
 * PUT /api/business-rules/:ruleName
 * Update business rule configuration
 */
router.put('/:ruleName', auth, async (req, res) => {
  try {
    const { ruleName } = req.params;
    const { enabled, config_json, description } = req.body;

    const success = await businessRules.updateRuleConfig(
      ruleName,
      enabled,
      config_json,
      description
    );

    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to update business rule'
      });
    }

    res.json({
      success: true,
      message: `Business rule '${ruleName}' updated successfully`
    });
  } catch (error) {
    console.error('Error updating business rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update business rule'
    });
  }
});

/**
 * POST /api/business-rules
 * Create new business rule
 */
router.post('/', auth, async (req, res) => {
  try {
    const { rule_name, enabled, config_json, description } = req.body;

    if (!rule_name || !description) {
      return res.status(400).json({
        success: false,
        error: 'rule_name and description are required'
      });
    }

    const success = await businessRules.createNewRule(
      rule_name,
      enabled || false,
      config_json || {},
      description
    );

    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create business rule'
      });
    }

    res.status(201).json({
      success: true,
      message: `Business rule '${rule_name}' created successfully`
    });
  } catch (error) {
    console.error('Error creating business rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create business rule'
    });
  }
});

/**
 * POST /api/business-rules/:ruleName/toggle
 * Quick toggle to enable/disable a rule
 */
router.post('/:ruleName/toggle', auth, async (req, res) => {
  try {
    const { ruleName } = req.params;
    const currentRule = await businessRules.getRuleConfig(ruleName);
    
    if (!currentRule) {
      return res.status(404).json({
        success: false,
        error: 'Business rule not found'
      });
    }

    const newEnabled = !currentRule.enabled;
    const success = await businessRules.updateRuleConfig(
      ruleName,
      newEnabled
    );

    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to toggle business rule'
      });
    }

    res.json({
      success: true,
      message: `Business rule '${ruleName}' ${newEnabled ? 'enabled' : 'disabled'}`,
      data: { enabled: newEnabled }
    });
  } catch (error) {
    console.error('Error toggling business rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle business rule'
    });
  }
});

export default router;