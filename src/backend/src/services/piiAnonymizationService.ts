import { Pool } from 'pg';
import crypto from 'crypto';

interface AnonymizationMapping {
  id: string;
  original_value: string;
  anonymized_value: string;
  field_type: 'name' | 'address' | 'ssn' | 'phone' | 'email' | 'other';
  created_at: Date;
  expires_at: Date;
}

interface PIIField {
  type: 'name' | 'address' | 'ssn' | 'phone' | 'email' | 'other';
  value: string;
  context?: string; // e.g., 'borrower_name', 'property_address'
}

interface AnonymizationResult {
  anonymizedText: string;
  mappings: AnonymizationMapping[];
}

interface DeAnonymizationResult {
  originalText: string;
  mappingsUsed: string[];
}

export class PIIAnonymizationService {
  private pool: Pool;
  private encryptionKey: string;
  private mappingCache: Map<string, AnonymizationMapping> = new Map();
  private reverseMappingCache: Map<string, AnonymizationMapping> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
    this.encryptionKey = process.env.PII_ENCRYPTION_KEY || this.generateEncryptionKey();
    
    if (!process.env.PII_ENCRYPTION_KEY) {
      console.warn('⚠️ PII_ENCRYPTION_KEY not set in environment. Generated temporary key for session.');
    }
  }

  /**
   * Generate a secure encryption key for PII anonymization
   */
  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a secure hash for anonymization mapping lookup
   */
  private createMappingHash(originalValue: string, fieldType: string): string {
    const hmac = crypto.createHmac('sha256', this.encryptionKey);
    hmac.update(`${fieldType}:${originalValue}`);
    return hmac.digest('hex');
  }

  /**
   * Generate anonymized placeholder for a given PII type
   */
  private generateAnonymizedValue(fieldType: string, context?: string): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    
    switch (fieldType) {
      case 'name':
        return `PERSON_${random.toUpperCase()}`;
      case 'address':
        return `ADDRESS_${random.toUpperCase()}`;
      case 'ssn':
        return `SSN_${random.toUpperCase()}`;
      case 'phone':
        return `PHONE_${random.toUpperCase()}`;
      case 'email':
        return `EMAIL_${random.toUpperCase()}`;
      default:
        return `PII_${random.toUpperCase()}`;
    }
  }

  /**
   * Store anonymization mapping in database
   */
  private async storeMapping(mapping: Omit<AnonymizationMapping, 'id' | 'created_at' | 'expires_at'>): Promise<AnonymizationMapping> {
    const mappingId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
    
    const result = await this.pool.query(`
      INSERT INTO ai_pii_mappings (
        id, original_value_hash, anonymized_value, field_type, 
        created_at, expires_at
      ) VALUES ($1, $2, $3, $4, NOW(), $5)
      ON CONFLICT (original_value_hash, field_type) DO UPDATE SET
        expires_at = EXCLUDED.expires_at
      RETURNING *
    `, [
      mappingId,
      this.createMappingHash(mapping.original_value, mapping.field_type),
      mapping.anonymized_value,
      mapping.field_type,
      expiresAt
    ]);

    const storedMapping: AnonymizationMapping = {
      id: result.rows[0].id,
      original_value: mapping.original_value,
      anonymized_value: result.rows[0].anonymized_value,
      field_type: result.rows[0].field_type,
      created_at: result.rows[0].created_at,
      expires_at: result.rows[0].expires_at
    };

    // Cache the mapping
    this.mappingCache.set(mapping.original_value, storedMapping);
    this.reverseMappingCache.set(storedMapping.anonymized_value, storedMapping);

    return storedMapping;
  }

  /**
   * Retrieve anonymization mapping from database or cache
   */
  private async getMapping(originalValue: string, fieldType: string): Promise<AnonymizationMapping | null> {
    // Check cache first
    const cached = this.mappingCache.get(originalValue);
    if (cached && cached.expires_at > new Date()) {
      return cached;
    }

    // Query database
    const hash = this.createMappingHash(originalValue, fieldType);
    const result = await this.pool.query(`
      SELECT * FROM ai_pii_mappings 
      WHERE original_value_hash = $1 AND field_type = $2 
      AND expires_at > NOW()
    `, [hash, fieldType]);

    if (result.rows.length === 0) {
      return null;
    }

    const mapping: AnonymizationMapping = {
      id: result.rows[0].id,
      original_value: originalValue,
      anonymized_value: result.rows[0].anonymized_value,
      field_type: result.rows[0].field_type,
      created_at: result.rows[0].created_at,
      expires_at: result.rows[0].expires_at
    };

    // Update cache
    this.mappingCache.set(originalValue, mapping);
    this.reverseMappingCache.set(mapping.anonymized_value, mapping);

    return mapping;
  }

  /**
   * Retrieve mapping by anonymized value
   */
  private async getReverseMapping(anonymizedValue: string): Promise<AnonymizationMapping | null> {
    // Check cache first
    const cached = this.reverseMappingCache.get(anonymizedValue);
    if (cached && cached.expires_at > new Date()) {
      return cached;
    }

    // Query database
    const result = await this.pool.query(`
      SELECT * FROM ai_pii_mappings 
      WHERE anonymized_value = $1 AND expires_at > NOW()
    `, [anonymizedValue]);

    if (result.rows.length === 0) {
      return null;
    }

    const mapping: AnonymizationMapping = {
      id: result.rows[0].id,
      original_value: '', // We don't store original values in plain text
      anonymized_value: result.rows[0].anonymized_value,
      field_type: result.rows[0].field_type,
      created_at: result.rows[0].created_at,
      expires_at: result.rows[0].expires_at
    };

    return mapping;
  }

  /**
   * Anonymize a single PII field
   */
  async anonymizeField(field: PIIField): Promise<AnonymizationMapping> {
    // Check if we already have a mapping for this value
    let mapping = await this.getMapping(field.value, field.type);
    
    if (!mapping) {
      // Create new mapping
      const anonymizedValue = this.generateAnonymizedValue(field.type, field.context);
      mapping = await this.storeMapping({
        original_value: field.value,
        anonymized_value: anonymizedValue,
        field_type: field.type
      });
    }

    return mapping;
  }

  /**
   * Anonymize text containing multiple PII fields
   */
  async anonymizeText(text: string, piiFields: PIIField[]): Promise<AnonymizationResult> {
    let anonymizedText = text;
    const mappings: AnonymizationMapping[] = [];

    // Sort fields by length (longest first) to avoid partial replacements
    const sortedFields = piiFields.sort((a, b) => b.value.length - a.value.length);

    for (const field of sortedFields) {
      const mapping = await this.anonymizeField(field);
      mappings.push(mapping);

      // Replace all occurrences of the original value with the anonymized value
      const regex = new RegExp(this.escapeRegExp(field.value), 'gi');
      anonymizedText = anonymizedText.replace(regex, mapping.anonymized_value);
    }

    return { anonymizedText, mappings };
  }

  /**
   * Anonymize loan data for AI processing
   */
  async anonymizeLoanData(loanData: any[]): Promise<{
    anonymizedData: any[];
    mappings: AnonymizationMapping[];
  }> {
    const allMappings: AnonymizationMapping[] = [];
    const anonymizedData = [];

    for (const loan of loanData) {
      const piiFields: PIIField[] = [];
      
      // Extract PII fields from loan data
      if (loan.borrower_name) {
        piiFields.push({ type: 'name', value: loan.borrower_name, context: 'borrower_name' });
      }
      
      if (loan.co_borrower_name) {
        piiFields.push({ type: 'name', value: loan.co_borrower_name, context: 'co_borrower_name' });
      }
      
      if (loan.property_address) {
        piiFields.push({ type: 'address', value: loan.property_address, context: 'property_address' });
      }
      
      if (loan.borrower_ssn) {
        piiFields.push({ type: 'ssn', value: loan.borrower_ssn, context: 'borrower_ssn' });
      }
      
      if (loan.borrower_phone) {
        piiFields.push({ type: 'phone', value: loan.borrower_phone, context: 'borrower_phone' });
      }
      
      if (loan.borrower_email) {
        piiFields.push({ type: 'email', value: loan.borrower_email, context: 'borrower_email' });
      }

      // Create anonymized version of the loan
      const anonymizedLoan = { ...loan };
      
      for (const field of piiFields) {
        const mapping = await this.anonymizeField(field);
        allMappings.push(mapping);
        
        // Replace PII in the loan object
        const fieldKey = field.context || 'unknown';
        if (fieldKey in anonymizedLoan) {
          anonymizedLoan[fieldKey] = mapping.anonymized_value;
        }
      }
      
      anonymizedData.push(anonymizedLoan);
    }

    return { anonymizedData, mappings: allMappings };
  }

  /**
   * De-anonymize response text back to original values
   */
  async deAnonymizeText(text: string, mappings: AnonymizationMapping[]): Promise<DeAnonymizationResult> {
    let originalText = text;
    const mappingsUsed: string[] = [];

    // Sort mappings by anonymized value length (longest first)
    const sortedMappings = mappings.sort((a, b) => b.anonymized_value.length - a.anonymized_value.length);

    for (const mapping of sortedMappings) {
      const regex = new RegExp(this.escapeRegExp(mapping.anonymized_value), 'gi');
      
      if (regex.test(originalText)) {
        originalText = originalText.replace(regex, mapping.original_value);
        mappingsUsed.push(mapping.id);
      }
    }

    return { originalText, mappingsUsed };
  }

  /**
   * Clean up expired mappings
   */
  async cleanupExpiredMappings(): Promise<number> {
    const result = await this.pool.query(`
      DELETE FROM ai_pii_mappings 
      WHERE expires_at < NOW()
    `);

    // Clear cache
    this.mappingCache.clear();
    this.reverseMappingCache.clear();

    console.log(`🧹 Cleaned up ${result.rowCount} expired PII mappings`);
    return result.rowCount || 0;
  }

  /**
   * Get anonymization statistics
   */
  async getAnonymizationStats(): Promise<{
    totalMappings: number;
    mappingsByType: Record<string, number>;
    oldestMapping: Date | null;
    newestMapping: Date | null;
  }> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_mappings,
        field_type,
        COUNT(*) as type_count,
        MIN(created_at) as oldest_mapping,
        MAX(created_at) as newest_mapping
      FROM ai_pii_mappings 
      WHERE expires_at > NOW()
      GROUP BY field_type
    `);

    const mappingsByType: Record<string, number> = {};
    let totalMappings = 0;
    let oldestMapping: Date | null = null;
    let newestMapping: Date | null = null;

    for (const row of result.rows) {
      mappingsByType[row.field_type] = parseInt(row.type_count);
      totalMappings += parseInt(row.type_count);
      
      if (!oldestMapping || row.oldest_mapping < oldestMapping) {
        oldestMapping = row.oldest_mapping;
      }
      
      if (!newestMapping || row.newest_mapping > newestMapping) {
        newestMapping = row.newest_mapping;
      }
    }

    return {
      totalMappings,
      mappingsByType,
      oldestMapping,
      newestMapping
    };
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Validate that text contains no PII (for testing)
   */
  async validateNoPII(text: string): Promise<{
    isClean: boolean;
    potentialPII: string[];
  }> {
    const potentialPII: string[] = [];
    
    // Common PII patterns
    const patterns = [
      { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
      { name: 'Phone', regex: /\b\d{3}-\d{3}-\d{4}\b/g },
      { name: 'Email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
      { name: 'Address', regex: /\b\d+\s+[A-Za-z0-9\s,]+\s+(Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b/gi }
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern.regex);
      if (matches) {
        potentialPII.push(...matches.map(match => `${pattern.name}: ${match}`));
      }
    }

    return {
      isClean: potentialPII.length === 0,
      potentialPII
    };
  }
}