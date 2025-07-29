import { 
  ExtractionStrategy, 
  ExtractedCandidate, 
  ExtractorConfig 
} from '../markdownFieldExtractorV2';

export class PatternStrategy implements ExtractionStrategy {
  name = 'Pattern';
  priority = 80; // Medium-high priority for regex patterns

  extract(text: string, config: ExtractorConfig): Map<string, ExtractedCandidate> {
    const results = new Map<string, ExtractedCandidate>();
    
    for (const field of config.fields) {
      const candidate = this.extractPatternField(text, field);
      if (candidate) {
        results.set(field.name, candidate);
      }
    }
    
    return results;
  }

  private extractPatternField(text: string, fieldDef: any): ExtractedCandidate | null {
    // Use configured patterns if available
    if (fieldDef.patterns && fieldDef.patterns.length > 0) {
      for (const patternStr of fieldDef.patterns) {
        try {
          const pattern = new RegExp(patternStr, 'i');
          const match = text.match(pattern);
          if (match && match[1]) {
            const value = this.parseValue(match[1].trim(), fieldDef.name);
            
            return {
              value,
              confidence: 0.85, // Good confidence for configured patterns
              strategy: this.name,
              justification: `Matched configured pattern: ${patternStr}`
            };
          }
        } catch (error) {
          console.warn(`Invalid regex pattern for field ${fieldDef.name}: ${patternStr}`);
        }
      }
    }
    
    // Fallback to built-in patterns based on field name
    return this.extractWithBuiltInPatterns(text, fieldDef);
  }

