import { DocumentType } from './documentClassifier';

export interface EnhancedClassificationResult {
  documentType: DocumentType;
  confidence: number;
  scores: Map<DocumentType, number>;
  hasEmbeddedAllonges?: boolean;
  allongeCount?: number;
  allongeChain?: AllongeEndorsement[];
}

export interface AllongeEndorsement {
  sequenceNumber: number;
  endorser?: string; // "From" party (may be blank for the first endorsement)
  endorsee?: string; // "To" party ("blank" if endorsed in blank)
  endorsementType: 'specific' | 'blank'; // specific to named party or blank
  endorsementText: string; // Raw text of the endorsement
}

interface MarkdownPattern {
  headerPatterns: RegExp[];
  highWeightKeywords: string[];
  mediumWeightKeywords: string[];
  tableHeaders?: string[];
  sectionHeaders?: string[];
  negativeKeywords?: string[];
}

interface MarkdownSection {
  level: number;
  heading: string;
  content: string;
}

interface MarkdownTable {
  headers: string[];
  rows: string[][];
}

// Minimum confidence thresholds per document type
const MIN_CONFIDENCE = {
  [DocumentType.NOTE]: 0.6,
  [DocumentType.SECURITY_INSTRUMENT]: 0.6,
  [DocumentType.ASSIGNMENT]: 0.75,
  [DocumentType.ALLONGE]: 0.75,
  [DocumentType.OTHER]: 0.3,
};

export class MarkdownDocumentClassifier {
  private readonly patterns: Record<DocumentType, MarkdownPattern> = {
    [DocumentType.NOTE]: {
      headerPatterns: [
        /^#+\s*(PROMISSORY NOTE|NOTE)/im,
        /^\*\*(PROMISSORY NOTE|NOTE)\*\*/im,
        /^(PROMISSORY NOTE|NOTE)$/im
      ],
      highWeightKeywords: [
        'promissory note', 'promise to pay', 'principal amount', 'interest rate', 
        'maturity date', 'maker', 'payee', 'default', 'acceleration', 
        'late charges', 'prepayment', 'for value received', 'undersigned promises', 
        'order of', 'together with interest', 'unpaid balance'
      ],
      mediumWeightKeywords: [
        'borrower', 'lender', 'payment', 'monthly installment', 'due date'
      ],
      tableHeaders: ['Principal Amount', 'Interest Rate', 'Maturity Date', 'Loan Amount'],
      negativeKeywords: ['allonge', 'assignment of']
    },
    [DocumentType.SECURITY_INSTRUMENT]: {
      headerPatterns: [
        /^#+\s*(MORTGAGE|DEED OF TRUST|SECURITY DEED)/im,
        /^\*\*(MORTGAGE|DEED OF TRUST|SECURITY DEED)\*\*/im,
        /^(MORTGAGE|DEED OF TRUST|SECURITY DEED)$/im
      ],
      highWeightKeywords: [
        'mortgage', 'deed of trust', 'security interest', 'real property', 
        'legal description', 'mortgagor', 'mortgagee', 'trustor', 'trustee', 
        'beneficiary', 'foreclosure', 'power of sale', 'lien', 'encumbrance',
        'grant of mortgage', 'this mortgage dated'
      ],
      mediumWeightKeywords: [
        'collateral', 'secured', 'property', 'real estate', 'premises',
        'trust deed', 'reconveyance', 'trustee sale'
      ],
      sectionHeaders: ['DEFINITIONS', 'TRANSFER OF RIGHTS', 'BORROWER COVENANTS', 'GRANT OF MORTGAGE'],
      tableHeaders: ['Property Address', 'Legal Description', 'Tax ID'],
      negativeKeywords: ['assignment of mortgage', 'allonge']
    },
    [DocumentType.ALLONGE]: {
      headerPatterns: [
        /^#+\s*(ALLONGE)/im,
        /^\*\*(ALLONGE)\*\*/im,
        /^(ALLONGE)$/im
      ],
      highWeightKeywords: [
        'allonge', 'endorsement', 'indorsement', 'pay to the order of', 
        'without recourse', 'with recourse', 'blank endorsement', 
        'special endorsement', 'attached hereto', 'affixed'
      ],
      mediumWeightKeywords: [
        'transfer', 'negotiate', 'bearer', 'holder'
      ],
      negativeKeywords: []
    },
    [DocumentType.ASSIGNMENT]: {
      headerPatterns: [
        /^#+\s*(ASSIGNMENT)/im,
        /^\*\*(ASSIGNMENT)\*\*/im,
        /^(ASSIGNMENT)$/im
      ],
      highWeightKeywords: [
        'assignment', 'assign', 'transfer', 'convey', 'assignor', 'assignee', 
        'all right, title and interest', 'mortgage loan', 'servicing rights',
        'assignment of mortgage', 'hereby assigns'
      ],
      mediumWeightKeywords: [
        'successor', 'benefit', 'binding', 'heirs and assigns'
      ],
      tableHeaders: ['Assignor', 'Assignee', 'Recording Date', 'Instrument Number'],
      negativeKeywords: []
    },
    [DocumentType.OTHER]: {
      headerPatterns: [],
      highWeightKeywords: [],
      mediumWeightKeywords: [],
      negativeKeywords: []
    }
  };

