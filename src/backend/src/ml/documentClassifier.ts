import { TextractResult } from '../ocr/textractClient';

export enum DocumentType {
  NOTE = 'Note',
  MORTGAGE = 'Mortgage',
  DEED_OF_TRUST = 'Deed of Trust',
  ALLONGE = 'Allonge',
  ASSIGNMENT = 'Assignment',
  OTHER = 'Other',
}

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  scores: Map<DocumentType, number>;
}

interface DocumentPattern {
  highWeightKeywords: string[];
  mediumWeightKeywords: string[];
  negativeKeywords?: string[];
}

export class DocumentClassifier {
  // V2 Keywords and patterns for each document type with weighted groups
  private readonly patterns: Record<DocumentType, DocumentPattern> = {
    [DocumentType.NOTE]: {
      highWeightKeywords: [
        'promissory note', 'promise to pay', 'principal amount', 'interest rate', 
        'maturity date', 'maker', 'payee', 'default', 'acceleration', 
        'late charges', 'prepayment'
      ],
      mediumWeightKeywords: [
        'borrower', 'lender', 'payment', 'monthly installment', 'due date'
      ],
      negativeKeywords: ['allonge']
    },
    [DocumentType.MORTGAGE]: {
      highWeightKeywords: [
        'mortgage', 'deed of trust', 'security interest', 'real property', 
        'legal description', 'mortgagor', 'mortgagee', 'trustee', 'beneficiary', 
        'foreclosure', 'power of sale', 'lien', 'encumbrance'
      ],
      mediumWeightKeywords: [
        'collateral', 'secured', 'property', 'real estate', 'premises'
      ],
      negativeKeywords: ['assignment of mortgage']
    },
    [DocumentType.DEED_OF_TRUST]: {
      // Deed of Trust will be handled by the Mortgage pattern
      highWeightKeywords: [],
      mediumWeightKeywords: [],
      negativeKeywords: []
    },
    [DocumentType.ALLONGE]: {
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
      highWeightKeywords: [
        'assignment', 'assign', 'transfer', 'convey', 'assignor', 'assignee', 
        'all right, title and interest', 'mortgage loan', 'servicing rights'
      ],
      mediumWeightKeywords: [
        'successor', 'benefit', 'binding', 'heirs and assigns'
      ],
      negativeKeywords: []
    },
  };

  async classify(textractResult: TextractResult): Promise<ClassificationResult> {
    const text = textractResult.text.toLowerCase();
    const keyValues = textractResult.keyValuePairs;
    
    const scores = new Map<DocumentType, number>();
    let maxScore = 0;
    let predictedType = DocumentType.OTHER;

    // Score each document type
    for (const [docType, pattern] of Object.entries(this.patterns)) {
      // Skip DEED_OF_TRUST as it's handled by MORTGAGE pattern
      if (docType === DocumentType.DEED_OF_TRUST) {
        scores.set(docType as DocumentType, 0);
        continue;
      }
      
      const score = this.calculateScore(text, keyValues, pattern);
      scores.set(docType as DocumentType, score);
      
      // Handle MORTGAGE also setting DEED_OF_TRUST score
      if (docType === DocumentType.MORTGAGE) {
        // Check if this is specifically a Deed of Trust
        if (text.includes('deed of trust') || text.includes('trustor') || text.includes('trustee')) {
          scores.set(DocumentType.DEED_OF_TRUST, score * 1.1); // Slightly higher for deed of trust
          if (score * 1.1 > maxScore) {
            maxScore = score * 1.1;
            predictedType = DocumentType.DEED_OF_TRUST;
          }
        }
      }
      
      if (score > maxScore) {
        maxScore = score;
        predictedType = docType as DocumentType;
      }
    }

    // Calculate confidence based on score distribution
    const confidence = this.calculateConfidence(scores, predictedType);

    // Default to OTHER if confidence is too low
    if (confidence < 0.3) {
      predictedType = DocumentType.OTHER;
    }

    return {
      documentType: predictedType,
      confidence,
      scores,
    };
  }

  private calculateScore(
    text: string, 
    keyValues: Map<string, string>, 
    pattern: DocumentPattern
  ): number {
    let score = 0;
    const wordCount = text.split(/\s+/).length;
    
    // V2 Scoring: High weight keywords (25 points each)
    for (const keyword of pattern.highWeightKeywords) {
      if (text.includes(keyword)) {
        score += 25;
      }
    }

    // V2 Scoring: Medium weight keywords (10 points each)
    for (const keyword of pattern.mediumWeightKeywords) {
      if (text.includes(keyword)) {
        score += 10;
      }
    }

    // Check key-value pairs for document-specific fields
    keyValues.forEach((value, key) => {
      const keyLower = key.toLowerCase();
      
      // Bonus points for form fields that match high weight keywords
      if (pattern.highWeightKeywords.some((kw: string) => keyLower.includes(kw))) {
        score += 15;
      }
      // Smaller bonus for medium weight keywords
      else if (pattern.mediumWeightKeywords.some((kw: string) => keyLower.includes(kw))) {
        score += 7;
      }
    });

    // Apply negative keyword penalties
    if (pattern.negativeKeywords) {
      for (const negativeKeyword of pattern.negativeKeywords) {
        if (text.includes(negativeKeyword)) {
          score *= 0.2; // Significant penalty for negative keywords
        }
      }
    }

    // V2 Structural Analysis: Document length-based scoring
    // For ALLONGE: Short documents get a bonus
    if (pattern.highWeightKeywords.includes('allonge') && wordCount < 350) {
      score *= 1.5;
    }
    
    // For NOTE and MORTGAGE: Short documents get penalized
    if ((pattern.highWeightKeywords.includes('promissory note') || 
         pattern.highWeightKeywords.includes('mortgage')) && 
        wordCount < 400) {
      score *= 0.5;
    }

    return score;
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
    
    // Also factor in the absolute score
    const absoluteConfidence = Math.min(maxScore / 100, 1);
    
    // Weighted average of relative and absolute confidence
    return 0.6 * relativeConfidence + 0.4 * absoluteConfidence;
  }

  // Method to update classifier with feedback (for future ML improvement)
  async updateWithFeedback(
    textractResult: TextractResult,
    predictedType: DocumentType,
    actualType: DocumentType
  ): Promise<void> {
    // Log feedback for model retraining
    console.log(`Classification feedback: Predicted ${predictedType}, Actual ${actualType}`);
    // In future: Update ML model weights or retrain
  }
}