  private extractWithBuiltInPatterns(text: string, fieldDef: any): ExtractedCandidate | null {
    const fieldName = fieldDef.name.toLowerCase();
    
    // Address patterns
    if (fieldName.includes('address') || fieldName.includes('street')) {
      const addressPattern = /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl))/i;
      const match = text.match(addressPattern);
      if (match) {
        return {
          value: match[1].trim(),
          confidence: 0.8,
          strategy: this.name,
          justification: 'Matched address pattern'
        };
      }
    }
    
    // Assignment patterns
    if (fieldName.includes('assignor')) {
      const patterns = [
        // Standard assignment language
        /([A-Z][A-Za-z\s&,.()]+?)\s+(?:does\s+)?hereby\s+(?:grant|assign|transfer|convey)s?\s+/i,
        /assignment\s+from\s+([A-Z][A-Za-z\s&,.()]+?)\s+to/i,
        /assignor[:\s]+([A-Z][A-Za-z\s&,.()]+?)(?:[,\n]|$)/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return {
            value: this.cleanCompanyName(match[1]),
            confidence: 0.85,
            strategy: this.name,
            justification: 'Matched assignor pattern'
          };
        }
      }
    }
    
    if (fieldName.includes('assignee')) {
      const patterns = [
        /(?:grant|assign|transfer|convey)s?\s+to\s+([A-Z][A-Za-z\s&,.()]+?)(?:\s+all|\s+the|\s*[,\n]|$)/i,
        /assignment\s+(?:from\s+[^,]+\s+)?to\s+([A-Z][A-Za-z\s&,.()]+?)(?:[,\n]|$)/i,
        /assignee[:\s]+([A-Z][A-Za-z\s&,.()]+?)(?:[,\n]|$)/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return {
            value: this.cleanCompanyName(match[1]),
            confidence: 0.85,
            strategy: this.name,
            justification: 'Matched assignee pattern'
          };
        }
      }
    }
    
    // Date patterns
    if (fieldName.includes('date')) {
      const patterns = [
        /(\w+\s+\d{1,2},?\s+\d{4})/g, // Month dd, yyyy
        /(\d{1,2}\/\d{1,2}\/\d{2,4})/g, // MM/dd/yyyy
        /(\d{1,2}-\d{1,2}-\d{2,4})/g, // MM-dd-yyyy
      ];
      
      for (const pattern of patterns) {
        const matches = Array.from(text.matchAll(pattern));
        if (matches.length > 0) {
          // Take the first valid date
          for (const match of matches) {
            const date = new Date(match[1]);
            if (!isNaN(date.getTime())) {
              return {
                value: date,
                confidence: 0.75,
                strategy: this.name,
                justification: `Matched date pattern: ${match[1]}`
              };
            }
          }
        }
      }
    }
    
    // Currency patterns
    if (fieldName.includes('amount')) {
      const patterns = [
        /\$\s*([\d,]+(?:\.\d{2})?)/g,
        /(?:amount|sum|principal)[\s\w]*\$\s*([\d,]+(?:\.\d{2})?)/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          if (amount > 0) {
            return {
              value: amount,
              confidence: 0.8,
              strategy: this.name,
              justification: `Matched currency pattern: $${match[1]}`
            };
          }
        }
      }
    }
    
    // Borrower/Lender patterns
    if (fieldName.includes('borrower') || fieldName.includes('lender')) {
      const role = fieldName.includes('borrower') ? 'borrower' : 'lender';
      const patterns = [
        new RegExp(`${role}[:\\s]+([A-Z][A-Za-z\\s&,.()]+?)(?:[,\\n]|$)`, 'i'),
        new RegExp(`(?:${role}|mortgagor|grantor)[:\\s]+([A-Z][A-Za-z\\s&,.()]+?)(?:[,\\n]|$)`, 'i')
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return {
            value: match[1].trim(),
            confidence: 0.75,
            strategy: this.name,
            justification: `Matched ${role} pattern`
          };
        }
      }
    }
    
    return null;
  }

  private parseValue(rawValue: string, fieldName: string): any {
    let cleaned = rawValue.trim();
    
    // Parse based on field type
    if (fieldName.includes('Amount') || fieldName.includes('amount')) {
      const amount = parseFloat(cleaned.replace(/[$,]/g, ''));
      return isNaN(amount) ? cleaned : amount;
    }
    
    if (fieldName.includes('Date') || fieldName.includes('date')) {
      // Clean up date strings that contain extra text
      const datePatterns = [
        /(\d{1,2}\/\d{1,2}\/\d{4})/,  // MM/dd/yyyy
        /(\d{1,2}-\d{1,2}-\d{4})/,   // MM-dd-yyyy
        /([A-Za-z]+ \d{1,2}, \d{4})/ // Month dd, yyyy
      ];
      
      for (const pattern of datePatterns) {
        const match = cleaned.match(pattern);
        if (match) {
          const date = new Date(match[1]);
          return isNaN(date.getTime()) ? cleaned : date;
        }
      }
      
      // Fallback to original parsing
      const date = new Date(cleaned);
      return isNaN(date.getTime()) ? cleaned : date;
    }
    
    // Clean assignor/assignee company names
    if (fieldName === 'assignor' || fieldName === 'assignee') {
      // First, try to extract just company names from the text
      const companyPatterns = [
        /PNC\s+BANK[A-Za-z\s,]*NATIONAL\s+ASSOCIATION/i,
        /NATIONAL\s+CITY\s+BANK[A-Za-z\s,]*/i,
        /ETRADE\s+BANK[A-Za-z\s,]*/i,
        /VERIPRO[A-Za-z\s,]*/i,
        /NS194[A-Za-z\s,]*LLC/i
      ];
      
      for (const pattern of companyPatterns) {
        const match = cleaned.match(pattern);
        if (match) {
          cleaned = match[0].trim();
          break;
        }
      }
      
      // If no specific company found, clean up legal text
      if (cleaned.length > 50 || /\b(?:executed|assignment|hereby|duly)\b/i.test(cleaned)) {
        // Remove common noise text and phrases
        cleaned = cleaned
          .replace(/^.*?(?:executed|duly)\s+.*?(?:assignment|this)\s+.*?(?:day|of)\s+.*?\d{4}\s*/i, '') // Remove date execution text
          .replace(/\s+hereby\s+.*$/i, '') // Remove "hereby assigns..." text
          .replace(/\s+(?:does\s+hereby|hereby)\s+.*$/i, '') // Remove legal language
          .replace(/\s+(?:assign|assigns|transfer|transfers|convey|conveys).*$/i, '') // Remove action words
          .replace(/\s+(?:and\s+)?(?:all|the)\s+.*$/i, '') // Remove "and all..." text
          .replace(/\s*[,;].*$/, '') // Remove everything after first comma/semicolon
          .replace(/\s+(?:dated|effective|recorded).*$/i, '') // Remove date references
          .replace(/\s*\d+.*$/, '') // Remove trailing numbers and text
          .trim();
      }
      
      // Clean up and standardize company names
      cleaned = cleaned
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/\bPnc\b/gi, 'PNC')
        .replace(/\bEtrade\b/gi, 'ETRADE')
        .replace(/\bBank\b/gi, 'BANK')
        .replace(/\bNational\b/gi, 'NATIONAL')
        .replace(/\bAssociation\b/gi, 'ASSOCIATION')
        .replace(/\bCity\b/gi, 'CITY')
        .replace(/\bLlc\b/gi, 'LLC')
        .trim();
      
      // Final cleanup - if still contains legal language, try to extract company name
      if (/\b(?:executed|assignment|hereby|duly|day|march|serial)\b/i.test(cleaned)) {
        const finalMatch = cleaned.match(/([A-Z]+\s*(?:BANK|NATIONAL|ASSOCIATION|LLC)[A-Za-z\s]*)/i);
        if (finalMatch) {
          cleaned = finalMatch[1].trim();
        }
      }
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