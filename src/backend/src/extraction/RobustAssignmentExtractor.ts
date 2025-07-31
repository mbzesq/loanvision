interface AssignmentPattern {
  jurisdictions?: string[];  // null = all jurisdictions
  dateRange?: { start: string; end: string };     // when this pattern was common
  pattern: RegExp;
  confidence: number;
  description: string;
}

interface JurisdictionConfig {
  state: string;
  coverPageMarkers: string[];
  recordingInfoLocation: 'top' | 'bottom' | 'coverpage';
  partyTableFormat: 'structured' | 'narrative';
}

export class RobustAssignmentExtractor {
  private patterns: AssignmentPattern[] = [
    // NYC structured cover page format
    {
      jurisdictions: ['NY', 'NJ'],
      pattern: /ASSIGNOR(?:\/OLD LENDER)?:\s*([^\n]+?)[\s\S]*?ASSIGNEE(?:\/NEW LENDER)?:\s*([^\n]+)/i,
      confidence: 0.95,
      description: 'NYC cover page format'
    },
    // MERS assignments
    {
      dateRange: { start: '2005', end: '2025' },
      pattern: /MORTGAGE\s+ELECTRONIC\s+REGISTRATION\s+SYSTEMS[^,]*,?\s*INC\.?[^,.]*(?:,?\s*as\s+(?:nominee|mortgagee)\s+for\s+([^,]+?))?[^,.]*,?\s*(?:by\s+these\s+presents\s+)?does?\s+(?:hereby\s+)?(?:convey|assign|transfer|grant)[^:]*to\s*:?\s*([^,\n]+)/i,
      confidence: 0.9,
      description: 'MERS standard assignment'
    },
    // Standard assignment language
    {
      pattern: /for\s+(?:good\s+and\s+)?valuable\s+consideration[^,.]*,\s*([^,\n]+?)\s+(?:does\s+)?(?:hereby\s+)?(?:convey|assign|transfer|grant)s?[^:]*to\s*:?\s*([^,\n]+)/i,
      confidence: 0.85,
      description: 'Standard consideration assignment'
    },
    // Simple assignment format
    {
      pattern: /([A-Z][A-Za-z\s&]{10,80}?(?:LLC|Inc|Corp|Trust|Bank|MERS))\s+(?:does\s+)?(?:hereby\s+)?(?:assign|transfer|convey)s?\s+to\s+([A-Z][A-Za-z\s&]{5,80}?(?:LLC|Inc|Corp|Trust|Bank|Fund))/i,
      confidence: 0.8,
      description: 'Simple entity-to-entity assignment'
    }
  ];

  private jurisdictionConfigs: Map<string, JurisdictionConfig> = new Map([
    ['NY', {
      state: 'NY',
      coverPageMarkers: ['RECORDING AND ENDORSEMENT COVER PAGE', 'CRFN:', 'CROSS REFERENCE DATA'],
      recordingInfoLocation: 'coverpage',
      partyTableFormat: 'structured'
    }],
    ['TX', {
      state: 'TX',
      coverPageMarkers: ['CLERK\'S FILE STAMP'],
      recordingInfoLocation: 'top',
      partyTableFormat: 'narrative'
    }]
  ]);

  private legalDescMarkers = [
    /beginning\s+at\s+a\s+point/i,
    /thence\s+(north|south|east|west|running)/i,
    /feet\s+and\s+\d+\s+inches/i,
    /corner\s+(of|formed\s+by)/i,
    /intersection\s+of/i,
    /parallel\s+with/i,
    /bounded\s+and\s+described/i,
    /westerly\s+side/i,
    /northerly\s+side/i,
    /running\s+thence/i,
    /point\s+or\s+place\s+of\s+beginning/i
  ];

