import { 
  ExtractionStrategy, 
  ExtractedCandidate, 
  ExtractorConfig 
} from '../MarkdownFieldExtractor';

export class TableStrategy implements ExtractionStrategy {
  name = 'Table';
  priority = 95; // Highest priority for structured data

  extract(text: string, config: ExtractorConfig): Map<string, ExtractedCandidate> {
    const results = new Map<string, ExtractedCandidate>();
    
    // Parse potential table structures from text
    const tables = this.extractTables(text);
    
    for (const table of tables) {
      for (const field of config.fields) {
        const candidate = this.extractFieldFromTable(table, field);
        if (candidate) {
          results.set(field.name, candidate);
        }
      }
    }
    
    return results;
  }

  private extractTables(text: string): Array<{ headers: string[], rows: string[][] }> {
    const tables: Array<{ headers: string[], rows: string[][] }> = [];
    
    // Look for markdown-style tables that got converted to text
    const lines = text.split('\n');
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Check if this looks like a table header (has multiple words separated by significant whitespace)
      if (this.looksLikeTableHeader(line)) {
        const headers = this.parseTableHeader(line);
        const rows: string[][] = [];
        
        // Look for rows following this header
        i++;
        while (i < lines.length && lines[i].trim()) {
          const rowData = this.parseTableRow(lines[i], headers.length);
          if (rowData.length > 0) {
            rows.push(rowData);
          }
          i++;
        }
        
        if (rows.length > 0) {
          tables.push({ headers, rows });
        }
      }
      i++;
    }
    
    return tables;
  }

  private looksLikeTableHeader(line: string): boolean {
    // Heuristics for table headers:
    // - Multiple words/phrases separated by significant whitespace
    // - Contains field-like terms
    const fieldTerms = [
      'assignor', 'assignee', 'date', 'amount', 'property', 'address',
      'borrower', 'lender', 'recording', 'instrument', 'loan'
    ];
    
    const words = line.toLowerCase().split(/\s{2,}/); // Split on 2+ spaces
    return words.length >= 2 && 
           words.some(word => fieldTerms.some(term => word.includes(term)));
  }

  private parseTableHeader(line: string): string[] {
    return line.split(/\s{2,}/).map(h => h.trim()).filter(h => h);
  }

  private parseTableRow(line: string, expectedColumns: number): string[] {
    const parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p);
    
    // Only return if we have reasonable number of columns
    return parts.length >= Math.min(2, expectedColumns) ? parts : [];
  }

  private extractFieldFromTable(
    table: { headers: string[], rows: string[][] }, 
    fieldDef: any
  ): ExtractedCandidate | null {
    // Find header column that matches field keywords
    let columnIndex = -1;
    
    for (let i = 0; i < table.headers.length; i++) {
      const header = table.headers[i].toLowerCase();
      
      for (const keyword of fieldDef.keywords) {
        if (header.includes(keyword.toLowerCase())) {
          columnIndex = i;
          break;
        }
      }
      
      if (columnIndex !== -1) break;
    }
    
    if (columnIndex === -1) return null;
    
    // Extract value from first non-empty row
    for (const row of table.rows) {
      if (row[columnIndex] && row[columnIndex].trim()) {
        const value = this.parseValue(row[columnIndex], fieldDef.name);
        
        return {
          value,
          confidence: 0.95, // High confidence for structured table data
          strategy: this.name,
          justification: `Found in table column "${table.headers[columnIndex]}"`
        };
      }
    }
    
    return null;
  }

  private parseValue(rawValue: string, fieldName: string): any {
    const cleaned = rawValue.trim();
    
    // Parse based on field type
    if (fieldName.includes('Amount') || fieldName.includes('amount')) {
      // Currency parsing
      const currencyMatch = cleaned.match(/\$?[\d,]+(?:\.\d{2})?/);
      if (currencyMatch) {
        return parseFloat(currencyMatch[0].replace(/[$,]/g, ''));
      }
    }
    
    if (fieldName.includes('Date') || fieldName.includes('date')) {
      // Date parsing
      const date = new Date(cleaned);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    return cleaned;
  }
}