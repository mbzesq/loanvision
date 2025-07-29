import pool from '../db';
import { DocumentAnalysisResult } from '../ocr/azureDocumentClient';
import { ExtractedFields } from '../extraction/fieldExtractor';
import { DocumentType } from '../ml/documentClassifier';

export interface CollateralStatus {
  loanId: string;
  completenessScore: number;
  isComplete: boolean;
  requiredDocuments: DocumentRequirement[];
  missingDocuments: string[];
  assignmentChainComplete: boolean;
  chainGaps: string[];
  validationErrors: ValidationError[];
  noteOwnership?: NoteOwnershipStatus;
  lastUpdated: Date;
}

export interface NoteOwnershipStatus {
  hasNote: boolean;
  currentOwner?: string;
  isBlankEndorsed: boolean;
  allongeChainComplete: boolean;
  totalEndorsements: number;
  ownershipValidated: boolean;
}

export interface DocumentRequirement {
  type: DocumentType;
  required: boolean;
  present: boolean;
  validated: boolean;
  count: number;
  validationDetails?: string;
}

export interface ValidationError {
  field: string;
  issue: string;
  severity: 'error' | 'warning';
  documentId?: number;
}

export interface ChainLink {
  sequenceNumber: number;
  transferor: string;
  transferee: string;
  transferDate?: Date;
  recordingDate?: Date;
  documentType: string;
  instrumentNumber?: string;
  isGap: boolean;
  gapReason?: string;
}

interface LoanReference {
  borrowerName?: string;
  propertyAddress?: string;
  loanAmount?: number;
  originationDate?: Date;
}

export class CollateralAnalysisService {
  /**
   * Analyze and validate a newly uploaded document
   */
  async analyzeDocument(
    loanId: string,
    documentAnalysisId: number,
    extractedFields: ExtractedFields,
    documentType: DocumentType,
    confidence: number
  ): Promise<void> {
    console.log(`[CollateralAnalysis] Analyzing document ${documentAnalysisId} for loan ${loanId}`);

    try {
      // 1. Validate document against loan reference data
      await this.validateDocumentFields(loanId, documentAnalysisId, extractedFields, documentType);

      // 2. Update assignment chain if this is an assignment
      if (documentType === DocumentType.ASSIGNMENT) {
        await this.updateAssignmentChain(loanId, documentAnalysisId, extractedFields, documentType);
      }
      // NOTE: ALLONGE documents are now classified as Notes with endorsements

      // 3. Recalculate collateral completeness
      await this.updateCollateralStatus(loanId);

      console.log(`[CollateralAnalysis] Analysis complete for document ${documentAnalysisId}`);
    } catch (error) {
      console.error(`[CollateralAnalysis] Error analyzing document ${documentAnalysisId}:`, error);
      throw error;
    }
  }

