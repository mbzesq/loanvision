import { DocumentType } from '../ml/documentClassifier';
import { ImprovedAssignmentExtractor } from './improvedAssignmentExtractor';

export interface ExtractedFields {
  // Common fields
  propertyStreet?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  
  // Note/Mortgage fields
  borrowerName?: string;
  coBorrowerName?: string;
  loanAmount?: number;
  originationDate?: Date;
  lenderName?: string;
  
  // Assignment fields
  assignor?: string;
  assignee?: string;
  assignmentDate?: Date;
  recordingDate?: Date;
  instrumentNumber?: string;
  
  // Confidence scores for each field
  fieldConfidence: Map<string, number>;
}

export class MarkdownFieldExtractor {
  // Common patterns
  private readonly addressPattern = /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl))\s*,?\s*([A-Za-z\s]+)\s*,?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/i;
  private readonly datePattern = /(\d{1,2})[\\/\-](\d{1,2})[\\/\-](\d{2,4})/;
  private readonly currencyPattern = /\$[\d,]+(?:\.\d{2})?/;
  private readonly namePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;
  
  // Improved assignment extractor
  private readonly improvedAssignmentExtractor = new ImprovedAssignmentExtractor();

  async extractFields(
    markdown: string, 
    documentType: DocumentType
  ): Promise<ExtractedFields> {
    const fields: ExtractedFields = {
      fieldConfidence: new Map<string, number>(),
    };

    // Parse markdown into sections and tables
    const sections = this.parseMarkdownSections(markdown);
    const tables = this.extractMarkdownTables(markdown);
    const cleanText = this.stripMarkdown(markdown);

    // Extract common fields
    this.extractPropertyAddress(markdown, sections, tables, fields);

    // Extract document-specific fields
    switch (documentType) {
      case DocumentType.NOTE:
      case DocumentType.SECURITY_INSTRUMENT:
        this.extractLoanFields(markdown, sections, tables, fields);
        break;
      case DocumentType.ASSIGNMENT:
        await this.extractAssignmentFields(markdown, sections, tables, fields);
        break;
      // NOTE: ALLONGE documents are now classified as Notes with endorsements
    }

    return fields;
  }

  private extractPropertyAddress(
    markdown: string,
    sections: any[],
    tables: any[],
    fields: ExtractedFields
  ): void {
    // Try to find address in tables first (most reliable)
    for (const table of tables) {
      for (let i = 0; i < table.headers.length; i++) {
        const header = table.headers[i].toLowerCase();
        if (['property address', 'address', 'premises', 'property'].some(key => header.includes(key))) {
          for (const row of table.rows) {
            if (row[i]) {
              const parsedAddress = this.parseAddress(row[i]);
              if (parsedAddress) {
                Object.assign(fields, parsedAddress);
                fields.fieldConfidence.set('propertyAddress', 0.95);
                return;
              }
            }
          }
        }
      }
    }

    // Try to find address in structured sections
    const propertySection = sections.find(s => 
      s.heading.toLowerCase().includes('property') || 
      s.heading.toLowerCase().includes('real property')
    );
    
    if (propertySection) {
      const addressMatch = propertySection.content.match(this.addressPattern);
      if (addressMatch) {
        fields.propertyStreet = addressMatch[1].trim();
        fields.propertyCity = addressMatch[2].trim();
        fields.propertyState = addressMatch[3].trim();
        fields.propertyZip = addressMatch[4].trim();
        fields.fieldConfidence.set('propertyAddress', 0.85);
        return;
      }
    }

    // Fallback to full text search
    const fullText = this.stripMarkdown(markdown);
    const addressMatch = fullText.match(this.addressPattern);
    if (addressMatch) {
      fields.propertyStreet = addressMatch[1].trim();
      fields.propertyCity = addressMatch[2].trim();
      fields.propertyState = addressMatch[3].trim();
      fields.propertyZip = addressMatch[4].trim();
      fields.fieldConfidence.set('propertyAddress', 0.7);
    }
  }

  private extractLoanFields(
    markdown: string,
    sections: any[],
    tables: any[],
    fields: ExtractedFields
  ): void {
    const fullText = this.stripMarkdown(markdown);

    // Extract borrower names
    this.extractBorrowerNames(markdown, tables, fields);

    // Extract loan amount
    this.extractLoanAmount(markdown, tables, fields);

    // Extract dates
    this.extractLoanDates(markdown, tables, fields);

    // Extract lender
    this.extractLender(markdown, tables, fields);
  }

  private extractBorrowerNames(markdown: string, tables: any[], fields: ExtractedFields): void {
    // Check tables first
    for (const table of tables) {
      for (let i = 0; i < table.headers.length; i++) {
        const header = table.headers[i].toLowerCase();
        if (['borrower', 'mortgagor', 'grantor', 'trustor'].some(key => header.includes(key))) {
          for (const row of table.rows) {
            if (row[i]) {
              const names = this.extractNamesFromValue(row[i]);
              if (names.length > 0) {
                fields.borrowerName = names[0];
                fields.fieldConfidence.set('borrowerName', 0.9);
                if (names.length > 1) {
                  fields.coBorrowerName = names[1];
                  fields.fieldConfidence.set('coBorrowerName', 0.85);
                }
                return;
              }
            }
          }
        }
      }
    }

    // Fallback to pattern matching in full text
    const fullText = this.stripMarkdown(markdown);
    const borrowerPatterns = [
      /(?:borrower|mortgagor|grantor|trustor)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /between\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+and\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?)/i
    ];

    for (const pattern of borrowerPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        const names = this.extractNamesFromValue(match[1]);
        if (names.length > 0) {
          fields.borrowerName = names[0];
          fields.fieldConfidence.set('borrowerName', 0.7);
          if (names.length > 1) {
            fields.coBorrowerName = names[1];
            fields.fieldConfidence.set('coBorrowerName', 0.7);
          }
          break;
        }
      }
    }
  }

  private extractLoanAmount(markdown: string, tables: any[], fields: ExtractedFields): void {
    // Check tables first
    for (const table of tables) {
      for (let i = 0; i < table.headers.length; i++) {
        const header = table.headers[i].toLowerCase();
        if (['amount', 'principal', 'loan amount', 'sum'].some(key => header.includes(key))) {
          for (const row of table.rows) {
            if (row[i]) {
              const amount = this.parseCurrency(row[i]);
              if (amount) {
                fields.loanAmount = amount;
                fields.fieldConfidence.set('loanAmount', 0.95);
                return;
              }
            }
          }
        }
      }
    }

    // Pattern matching in full text
    const fullText = this.stripMarkdown(markdown);
    const amountPatterns = [
      /principal amount[\s\w]*\$(\d[\d,]*(?:\.\d{2})?)/i,
      /loan amount[\s\w]*\$(\d[\d,]*(?:\.\d{2})?)/i,
      /sum of[\s\w]*\$(\d[\d,]*(?:\.\d{2})?)/i,
      /maximum principal amount[\s\w]*\$(\d[\d,]*(?:\.\d{2})?)/i
    ];

    for (const pattern of amountPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        const amount = this.parseCurrency('$' + match[1]);
        if (amount) {
          fields.loanAmount = amount;
          fields.fieldConfidence.set('loanAmount', 0.8);
          break;
        }
      }
    }
  }

  private extractLoanDates(markdown: string, tables: any[], fields: ExtractedFields): void {
    // Check tables first
    for (const table of tables) {
      for (let i = 0; i < table.headers.length; i++) {
        const header = table.headers[i].toLowerCase();
        if (['date', 'dated', 'origination', 'loan date'].some(key => header.includes(key))) {
          for (const row of table.rows) {
            if (row[i]) {
              const date = this.parseDate(row[i]);
              if (date) {
                fields.originationDate = date;
                fields.fieldConfidence.set('originationDate', 0.9);
                return;
              }
            }
          }
        }
      }
    }

    // Pattern matching for common date formats in mortgage documents
    const fullText = this.stripMarkdown(markdown);
    const datePatterns = [
      /this mortgage dated\s+([^,]+)/i,
      /dated\s+([^,\n]+)/i
    ];

    for (const pattern of datePatterns) {
      const match = fullText.match(pattern);
      if (match) {
        const date = this.parseDate(match[1]);
        if (date) {
          fields.originationDate = date;
          fields.fieldConfidence.set('originationDate', 0.75);
          break;
        }
      }
    }
  }

  private extractLender(markdown: string, tables: any[], fields: ExtractedFields): void {
    // Pattern matching for lender identification
    const fullText = this.stripMarkdown(markdown);
    const lenderPatterns = [
      /(?:lender|mortgagee|beneficiary)[:\s]+([A-Z][A-Za-z\s&,.]+?)(?:,|\n|whose)/i,
      /and\s+([A-Z][A-Za-z\s&,.]+?)\s*\(referred to.*as.*lender\)/i
    ];

    for (const pattern of lenderPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        fields.lenderName = this.cleanCompanyName(match[1]);
        fields.fieldConfidence.set('lenderName', 0.8);
        break;
      }
    }
  }

  private async extractAssignmentFields(markdown: string, sections: any[], tables: any[], fields: ExtractedFields): Promise<void> {
    // Use the improved assignment extractor
    const improvedResults = await this.improvedAssignmentExtractor.extractAssignmentFields(
      markdown,
      tables,
      sections
    );
    
    // Merge the results into fields
    if (improvedResults.assignor) {
      fields.assignor = improvedResults.assignor;
    }
    if (improvedResults.assignee) {
      fields.assignee = improvedResults.assignee;
    }
    if (improvedResults.recordingDate) {
      fields.recordingDate = improvedResults.recordingDate;
    }
    if (improvedResults.instrumentNumber) {
      fields.instrumentNumber = improvedResults.instrumentNumber;
    }
    if (improvedResults.fieldConfidence) {
      improvedResults.fieldConfidence.forEach((confidence, field) => {
        fields.fieldConfidence.set(field, confidence);
      });
    }
    
    return;
  }
  
  // Keep the old implementation as a fallback/reference
  private extractAssignmentFieldsLegacy(markdown: string, sections: any[], tables: any[], fields: ExtractedFields): void {
    const fullText = this.stripMarkdown(markdown);

    // Extract assignor/assignee from tables first
    for (const table of tables) {
      for (let i = 0; i < table.headers.length; i++) {
        const header = table.headers[i].toLowerCase();
        if (header.includes('assignor')) {
          for (const row of table.rows) {
            if (row[i]) {
              fields.assignor = this.cleanCompanyName(row[i]);
              fields.fieldConfidence.set('assignor', 0.9);
            }
          }
        }
        if (header.includes('assignee')) {
          for (const row of table.rows) {
            if (row[i]) {
              fields.assignee = this.cleanCompanyName(row[i]);
              fields.fieldConfidence.set('assignee', 0.9);
            }
          }
        }
      }
    }

    // Extract assignor/assignee from markdown structured text (with bold formatting)
    if (!fields.assignor) {
      const assignorPatterns = [
        // Markdown formatted with precise stopping points
        /\*\*assignor:\*\*\s*([A-Z][A-Za-z\s&]+?)(?=\s*[\n\r]|\*\*|$)/i,
        // Simple colon format with conservative capture
        /assignor:\s*([A-Z][A-Za-z\s&]+?)(?=\s*[\n\r]|assignee|hereby|and\s+has|$)/i,
        // Structured format with stops at common legal phrases
        /\*\*assignor\*\*[:\s]*([A-Z][A-Za-z\s&]+?)(?=\s*[\n\r]|\*\*|$)/i,
        // Conservative fallback
        /assignor[:\s]+([A-Z][A-Za-z\s&]+?)(?=\s*(?:,|and|hereby|known|being|\n))/i
      ];
      
      for (const pattern of assignorPatterns) {
        const match = markdown.match(pattern);
        if (match && match[1]) {
          const cleaned = this.cleanCompanyName(match[1]);
          if (cleaned && cleaned.length > 2 && cleaned.length < 100) {
            fields.assignor = cleaned;
            fields.fieldConfidence.set('assignor', 0.9);
            break;
          }
        }
      }
    }

    if (!fields.assignee) {
      const assigneePatterns = [
        // Markdown formatted with precise stopping points
        /\*\*assignee:\*\*\s*([A-Z][A-Za-z\s&]+?)(?=\s*[\n\r]|\*\*|$)/i,
        // Simple colon format with conservative capture
        /assignee:\s*([A-Z][A-Za-z\s&]+?)(?=\s*[\n\r]|all\s+right|hereby|$)/i,
        // Structured format
        /\*\*assignee\*\*[:\s]*([A-Z][A-Za-z\s&]+?)(?=\s*[\n\r]|\*\*|$)/i,
        // Conservative fallback
        /assignee[:\s]+([A-Z][A-Za-z\s&]+?)(?=\s*(?:all|,|\n|$))/i
      ];
      
      for (const pattern of assigneePatterns) {
        const match = markdown.match(pattern);
        if (match && match[1]) {
          const cleaned = this.cleanCompanyName(match[1]);
          if (cleaned && cleaned.length > 2 && cleaned.length < 100) {
            fields.assignee = cleaned;
            fields.fieldConfidence.set('assignee', 0.9);
            break;
          }
        }
      }
    }

    // Pattern matching for assignment transfer language - more conservative
    if (!fields.assignor || !fields.assignee) {
      // Look for "X hereby assigns and transfers to Y" patterns with better boundaries
      const transferPatterns = [
        // Company-to-company with clear entity markers
        /([A-Z][A-Za-z\s&]+?(?:LLC|Inc|Corp|Trust|Company|Co\.?))\s+hereby assigns?(?:\s+and transfers?)?\s+to\s+([A-Z][A-Za-z\s&]+?(?:LLC|Inc|Corp|Trust|Company|Co\.?))\s+all/i,
        // Shorter, more conservative patterns
        /([A-Z][A-Za-z\s&]{3,50}?)\s+assigns?\s+to\s+([A-Z][A-Za-z\s&]{3,50}?)\s+(?:all|the)/i,
        // Assignment from X to Y format
        /assignment\s+from\s+([A-Z][A-Za-z\s&]{3,50}?)\s+to\s+([A-Z][A-Za-z\s&]{3,50}?)(?:\s|,|$)/i
      ];

      for (const pattern of transferPatterns) {
        const match = fullText.match(pattern);
        if (match && match[1] && match[2]) {
          const cleanedAssignor = this.cleanCompanyName(match[1]);
          const cleanedAssignee = this.cleanCompanyName(match[2]);
          
          // Quality checks for reasonable entity names
          if (cleanedAssignor && cleanedAssignee && 
              cleanedAssignor.length > 2 && cleanedAssignor.length < 100 &&
              cleanedAssignee.length > 2 && cleanedAssignee.length < 100 &&
              cleanedAssignor !== cleanedAssignee) {
            
            if (!fields.assignor) {
              fields.assignor = cleanedAssignor;
              fields.fieldConfidence.set('assignor', 0.85);
            }
            if (!fields.assignee) {
              fields.assignee = cleanedAssignee;
              fields.fieldConfidence.set('assignee', 0.85);
            }
            break;
          }
        }
      }
    }

    // Legacy simple patterns for fallback
    if (!fields.assignor || !fields.assignee) {
      const simplePatterns = [
        /assigns?\s+to\s+([A-Z][A-Za-z\s&,.]+?)\s*(?:,|\n|all)/i,
        /assignor[:\s]+([A-Z][A-Za-z\s&,.]+?)\s*(?:,|\n)/i,
        /assignee[:\s]+([A-Z][A-Za-z\s&,.]+?)\s*(?:,|\n)/i
      ];

      for (const pattern of simplePatterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
          const company = this.cleanCompanyName(match[1]);
          // Add quality checks for reasonable entity names
          if (company && company.length > 2 && company.length < 100) {
            if (!fields.assignee && pattern.source.includes('assigns? to')) {
              fields.assignee = company;
              fields.fieldConfidence.set('assignee', 0.75);
            } else if (!fields.assignor && pattern.source.includes('assignor')) {
              fields.assignor = company;
              fields.fieldConfidence.set('assignor', 0.75);
            } else if (!fields.assignee && pattern.source.includes('assignee')) {
              fields.assignee = company;
              fields.fieldConfidence.set('assignee', 0.75);
            }
          }
        }
      }
    }

    // Extract dates - improved patterns for various document formats
    // Use original markdown to preserve line breaks and better date context
    const datePatterns = [
      /recording date[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /assignment recorded[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /recorded[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /document number[:\s]+(\d{4}-\d+)/i,
      /recording number[:\s]+(\d{4}-\d+)/i,
      /instrument(?:\s+no\.?|number)[:\s]+([^\n,]+)/i
    ];

    for (const pattern of datePatterns) {
      const match = markdown.match(pattern);
      if (match) {
        const value = match[1].trim();
        
        // Try to parse as date first
        const date = this.parseDate(value);
        if (date) {
          if (pattern.source.includes('recording')) {
            fields.recordingDate = date;
            fields.fieldConfidence.set('recordingDate', 0.8);
          } else if (pattern.source.includes('assignment')) {
            fields.assignmentDate = date;
            fields.fieldConfidence.set('assignmentDate', 0.8);
          }
        } else if (pattern.source.includes('number') || pattern.source.includes('instrument')) {
          // If not a date, might be an instrument number
          if (value.match(/^\d{4}-\d+$|^\d+$/)) {
            fields.instrumentNumber = value;
            fields.fieldConfidence.set('instrumentNumber', 0.8);
          }
        }
      }
    }
  }

  private extractEndorsementFields(markdown: string, fields: ExtractedFields): void {
    const fullText = this.stripMarkdown(markdown);
    const endorsementPattern = /pay to the order of\s+([A-Za-z\s,.'&]+?)(?:\n|without)/i;
    const match = fullText.match(endorsementPattern);
    
    if (match) {
      fields.assignee = this.cleanCompanyName(match[1]);
      fields.fieldConfidence.set('assignee', 0.8);
    }
  }

  // Helper methods
  private parseMarkdownSections(markdown: string): any[] {
    const sections: any[] = [];
    const lines = markdown.split('\n');
    let currentSection: any = null;

    for (const line of lines) {
      const headerMatch = line.match(/^(#+)\s+(.+)$/);
      if (headerMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          level: headerMatch[1].length,
          heading: headerMatch[2].trim(),
          content: ''
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  private extractMarkdownTables(markdown: string): any[] {
    const tables: any[] = [];
    const tableRegex = /\|(.+)\|[\r\n]+\|[-:\s|]+\|[\r\n]+((?:\|.+\|[\r\n]*)+)/g;
    
    let match;
    while ((match = tableRegex.exec(markdown)) !== null) {
      const headerLine = match[1];
      const bodyLines = match[2].trim().split('\n');
      
      const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
      const rows = bodyLines.map(line => 
        line.split('|').map(cell => cell.trim()).filter(cell => cell)
      );
      
      tables.push({ headers, rows });
    }

    return tables;
  }

  private stripMarkdown(markdown: string): string {
    return markdown
      .replace(/^#+\s+/gm, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
      .replace(/```[^`]+```/g, '') // Remove code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\|[^|]+\|/g, ' ') // Remove tables
      .replace(/^[-*_]{3,}$/gm, '') // Remove horizontal rules
      .replace(/\s+/g, ' ') // Clean up whitespace
      .trim();
  }

  private parseAddress(addressText: string): Partial<ExtractedFields> | null {
    const match = addressText.match(this.addressPattern);
    if (match) {
      return {
        propertyStreet: match[1].trim(),
        propertyCity: match[2].trim(),
        propertyState: match[3].trim(),
        propertyZip: match[4].trim(),
      };
    }
    return null;
  }

  private extractNamesFromValue(value: string): string[] {
    const names = value.split(/\s+and\s+|\s*,\s*|\s*&\s*/i)
      .map(n => n.trim())
      .filter(n => n.length > 0 && this.namePattern.test(n));
    
    return names;
  }

  private parseCurrency(value: string): number | undefined {
    const cleanValue = value.replace(/[$,]/g, '');
    const amount = parseFloat(cleanValue);
    return isNaN(amount) ? undefined : amount;
  }

  private parseDate(value: string): Date | undefined {
    // Handle various date formats
    const cleanValue = value.trim().replace(/[,]/g, '');
    
    // Try standard formats
    const formats = [
      /^(\d{1,2})[\\/\-](\d{1,2})[\\/\-](\d{2,4})$/, // MM/dd/yyyy
      /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/, // Month dd, yyyy
      /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/ // dd Month yyyy
    ];

    for (const format of formats) {
      const match = cleanValue.match(format);
      if (match) {
        let month: number, day: number, year: number;
        
        if (format === formats[0]) { // MM/dd/yyyy
          month = parseInt(match[1]);
          day = parseInt(match[2]);
          year = parseInt(match[3]);
          if (year < 100) year += year < 50 ? 2000 : 1900;
        } else if (format === formats[1]) { // Month dd, yyyy
          month = this.parseMonthName(match[1]);
          day = parseInt(match[2]);
          year = parseInt(match[3]);
        } else { // dd Month yyyy
          day = parseInt(match[1]);
          month = this.parseMonthName(match[2]);
          year = parseInt(match[3]);
        }
        
        if (month > 0 && month <= 12 && day > 0 && day <= 31) {
          const date = new Date(year, month - 1, day);
          return isNaN(date.getTime()) ? undefined : date;
        }
      }
    }
    
    return undefined;
  }

  private parseMonthName(monthName: string): number {
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const index = months.findIndex(m => m.startsWith(monthName.toLowerCase()));
    return index + 1;
  }

  private cleanCompanyName(name: string): string {
    if (!name) return '';
    
    return name
      .replace(/^\s*\*\*|\*\*\s*$/g, '') // Remove markdown bold formatting
      .replace(/\s*\([^)]+\)\s*/g, ' ') // Remove parenthetical content like "(Mortgage Electronic Registration Systems, Inc.)"
      // Remove common legal boilerplate phrases that get captured in assignments
      .replace(/\s*(known\s+as|being\s+the|hereby\s+assigns?|has\s+duly\s+executed|and\s+has\s+duly|on\s+the\s+date|hereinafter\s+written)/gi, '')
      .replace(/\s*(missing\s+link\s+between|duly\s+executed\s+this\s+assignment|for\s+good\s+and\s+valuable\s+consideration)/gi, '')
      .replace(/\s*(all\s+right,?\s+title\s+and\s+interest|in\s+the\s+mortgage\s+described\s+herein)/gi, '')
      // Keep company suffixes but clean them up
      .replace(/[,.]?\s*(LLC|L\.L\.C\.|Inc\.?|Corp\.?|Corporation|Company|Co\.?|Trust|LP|Ltd\.?)\s*$/i, ' $1')
      .replace(/\s+/g, ' ')
      .trim();
  }
}