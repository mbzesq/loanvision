import { DocumentAnalysisResult } from '../ocr/azureDocumentClient';
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

export class FieldExtractor {
  // Common patterns
  private readonly addressPattern = /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl))\s*,?\s*([A-Za-z\s]+)\s*,?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/i;
  
  private readonly datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
  private readonly currencyPattern = /\$[\d,]+(?:\.\d{2})?/;
  private readonly namePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;

  async extractFields(
    ocrResult: DocumentAnalysisResult, 
    documentType: DocumentType
  ): Promise<ExtractedFields> {
    const fields: ExtractedFields = {
      fieldConfidence: new Map<string, number>(),
    };

    // Extract common fields
    this.extractPropertyAddress(ocrResult, fields);

    // Extract document-specific fields
    switch (documentType) {
      case DocumentType.NOTE:
      case DocumentType.SECURITY_INSTRUMENT:
        this.extractLoanFields(ocrResult, fields);
        break;
      case DocumentType.ASSIGNMENT:
        this.extractAssignmentFields(ocrResult, fields);
        break;
      case DocumentType.ALLONGE:
        // Allonge typically just has endorsement info
        this.extractEndorsementFields(ocrResult, fields);
        break;
    }

    return fields;
  }

  private extractPropertyAddress(result: DocumentAnalysisResult, fields: ExtractedFields): void {
    const text = result.text;
    const keyValues = result.keyValuePairs;

    // Try to find address in key-value pairs first
    const addressKeys = ['property address', 'premises', 'property', 'located at', 'address'];
    
    for (const key of addressKeys) {
      keyValues.forEach((value: string, k: string) => {
        if (k.toLowerCase().includes(key)) {
          const parsedAddress = this.parseAddress(value);
          if (parsedAddress) {
            Object.assign(fields, parsedAddress);
            fields.fieldConfidence.set('propertyAddress', 0.9);
            return;
          }
        }
      });
    }

    // Fallback to regex search in full text
    const addressMatch = text.match(this.addressPattern);
    if (addressMatch) {
      fields.propertyStreet = addressMatch[1].trim();
      fields.propertyCity = addressMatch[2].trim();
      fields.propertyState = addressMatch[3].trim();
      fields.propertyZip = addressMatch[4].trim();
      fields.fieldConfidence.set('propertyAddress', 0.7);
    }
  }

  private extractLoanFields(result: DocumentAnalysisResult, fields: ExtractedFields): void {
    const keyValues = result.keyValuePairs;
    const text = result.text;

    // Extract borrower names
    this.extractBorrowerNames(keyValues, text, fields);

    // Extract loan amount
    this.extractLoanAmount(keyValues, text, fields);

    // Extract dates
    this.extractLoanDates(keyValues, text, fields);

    // Extract lender
    this.extractLender(keyValues, text, fields);
  }

  private extractBorrowerNames(
    keyValues: Map<string, string>, 
    text: string, 
    fields: ExtractedFields
  ): void {
    // Check key-value pairs first
    const borrowerKeys = ['borrower', 'mortgagor', 'trustor', 'maker'];
    const coBorrowerKeys = ['co-borrower', 'co borrower', 'and'];

    keyValues.forEach((value, key) => {
      const keyLower = key.toLowerCase();
      
      if (borrowerKeys.some(k => keyLower.includes(k))) {
        const names = this.extractNamesFromValue(value);
        if (names.length > 0) {
          fields.borrowerName = names[0];
          fields.fieldConfidence.set('borrowerName', 0.85);
          if (names.length > 1) {
            fields.coBorrowerName = names[1];
            fields.fieldConfidence.set('coBorrowerName', 0.8);
          }
        }
      }
    });

    // Fallback patterns
    if (!fields.borrowerName) {
      const borrowerPattern = /(?:borrower|mortgagor|trustor):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i;
      const match = text.match(borrowerPattern);
      if (match) {
        fields.borrowerName = match[1];
        fields.fieldConfidence.set('borrowerName', 0.6);
      }
    }
  }

  private extractLoanAmount(
    keyValues: Map<string, string>, 
    text: string, 
    fields: ExtractedFields
  ): void {
    const amountKeys = ['loan amount', 'principal', 'amount', 'sum'];

    keyValues.forEach((value, key) => {
      const keyLower = key.toLowerCase();
      
      if (amountKeys.some(k => keyLower.includes(k))) {
        const amount = this.parseCurrency(value);
        if (amount) {
          fields.loanAmount = amount;
          fields.fieldConfidence.set('loanAmount', 0.9);
        }
      }
    });

    // Fallback to pattern matching
    if (!fields.loanAmount) {
      const amountPattern = /(?:principal sum of|loan amount of|amount of)\s*(\$[\d,]+(?:\.\d{2})?)/i;
      const match = text.match(amountPattern);
      if (match) {
        fields.loanAmount = this.parseCurrency(match[1]);
        fields.fieldConfidence.set('loanAmount', 0.7);
      }
    }
  }

  private extractLoanDates(
    keyValues: Map<string, string>, 
    text: string, 
    fields: ExtractedFields
  ): void {
    const dateKeys = ['date', 'dated', 'origination date', 'loan date'];

    keyValues.forEach((value, key) => {
      const keyLower = key.toLowerCase();
      
      if (dateKeys.some(k => keyLower.includes(k))) {
        const date = this.parseDate(value);
        if (date) {
          fields.originationDate = date;
          fields.fieldConfidence.set('originationDate', 0.8);
        }
      }
    });
  }

  private extractLender(
    keyValues: Map<string, string>, 
    text: string, 
    fields: ExtractedFields
  ): void {
    const lenderKeys = ['lender', 'mortgagee', 'beneficiary', 'payee'];

    keyValues.forEach((value, key) => {
      const keyLower = key.toLowerCase();
      
      if (lenderKeys.some(k => keyLower.includes(k))) {
        fields.lenderName = this.cleanCompanyName(value);
        fields.fieldConfidence.set('lenderName', 0.85);
      }
    });
  }

  private extractAssignmentFields(result: DocumentAnalysisResult, fields: ExtractedFields): void {
    const keyValues = result.keyValuePairs;
    const text = result.text;

    // Extract assignor/assignee
    keyValues.forEach((value: string, key: string) => {
      const keyLower = key.toLowerCase();
      
      if (keyLower.includes('assignor') || keyLower.includes('from')) {
        fields.assignor = this.cleanCompanyName(value);
        fields.fieldConfidence.set('assignor', 0.85);
      }
      
      if (keyLower.includes('assignee') || keyLower.includes('to')) {
        fields.assignee = this.cleanCompanyName(value);
        fields.fieldConfidence.set('assignee', 0.85);
      }
      
      if (keyLower.includes('assignment date')) {
        fields.assignmentDate = this.parseDate(value);
        fields.fieldConfidence.set('assignmentDate', 0.8);
      }
      
      if (keyLower.includes('recording date') || keyLower.includes('recorded')) {
        fields.recordingDate = this.parseDate(value);
        fields.fieldConfidence.set('recordingDate', 0.8);
      }
      
      if (keyLower.includes('instrument') || keyLower.includes('document number')) {
        fields.instrumentNumber = value.trim();
        fields.fieldConfidence.set('instrumentNumber', 0.9);
      }
    });
  }

  private extractEndorsementFields(result: DocumentAnalysisResult, fields: ExtractedFields): void {
    // For allonge, mainly extract the endorser information
    const text = result.text;
    const endorsementPattern = /pay to the order of\s+([A-Za-z\s,.'&]+?)(?:\n|without)/i;
    const match = text.match(endorsementPattern);
    
    if (match) {
      fields.assignee = this.cleanCompanyName(match[1]);
      fields.fieldConfidence.set('assignee', 0.7);
    }
  }

  // Helper methods
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
    // Split by common separators
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
    const match = value.match(this.datePattern);
    if (match) {
      const month = parseInt(match[1]);
      const day = parseInt(match[2]);
      let year = parseInt(match[3]);
      
      // Handle 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      
      const date = new Date(year, month - 1, day);
      return isNaN(date.getTime()) ? undefined : date;
    }
    return undefined;
  }

  private cleanCompanyName(name: string): string {
    return name
      .replace(/[,.]?\s*(LLC|L\.L\.C\.|Inc|Corp|Corporation|Company|Co\.?)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}