  extractAssignmentParties(text: string): {
    assignor?: string;
    assignee?: string;
    confidence: number;
    method: string;
  } {
    console.log('[RobustExtractor] Input text length:', text.length);
    console.log('[RobustExtractor] First 500 chars:', text.substring(0, 500));
    console.log('[RobustExtractor] Contains CROSS REFERENCE DATA:', text.includes('CROSS REFERENCE DATA'));
    console.log('[RobustExtractor] Contains MERS:', text.includes('MORTGAGE ELECTRONIC REGISTRATION'));
    console.log('[RobustExtractor] Contains STAR201:', text.includes('STAR201'));
    
    // Step 1: Detect jurisdiction if possible
    const jurisdiction = this.detectJurisdiction(text);
    console.log('[RobustExtractor] Detected jurisdiction:', jurisdiction);
    
    // Step 2: Try structured extraction first (highest confidence)
    if (jurisdiction) {
      const config = this.jurisdictionConfigs.get(jurisdiction);
      if (config) {
        const structuredResult = this.extractFromStructuredFormat(text, config);
        if (structuredResult.assignor && structuredResult.assignee) {
          return {
            ...structuredResult,
            confidence: 0.95,
            method: 'structured'
          };
        }
      }
    }
    
    // Step 3: Try pattern-based extraction
    const patternResult = this.extractWithPatterns(text, jurisdiction);
    if (patternResult.assignor && patternResult.assignee) {
      return patternResult;
    }
    
    // Step 4: Try proximity-based extraction as fallback
    const proximityResult = this.extractWithProximity(text);
    if (proximityResult.assignor && proximityResult.assignee) {
      return {
        ...proximityResult,
        confidence: 0.7,
        method: 'proximity'
      };
    }
    
    return { confidence: 0, method: 'none' };
  }

  private detectJurisdiction(text: string): string | null {
    for (const [state, config] of this.jurisdictionConfigs) {
      if (config.coverPageMarkers.some(marker => text.includes(marker))) {
        return state;
      }
    }
    return null;
  }

  private extractFromStructuredFormat(text: string, config: JurisdictionConfig): {
    assignor?: string;
    assignee?: string;
  } {
    if (config.state === 'NY') {
      return this.extractFromNYCFormat(text);
    }
    return {};
  }

  private extractFromNYCFormat(text: string): {
    assignor?: string;
    assignee?: string;
  } {
    console.log('[NYCFormat] Looking for CROSS REFERENCE DATA section...');
    console.log('[NYCFormat] Text contains pipes (markdown table):', text.includes('|'));
    
    // First try to find the markdown table with ASSIGNOR/ASSIGNEE headers
    const tableMatch = text.match(/ASSIGNOR\/OLD LENDER.*?\|.*?PARTIES.*?\n\|[\s\S]*?(?=\n\n|$)/i);
    if (tableMatch) {
      console.log('[NYCFormat] Found markdown table with ASSIGNOR/ASSIGNEE headers');
      const tableText = tableMatch[0];
      const rows = tableText.split('\n').filter(row => row.includes('|'));
      
      let assignor: string | undefined;
      let assignee: string | undefined;
      
      // Process each row of the table
      for (const row of rows) {
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
        
        // Look for MERS in any cell
        if (!assignor && cells.some(cell => cell.includes('MORTGAGE ELECTRONIC REGISTRATION'))) {
          assignor = 'MORTGAGE ELECTRONIC REGISTRATION SYSTEMS, INC.';
          console.log('[NYCFormat] Found MERS in table');
        }
        
        // Look for LLC entities (like STAR201, LLC)
        if (!assignee) {
          for (const cell of cells) {
            if (cell.includes('LLC') && !cell.includes('MORTGAGE')) {
              // Extract just the company name
              const llcMatch = cell.match(/([A-Z][A-Za-z0-9\s,]+LLC)/i);
              if (llcMatch) {
                assignee = llcMatch[1].trim();
                console.log('[NYCFormat] Found assignee in table:', assignee);
                break;
              }
            }
          }
        }
      }
      
      if (assignor && assignee) {
        console.log('[NYCFormat] Successfully extracted from markdown table');
        return { assignor, assignee };
      }
    }
    
    // Fallback to the previous method for non-table formats
    console.log('[NYCFormat] No markdown table found, trying text-based extraction...');
    
    const crossRefMatch = text.match(/CROSS\s+REFERENCE\s+DATA([\s\S]*?)(?=\n\s*#|$)/i);
    if (!crossRefMatch) {
      console.log('[NYCFormat] CROSS REFERENCE DATA section not found');
      return {};
    }
    
    const crossRefSection = crossRefMatch[1];
    const lines = crossRefSection.split('\n').map(l => l.trim()).filter(l => l);
    
    let assignor: string | undefined;
    let assignee: string | undefined;
    
    for (const line of lines) {
      if (!assignor && line.includes('MORTGAGE ELECTRONIC REGISTRATION')) {
        assignor = 'MORTGAGE ELECTRONIC REGISTRATION SYSTEMS, INC.';
      }
      
      if (!assignee && line.includes('LLC') && !line.includes('MORTGAGE')) {
        const patterns = [
          /([A-Z][A-Za-z0-9\s,]+LLC)/i,
          /(STAR\d+[^,\n]*LLC)/i
        ];
        
        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match) {
            assignee = match[1].trim();
            break;
          }
        }
      }
    }
    
    console.log('[NYCFormat] Final results:', { assignor, assignee });
    return { assignor, assignee };
  }

