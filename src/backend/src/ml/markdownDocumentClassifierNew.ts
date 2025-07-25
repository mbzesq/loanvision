import { DocumentType, EndorsementChain, ClassificationResult } from './documentClassifier';

interface MarkdownPattern {
  headerPatterns: RegExp[];
  highWeightKeywords: string[];
  mediumWeightKeywords: string[];
  tableHeaders?: string[];
  sectionHeaders?: string[];
  negativeKeywords?: string[];
  entityPatterns?: {
    [entityName: string]: {
      regex: RegExp;
      weight: number;
    }
  }
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

export class MarkdownDocumentClassifierNew {
  // BALANCE: Adjusted thresholds to be more realistic for all document types.
  private readonly CONFIDENCE_THRESHOLDS = {
    [DocumentType.NOTE]: 20, // Lowered to accommodate diverse Note formats
    [DocumentType.SECURITY_INSTRUMENT]: 25,
    [DocumentType.ASSIGNMENT]: 25,
    [DocumentType.OTHER]: 10,
  };

  private readonly patterns: Record<DocumentType, MarkdownPattern> = {
    [DocumentType.NOTE]: {
      headerPatterns: [
        /^#+\s*(PROMISSORY NOTE|NOTE|ADJUSTABLE RATE NOTE|CREDIT AGREEMENT)/im, 
        /^\*\*(PROMISSORY NOTE|NOTE|ADJUSTABLE RATE NOTE|CREDIT AGREEMENT)\*\*/im
      ],
      highWeightKeywords: [
        'promissory note', 'promise to pay', 'principal amount', 'interest rate', 'maturity date', 
        'maker', 'note holder', 'principal sum', 'for value received', 'credit agreement', 
        'home equity credit line', 'adjustable rate note', 'loan agreement', 'credit line agreement',
        'disclosure statement', 'periodic rate', 'annual percentage rate', 'loan no', 'loan date',
        'credit line account', 'borrower promise', 'loan terms', 'payment terms',
        'pay to the order of', 'without recourse', 'allonge'
      ],
      mediumWeightKeywords: [
        'borrower', 'lender', 'payment', 'monthly installment', 'due date', 'loan', 'debt', 
        'interest', 'term', 'principal', 'credit line', 'line of credit', 'account', 'disclosure',
        'balance', 'amount', 'rate', 'monthly', 'maturity', 'loan number', 'case number',
        'property address', 'secured by', 'collateral', 'default', 'acceleration',
        'endorsement', 'bearer', 'holder', 'transfer'
      ],
      negativeKeywords: ['assignment of mortgage', 'assignor', 'assignee', 'aom', 'recorded assignment'],
      entityPatterns: {
        currency: { regex: /\$[\d,]+(?:\.\d{2})?/g, weight: 4 },
        dates: { regex: /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, weight: 2 },
        percentages: { regex: /\d+(?:\.\d+)?%/g, weight: 3 }
      }
    },
    [DocumentType.SECURITY_INSTRUMENT]: {
      headerPatterns: [/^#+\s*(MORTGAGE|DEED OF TRUST|SECURITY DEED|THIS DEED OF TRUST)/im],
      highWeightKeywords: [
        'mortgage', 'deed of trust', 'security interest', 'real property', 'legal description', 
        'mortgagor', 'mortgagee', 'trustor', 'trustee', 'beneficiary', 'foreclosure',
        'security instrument', 'grant of mortgage', 'this mortgage dated', 'grantor is',
        'trustee is', 'borrower covenants', 'power of sale'
      ],
      mediumWeightKeywords: [
        'collateral', 'secured', 'property', 'real estate', 'lien', 'covenants', 'premises',
        'reconveyance', 'encumbrance', 'borrower', 'note dated'
      ],
      sectionHeaders: ['DEFINITIONS', 'TRANSFER OF RIGHTS', 'BORROWER COVENANTS'],
      negativeKeywords: ['assignment of mortgage', 'assignor', 'assignee', 'allonge to', 'release of lien'],
      entityPatterns: {
        currency: { regex: /\$[\d,]+(?:\.\d{2})?/g, weight: 3 },
        legalDescriptions: { regex: /lot\s+\d+|block\s+\d+|section\s+\d+/gi, weight: 2 }
      }
    },
    [DocumentType.ASSIGNMENT]: {
      headerPatterns: [
        /^#+\s*(ASSIGNMENT OF MORTGAGE|ASSIGNMENT|CORPORATE ASSIGNMENT|AOM)/im,
        /recorded\s+assignment/im
      ],
      // BALANCE: Expanded high-weight keywords significantly.
      highWeightKeywords: [
        'assignment of mortgage', 'assigns and transfers', 'assignor', 'assignee',
        'for value received, hereby grants', 'mortgage dated', 'recorded in',
        'hereby assigns and transfers', 'security instrument', 'aom', 'mers',
        'recorded assignment', 'successor in interest', 'together with the note',
        'hereby grants, assigns and transfers'
      ],
      // BALANCE: Expanded medium-weight keywords.
      mediumWeightKeywords: [
        'successor', 'benefit', 'recording date', 'instrument number', 'all right, title and interest',
        'mortgage loan', 'servicing rights', 'notarized', 'acknowledged', 'county clerk',
        'recorded', 'transfer', 'convey', 'assign'
      ],
      negativeKeywords: ['allonge to', 'pay to the order of'],
      // BALANCE: Added new entity patterns for financial data and legal formalities.
      entityPatterns: {
        dates: { regex: /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, weight: 3 },
        recordingNumbers: { regex: /(?:recording|instrument)\s*#?\s*[\d\-]{5,}/gi, weight: 4 },
        mortgageAmounts: { regex: /\$[\d,]+(?:\.\d{2})?/g, weight: 2 },
        notaryAcknowledgment: { regex: /notary public|acknowledged before me/gi, weight: 3 }
      }
    },
    [DocumentType.OTHER]: {
      headerPatterns: [],
      highWeightKeywords: [],
      mediumWeightKeywords: [],
      negativeKeywords: [],
      entityPatterns: {}
    }
  };

  async classify(markdown: string): Promise<ClassificationResult> {
    const scores = new Map<DocumentType, number>();
    const cleanText = this.stripMarkdown(markdown).toLowerCase();
    const sections = this.parseMarkdownSections(markdown);
    const tables = this.extractTables(markdown);
    
    console.log(`[NewClassifier] Analyzing ${markdown.length} chars, ${cleanText.split(/\s+/).length} words`);
    
    for (const docType of Object.keys(this.patterns) as DocumentType[]) {
      const pattern = this.patterns[docType];
      const score = this.calculateMarkdownScore(markdown, cleanText, sections, tables, pattern, docType);
      scores.set(docType, score);
    }

    return this.calculateConfidenceAndEndorsements(markdown, scores);
  }

  private calculateMarkdownScore(
    markdown: string,
    cleanText: string,
    sections: MarkdownSection[],
    tables: MarkdownTable[],
    pattern: MarkdownPattern,
    docType: DocumentType
  ): number {
    const wordCount = cleanText.split(/\s+/).length;
    if (wordCount < 20) return 0;

    let weightedKeywordScore = 0;
    const matchedKeywords: string[] = [];
    
    for (const keyword of pattern.highWeightKeywords) {
      const matches = (cleanText.match(new RegExp(`\\b${keyword}\\b`, 'gi')) || []).length;
      if (matches > 0) {
        weightedKeywordScore += matches * 5;
        matchedKeywords.push(`HIGH: "${keyword}" x${matches}`);
      }
    }
    
    for (const keyword of pattern.mediumWeightKeywords) {
      const matches = (cleanText.match(new RegExp(`\\b${keyword}\\b`, 'gi')) || []).length;
      if (matches > 0) {
        weightedKeywordScore += matches * 1;
        matchedKeywords.push(`MED: "${keyword}" x${matches}`);
      }
    }
    
    const keywordDensityScore = (weightedKeywordScore / wordCount) * 100;

    let entityScore = 0;
    const entityMatches: string[] = [];
    if (pattern.entityPatterns) {
      for (const [entityName, { regex, weight }] of Object.entries(pattern.entityPatterns)) {
        const matches = (cleanText.match(regex) || []).length;
        if (matches > 0) {
          entityScore += matches * weight;
          entityMatches.push(`${entityName}: x${matches} (weight ${weight})`);
        }
      }
    }

    let baseScore = keywordDensityScore + entityScore;

    // Apply multipliers
    const firstLines = markdown.substring(0, 500);
    if (pattern.headerPatterns?.some(p => p.test(firstLines))) {
      baseScore *= 1.4;
      console.log(`[NewClassifier] ${docType} - Header match found, multiplier 1.4x`);
    }
    
    // Special boost for strong assignment indicators
    if (docType === DocumentType.ASSIGNMENT) {
      const strongAssignmentIndicators = ['assignor', 'assignee', 'mers', 'aom'];
      const indicatorCount = strongAssignmentIndicators.filter(indicator => 
        cleanText.includes(indicator)
      ).length;
      if (indicatorCount >= 2) {
        baseScore *= 1.5;
        console.log(`[NewClassifier] ${docType} - Strong assignment indicators (${indicatorCount}), multiplier 1.5x`);
      }
    }
    
    // Special boost for strong note indicators
    if (docType === DocumentType.NOTE) {
      const strongNoteIndicators = ['promissory note', 'promise to pay', 'note holder', 'principal amount'];
      const indicatorCount = strongNoteIndicators.filter(indicator => 
        cleanText.includes(indicator)
      ).length;
      if (indicatorCount >= 2) {
        baseScore *= 1.3;
        console.log(`[NewClassifier] ${docType} - Strong note indicators (${indicatorCount}), multiplier 1.3x`);
      }
      
      // Special handling for endorsement-heavy documents (standalone allonges)
      const endorsementIndicators = ['pay to the order of', 'without recourse', 'allonge'];
      const endorsementCount = endorsementIndicators.filter(indicator => 
        cleanText.includes(indicator)
      ).length;
      if (endorsementCount >= 2 && wordCount < 300) {
        baseScore *= 1.8;
        console.log(`[NewClassifier] ${docType} - Endorsement-heavy document (${endorsementCount} indicators, ${wordCount} words), multiplier 1.8x`);
      }
    }
    
    if (pattern.sectionHeaders?.some(sh => sections.some(s => s.heading.toLowerCase().includes(sh.toLowerCase())))) {
      baseScore *= 1.1;
    }
    
    if (pattern.negativeKeywords?.some(nk => cleanText.includes(nk))) {
      baseScore *= 0.1;
      console.log(`[NewClassifier] ${docType} - Negative keyword penalty applied`);
    }

    console.log(`[NewClassifier] ${docType} scoring:`);
    console.log(`  - Keyword density: ${keywordDensityScore.toFixed(2)}`);
    console.log(`  - Entity score: ${entityScore}`);
    console.log(`  - Final score: ${baseScore.toFixed(2)}`);
    if (matchedKeywords.length > 0) {
      console.log(`  - Matched keywords: ${matchedKeywords.slice(0, 5).join(', ')}${matchedKeywords.length > 5 ? '...' : ''}`);
    }
    if (entityMatches.length > 0) {
      console.log(`  - Entity matches: ${entityMatches.join(', ')}`);
    }

    return baseScore;
  }
  
  private calculateConfidenceAndEndorsements(markdown: string, scores: Map<DocumentType, number>): ClassificationResult {
    let predictedType = DocumentType.OTHER;
    let maxScore = -1;

    for (const [docType, score] of scores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        predictedType = docType;
      }
    }

    // FIX: Correctly handle the zero-score case
    if (maxScore <= 0) {
      const endorsementAnalysis = this.analyzeEndorsementChain(markdown);
      return { 
        documentType: DocumentType.OTHER, 
        confidence: 0.0, 
        scores,
        hasEndorsements: endorsementAnalysis.hasEndorsements,
        endorsementCount: endorsementAnalysis.count,
        endorsementChain: endorsementAnalysis.chain,
        endsWithCurrentInvestor: endorsementAnalysis.endsWithCurrentInvestor,
        endsInBlank: endorsementAnalysis.endsInBlank
      };
    }

    const threshold = this.CONFIDENCE_THRESHOLDS[predictedType];
    const confidence = Math.min(maxScore / threshold, 1.0);

    if (confidence < 0.5) { // 50% confidence floor
      predictedType = DocumentType.OTHER;
    }

    // Enhanced endorsement analysis for all document types
    const endorsementAnalysis = this.analyzeEndorsementChain(markdown);
    
    console.log(`[NewClassifier] Final prediction: ${predictedType} with confidence ${confidence.toFixed(3)}`);
    if (endorsementAnalysis.hasEndorsements) {
      console.log(`[NewClassifier] Found ${endorsementAnalysis.count} endorsements, ends with: ${endorsementAnalysis.endsInBlank ? 'BLANK' : endorsementAnalysis.endsWithCurrentInvestor ? 'CURRENT INVESTOR' : 'OTHER'}`);
    }
    
    return {
      documentType: predictedType,
      confidence: parseFloat(confidence.toFixed(2)),
      scores,
      hasEndorsements: endorsementAnalysis.hasEndorsements,
      endorsementCount: endorsementAnalysis.count,
      endorsementChain: endorsementAnalysis.chain,
      endsWithCurrentInvestor: endorsementAnalysis.endsWithCurrentInvestor,
      endsInBlank: endorsementAnalysis.endsInBlank
    };
  }

  private analyzeEndorsementChain(markdown: string): {
    hasEndorsements: boolean;
    count: number;
    chain: EndorsementChain[];
    endsWithCurrentInvestor: boolean;
    endsInBlank: boolean;
  } {
    const endorsementChain: EndorsementChain[] = [];
    const cleanText = this.stripMarkdown(markdown);
    
    // Enhanced patterns for endorsement detection
    const endorsementPatterns = [
      /PAY TO THE ORDER OF\s*([^\n]*?)(?:\s*WITHOUT RECOURSE\s*([^\n]*?))?(?=\n|$)/gi,
      /ENDORSED TO\s*([^\n]*?)(?:\s*WITHOUT RECOURSE\s*([^\n]*?))?(?=\n|$)/gi,
      /FOR DEPOSIT ONLY\s*([^\n]*?)(?=\n|$)/gi
    ];
    
    let sequenceNumber = 1;
    
    for (const pattern of endorsementPatterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      
      while ((match = pattern.exec(cleanText)) !== null) {
        const endorsementText = match[0].trim();
        const endorseeText = match[1]?.trim() || '';
        
        const isBlank = !endorseeText || endorseeText === '' || 
                       endorseeText.toLowerCase().includes('blank') ||
                       endorseeText.toLowerCase().includes('bearer');
        
        endorsementChain.push({
          sequenceNumber,
          endorser: sequenceNumber === 1 ? this.extractOriginalPayee(cleanText) : 
                   endorsementChain[sequenceNumber - 2]?.endorsee,
          endorsee: isBlank ? 'BLANK' : this.cleanCompanyName(endorseeText),
          endorsementType: isBlank ? 'blank' : 'specific',
          endorsementText
        });
        
        sequenceNumber++;
      }
    }

    // Determine chain ending
    const lastEndorsement = endorsementChain.length > 0 ? endorsementChain[endorsementChain.length - 1] : null;
    const endsInBlank = lastEndorsement?.endorsementType === 'blank';
    const endsWithCurrentInvestor = lastEndorsement ? 
      this.isCurrentInvestor(lastEndorsement.endorsee || '') : false;

    return {
      hasEndorsements: endorsementChain.length > 0,
      count: endorsementChain.length,
      chain: endorsementChain,
      endsWithCurrentInvestor,
      endsInBlank
    };
  }

  private isCurrentInvestor(endorsee: string): boolean {
    // Define current investor patterns - this could be configurable
    const currentInvestorPatterns = [
      /ATC\d*\s*TRUST/i,
      /SRP\s*\d*\s*LLC/i,
      /NS\d*\s*LLC/i,
      // Add more patterns as needed
    ];
    
    return currentInvestorPatterns.some(pattern => pattern.test(endorsee));
  }

  private extractOriginalPayee(text: string): string | undefined {
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

  private parseMarkdownSections(markdown: string): MarkdownSection[] {
    const sections: MarkdownSection[] = [];
    const lines = markdown.split('\n');
    let currentSection: MarkdownSection | null = null;

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
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/```[^`]+```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\|[^|]+\|/g, ' ')
      .replace(/^[-*_]{3,}$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}