  async classify(markdown: string): Promise<EnhancedClassificationResult> {
    const scores = new Map<DocumentType, number>();
    let maxScore = 0;
    let predictedType = DocumentType.OTHER;

    // Parse markdown structure
    const sections = this.parseMarkdownSections(markdown);
    const tables = this.extractTables(markdown);
    const cleanText = this.stripMarkdown(markdown).toLowerCase();

    // Score each document type
    for (const [docType, pattern] of Object.entries(this.patterns)) {
      const score = this.calculateMarkdownScore(
        markdown,
        cleanText,
        sections,
        tables,
        pattern,
        docType as DocumentType
      );
      scores.set(docType as DocumentType, score);
      
      if (score > maxScore) {
        maxScore = score;
        predictedType = docType as DocumentType;
      }
    }

    // Calculate confidence based on score distribution
    const confidence = this.calculateConfidence(scores, predictedType);

    // Use per-type confidence thresholds
    const minConfidence = MIN_CONFIDENCE[predictedType] || 0.3;
    if (confidence < minConfidence) {
      predictedType = DocumentType.OTHER;
    }

    // Detect embedded allonges (especially in Notes)
    const allongeAnalysis = this.detectEmbeddedAllonges(markdown, predictedType);

    return {
      documentType: predictedType,
      confidence,
      scores,
      hasEmbeddedAllonges: allongeAnalysis.hasAllonges,
      allongeCount: allongeAnalysis.count,
      allongeChain: allongeAnalysis.chain
    };
  }

  private detectEmbeddedAllonges(markdown: string, documentType: DocumentType): {
    hasAllonges: boolean;
    count: number;
    chain: AllongeEndorsement[];
  } {
    // Only look for embedded allonges in Notes and standalone Allonges
    if (documentType !== DocumentType.NOTE && documentType !== DocumentType.ALLONGE) {
      return { hasAllonges: false, count: 0, chain: [] };
    }

    const allongeChain: AllongeEndorsement[] = [];
    const cleanText = this.stripMarkdown(markdown);
    
    // Pattern to find "Pay to the Order Of" endorsements
    const payToOrderPattern = /PAY TO THE ORDER OF\s*([^\n]*?)(?:\s*WITHOUT RECOURSE\s*([^\n]*?))?(?=\n|$)/gi;
    
    let match;
    let sequenceNumber = 1;
    
    while ((match = payToOrderPattern.exec(cleanText)) !== null) {
      const endorsementText = match[0].trim();
      const endorseeText = match[1].trim();
      
      // Determine if this is a blank endorsement or specific endorsement
      const isBlank = !endorseeText || endorseeText === '' || endorseeText.toLowerCase().includes('blank');
      
      allongeChain.push({
        sequenceNumber,
        endorser: sequenceNumber === 1 ? this.extractOriginalPayee(cleanText) : allongeChain[sequenceNumber - 2]?.endorsee,
        endorsee: isBlank ? 'BLANK' : this.cleanCompanyName(endorseeText),
        endorsementType: isBlank ? 'blank' : 'specific',
        endorsementText
      });
      
      sequenceNumber++;
    }

    return {
      hasAllonges: allongeChain.length > 0,
      count: allongeChain.length,
      chain: allongeChain
    };
  }

