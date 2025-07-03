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
  keywords: string[];
  requiredKeywords: string[];
  negativeKeywords?: string[];
  weight: number;
}

export class DocumentClassifier {
  // Keywords and patterns for each document type
  private readonly patterns: Record<DocumentType, DocumentPattern> = {
    [DocumentType.NOTE]: {
      keywords: ['promissory note', 'promise to pay', 'principal sum', 'interest rate', 'maturity date', 'balloon note', 'borrower\'s promise to pay'],
      requiredKeywords: ['promissory note'],
      negativeKeywords: ['allonge'],
      weight: 1.2,
    },
    [DocumentType.MORTGAGE]: {
      keywords: ['mortgage', 'mortgagor', 'mortgagee', 'this mortgage', 'mortgage deed', 'security instrument'],
      requiredKeywords: ['mortgage'],
      negativeKeywords: ['assignment of mortgage', 'deed of trust'],
      weight: 1.2,
    },
    [DocumentType.DEED_OF_TRUST]: {
      keywords: ['deed of trust', 'trustor', 'trustee', 'beneficiary', 'trust deed'],
      requiredKeywords: ['deed of trust'],
      negativeKeywords: ['mortgagee', 'mortgagor'],
      weight: 1.2,
    },
    [DocumentType.ALLONGE]: {
      keywords: ['allonge', 'endorsement', 'pay to the order', 'without recourse'],
      requiredKeywords: ['allonge'],
      weight: 1.2, // Higher weight as it's often a shorter document
    },
    [DocumentType.ASSIGNMENT]: {
      keywords: ['assignment', 'assignor', 'assignee', 'hereby assigns', 'assignment of mortgage', 'assignment of deed'],
      requiredKeywords: ['assignment'],
      weight: 1.2, // Further increased weight to help with longer documents
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
      const score = this.calculateScore(text, keyValues, pattern);
      scores.set(docType as DocumentType, score);
      
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
    
    // Check required keywords
    for (const required of pattern.requiredKeywords) {
      if (text.includes(required)) {
        score += 50; // High base score for required keywords
      }
    }

    // Check additional keywords
    for (const keyword of pattern.keywords) {
      if (text.includes(keyword)) {
        score += 10;
      }
    }

    // Check key-value pairs for document-specific fields
    keyValues.forEach((value, key) => {
      const keyLower = key.toLowerCase();
      
      // Bonus points for form fields that match document type
      if (pattern.keywords.some((kw: string) => keyLower.includes(kw))) {
        score += 15;
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

    // Apply document type weight
    score *= pattern.weight;

    // Normalize score based on text length (longer documents shouldn't automatically score higher)
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 0) {
      score = score / Math.log(wordCount + 1);
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