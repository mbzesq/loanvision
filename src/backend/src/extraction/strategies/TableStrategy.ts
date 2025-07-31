import { 
  ExtractionStrategy, 
  ExtractedCandidate, 
  ExtractorConfig 
} from '../markdownFieldExtractorV2';

export class TableStrategy implements ExtractionStrategy {
  name = 'Table';
  priority = 95; // Highest priority for structured data

  extract(text: string, config: ExtractorConfig): Map<string, ExtractedCandidate> {
    const results = new Map<string, ExtractedCandidate>();
    
    // First, try specialized NYC cover page parsing
    const nycResults = this.extractFromNYCCoverPage(text, config);
    nycResults.forEach((candidate, fieldName) => {
      results.set(fieldName, candidate);
    });
    
    // Then try generic table parsing for other structured data
    const tables = this.extractTables(text);
    
    for (const table of tables) {
      for (const field of config.fields) {
        // Only extract if we haven't already found this field from NYC parsing
        if (!results.has(field.name)) {
          const candidate = this.extractFieldFromTable(table, field);
          if (candidate) {
            results.set(field.name, candidate);
          }
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

  private extractFromNYCCoverPage(text: string, config: ExtractorConfig): Map<string, ExtractedCandidate> {
    const results = new Map<string, ExtractedCandidate>();
    
    // Look for NYC-style cover page with "CROSS REFERENCE DATA" section
    if (!text.includes('CROSS REFERENCE DATA') && !text.includes('ASSIGNOR/OLD LENDER')) {
      return results;
    }
    
    console.log('[TableStrategy] Detected NYC cover page format');
    
    // Extract assignor and assignee from the structured format
    const lines = text.split('\n');
    let inCrossRefSection = false;
    let assignorFound = false;
    let assigneeFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.includes('CROSS REFERENCE DATA') || line.includes('ASSIGNOR/OLD LENDER')) {
        inCrossRefSection = true;
        continue;
      }
      
      if (inCrossRefSection) {
        // Stop if we hit another section
        if (line.match(/^[A-Z\s]{10,}$/) && !line.includes('ASSIGNOR') && !line.includes('ASSIGNEE') && 
            !line.includes('MORTGAGE ELECTRONIC') && !line.includes('LLC')) {
          break;
        }
        
        // Look for assignor (MERS)
        if (!assignorFound && line.includes('MORTGAGE ELECTRONIC REGISTRATION')) {
          const assignorField = config.fields.find(f => f.name === 'assignor');
          if (assignorField) {
            results.set('assignor', {
              value: 'MORTGAGE ELECTRONIC REGISTRATION SYSTEMS, INC.',
              confidence: 0.98,
              strategy: this.name,
              justification: 'Found MERS in NYC cover page CROSS REFERENCE DATA'
            });
            assignorFound = true;
            console.log('[TableStrategy] Found assignor: MERS');
          }
        }
        
        // Look for assignee (LLC/company names)
        if (!assigneeFound && line.match(/[A-Z]+\d+.*LLC/i)) {
          const assigneeMatch = line.match(/([A-Z]+\d+[^,]*LLC)/i);
          if (assigneeMatch) {
            const assigneeField = config.fields.find(f => f.name === 'assignee');
            if (assigneeField) {
              results.set('assignee', {
                value: assigneeMatch[1].trim(),
                confidence: 0.98,
                strategy: this.name,
                justification: 'Found LLC entity in NYC cover page CROSS REFERENCE DATA'
              });
              assigneeFound = true;
              console.log('[TableStrategy] Found assignee:', assigneeMatch[1]);
            }
          }
        }
        
        // Also check for other LLC patterns
        if (!assigneeFound && line.match(/LLC/i) && !line.includes('MORTGAGE ELECTRONIC')) {
          const llcMatch = line.match(/([A-Z][A-Za-z0-9\s,]+LLC[^,]*)/i);
          if (llcMatch) {
            const cleaned = llcMatch[1].trim().replace(/,.*$/, ''); // Remove trailing address
            if (cleaned.length < 50) { // Reasonable company name length
              const assigneeField = config.fields.find(f => f.name === 'assignee');
              if (assigneeField) {
                results.set('assignee', {
                  value: cleaned,
                  confidence: 0.95,
                  strategy: this.name,
                  justification: 'Found LLC entity in NYC cover page'
                });
                assigneeFound = true;
                console.log('[TableStrategy] Found assignee (fallback):', cleaned);
              }
            }
          }
        }
        
        // Break if we found both
        if (assignorFound && assigneeFound) {
          break;
        }
      }
    }
    
    return results;
  }
}