  private extractOriginalPayee(text: string): string | undefined {
    // Try to find the original payee from the note text
    const payeePatterns = [
      /payable to[:\s]+([^,\n]+)/i,
      /pay to[:\s]+([^,\n]+)/i,
      /promises to pay[^,]*to[:\s]+([^,\n]+)/i
    ];

    for (const pattern of payeePatterns) {
      const match = text.match(pattern);
      if (match) {
        return this.cleanCompanyName(match[1]);
      }
    }

    return undefined;
  }

  private cleanCompanyName(name: string): string {
    return name
      .replace(/[,.]?\s*(LLC|L\.L\.C\.|Inc|Corp|Corporation|Company|Co\.?|N\.A\.)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateMarkdownScore(
    markdown: string,
    cleanText: string,
    sections: MarkdownSection[],
    tables: MarkdownTable[],
    pattern: MarkdownPattern,
    docType: DocumentType
  ): number {
    let score = 0;
    const wordCount = cleanText.split(/\s+/).length;
    
    // Header matching (highest weight - 40 points)
    if (pattern.headerPatterns?.some(p => p.test(markdown))) {
      score += 40;
    }

    // Section header matching (30 points each)
    if (pattern.sectionHeaders) {
      for (const sectionHeader of pattern.sectionHeaders) {
        if (sections.some(s => s.heading.toLowerCase().includes(sectionHeader.toLowerCase()))) {
          score += 30;
        }
      }
    }
    
    // Table header matching (20 points each)
    if (pattern.tableHeaders) {
      for (const tableHeader of pattern.tableHeaders) {
        if (tables.some(t => 
          t.headers.some(h => h.toLowerCase().includes(tableHeader.toLowerCase()))
        )) {
          score += 20;
        }
      }
    }
    
    // High weight keywords (25 points each)
    for (const keyword of pattern.highWeightKeywords) {
      if (cleanText.includes(keyword)) {
        score += 25;
      }
    }

    // Medium weight keywords (10 points each)
    for (const keyword of pattern.mediumWeightKeywords) {
      if (cleanText.includes(keyword)) {
        score += 10;
      }
    }

    // Apply negative keyword penalties
    if (pattern.negativeKeywords) {
      for (const negativeKeyword of pattern.negativeKeywords) {
        if (cleanText.includes(negativeKeyword)) {
          score *= 0.2; // Significant penalty
        }
      }
    }

    // Structural analysis based on document type
    if (docType === DocumentType.ALLONGE && wordCount < 350) {
      score *= 1.5; // Allonges are typically short
    }
    
    if (docType === DocumentType.NOTE && wordCount < 300) {
      score *= 0.7; // Notes should have some substance
    }
    
    if (docType === DocumentType.SECURITY_INSTRUMENT && wordCount < 400) {
      score *= 0.5; // Mortgages are typically longer
    }

    // Boost score if document has clear structure (headers + sections)
    if (sections.length > 3) {
      score *= 1.2;
    }

    return score;
  }

  private parseMarkdownSections(markdown: string): MarkdownSection[] {
    const sections: MarkdownSection[] = [];
    const lines = markdown.split('\n');
    let currentSection: MarkdownSection | null = null;

    for (const line of lines) {
      // Check for markdown headers
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

  private extractTables(markdown: string): MarkdownTable[] {
    const tables: MarkdownTable[] = [];
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
      // Remove headers
      .replace(/^#+\s+/gm, '')
      // Remove emphasis
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Remove code blocks
      .replace(/```[^`]+```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove tables
      .replace(/\|[^|]+\|/g, ' ')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateConfidence(scores: Map<DocumentType, number>, predictedType: DocumentType): number {
    const allScores = Array.from(scores.values());
    const maxScore = Math.max(...allScores);
    
    if (maxScore === 0) return 0;

    // Calculate confidence based on score separation
    const secondHighest = allScores
      .filter(s => s < maxScore)
      .reduce((max, s) => Math.max(max, s), 0);
    
    const separation = maxScore - secondHighest;
    const relativeConfidence = separation / maxScore;
    
    // Factor in absolute score
    const absoluteConfidence = Math.min(maxScore / 200, 1); // Adjusted for higher scores
    
    // Weighted average
    return 0.6 * relativeConfidence + 0.4 * absoluteConfidence;
  }
}