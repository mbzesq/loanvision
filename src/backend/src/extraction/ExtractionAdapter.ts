import { DocumentType } from '../ml/documentClassifier';
import { 
  MarkdownFieldExtractor,
  ExtractorConfig,
  ExtractionStrategy,
  ExtractedFields
} from './markdownFieldExtractorV2';
import { TableStrategy } from './strategies/TableStrategy';
import { KeyValueStrategy } from './strategies/KeyValueStrategy';
import { PatternStrategy } from './strategies/PatternStrategy';
import { ContextStrategy } from './strategies/ContextStrategy';
import { RobustAssignmentStrategy } from './strategies/RobustAssignmentStrategy';
import { SimpleExtractionLearner } from './SimpleExtractionLearner';
import * as fs from 'fs';
import * as path from 'path';

export class ExtractionAdapter {
  private extractor: MarkdownFieldExtractor | null = null;
  private config: ExtractorConfig | null = null;

  constructor() {
    this.initializeExtractor();
  }

  private initializeExtractor(): void {
    try {
      // Load field configuration
      const configPath = path.join(__dirname, 'field-config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      const fieldConfig = JSON.parse(configData);

      // Create base config
      this.config = {
        fields: fieldConfig.fields,
        documentType: DocumentType.OTHER // Will be set per request
      };

      // Initialize strategies
      const strategies: ExtractionStrategy[] = [
        new RobustAssignmentStrategy(), // Highest priority for assignment extraction
        new TableStrategy(),
        new KeyValueStrategy(),
        new PatternStrategy(),
        new ContextStrategy()
      ];

      // Initialize learner
      const learner = new SimpleExtractionLearner();

      // Create extractor
      this.extractor = new MarkdownFieldExtractor(this.config, strategies, learner);

      console.log('✅ Enhanced extraction system initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize enhanced extraction system:', error);
      // Fall back to null - will use legacy extractor
    }
  }

  async extractFields(
    markdown: string,
    documentType: DocumentType
  ): Promise<ExtractedFields> {
    
    if (!this.extractor || !this.config) {
      throw new Error('Enhanced extraction system not available');
    }

    // Update config for this document type
    this.config.documentType = documentType;

    // Filter fields based on document type
    const relevantFields = this.getRelevantFields(documentType);
    this.config.fields = relevantFields;

    // Extract fields
    return await this.extractor.extractFields(markdown, documentType);
  }

  private getRelevantFields(documentType: DocumentType): Array<{name: string, keywords: string[], patterns?: string[], validators?: string[], dependencies?: string[], contextPatterns?: string[]}> {
    if (!this.config) return [];

    const allFields = this.config.fields;
    
    // Define field relevance by document type
    const fieldRelevance: Record<DocumentType, string[]> = {
      [DocumentType.NOTE]: [
        'borrowerName', 'coBorrowerName', 'loanAmount', 'originationDate', 
        'lenderName', 'propertyStreet', 'propertyCity', 'propertyState', 'propertyZip'
      ],
      [DocumentType.SECURITY_INSTRUMENT]: [
        'borrowerName', 'coBorrowerName', 'loanAmount', 'originationDate',
        'lenderName', 'propertyStreet', 'propertyCity', 'propertyState', 'propertyZip'
      ],
      [DocumentType.ASSIGNMENT]: [
        'assignor', 'assignee', 'assignmentDate', 'recordingDate', 'instrumentNumber',
        'propertyStreet', 'propertyCity', 'propertyState', 'propertyZip'
      ],
      [DocumentType.OTHER]: [] // All fields
    };

    const relevantFieldNames = fieldRelevance[documentType] || [];
    
    if (relevantFieldNames.length === 0) {
      return allFields; // Return all fields for OTHER type
    }

    return allFields.filter(field => relevantFieldNames.includes(field.name));
  }

  // Method to check if enhanced extraction is available
  isAvailable(): boolean {
    return this.extractor !== null && this.config !== null;
  }

  // Method to get extraction statistics
  async getExtractionStats(): Promise<any> {
    // Could be used for monitoring extraction performance
    return {
      available: this.isAvailable(),
      strategiesCount: 4,
      fieldsConfigured: this.config?.fields.length || 0
    };
  }
}