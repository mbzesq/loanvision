export class SimpleAssignmentExtractor {
  
  extractAssignmentParties(text: string): {
    assignor?: string;
    assignee?: string;
    confidence: number;
    method: string;
  } {
    console.log('[SimpleExtractor] Starting simple assignment extraction...');
    console.log('[SimpleExtractor] Text length:', text.length);
    
    // Universal patterns based on real-world assignment documents
    const patterns = [
      // Pattern 1: Explicit (ASSIGNOR) and (ASSIGNEE) labels - highest confidence
      {
        regex: /[^(]*\("?ASSIGNOR"?\)[^,]*,?\s*([^,\n]+?)[\s\S]*?[^(]*\("?ASSIGNEE"?\)[^,]*,?\s*([^,\n]+)/i,
        confidence: 0.98,
        name: 'explicit_labels'
      },
      
      // Pattern 2: "herein (Assignor)" and "herein (Assignee)" pattern
      {
        regex: /([^,\n]+?),?\s+herein\s*\("?Assignor"?\)[\s\S]*?([^,\n]+?),?\s+herein\s*\("?Assignee"?\)/i,
        confidence: 0.95,
        name: 'herein_labels'
      },
      
      // Pattern 3: Assignment verb structure with "unto"
      {
        regex: /([A-Z][^,]+?(?:LLC|L\.L\.C\.|Inc|Corp|Trust|Bank|MERS|ASSOCIATION))[\s\S]{0,50}?(?:does\s+hereby\s+)?(?:grant,?\s+)?(?:sell,?\s+)?(?:assign|transfer|convey)[\s\S]{0,100}?unto\s+([A-Z][^,\n]+?(?:LLC|L\.L\.C\.|Inc|Corp|Trust|Bank|Fund))/i,
        confidence: 0.9,
        name: 'assignment_unto'
      },
      
      // Pattern 4: "FOR VALUE RECEIVED" with assignor identification
      {
        regex: /FOR\s+(?:GOOD\s+AND\s+)?(?:VALUABLE\s+)?(?:VALUE|CONSIDERATION)\s+RECEIVED[^,]*,\s*[^,]*?([A-Z][^,\n]+?(?:LLC|L\.L\.C\.|Inc|Corp|Trust|Bank|MERS|ASSOCIATION))[^,]*?[\s\S]{0,200}?(?:assign|transfer|convey)[\s\S]{0,100}?(?:unto|to)\s+([A-Z][^,\n]+?(?:LLC|L\.L\.C\.|Inc|Corp|Trust|Bank|Fund))/i,
        confidence: 0.85,
        name: 'value_received'
      },
      
      // Pattern 5: Signature block validation (assignor should match signer)
      {
        regex: /([A-Z][^,\n]+?(?:LLC|L\.L\.C\.|Inc|Corp|Trust|Bank|MERS|ASSOCIATION))[\s\S]*?BY:\s*\n.*?Name:\s*([^,\n]+)/i,
        confidence: 0.7,
        name: 'signature_validation',
        isValidation: true
      }
    ];
    
    for (const pattern of patterns) {
      console.log(`[SimpleExtractor] Trying pattern: ${pattern.name}`);
      const match = text.match(pattern.regex);
      
      if (match && match[1] && match[2]) {
        let assignor = this.cleanEntityName(match[1]);
        let assignee = this.cleanEntityName(match[2]);
        
        console.log(`[SimpleExtractor] Raw match - Assignor: "${match[1]}", Assignee: "${match[2]}"`);
        console.log(`[SimpleExtractor] Cleaned - Assignor: "${assignor}", Assignee: "${assignee}"`);
        
        // Validate the results
        if (this.isValidEntity(assignor) && this.isValidEntity(assignee) && assignor !== assignee) {
          console.log(`[SimpleExtractor] SUCCESS with ${pattern.name} pattern`);
          return {
            assignor,
            assignee,
            confidence: pattern.confidence,
            method: pattern.name
          };
        } else {
          console.log(`[SimpleExtractor] Validation failed for ${pattern.name} pattern`);
        }
      } else {
        console.log(`[SimpleExtractor] No match for ${pattern.name} pattern`);
      }
    }
    
    console.log('[SimpleExtractor] No valid assignment parties found');
    return { confidence: 0, method: 'none' };
  }
  
  private cleanEntityName(name: string): string {
    if (!name) return '';
    
    let cleaned = name.trim();
    
    // Remove "located at" and addresses that follow entity names
    cleaned = cleaned.replace(/,?\s*located\s+at\s+.*$/i, '');
    cleaned = cleaned.replace(/,?\s*at\s+\d+.*$/i, '');
    
    // Remove common address patterns that get attached
    cleaned = cleaned.replace(/,?\s*\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Suite|Ste|Blvd|Boulevard).*$/i, '');
    cleaned = cleaned.replace(/,\s*C\/O.*$/i, '');
    cleaned = cleaned.replace(/,\s*P\.?O\.?\s*BOX.*$/i, '');
    
    // Remove legal descriptors that appear after entity names
    cleaned = cleaned.replace(/,?\s*(?:a|an)\s+(?:corporation|company|limited\s+liability\s+company|bank|delaware\s+corporation).*$/i, '');
    cleaned = cleaned.replace(/,?\s*its?\s+(?:successors?|assigns?).*$/i, '');
    cleaned = cleaned.replace(/,?\s*as\s+(?:successor|nominee|attorney\s+in\s+fact).*$/i, '');
    
    // Remove "herein" references
    cleaned = cleaned.replace(/,?\s*herein.*$/i, '');
    
    // Remove trailing "the undersigned"
    cleaned = cleaned.replace(/,?\s*the\s+undersigned.*$/i, '');
    
    // Clean up specific patterns from real documents
    cleaned = cleaned.replace(/BY\s+[A-Z\s]+$/i, ''); // Remove "BY VERIPRO SOLUTIONS" type suffixes
    
    // Normalize whitespace and punctuation
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/^[,\s]+|[,\s]+$/g, ''); // Trim commas and spaces
    
    return cleaned;
  }
  
  private isValidEntity(name: string): boolean {
    if (!name || name.length < 3 || name.length > 100) return false;
    
    // Must contain business entity indicator OR be MERS
    const businessPattern = /LLC|L\.L\.C\.|Inc|Corp|Trust|Bank|Fund|LP|Ltd|MERS/i;
    if (!businessPattern.test(name)) return false;
    
    // Should not contain legal description markers
    const legalDescMarkers = [
      /beginning\s+at/i,
      /corner\s+formed/i,
      /running\s+thence/i,
      /bounded\s+and\s+described/i,
      /feet\s+and\s+\d+\s+inches/i
    ];
    
    if (legalDescMarkers.some(pattern => pattern.test(name))) return false;
    
    return true;
  }
}