import { ExtractedFields } from './markdownFieldExtractor';

interface AssignmentSection {
  type: 'coverPage' | 'legalDescription' | 'assignmentClause' | 'other';
  content: string;
  startIndex: number;
  endIndex: number;
}

interface ExtractedPartyInfo {
  name: string;
  confidence: number;
  source: 'table' | 'structured' | 'pattern' | 'fallback';
}

export class ImprovedAssignmentExtractor {
  // Legal description indicators that should exclude text from party extraction
  private readonly LEGAL_DESC_INDICATORS = [
    /beginning\s+at\s+a\s+point/i,
    /thence\s+(north|south|east|west|running)/i,
    /feet\s+and\s+\d+\s+inches/i,
    /corner\s+(of|formed\s+by)/i,
    /intersection\s+of/i,
    /parallel\s+with/i,
    /bounded\s+and\s+described/i,
    /block\s*:?\s*\d+\s+lot\s*:?\s*\d+/i,
    /tax\s+map/i,
    /parcel\s+(number|id)/i
  ];

  // Business entity indicators
  private readonly ENTITY_INDICATORS = [
    /LLC|L\.L\.C\./i,
    /Inc\.?|Incorporated/i,
    /Corp\.?|Corporation/i,
    /Company|Co\./i,
    /Bank|F\.?S\.?B\./i,
    /Trust|Trustee/i,
    /LP|L\.P\.|Limited Partnership/i,
    /MERS|Mortgage Electronic/i,
    /Fund/i,
    /Holdings/i,
    /Capital/i,
    /Ventures/i,
    /Associates/i,
    /Group/i,
    /PLLC|P\.L\.L\.C\./i
  ];

  // Assignment verb patterns
  private readonly ASSIGNMENT_VERBS = [
    'assigns?',
    'transfers?',
    'conveys?',
    'grants?',
    'sells?',
    'delivers?',
    'sets? over',
    'endorses?'
  ];

  /**
   * Main extraction method that coordinates the extraction process
   */
  async extractAssignmentFields(
    markdown: string,
    tables: any[],
    sections: any[]
  ): Promise<Partial<ExtractedFields>> {
    const fields: Partial<ExtractedFields> = {
      fieldConfidence: new Map<string, number>()
    };

    // Step 1: Identify document sections
    const documentSections = this.identifyDocumentSections(markdown);

    // Step 2: Try structured extraction from tables/cover page
    const structuredResults = this.extractFromStructuredData(tables, documentSections);
    if (structuredResults.assignor) {
      fields.assignor = structuredResults.assignor;
      fields.fieldConfidence?.set('assignor', structuredResults.fieldConfidence?.get('assignor') || 0.9);
    }
    if (structuredResults.assignee) {
      fields.assignee = structuredResults.assignee;
      fields.fieldConfidence?.set('assignee', structuredResults.fieldConfidence?.get('assignee') || 0.9);
    }

    // Step 3: Try extraction from assignment clause
    const assignmentClause = documentSections.find(s => s.type === 'assignmentClause');
    if (assignmentClause) {
      const clauseResults = this.extractFromAssignmentClause(assignmentClause.content);
      if (clauseResults.assignor || clauseResults.assignee) {
        // Merge with any partial results from structured extraction
        if (!fields.assignor && clauseResults.assignor) {
          fields.assignor = clauseResults.assignor.name;
          fields.fieldConfidence?.set('assignor', clauseResults.assignor.confidence);
        }
        if (!fields.assignee && clauseResults.assignee) {
          fields.assignee = clauseResults.assignee.name;
          fields.fieldConfidence?.set('assignee', clauseResults.assignee.confidence);
        }
      }
    }

    // Step 4: Extract recording information
    const recordingInfo = this.extractRecordingInfo(markdown, documentSections);
    Object.assign(fields, recordingInfo);

    // Step 5: Validate results
    this.validateExtractedFields(fields);

    return fields;
  }

