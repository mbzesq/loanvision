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

export interface ExtractionStrategy {
  name: string;
  priority: number;
  extract(text: string, config: ExtractorConfig): Map<string, ExtractedCandidate>;
}

export interface ExtractedCandidate {
  value: any;
  confidence: number;
  strategy: string;
  justification: string;
}

export interface FieldDefinition {
  name: string;
  keywords: string[];
  patterns?: string[];
  validators?: string[];
  dependencies?: string[];
  contextPatterns?: string[];
}

export interface ExtractorConfig {
  fields: FieldDefinition[];
  documentType: DocumentType;
}

export interface ExtractionLearner {
  improveCandidates(
    candidates: Map<string, ExtractedCandidate[]>,
    feedback?: any
  ): Promise<Map<string, ExtractedCandidate>>;
}

export class MarkdownFieldExtractor {
  private strategies: ExtractionStrategy[];
  private config: ExtractorConfig;
  private learner?: ExtractionLearner;

  constructor(
    config: ExtractorConfig,
    strategies: ExtractionStrategy[],
    learner?: ExtractionLearner
  ) {
    this.config = config;
    this.strategies = strategies.sort((a, b) => b.priority - a.priority);
    this.learner = learner;
  }

  async extractFields(
    markdown: string,
    documentType: DocumentType
  ): Promise<ExtractedFields> {
    // Step 1: Parse document structure
    const sections = this.parseMarkdownSections(markdown);
    const tables = this.extractMarkdownTables(markdown);
    const cleanText = this.stripMarkdown(markdown);

    // Step 2: Collect candidates from all strategies
    const allCandidates = new Map<string, ExtractedCandidate[]>();

    for (const strategy of this.strategies) {
      try {
        // For strategies that can benefit from markdown structure, pass the original
        // For simple pattern matching, use clean text
        const useMarkdown = ['RobustAssignment', 'Table'].includes(strategy.name);
        const textToUse = useMarkdown ? markdown : cleanText;
        
        if (useMarkdown) {
          console.log(`[Extractor] Passing original markdown to ${strategy.name} strategy`);
        }
        
        const candidates = strategy.extract(textToUse, this.config);
        
        candidates.forEach((candidate, fieldName) => {
          if (!allCandidates.has(fieldName)) {
            allCandidates.set(fieldName, []);
          }
          allCandidates.get(fieldName)!.push(candidate);
        });
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error);
      }
    }

    // Step 3: Use learning system to improve candidates (if available)
    let finalCandidates: Map<string, ExtractedCandidate>;
    if (this.learner) {
      finalCandidates = await this.learner.improveCandidates(allCandidates);
    } else {
      // Fallback: select best candidate per field
      finalCandidates = this.selectBestCandidates(allCandidates);
    }

    // Step 4: Apply business rules and validation
    const validatedCandidates = this.applyBusinessRules(finalCandidates, cleanText);

    // Step 5: Convert to ExtractedFields format
    return this.buildExtractedFields(validatedCandidates);
  }

  private selectBestCandidates(
    allCandidates: Map<string, ExtractedCandidate[]>
  ): Map<string, ExtractedCandidate> {
    const result = new Map<string, ExtractedCandidate>();

    allCandidates.forEach((candidates, fieldName) => {
      if (candidates.length === 0) return;

      // Debug logging for assignment fields
      if (fieldName === 'assignor' || fieldName === 'assignee') {
        console.log(`[CandidateSelection] Field: ${fieldName}, Candidates:`, 
          candidates.map(c => ({ value: c.value, confidence: c.confidence, strategy: c.strategy }))
        );
      }

      // Sort by confidence and select the best
      candidates.sort((a, b) => b.confidence - a.confidence);
      result.set(fieldName, candidates[0]);
      
      if (fieldName === 'assignor' || fieldName === 'assignee') {
        console.log(`[CandidateSelection] Selected best for ${fieldName}:`, 
          { value: candidates[0].value, confidence: candidates[0].confidence, strategy: candidates[0].strategy }
        );
      }
    });

    return result;
  }

  private applyBusinessRules(
    candidates: Map<string, ExtractedCandidate>,
    text: string
  ): Map<string, ExtractedCandidate> {
    const result = new Map(candidates);

    // Example business rule: If we have assignor and assignee, they shouldn't be the same
    const assignor = result.get('assignor');
    const assignee = result.get('assignee');
    
    if (assignor && assignee && assignor.value === assignee.value) {
      // Reduce confidence for both
      assignor.confidence *= 0.5;
      assignee.confidence *= 0.5;
    }

    // Example: Validate property address components are consistent
    const street = result.get('propertyStreet');
    const city = result.get('propertyCity');
    const state = result.get('propertyState');
    
    if (street && city && state) {
      // Check if all appear together in text (increases confidence)
      const fullAddress = `${street.value} ${city.value} ${state.value}`;
      if (text.toLowerCase().includes(fullAddress.toLowerCase())) {
        street.confidence = Math.min(0.95, street.confidence + 0.1);
        city.confidence = Math.min(0.95, city.confidence + 0.1);
        state.confidence = Math.min(0.95, state.confidence + 0.1);
      }
    }

    return result;
  }

  private buildExtractedFields(
    candidates: Map<string, ExtractedCandidate>
  ): ExtractedFields {
    const fields: ExtractedFields = {
      fieldConfidence: new Map<string, number>(),
    };

    candidates.forEach((candidate, fieldName) => {
      // Set the field value
      (fields as any)[fieldName] = candidate.value;
      
      // Store confidence
      fields.fieldConfidence.set(fieldName, candidate.confidence);
    });

    return fields;
  }

  // Helper methods from original implementation
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
}