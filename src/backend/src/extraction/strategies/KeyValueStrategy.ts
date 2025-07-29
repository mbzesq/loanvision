import { 
  ExtractionStrategy, 
  ExtractedCandidate, 
  ExtractorConfig 
} from '../markdownFieldExtractorV2';

export class KeyValueStrategy implements ExtractionStrategy {
  name = 'KeyValue';
  priority = 90; // High priority for labeled data

  extract(text: string, config: ExtractorConfig): Map<string, ExtractedCandidate> {
    const results = new Map<string, ExtractedCandidate>();
    
    for (const field of config.fields) {
      const candidate = this.extractKeyValueField(text, field);
      if (candidate) {
        results.set(field.name, candidate);
      }
    }
    
    return results;
  }

  private extractKeyValueField(text: string, fieldDef: any): ExtractedCandidate | null {
    // Try each keyword to find key-value patterns
    for (const keyword of fieldDef.keywords) {
      const patterns = [
        // Standard colon patterns
        new RegExp(`${this.escapeRegex(keyword)}\\s*:\\s*([^\\n\\r]+)`, 'i'),
        // Equals patterns
        new RegExp(`${this.escapeRegex(keyword)}\\s*=\\s*([^\\n\\r]+)`, 'i'),
        // Spaced patterns with dashes
        new RegExp(`${this.escapeRegex(keyword)}\\s*[-–—]\\s*([^\\n\\r]+)`, 'i'),
        // Parentheses patterns
        new RegExp(`${this.escapeRegex(keyword)}\\s*\\(([^)]+)\\)`, 'i'),
        // Bold markdown patterns
        new RegExp(`\\*\\*${this.escapeRegex(keyword)}\\*\\*\\s*:?\\s*([^\\n\\r*]+)`, 'i'),
        // Property-style patterns for assignments
        new RegExp(`${this.escapeRegex(keyword)}\\s+(?:is\\s+)?([A-Z][^\\n\\r,.]+?)(?:[\\n\\r,.]|$)`, 'i')
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const rawValue = match[1].trim();
          
          // Skip if value is too short or looks like a label
          if (rawValue.length < 2 || this.looksLikeLabel(rawValue)) {
            continue;
          }
          
          const value = this.parseValue(rawValue, fieldDef.name);
          const confidence = this.calculateConfidence(keyword, rawValue, pattern.source);
          
          return {
            value,
            confidence,
            strategy: this.name,
            justification: `Found key-value pair: "${keyword}" -> "${rawValue}"`
          };
        }
      }
    }
    
    return null;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private looksLikeLabel(value: string): boolean {
    // Skip values that look like labels or headers
    const labelPatterns = [
      /^(yes|no|true|false|n\/a|tbd|pending)$/i,
      /^[A-Z\s]{2,}$/, // All caps (likely headers)
      /^_+$/, // Just underscores
      /^-+$/, // Just dashes
    ];
    
    return labelPatterns.some(pattern => pattern.test(value.trim()));
  }

  private calculateConfidence(keyword: string, value: string, patternSource: string): number {
    let confidence = 0.8; // Base confidence for key-value extraction
    
    // Boost confidence for exact keyword matches
    if (keyword.toLowerCase() === keyword) {
      confidence += 0.1;
    }
    
    // Boost for colon patterns (more structured)
    if (patternSource.includes(':')) {
      confidence += 0.1;
    }
    
    // Boost for reasonable value length
    if (value.length > 5 && value.length < 100) {
      confidence += 0.05;
    }
    
    // Reduce for very long values (might be false matches)
    if (value.length > 200) {
      confidence -= 0.2;
    }
    
    return Math.min(0.95, confidence);
  }

  private parseValue(rawValue: string, fieldName: string): any {
    let cleaned = rawValue
      .replace(/['"]/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Remove common suffixes
    cleaned = cleaned.replace(/[,.]$/, '');
    
    // Parse based on field type
    if (fieldName.includes('Amount') || fieldName.includes('amount')) {
      // Currency parsing
      const currencyMatch = cleaned.match(/\$?[\d,]+(?:\.\d{2})?/);
      if (currencyMatch) {
        return parseFloat(currencyMatch[0].replace(/[$,]/g, ''));
      }
    }
    
    if (fieldName.includes('Date') || fieldName.includes('date')) {
      // Date parsing
      const date = new Date(cleaned);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // Try parsing common date formats
      const datePatterns = [
        /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, // MM/dd/yyyy
        /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month dd, yyyy
      ];
      
      for (const pattern of datePatterns) {
        const match = cleaned.match(pattern);
        if (match) {
          const date = new Date(cleaned);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }
    
    return cleaned;
  }
}