  /**
   * Identify different sections of the document
   */
  private identifyDocumentSections(markdown: string): AssignmentSection[] {
    const sections: AssignmentSection[] = [];
    const lines = markdown.split('\n');
    let currentSection: AssignmentSection | null = null;
    let currentContent: string[] = [];
    let startIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();

      // Check for section markers
      if (upperLine.includes('RECORDING AND ENDORSEMENT COVER PAGE') ||
          upperLine.includes('COVER PAGE') ||
          upperLine.includes('PARTIES')) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n');
          currentSection.endIndex = i - 1;
          sections.push(currentSection);
        }
        currentSection = {
          type: 'coverPage',
          content: '',
          startIndex: i,
          endIndex: -1
        };
        currentContent = [line];
      } else if (upperLine.includes('LEGAL DESCRIPTION') ||
                 upperLine.includes('EXHIBIT A') ||
                 line.match(/^ALL\s+that\s+certain/i)) {
        if (currentSection) {
          currentSection.content = currentContent.join('\n');
          currentSection.endIndex = i - 1;
          sections.push(currentSection);
        }
        currentSection = {
          type: 'legalDescription',
          content: '',
          startIndex: i,
          endIndex: -1
        };
        currentContent = [line];
      } else if (upperLine.includes('ASSIGNMENT OF MORTGAGE') ||
                 upperLine.includes('ASSIGNMENT OF DEED')) {
        if (currentSection) {
          currentSection.content = currentContent.join('\n');
          currentSection.endIndex = i - 1;
          sections.push(currentSection);
        }
        currentSection = {
          type: 'assignmentClause',
          content: '',
          startIndex: i,
          endIndex: -1
        };
        currentContent = [line];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n');
      currentSection.endIndex = lines.length - 1;
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Extract from structured data (tables, cover page)
   */
  private extractFromStructuredData(
    tables: any[],
    sections: AssignmentSection[]
  ): Partial<ExtractedFields> {
    const fields: Partial<ExtractedFields> = {
      fieldConfidence: new Map<string, number>()
    };

    
    // Check tables first
    for (const table of tables) {
      // Look for PARTIES table or similar
      const headers = table.headers.map((h: string) => h.toLowerCase());
      
      // Special handling for NYC cover page format where data is in a two-column layout
      if (headers.some(h => h.includes('assignor') && h.includes('old lender')) && 
          headers.some(h => h.includes('parties'))) {
        
        // In this format:
        // Column 1: ASSIGNOR/OLD LENDER data
        // Column 2: ASSIGNEE/NEW LENDER data (under "PARTIES" header)
        
        // Look for the row that contains the actual party names (not addresses)
        for (const row of table.rows) {
          const col1 = row[0] || '';
          const col2 = row[1] || '';
          
          // Check if column 1 looks like a company name (not an address) and we haven't found assignor yet
          if (!fields.assignor && col1 && 
              !col1.match(/^\d+\s+[A-Z]/i) && // Not starting with street number
              !col1.match(/^[A-Z]{2}\s+\d{5}/i) && // Not a state/zip
              !col1.match(/^\d{5}/i) && // Not a zip code
              !col1.match(/street|avenue|drive|lane|blvd/i) && // Not a street
              col1.match(/[A-Z]/i) && // Has letters
              col1.length > 10) { // Reasonable length for company name
            const cleaned = this.cleanAndValidatePartyName(col1);
            if (cleaned && !this.isLegalDescription(cleaned) && cleaned.length > 5) {
              fields.assignor = cleaned;
              fields.fieldConfidence?.set('assignor', 0.95);
            }
          }
          
          // Check if column 2 looks like a company name and we haven't found assignee yet
          if (!fields.assignee && col2 && 
              !col2.match(/^ASSIGNEE\/NEW LENDER/i) && // Not the header text
              !col2.match(/^\d+\s+[A-Z]/i) && // Not an address
              !col2.match(/^[A-Z]{2}\s+\d{5}/i) && // Not a state/zip
              !col2.match(/^\d{5}/i) && // Not a zip code
              !col2.match(/street|avenue|drive|lane|blvd/i) && // Not a street
              col2.match(/[A-Z]/i) && // Has letters
              col2.match(/LLC|INC|CORP|PLLC|TRUST/i)) { // Has entity indicator
            const cleaned = this.cleanAndValidatePartyName(col2);
            if (cleaned && !this.isLegalDescription(cleaned) && cleaned.length > 5) {
              fields.assignee = cleaned;
              fields.fieldConfidence?.set('assignee', 0.95);
            }
          }
          
          // Break early if we found both
          if (fields.assignor && fields.assignee) {
            break;
          }
        }
      } else {
        // Standard table format handling
        const assignorIndex = headers.findIndex((h: string) => 
          h.includes('assignor') || h.includes('old lender'));
        const assigneeIndex = headers.findIndex((h: string) => 
          h.includes('assignee') || h.includes('new lender'));

        if (assignorIndex >= 0 || assigneeIndex >= 0) {
          for (const row of table.rows) {
            if (assignorIndex >= 0 && row[assignorIndex]) {
              const cleaned = this.cleanAndValidatePartyName(row[assignorIndex]);
              if (cleaned && !this.isLegalDescription(cleaned)) {
                fields.assignor = cleaned;
                fields.fieldConfidence?.set('assignor', 0.95);
              }
            }
            if (assigneeIndex >= 0 && row[assigneeIndex]) {
              const cleaned = this.cleanAndValidatePartyName(row[assigneeIndex]);
              if (cleaned && !this.isLegalDescription(cleaned)) {
                fields.assignee = cleaned;
                fields.fieldConfidence?.set('assignee', 0.95);
              }
            }
          }
        }
      }
    }

    // If not found in tables, check cover page section
    const coverPage = sections.find(s => s.type === 'coverPage');
    if (coverPage && (!fields.assignor || !fields.assignee)) {
      const coverPageResults = this.extractFromCoverPageText(coverPage.content);
      if (!fields.assignor && coverPageResults.assignor) {
        fields.assignor = coverPageResults.assignor;
        fields.fieldConfidence?.set('assignor', 0.9);
      }
      if (!fields.assignee && coverPageResults.assignee) {
        fields.assignee = coverPageResults.assignee;
        fields.fieldConfidence?.set('assignee', 0.9);
      }
    }

    return fields;
  }

  /**
   * Extract from assignment clause using improved patterns
   */
  private extractFromAssignmentClause(clauseText: string): {
    assignor?: ExtractedPartyInfo;
    assignee?: ExtractedPartyInfo;
  } {
    const result: {
      assignor?: ExtractedPartyInfo;
      assignee?: ExtractedPartyInfo;
    } = {};

    // Clean the text but preserve structure
    const cleanText = clauseText
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n');

    // Pattern 1: MERS assignments
    const assignmentVerbsPattern = this.ASSIGNMENT_VERBS.join('|');
    const mersPattern = new RegExp(
      `Mortgage\\s+Electronic\\s+Registration\\s+Systems[^,]*,\\s*Inc\\.?[^,]*(?:,\\s*as\\s+(?:nominee|mortgagee)\\s+for\\s+([^,]+?)(?:,\\s*its\\s+successors)?)?[^,]*,?\\s*(?:by\\s+these\\s+presents\\s+)?does?\\s+(?:hereby\\s+)?(?:${assignmentVerbsPattern})[^:]*to\\s*:?\\s*([^,\\n]+(?:,\\s*[^,\\n]+)?)`,
      'i'
    );
    
    let match = cleanText.match(mersPattern);
    if (match) {
      const assignorName = match[1] ? 
        `MERS as nominee for ${this.cleanAndValidatePartyName(match[1])}` : 
        'Mortgage Electronic Registration Systems, Inc.';
      const assigneeName = this.cleanAndValidatePartyName(match[2]);
      
      if (!this.isLegalDescription(assignorName)) {
        result.assignor = {
          name: assignorName,
          confidence: 0.9,
          source: 'pattern'
        };
      }
      if (!this.isLegalDescription(assigneeName)) {
        result.assignee = {
          name: assigneeName,
          confidence: 0.9,
          source: 'pattern'
        };
      }
      return result;
    }

    // Pattern 2: Standard assignment language
    const standardPatterns = [
      // "For value received, X assigns to Y"
      new RegExp(
        `for\\s+(?:good\\s+and\\s+)?valuable\\s+consideration[^,]*,\\s*([^,\\n]+?)\\s+(?:does\\s+)?(?:hereby\\s+)?(?:${assignmentVerbsPattern})[^:]*to\\s*:?\\s*([^,\\n]+)`,
        'i'
      ),
      // "X hereby assigns to Y"
      new RegExp(
        `([^,\\n]+?)\\s+(?:does\\s+)?(?:hereby\\s+)?(?:${assignmentVerbsPattern})[^:]*to\\s*:?\\s*([^,\\n]+?)(?:\\s+(?:all|the|that|certain))`,
        'i'
      ),
      // "The undersigned, X, assigns to Y"
      new RegExp(
        `the\\s+undersigned,?\\s*([^,\\n]+?),?\\s+(?:does\\s+)?(?:hereby\\s+)?(?:${assignmentVerbsPattern})[^:]*to\\s*:?\\s*([^,\\n]+)`,
        'i'
      )
    ];

    for (const pattern of standardPatterns) {
      match = cleanText.match(pattern);
      if (match && match[1] && match[2]) {
        const assignorName = this.cleanAndValidatePartyName(match[1]);
        const assigneeName = this.cleanAndValidatePartyName(match[2]);
        
        if (assignorName && !this.isLegalDescription(assignorName) &&
            assigneeName && !this.isLegalDescription(assigneeName)) {
          result.assignor = {
            name: assignorName,
            confidence: 0.85,
            source: 'pattern'
          };
          result.assignee = {
            name: assigneeName,
            confidence: 0.85,
            source: 'pattern'
          };
          return result;
        }
      }
    }

    return result;
  }

  /**
   * Extract from cover page text format
   */
  private extractFromCoverPageText(text: string): {
    assignor?: string;
    assignee?: string;
  } {
    const result: { assignor?: string; assignee?: string } = {};
    
    // Look for structured format like:
    // ASSIGNOR/OLD LENDER: [name]
    // ASSIGNEE/NEW LENDER: [name]
    const assignorMatch = text.match(/ASSIGNOR(?:\/OLD LENDER)?:\s*([^\n]+)/i);
    const assigneeMatch = text.match(/ASSIGNEE(?:\/NEW LENDER)?:\s*([^\n]+)/i);
    
    if (assignorMatch) {
      const cleaned = this.cleanAndValidatePartyName(assignorMatch[1]);
      if (cleaned && !this.isLegalDescription(cleaned)) {
        result.assignor = cleaned;
      }
    }
    
    if (assigneeMatch) {
      const cleaned = this.cleanAndValidatePartyName(assigneeMatch[1]);
      if (cleaned && !this.isLegalDescription(cleaned)) {
        result.assignee = cleaned;
      }
    }
    
    return result;
  }

  /**
   * Extract recording information
   */
  private extractRecordingInfo(
    markdown: string,
    sections: AssignmentSection[]
  ): Partial<ExtractedFields> {
    const fields: Partial<ExtractedFields> = {
      fieldConfidence: new Map<string, number>()
    };

    // Look for recording info in cover page first
    const coverPage = sections.find(s => s.type === 'coverPage');
    if (coverPage) {
      // Document ID pattern
      const docIdMatch = coverPage.content.match(/Document\s+ID:\s*(\d+)/i);
      if (docIdMatch) {
        fields.instrumentNumber = docIdMatch[1];
        fields.fieldConfidence?.set('instrumentNumber', 0.9);
      }

      // Recording date pattern  
      const recordDateMatch = coverPage.content.match(/(?:Recording|Document)\s+Date:\s*(\d{2}-\d{2}-\d{4})/i);
      if (recordDateMatch) {
        fields.recordingDate = new Date(recordDateMatch[1]);
        fields.fieldConfidence?.set('recordingDate', 0.9);
      }
    }

    // Fallback to searching entire document
    if (!fields.instrumentNumber) {
      const instrumentMatch = markdown.match(/(?:Instrument|Document)\s+(?:Number|No\.?|#):\s*(\d+)/i);
      if (instrumentMatch) {
        fields.instrumentNumber = instrumentMatch[1];
        fields.fieldConfidence?.set('instrumentNumber', 0.8);
      }
    }

    return fields;
  }

  /**
   * Check if text appears to be from a legal description
   */
  private isLegalDescription(text: string): boolean {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    return this.LEGAL_DESC_INDICATORS.some(pattern => pattern.test(lowerText));
  }

  /**
   * Clean and validate party names
   */
  private cleanAndValidatePartyName(name: string): string {
    if (!name) return '';
    
    // Remove markdown formatting and clean up
    let cleaned = name
      .replace(/^\s*\*\*|\*\*\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove address info if present (anything after street number)
    const addressMatch = cleaned.match(/^(.*?)\s+\d+\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr)/i);
    if (addressMatch) {
      cleaned = addressMatch[1].trim();
    }
    
    // Remove c/o and everything after
    const coMatch = cleaned.match(/^(.*?)\s*[,;]\s*c\/o/i);
    if (coMatch) {
      cleaned = coMatch[1].trim();
    }
    
    // Validate it's a reasonable party name
    if (cleaned.length < 3 || cleaned.length > 200) {
      return '';
    }
    
    // Check if it contains at least one letter
    if (!/[a-zA-Z]/.test(cleaned)) {
      return '';
    }
    
    return cleaned;
  }

  /**
   * Validate extracted fields
   */
  private validateExtractedFields(fields: Partial<ExtractedFields>): void {
    // Remove fields that look like legal descriptions
    if (fields.assignor && this.isLegalDescription(fields.assignor)) {
      delete fields.assignor;
      fields.fieldConfidence?.delete('assignor');
    }
    
    if (fields.assignee && this.isLegalDescription(fields.assignee)) {
      delete fields.assignee;
      fields.fieldConfidence?.delete('assignee');
    }
    
    // Ensure recording date is reasonable
    if (fields.recordingDate) {
      const year = fields.recordingDate.getFullYear();
      if (year < 1900 || year > new Date().getFullYear() + 1) {
        delete fields.recordingDate;
        fields.fieldConfidence?.delete('recordingDate');
      }
    }
  }
}