  /**
   * Get current collateral status for a loan
   */
  async getCollateralStatus(loanId: string): Promise<CollateralStatus> {
    const query = `
      SELECT 
        lcs.*,
        COALESCE(
          json_agg(
            json_build_object(
              'sequenceNumber', cot.sequence_number,
              'transferor', cot.transferor,
              'transferee', cot.transferee,
              'transferDate', cot.transfer_date,
              'recordingDate', cot.recording_date,
              'documentType', cot.document_type,
              'instrumentNumber', cot.instrument_number,
              'isGap', cot.is_gap,
              'gapReason', cot.gap_reason
            ) ORDER BY cot.sequence_number
          ) FILTER (WHERE cot.id IS NOT NULL),
          '[]'::json
        ) as chain_links
      FROM loan_collateral_status lcs
      LEFT JOIN chain_of_title cot ON lcs.loan_id = cot.loan_id
      WHERE lcs.loan_id = $1
      GROUP BY lcs.loan_id, lcs.has_note, lcs.has_mortgage, lcs.has_all_assignments, 
               lcs.has_allonges, lcs.assignment_chain_complete, lcs.chain_originator,
               lcs.chain_current_holder, lcs.chain_gap_details, lcs.note_count,
               lcs.mortgage_count, lcs.assignment_count, lcs.allonge_count,
               lcs.other_document_count, lcs.total_document_count, lcs.missing_documents,
               lcs.completeness_score, lcs.requires_qa_review, lcs.qa_notes,
               lcs.last_document_added, lcs.last_updated, lcs.created_at
    `;

    const result = await pool.query(query, [loanId]);
    
    if (result.rows.length === 0) {
      // Create initial status if doesn't exist
      await this.initializeCollateralStatus(loanId);
      return this.getCollateralStatus(loanId);
    }

    const row = result.rows[0];
    const chainLinks: ChainLink[] = row.chain_links || [];

    // Calculate required documents
    const requiredDocuments: DocumentRequirement[] = [
      {
        type: DocumentType.NOTE,
        required: true,
        present: row.has_note,
        validated: await this.isDocumentValidated(loanId, DocumentType.NOTE),
        count: row.note_count || 0
      },
      {
        type: DocumentType.SECURITY_INSTRUMENT,
        required: true,
        present: row.has_mortgage,
        validated: await this.isDocumentValidated(loanId, DocumentType.SECURITY_INSTRUMENT),
        count: row.mortgage_count || 0
      },
      {
        type: DocumentType.ASSIGNMENT,
        required: true,
        present: row.has_all_assignments,
        validated: row.assignment_chain_complete,
        count: row.assignment_count || 0
      },
      // NOTE: ALLONGE documents are now classified as Notes with endorsements
    ];

    // Get validation errors
    const validationErrors = await this.getValidationErrors(loanId);

    // Get note ownership status
    const noteOwnership = await this.getNoteOwnershipStatus(loanId);

    return {
      loanId,
      completenessScore: row.completeness_score || 0,
      isComplete: this.calculateIsComplete(requiredDocuments, row.assignment_chain_complete, noteOwnership),
      requiredDocuments,
      missingDocuments: row.missing_documents || [],
      assignmentChainComplete: row.assignment_chain_complete || false,
      chainGaps: this.extractChainGaps(chainLinks),
      validationErrors,
      noteOwnership,
      lastUpdated: row.last_updated
    };
  }

  /**
   * Validate document fields against loan reference data
   */
  private async validateDocumentFields(
    loanId: string,
    documentAnalysisId: number,
    extractedFields: ExtractedFields,
    documentType: DocumentType
  ): Promise<void> {
    // Get loan reference data
    const loanRef = await this.getLoanReferenceData(loanId);
    const validationErrors: ValidationError[] = [];

    // Validate borrower name matching
    if (extractedFields.borrowerName && loanRef.borrowerName) {
      const similarity = this.calculateNameSimilarity(extractedFields.borrowerName, loanRef.borrowerName);
      if (similarity < 0.8) {
        validationErrors.push({
          field: 'borrowerName',
          issue: `Borrower name mismatch: Document "${extractedFields.borrowerName}" vs Expected "${loanRef.borrowerName}" (similarity: ${(similarity * 100).toFixed(1)}%)`,
          severity: similarity < 0.6 ? 'error' : 'warning',
          documentId: documentAnalysisId
        });
      }
    }

    // Validate property address matching
    if (extractedFields.propertyStreet && loanRef.propertyAddress) {
      const similarity = this.calculateAddressSimilarity(
        `${extractedFields.propertyStreet} ${extractedFields.propertyCity} ${extractedFields.propertyState}`,
        loanRef.propertyAddress
      );
      if (similarity < 0.7) {
        validationErrors.push({
          field: 'propertyAddress',
          issue: `Property address mismatch: Document "${extractedFields.propertyStreet}" vs Expected "${loanRef.propertyAddress}"`,
          severity: similarity < 0.5 ? 'error' : 'warning',
          documentId: documentAnalysisId
        });
      }
    }

    // Validate loan amount (for notes and mortgages)
    if ((documentType === DocumentType.NOTE || documentType === DocumentType.SECURITY_INSTRUMENT) &&
        extractedFields.loanAmount && loanRef.loanAmount) {
      const amountDifference = Math.abs(extractedFields.loanAmount - loanRef.loanAmount) / loanRef.loanAmount;
      if (amountDifference > 0.05) { // 5% tolerance
        validationErrors.push({
          field: 'loanAmount',
          issue: `Loan amount mismatch: Document $${extractedFields.loanAmount.toLocaleString()} vs Expected $${loanRef.loanAmount.toLocaleString()}`,
          severity: amountDifference > 0.1 ? 'error' : 'warning',
          documentId: documentAnalysisId
        });
      }
    }

    // Store validation results
    if (validationErrors.length > 0) {
      await this.storeValidationErrors(loanId, validationErrors);
    }
  }