  private extractWithPatterns(text: string, jurisdiction?: string | null): {
    assignor?: string;
    assignee?: string;
    confidence: number;
    method: string;
  } {
    const relevantPatterns = this.patterns.filter(p => 
      !p.jurisdictions || !jurisdiction || p.jurisdictions.includes(jurisdiction)
    );
    
    for (const pattern of relevantPatterns) {
      const match = text.match(pattern.pattern);
      if (match && match[1] && match[2]) {
        const assignor = this.cleanAndValidate(match[1]);
        const assignee = this.cleanAndValidate(match[2]);
        
        if (assignor && assignee && this.validateAssignmentParties(assignor, assignee)) {
          return {
            assignor,
            assignee,
            confidence: pattern.confidence,
            method: `pattern: ${pattern.description}`
          };
        }
      }
    }
    
    return { confidence: 0, method: 'pattern failed' };
  }

  private extractWithProximity(text: string): {
    assignor?: string;
    assignee?: string;
  } {
    // Find assignment verbs and look nearby
    const assignmentVerbs = /\b(assign|transfer|convey|grant)s?\b/gi;
    const matches = Array.from(text.matchAll(assignmentVerbs));
    
    for (const match of matches) {
      const start = Math.max(0, match.index! - 200);
      const end = Math.min(text.length, match.index! + 200);
      const context = text.slice(start, end);
      
      // Look for business entities before and after the verb
      const beforeMatch = context.slice(0, match.index! - start).match(/([A-Z][A-Za-z\s&]{10,80}?(?:LLC|Inc|Corp|Trust|Bank|MERS))\s*$/i);
      const afterMatch = context.slice(match.index! - start).match(/\b(?:assign|transfer|convey|grant)s?\s+to\s+([A-Z][A-Za-z\s&]{5,80}?(?:LLC|Inc|Corp|Trust|Bank|Fund))/i);
      
      if (beforeMatch && afterMatch) {
        const assignor = this.cleanAndValidate(beforeMatch[1]);
        const assignee = this.cleanAndValidate(afterMatch[1]);
        
        if (assignor && assignee && this.validateAssignmentParties(assignor, assignee)) {
          return { assignor, assignee };
        }
      }
    }
    
    return {};
  }

  private cleanAndValidate(name: string): string {
    if (!name) return '';
    
    // Remove common artifacts
    let cleaned = name
      .replace(/^\s*[,.-]+|[,.-]+\s*$/g, '') // Remove leading/trailing punctuation
      .replace(/\s+/g, ' ')
      .trim();
    
    // Validate length
    if (cleaned.length < 3 || cleaned.length > 100) return '';
    
    return cleaned;
  }

  private validateAssignmentParties(assignor: string, assignee: string): boolean {
    // Must not be legal description
    if (this.containsLegalDescMarkers(assignor) || this.containsLegalDescMarkers(assignee)) {
      console.log('[RobustExtractor] Rejected: contains legal description markers');
      return false;
    }
    
    // Should contain business indicators OR be reasonable entity format
    const businessPattern = /LLC|L\.L\.C\.|Inc|Corp|Bank|Trust|MERS|Fund/i;
    const reasonablePattern = /^[A-Z][A-Za-z\s&,.\-0-9]+$/;
    
    const assignorValid = businessPattern.test(assignor) || reasonablePattern.test(assignor);
    const assigneeValid = businessPattern.test(assignee) || reasonablePattern.test(assignee);
    
    if (!assignorValid || !assigneeValid) {
      return false;
    }
    
    return true;
  }

  private containsLegalDescMarkers(text: string): boolean {
    return this.legalDescMarkers.some(pattern => pattern.test(text));
  }
}