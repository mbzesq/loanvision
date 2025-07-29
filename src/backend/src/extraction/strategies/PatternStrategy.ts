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
            
            // Debug logging for assignor/assignee
            if (fieldDef.name === 'assignor' || fieldDef.name === 'assignee') {
              console.log(`[PatternStrategy] Field: ${fieldDef.name}`);
              console.log(`[PatternStrategy] Pattern: ${patternStr}`);
              console.log(`[PatternStrategy] Raw match: "${extractedValue}"`);
            }
            
            const value = this.parseValue(extractedValue.trim(), fieldDef.name);
            
            if (fieldDef.name === 'assignor' || fieldDef.name === 'assignee') {
              console.log(`[PatternStrategy] Cleaned value: "${value}"`);
            }
            
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
      cleaned = this.cleanAssignmentText(cleaned, fieldName);
    }
    
    return cleaned;
  }

  private cleanAssignmentText(text: string, fieldName: string): string {
    let cleaned = text.trim();
    
    console.log(`[CleanAssignment] Before cleaning (${fieldName}): "${cleaned}"`);
    
    // Step 1: Remove verbose legal boilerplate patterns
    const boilerplatePatterns = [
      // Remove "has duly executed this assignment..." clauses
      /(?:has\s+)?(?:duly\s+)?executed\s+this\s+assignment[^,]*?(?:\d{1,2}(?:st|nd|rd|th)?\s+day\s+of\s+\w+\s+\d{4})/gi,
      
      // Remove "but effective..." date clauses
      /\b(?:but\s+)?effective\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\s+day\s+of\s+\w+\s+\d{4}/gi,
      
      // Remove property data and location info
      /(?:PROPERTY\s+DATA|Borough\s+Block\s+Lot|Unit\s+Address|BROOKL|BRONX|QUEEN|MANHATTAN|STATEN)[^,]*/gi,
      
      // Remove serial numbers and document references
      /Serial\s+(?:no\.?|number)[^,]*/gi,
      /Document\s+(?:no\.?|number)[^,]*/gi,
      
      // Remove office/recording references
      /in\s+the\s+office\s+of[^,]*/gi,
      /recorded?\s+in[^,]*/gi,
      
      // Remove description clauses
      /more\s+particularly\s+described[^,]*/gi,
      /as\s+more\s+fully\s+described[^,]*/gi,
      
      // Remove common assignment phrases that aren't company names
      /this\s+assignment\s+of[^,]*/gi,
      /all\s+right[^,]*/gi
    ];
    
    boilerplatePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });
    
    // Step 2: Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    console.log(`[CleanAssignment] After boilerplate removal: "${cleaned}"`);
    
    // Step 3: Extract company name using hierarchical patterns
    const companyExtractionPatterns = [
      // Pattern 1: Business entity with suffix (highest priority)
      /([A-Z][A-Z\s&.,'-]*?(?:LLC|L\.L\.C\.|INC|INCORPORATED|CORP|CORPORATION|COMPANY|CO|BANK|NATIONAL\s+ASSOCIATION|N\.A\.|TRUST|LP|LTD|LIMITED|PARTNERS|FINANCIAL|MORTGAGE|SERVICING|HOLDINGS|GROUP|CAPITAL|CREDIT|UNION)\b)/i,
      
      // Pattern 2: "Company Name, a [state] corporation" format
      /([A-Z][A-Za-z\s&.,'-]{2,50}?),\s+a\s+\w+\s+(?:corporation|company|limited|partnership|bank)/i,
      
      // Pattern 3: All caps sequence (common in legal docs)
      /([A-Z]{2,}(?:\s+[A-Z]{2,}){0,4})/,
      
      // Pattern 4: Title case company name (2-6 words)
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,5})/,
      
      // Pattern 5: Mixed case with &, Inc, etc.
      /([A-Z][A-Za-z\s&.,'-]{5,40})/
    ];
    
    for (const pattern of companyExtractionPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let companyName = match[1].trim();
        
        // Clean up the extracted company name
        companyName = this.enhancedCleanCompanyName(companyName);
        
        // Validate it's actually a company name
        if (this.isValidCompanyName(companyName)) {
          console.log(`[CleanAssignment] Extracted company (${fieldName}): "${companyName}"`);
          return companyName;
        }
      }
    }
    
    // Step 4: Fallback - try to find any reasonable text
    const fallbackPattern = /([A-Z][A-Za-z\s]{3,30})/;
    const fallbackMatch = cleaned.match(fallbackPattern);
    if (fallbackMatch) {
      const fallback = this.enhancedCleanCompanyName(fallbackMatch[1].trim());
      console.log(`[CleanAssignment] Fallback extraction (${fieldName}): "${fallback}"`);
      return fallback;
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

  private enhancedCleanCompanyName(name: string): string {
    let cleaned = name.trim();
    
    // Remove leading/trailing punctuation
    cleaned = cleaned.replace(/^[,.\s]+|[,.\s]+$/g, '');
    
    // Remove common legal phrases that got captured
    const unwantedPhrases = [
      /^(?:and|to|from|between|as|the|a|an)\s+/gi,
      /\s+(?:as|being|located|situated|in|at|on)$/gi,
      /\s+hereby\s.*$/gi,
      /\s+does\s.*$/gi
    ];
    
    unwantedPhrases.forEach(phrase => {
      cleaned = cleaned.replace(phrase, '');
    });
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Preserve business suffixes but ensure proper capitalization
    cleaned = cleaned.replace(/\s+(NATIONAL|ASSOCIATION|NA|CORP|INC|LLC|LTD|LIMITED|COMPANY|CO|BANK|TRUST|LP)$/i, 
      (match) => match.toUpperCase());
    
    return cleaned;
  }

  private isValidCompanyName(name: string): boolean {
    // Too short
    if (name.length < 3) return false;
    
    // Too long (likely captured too much)
    if (name.length > 80) return false;
    
    // Contains obvious non-company words
    const invalidKeywords = [
      'hereby', 'executed', 'assignment', 'effective', 'property', 'data',
      'borough', 'block', 'described', 'recorded', 'office', 'day', 'march',
      'february', 'january', 'april', 'may', 'june', 'july', 'august',
      'september', 'october', 'november', 'december'
    ];
    
    const lowerName = name.toLowerCase();
    if (invalidKeywords.some(keyword => lowerName.includes(keyword))) {
      return false;
    }
    
    // Should contain at least one letter
    if (!/[a-zA-Z]/.test(name)) return false;
    
    // Positive indicators (business suffixes)
    const businessSuffixes = [
      'LLC', 'INC', 'CORP', 'CORPORATION', 'COMPANY', 'CO', 'BANK', 
      'TRUST', 'LP', 'LTD', 'LIMITED', 'NATIONAL', 'ASSOCIATION',
      'FINANCIAL', 'MORTGAGE', 'SERVICING', 'HOLDINGS', 'GROUP',
      'CAPITAL', 'CREDIT', 'UNION'
    ];
    
    const upperName = name.toUpperCase();
    const hasBusinessSuffix = businessSuffixes.some(suffix => 
      upperName.includes(suffix)
    );
    
    // If it has business suffix, it's likely valid
    if (hasBusinessSuffix) return true;
    
    // Otherwise, check if it looks like a proper company name
    // (starts with capital, reasonable length, not all caps unless short)
    if (!/^[A-Z]/.test(name)) return false;
    
    // If all caps and long, probably not a clean company name
    if (name === name.toUpperCase() && name.length > 20) return false;
    
    return true;
  }
}