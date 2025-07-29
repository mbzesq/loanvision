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
          if (match) {
            // Use capture group if available, otherwise full match
            let extractedValue = match[1] || match[0];
            
            const value = this.parseValue(extractedValue.trim(), fieldDef.name);
            
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
      // Strategy: Look for capitalized sequences that look like company names
      // Companies typically have: 
      // - All caps or title case words
      // - Common suffixes like LLC, INC, CORP, BANK, etc.
      // - Multiple capitalized words in sequence
      
      // First, remove obvious legal boilerplate
      cleaned = cleaned
        .replace(/(?:has\s+)?(?:duly\s+)?executed\s+this\s+assignment[^,]*\d{4}/i, '')
        .replace(/\b(?:but\s+)?effective\s+(?:the\s+)?\d+\w*\s+day\s+of\s+\w+\s+\d{4}/i, '')
        .replace(/Serial\s+no\.?[^,]*/i, '')
        .replace(/in\s+the\s+office\s+of[^,]*/i, '')
        .replace(/more\s+particularly\s+described[^,]*/i, '')
        .trim();
      
      // Look for company name patterns
      const companyPatterns = [
        // Match sequences of capitalized words ending in common business suffixes
        /([A-Z][A-Z\s&.,'-]+(?:LLC|L\.L\.C\.|INC|INCORPORATED|CORP|CORPORATION|COMPANY|CO|BANK|NATIONAL\s+ASSOCIATION|N\.A\.|TRUST|LP|LTD|LIMITED|PARTNERS|FINANCIAL|MORTGAGE|SERVICING|HOLDINGS|GROUP|CAPITAL)\b)/i,
        // Match "Company Name, a Delaware corporation" style
        /([A-Z][A-Za-z\s&.,'-]+),\s+a\s+\w+\s+(?:corporation|company|limited|partnership)/i,
        // Match sequences of 2+ capitalized words
        /([A-Z][A-Z\s&.,'-]{3,}[A-Z])/,
        // Fallback: first sequence of capitalized words
        /([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/
      ];
      
      for (const pattern of companyPatterns) {
        const match = cleaned.match(pattern);
        if (match) {
          let companyName = match[1].trim();
          
          // Clean up the extracted company name
          companyName = companyName
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/[,.]\s*$/, '') // Remove trailing punctuation
            .replace(/^[,.]\s*/, '') // Remove leading punctuation
            .trim();
          
          // If we found something reasonable, use it
          if (companyName.length > 2 && companyName.length < 100) {
            return companyName;
          }
        }
      }
      
      // If no pattern matched, try to clean up what we have
      cleaned = cleaned
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[,;].*$/, '') // Remove everything after comma/semicolon
        .trim();
      
      // If still too long or contains junk, truncate intelligently
      if (cleaned.length > 50) {
        // Try to find the first reasonable endpoint
        const endPoints = [',', ';', ' hereby', ' does', ' has', ' serial', ' dated', ' effective'];
        let shortestClean = cleaned;
        
        for (const endPoint of endPoints) {
          const index = cleaned.toLowerCase().indexOf(endPoint);
          if (index > 0 && index < shortestClean.length) {
            shortestClean = cleaned.substring(0, index).trim();
          }
        }
        
        cleaned = shortestClean;
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