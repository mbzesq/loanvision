import { 
  ExtractionStrategy, 
  ExtractedCandidate, 
  ExtractorConfig 
} from '../MarkdownFieldExtractor';

export class ContextStrategy implements ExtractionStrategy {
  name = 'Context';
  priority = 70; // Lower priority, used as fallback

  extract(text: string, config: ExtractorConfig): Map<string, ExtractedCandidate> {
    const results = new Map<string, ExtractedCandidate>();
    
    for (const field of config.fields) {
      const candidate = this.extractContextField(text, field);
      if (candidate) {
        results.set(field.name, candidate);
      }
    }
    
    return results;
  }

  private extractContextField(text: string, fieldDef: any): ExtractedCandidate | null {
    // Use context patterns if configured
    if (fieldDef.contextPatterns && fieldDef.contextPatterns.length > 0) {
      for (const contextPattern of fieldDef.contextPatterns) {
        const candidate = this.extractWithContextPattern(text, fieldDef, contextPattern);
        if (candidate) {
          return candidate;
        }
      }
    }
    
    // Fallback to proximity-based extraction
    return this.extractByProximity(text, fieldDef);
  }

  private extractWithContextPattern(
    text: string, 
    fieldDef: any, 
    contextPattern: string
  ): ExtractedCandidate | null {
    try {
      const pattern = new RegExp(contextPattern, 'i');
      const match = text.match(pattern);
      
      if (match && match[1]) {
        return {
          value: this.parseValue(match[1].trim(), fieldDef.name),
          confidence: 0.75,
          strategy: this.name,
          justification: `Matched context pattern: ${contextPattern}`
        };
      }
    } catch (error) {
      console.warn(`Invalid context pattern for field ${fieldDef.name}: ${contextPattern}`);
    }
    
    return null;
  }

  private extractByProximity(text: string, fieldDef: any): ExtractedCandidate | null {
    // Find text near keywords
    for (const keyword of fieldDef.keywords) {
      const candidate = this.findNearbyValue(text, keyword, fieldDef);
      if (candidate) {
        return candidate;
      }
    }
    
    return null;
  }

  private findNearbyValue(text: string, keyword: string, fieldDef: any): ExtractedCandidate | null {
    const sentences = text.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
        const value = this.extractValueFromSentence(sentence, keyword, fieldDef);
        if (value) {
          return {
            value: this.parseValue(value, fieldDef.name),
            confidence: 0.65, // Lower confidence for proximity-based extraction
            strategy: this.name,
            justification: `Found near keyword "${keyword}" in sentence context`
          };
        }
      }
    }
    
    return null;
  }

  private extractValueFromSentence(sentence: string, keyword: string, fieldDef: any): string | null {
    const fieldName = fieldDef.name.toLowerCase();
    
    // For company names (assignor/assignee)
    if (fieldName.includes('assignor') || fieldName.includes('assignee') || 
        fieldName.includes('lender') || fieldName.includes('borrower')) {
      
      // Look for capitalized company names in the sentence
      const companyPattern = /([A-Z][A-Za-z\s&,.()]{2,50}(?:LLC|Inc|Corp|Company|Co|Trust|LP|Ltd)?)/g;
      const matches = sentence.match(companyPattern);
      
      if (matches && matches.length > 0) {
        // Return the longest match (likely the full company name)
        return matches.reduce((longest, current) => 
          current.length > longest.length ? current : longest
        );
      }
    }
    
    // For addresses
    if (fieldName.includes('address') || fieldName.includes('street')) {
      const addressPattern = /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)[^,.]*)/i;
      const match = sentence.match(addressPattern);
      if (match) {
        return match[1];
      }
    }
    
    // For dates
    if (fieldName.includes('date')) {
      const datePatterns = [
        /(\w+\s+\d{1,2},?\s+\d{4})/,
        /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
        /(\d{1,2}-\d{1,2}-\d{2,4})/
      ];
      
      for (const pattern of datePatterns) {
        const match = sentence.match(pattern);
        if (match) {
          return match[1];
        }
      }
    }
    
    // For amounts
    if (fieldName.includes('amount')) {
      const amountPattern = /\$\s*([\d,]+(?:\.\d{2})?)/;
      const match = sentence.match(amountPattern);
      if (match) {
        return match[1];
      }
    }
    
    // For other fields, look for text after the keyword
    const keywordIndex = sentence.toLowerCase().indexOf(keyword.toLowerCase());
    if (keywordIndex !== -1) {
      const afterKeyword = sentence.substring(keywordIndex + keyword.length);
      
      // Extract first meaningful text after keyword
      const valueMatch = afterKeyword.match(/[:\s]*([A-Za-z0-9\s&,.()$-]{3,50}?)(?:[,.]|$)/);
      if (valueMatch && valueMatch[1] && !this.isGenericText(valueMatch[1])) {
        return valueMatch[1].trim();
      }
    }
    
    return null;
  }

  private isGenericText(text: string): boolean {
    const generic = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might',
      'shall', 'as follows', 'described', 'herein', 'thereof', 'hereunder'
    ];
    
    const words = text.toLowerCase().trim().split(/\s+/);
    
    // If more than half the words are generic, consider it generic
    const genericCount = words.filter(word => generic.includes(word)).length;
    return genericCount > words.length / 2 || words.length < 2;
  }

  private parseValue(rawValue: string, fieldName: string): any {
    const cleaned = rawValue.trim();
    
    // Parse based on field type
    if (fieldName.includes('Amount') || fieldName.includes('amount')) {
      const amount = parseFloat(cleaned.replace(/[$,]/g, ''));
      return isNaN(amount) ? cleaned : amount;
    }
    
    if (fieldName.includes('Date') || fieldName.includes('date')) {
      const date = new Date(cleaned);
      return isNaN(date.getTime()) ? cleaned : date;
    }
    
    // Clean up company names
    if (fieldName.includes('assignor') || fieldName.includes('assignee') || 
        fieldName.includes('lender') || fieldName.includes('borrower')) {
      return this.cleanCompanyName(cleaned);
    }
    
    return cleaned;
  }

  private cleanCompanyName(name: string): string {
    return name
      .replace(/\s*\([^)]+\)\s*/g, ' ') // Remove parenthetical content
      .replace(/[,.]?\s*(LLC|L\.L\.C\.|Inc\.?|Corp\.?|Corporation|Company|Co\.?|Trust|LP|Ltd\.?)?\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}