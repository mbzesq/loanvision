import { DocumentType } from '../ml/documentClassifier';

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
        this.extractAssignmentFields(markdown, sections, tables, fields);
        break;
      case DocumentType.ALLONGE:
        this.extractEndorsementFields(markdown, fields);
        break;
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

  private extractAssignmentFields(markdown: string, sections: any[], tables: any[], fields: ExtractedFields): void {
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

    // Pattern matching for assignment parties
    if (!fields.assignor || !fields.assignee) {
      const assignmentPatterns = [
        /assigns?\s+to\s+([A-Z][A-Za-z\s&,.]+?)\s*(?:,|\n|all)/i,
        /assignor[:\s]+([A-Z][A-Za-z\s&,.]+?)\s*(?:,|\n)/i,
        /assignee[:\s]+([A-Z][A-Za-z\s&,.]+?)\s*(?:,|\n)/i
      ];

      for (const pattern of assignmentPatterns) {
        const match = fullText.match(pattern);
        if (match) {
          const company = this.cleanCompanyName(match[1]);
          if (!fields.assignee && pattern.source.includes('assigns? to')) {
            fields.assignee = company;
            fields.fieldConfidence.set('assignee', 0.75);
          }
        }
      }
    }

    // Extract dates
    const datePatterns = [
      /assignment date[:\s]+([^\n,]+)/i,
      /recorded[:\s]+([^\n,]+)/i,
      /recording date[:\s]+([^\n,]+)/i
    ];

    for (const pattern of datePatterns) {
      const match = fullText.match(pattern);
      if (match) {
        const date = this.parseDate(match[1]);
        if (date) {
          if (pattern.source.includes('recording')) {
            fields.recordingDate = date;
            fields.fieldConfidence.set('recordingDate', 0.8);
          } else {
            fields.assignmentDate = date;
            fields.fieldConfidence.set('assignmentDate', 0.8);
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
    return name
      .replace(/[,.]?\s*(LLC|L\.L\.C\.|Inc|Corp|Corporation|Company|Co\.?)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}