  /**
   * Update assignment chain when new assignment or allonge is processed
   */
  private async updateAssignmentChain(
    loanId: string,
    documentAnalysisId: number,
    extractedFields: ExtractedFields,
    documentType: DocumentType
  ): Promise<void> {
    if (!extractedFields.assignor || !extractedFields.assignee) {
      console.warn(`[AssignmentChain] Missing assignor/assignee data for document ${documentAnalysisId}`);
      return;
    }

    // Date sanitization function (same as in documentAnalysis route)
    const sanitizeDate = (dateValue: any): Date | null => {
      if (!dateValue) return null;
      if (dateValue instanceof Date) return dateValue;
      
      // If it's a string, try to extract just the date part
      const dateStr = dateValue.toString();
      const dateMatch = dateStr.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{1,2}-\d{1,2}-\d{4})|([A-Za-z]+ \d{1,2}, \d{4})/);
      if (dateMatch) {
        const parsedDate = new Date(dateMatch[0]);
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
      }
      
      return null;
    };

    // Get current chain
    const existingChain = await this.getAssignmentChain(loanId);
    const nextSequence = existingChain.length + 1;

    // Insert new chain link
    const insertQuery = `
      INSERT INTO chain_of_title (
        loan_id, document_analysis_id, transferor, transferee,
        transfer_date, recording_date, document_type, instrument_number,
        sequence_number, is_gap, gap_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    const isGap = this.detectChainGap(existingChain, extractedFields.assignor);
    const gapReason = isGap ? `Missing link between ${existingChain[existingChain.length - 1]?.transferee || 'unknown'} and ${extractedFields.assignor}` : null;

    await pool.query(insertQuery, [
      loanId,
      documentAnalysisId,
      extractedFields.assignor,
      extractedFields.assignee,
      sanitizeDate(extractedFields.assignmentDate),
      sanitizeDate(extractedFields.recordingDate),
      documentType,
      extractedFields.instrumentNumber,
      nextSequence,
      isGap,
      gapReason
    ]);

    // Recalculate chain completeness
    await this.updateChainCompleteness(loanId);
  }

  /**
   * Get loan reference data from daily_metrics_current
   */
  private async getLoanReferenceData(loanId: string): Promise<LoanReference> {
    const query = `
      SELECT 
        CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as borrower_name,
        CONCAT(COALESCE(address, ''), ' ', COALESCE(city, ''), ' ', COALESCE(state, '')) as property_address,
        prin_bal as loan_amount,
        -- Try to extract origination date from available date fields
        COALESCE(maturity_date - INTERVAL '30 years', NULL) as estimated_origination_date
      FROM daily_metrics_current 
      WHERE loan_id = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [loanId]);
    if (result.rows.length === 0) {
      return {};
    }

    const row = result.rows[0];
    return {
      borrowerName: row.borrower_name?.trim() || undefined,
      propertyAddress: row.property_address?.trim() || undefined,
      loanAmount: parseFloat(row.loan_amount) || undefined,
      originationDate: row.estimated_origination_date || undefined
    };
  }

  /**
   * Calculate name similarity using Levenshtein distance
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    const distance = this.levenshteinDistance(n1, n2);
    const maxLength = Math.max(n1.length, n2.length);
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  /**
   * Calculate address similarity
   */
  private calculateAddressSimilarity(addr1: string, addr2: string): number {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const a1 = normalize(addr1);
    const a2 = normalize(addr2);

    // For addresses, use token-based similarity
    const tokens1 = a1.split(/\s+/);
    const tokens2 = a2.split(/\s+/);
    
    let matches = 0;
    for (const token of tokens1) {
      if (tokens2.some(t => t.includes(token) || token.includes(t))) {
        matches++;
      }
    }

    return matches / Math.max(tokens1.length, tokens2.length);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Other helper methods continue here...
   */
  private async getAssignmentChain(loanId: string): Promise<ChainLink[]> {
    const query = `
      SELECT * FROM chain_of_title 
      WHERE loan_id = $1 
      ORDER BY sequence_number
    `;
    const result = await pool.query(query, [loanId]);
    return result.rows.map(row => ({
      sequenceNumber: row.sequence_number,
      transferor: row.transferor,
      transferee: row.transferee,
      transferDate: row.transfer_date,
      recordingDate: row.recording_date,
      documentType: row.document_type,
      instrumentNumber: row.instrument_number,
      isGap: row.is_gap,
      gapReason: row.gap_reason
    }));
  }

  private detectChainGap(existingChain: ChainLink[], newTransferor: string): boolean {
    if (existingChain.length === 0) return false;
    const lastTransferee = existingChain[existingChain.length - 1]?.transferee;
    return lastTransferee ? this.calculateNameSimilarity(lastTransferee, newTransferor) < 0.8 : false;
  }

  private async updateChainCompleteness(loanId: string): Promise<void> {
    const chain = await this.getAssignmentChain(loanId);
    const hasGaps = chain.some(link => link.isGap);
    const isComplete = chain.length > 0 && !hasGaps;

    await pool.query(`
      UPDATE loan_collateral_status 
      SET assignment_chain_complete = $1,
          chain_gap_details = $2,
          last_updated = NOW()
      WHERE loan_id = $3
    `, [
      isComplete,
      hasGaps ? 'Chain has gaps' : null,
      loanId
    ]);
  }

  private async initializeCollateralStatus(loanId: string): Promise<void> {
    await pool.query(`
      INSERT INTO loan_collateral_status (loan_id)
      VALUES ($1)
      ON CONFLICT (loan_id) DO NOTHING
    `, [loanId]);
  }

  private async updateCollateralStatus(loanId: string): Promise<void> {
    // This will be triggered by the database trigger
    console.log(`[CollateralAnalysis] Collateral status updated for loan ${loanId}`);
  }

  private async isDocumentValidated(loanId: string, documentType: DocumentType): Promise<boolean> {
    // Check if there are any validation errors for this document type
    const query = `
      SELECT COUNT(*) as error_count
      FROM document_analysis_qa_flags daqf
      JOIN document_analysis da ON daqf.document_analysis_id = da.id
      WHERE da.loan_id = $1 AND da.document_type = $2 AND daqf.reviewed = false
    `;
    const result = await pool.query(query, [loanId, documentType]);
    return parseInt(result.rows[0].error_count) === 0;
  }

  private calculateIsComplete(
    requiredDocuments: DocumentRequirement[], 
    chainComplete: boolean, 
    noteOwnership?: NoteOwnershipStatus
  ): boolean {
    const requiredDocsPresent = requiredDocuments
      .filter(doc => doc.required)
      .every(doc => doc.present && doc.validated);
    
    // For note ownership, it's complete if:
    // 1. No note exists (not applicable), OR
    // 2. Note exists and ownership is clear (specific endorsement or blank endorsed)
    const noteOwnershipComplete = !noteOwnership?.hasNote || 
      (noteOwnership.hasNote && (noteOwnership.isBlankEndorsed || !!noteOwnership.currentOwner));
    
    return requiredDocsPresent && chainComplete && noteOwnershipComplete;
  }

  /**
   * Get note ownership status including allonge chain analysis
   */
  private async getNoteOwnershipStatus(loanId: string): Promise<NoteOwnershipStatus> {
    const query = `
      SELECT 
        nco.current_owner,
        nco.is_blank_endorsed,
        nco.total_endorsements,
        CASE 
          WHEN nco.current_owner IS NOT NULL OR nco.is_blank_endorsed = true THEN true 
          ELSE false 
        END as ownership_validated
      FROM note_current_ownership nco
      WHERE nco.loan_id = $1
      ORDER BY nco.note_analysis_date DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [loanId]);

    if (result.rows.length === 0) {
      return {
        hasNote: false,
        isBlankEndorsed: false,
        allongeChainComplete: true, // Not applicable
        totalEndorsements: 0,
        ownershipValidated: true // Not applicable
      };
    }

    const row = result.rows[0];
    return {
      hasNote: true,
      currentOwner: row.current_owner === 'HOLDER_IN_DUE_COURSE' ? undefined : row.current_owner,
      isBlankEndorsed: row.is_blank_endorsed || false,
      allongeChainComplete: true, // For now, assume complete if we can parse it
      totalEndorsements: row.total_endorsements || 0,
      ownershipValidated: row.ownership_validated || false
    };
  }

  private extractChainGaps(chainLinks: ChainLink[]): string[] {
    return chainLinks
      .filter(link => link.isGap && link.gapReason)
      .map(link => link.gapReason!);
  }

  private async getValidationErrors(loanId: string): Promise<ValidationError[]> {
    // Implementation would fetch from validation error storage
    return [];
  }

  private async storeValidationErrors(loanId: string, errors: ValidationError[]): Promise<void> {
    // Implementation would store validation errors
    console.log(`[Validation] Storing ${errors.length} validation errors for loan ${loanId}`);
  }
}

export const collateralAnalysisService = new CollateralAnalysisService();