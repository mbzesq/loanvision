import { 
  ExtractionLearner, 
  ExtractedCandidate 
} from './MarkdownFieldExtractor';
import pool from '../db';

export class SimpleExtractionLearner implements ExtractionLearner {
  
  async improveCandidates(
    allCandidates: Map<string, ExtractedCandidate[]>,
    feedback?: any
  ): Promise<Map<string, ExtractedCandidate>> {
    
    const result = new Map<string, ExtractedCandidate>();
    
    for (const [fieldName, candidates] of allCandidates.entries()) {
      if (candidates.length === 0) continue;
      
      // Apply learning rules to select and improve candidates
      const bestCandidate = await this.selectBestCandidate(fieldName, candidates);
      
      if (bestCandidate) {
        result.set(fieldName, bestCandidate);
      }
    }
    
    return result;
  }

  private async selectBestCandidate(
    fieldName: string, 
    candidates: ExtractedCandidate[]
  ): Promise<ExtractedCandidate | null> {
    
    if (candidates.length === 1) {
      return candidates[0];
    }
    
    // Sort by confidence initially
    candidates.sort((a, b) => b.confidence - a.confidence);
    
    // Apply field-specific learning rules
    const improved = await this.applyLearningRules(fieldName, candidates);
    
    return improved.length > 0 ? improved[0] : null;
  }

  private async applyLearningRules(
    fieldName: string, 
    candidates: ExtractedCandidate[]
  ): Promise<ExtractedCandidate[]> {
    
    // Get historical success rates for strategies on this field type
    const strategyStats = await this.getStrategyStats(fieldName);
    
    // Adjust confidence based on historical performance
    for (const candidate of candidates) {
      const stats = strategyStats.get(candidate.strategy);
      if (stats) {
        // Boost confidence for strategies with good historical performance
        const successRate = stats.successes / Math.max(stats.attempts, 1);
        const boost = (successRate - 0.5) * 0.2; // Up to ±0.1 adjustment
        candidate.confidence = Math.max(0, Math.min(1, candidate.confidence + boost));
      }
    }
    
    // Apply business rules for candidate selection
    const filtered = this.applyBusinessRules(fieldName, candidates);
    
    // Re-sort after adjustments
    filtered.sort((a, b) => b.confidence - a.confidence);
    
    return filtered;
  }

  private async getStrategyStats(fieldName: string): Promise<Map<string, {successes: number, attempts: number}>> {
    const stats = new Map<string, {successes: number, attempts: number}>();
    
    try {
      const query = `
        SELECT 
          strategy_name,
          COUNT(*) as attempts,
          COUNT(CASE WHEN is_correct = true THEN 1 END) as successes
        FROM extraction_feedback 
        WHERE field_name = $1 
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY strategy_name
      `;
      
      const result = await pool.query(query, [fieldName]);
      
      for (const row of result.rows) {
        stats.set(row.strategy_name, {
          successes: parseInt(row.successes),
          attempts: parseInt(row.attempts)
        });
      }
    } catch (error) {
      console.warn('Failed to get strategy stats:', error);
      // Continue without historical data
    }
    
    return stats;
  }

  private applyBusinessRules(
    fieldName: string, 
    candidates: ExtractedCandidate[]
  ): ExtractedCandidate[] {
    
    // Field-specific business rules
    switch (fieldName) {
      case 'assignor':
      case 'assignee':
        return this.filterCompanyNames(candidates);
        
      case 'loanAmount':
        return this.filterReasonableAmounts(candidates);
        
      case 'propertyState':
        return this.filterValidStates(candidates);
        
      case 'originationDate':
      case 'assignmentDate':
      case 'recordingDate':
        return this.filterReasonableDates(candidates);
        
      default:
        return candidates;
    }
  }

  private filterCompanyNames(candidates: ExtractedCandidate[]): ExtractedCandidate[] {
    return candidates.filter(candidate => {
      const value = candidate.value?.toString() || '';
      
      // Filter out obviously bad company names
      if (value.length < 3 || value.length > 200) return false;
      if (/^\d+$/.test(value)) return false; // Just numbers
      if (/^[a-z\s]+$/.test(value)) return false; // All lowercase
      
      return true;
    });
  }

  private filterReasonableAmounts(candidates: ExtractedCandidate[]): ExtractedCandidate[] {
    return candidates.filter(candidate => {
      const amount = parseFloat(candidate.value?.toString() || '0');
      
      // Filter unreasonable loan amounts
      return amount >= 1000 && amount <= 10000000; // $1K to $10M
    });
  }

  private filterValidStates(candidates: ExtractedCandidate[]): ExtractedCandidate[] {
    const validStates = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC'
    ]);
    
    return candidates.filter(candidate => {
      const state = candidate.value?.toString()?.toUpperCase() || '';
      return validStates.has(state);
    });
  }

  private filterReasonableDates(candidates: ExtractedCandidate[]): ExtractedCandidate[] {
    const now = new Date();
    const minDate = new Date('1900-01-01');
    const maxDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year in future
    
    return candidates.filter(candidate => {
      const dateValue = candidate.value;
      
      if (dateValue instanceof Date) {
        return dateValue >= minDate && dateValue <= maxDate;
      }
      
      // Try to parse string dates
      const parsedDate = new Date(dateValue?.toString() || '');
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate >= minDate && parsedDate <= maxDate;
      }
      
      return true; // Keep non-date values for now
    });
  }

  // Method to record feedback for learning
  async recordFeedback(
    fieldName: string,
    strategyName: string,
    extractedValue: any,
    isCorrect: boolean,
    correctValue?: any
  ): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO extraction_feedback (
          field_name, strategy_name, extracted_value, is_correct, correct_value
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        fieldName,
        strategyName,
        extractedValue?.toString() || null,
        isCorrect,
        correctValue?.toString() || null
      ]);
    } catch (error) {
      console.warn('Failed to record extraction feedback:', error);
      // Non-critical, continue operation
    }
  }
}