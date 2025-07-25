import { DocumentAnalysisResult } from '../ocr/azureDocumentClient';

export enum DocumentType {
  NOTE = 'Note',
  SECURITY_INSTRUMENT = 'Security Instrument',
  ASSIGNMENT = 'Assignment',
  OTHER = 'Other',
}

export interface EndorsementChain {
  sequenceNumber: number;
  endorser?: string;
  endorsee?: string;
  endorsementType: 'specific' | 'blank';
  endorsementText: string;
}

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  scores: Map<DocumentType, number>;
  // Enhanced endorsement analysis
  hasEndorsements?: boolean;
  endorsementCount?: number;
  endorsementChain?: EndorsementChain[];
  endsWithCurrentInvestor?: boolean;
  endsInBlank?: boolean;
}

interface DocumentPattern {
  highWeightKeywords: string[];
  mediumWeightKeywords: string[];
  negativeKeywords?: string[];
}

// V3.1 Minimum confidence thresholds per document type
const MIN_CONFIDENCE = {
  [DocumentType.NOTE]: 0.6,
  [DocumentType.SECURITY_INSTRUMENT]: 0.6,
  [DocumentType.ASSIGNMENT]: 0.75,
  [DocumentType.OTHER]: 0.3,
};

export class DocumentClassifier {
  // V3 Keywords and patterns for each document type with weighted groups
  private readonly patterns: Record<DocumentType, DocumentPattern> = {
    [DocumentType.NOTE]: {
      highWeightKeywords: [
        'promissory note', 'promise to pay', 'principal amount', 'interest rate', 
        'maturity date', 'maker', 'payee', 'default', 'acceleration', 
        'late charges', 'prepayment', 'for value received', 'undersigned promises', 
        'order of', 'together with interest', 'unpaid balance'
      ],
      mediumWeightKeywords: [
        'borrower', 'lender', 'payment', 'monthly installment', 'due date'
      ],
      negativeKeywords: []
    },
    [DocumentType.SECURITY_INSTRUMENT]: {
      highWeightKeywords: [
        'mortgage', 'deed of trust', 'security interest', 'real property', 
        'legal description', 'mortgagor', 'mortgagee', 'trustor', 'trustee', 
        'beneficiary', 'foreclosure', 'power of sale', 'lien', 'encumbrance'
      ],
      mediumWeightKeywords: [
        'collateral', 'secured', 'property', 'real estate', 'premises',
        'trust deed', 'reconveyance', 'trustee sale'
      ],
      negativeKeywords: ['assignment of mortgage']
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
    [DocumentType.OTHER]: {
      highWeightKeywords: [],
      mediumWeightKeywords: [],
      negativeKeywords: []
    },
  };

  async classify(ocrResult: DocumentAnalysisResult): Promise<ClassificationResult> {
    const text = ocrResult.text.toLowerCase();
    const keyValues = ocrResult.keyValuePairs;
    
    const scores = new Map<DocumentType, number>();
    let maxScore = 0;
    let predictedType = DocumentType.OTHER;

    // Score each document type
    for (const [docType, pattern] of Object.entries(this.patterns)) {
      const score = this.calculateScore(text, keyValues, pattern, docType as DocumentType);
      scores.set(docType as DocumentType, score);
      
      if (score > maxScore) {
        maxScore = score;
        predictedType = docType as DocumentType;
      }
    }

    // Calculate confidence based on score distribution
    const confidence = this.calculateConfidence(scores, predictedType);

    // V3: Use per-type confidence thresholds
    const minConfidence = MIN_CONFIDENCE[predictedType] || 0.3;
    if (confidence < minConfidence) {
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
    pattern: DocumentPattern,
    docType: DocumentType
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

    // V3 Structural Analysis: Document length-based scoring
    
    // For NOTE: V3 adjusted - lower threshold and less severe penalty
    if (docType === DocumentType.NOTE && wordCount < 300) {
      score *= 0.7;
    }
    
    // For SECURITY_INSTRUMENT: Short documents get penalized
    if (docType === DocumentType.SECURITY_INSTRUMENT && wordCount < 400) {
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
    ocrResult: DocumentAnalysisResult,
    predictedType: DocumentType,
    actualType: DocumentType
  ): Promise<void> {
    // Log feedback for model retraining
    console.log(`Classification feedback: Predicted ${predictedType}, Actual ${actualType}`);
    // In future: Update ML model weights or retrain
  }
}