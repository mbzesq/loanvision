import { Router } from 'express';
import multer from 'multer';
import pool from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import { AzureDocumentService } from '../ocr/azureDocumentClient';
import { DocumentClassifier } from '../ml/documentClassifier';
import { FieldExtractor } from '../extraction/fieldExtractor';
import { s3Service } from '../services/s3Service';
import { ocrEnhancementService } from '../services/ocrEnhancementService';
import { collateralAnalysisService } from '../services/collateralAnalysisService';

const router = Router();

// Configure multer for memory storage (no file persistence)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Initialize services (lazy initialization for Azure)
let azureDocumentService: AzureDocumentService | null = null;
const documentClassifier = new DocumentClassifier();
const fieldExtractor = new FieldExtractor();

// Helper to get Azure service with lazy initialization
const getAzureService = () => {
  if (!azureDocumentService) {
    try {
      azureDocumentService = new AzureDocumentService();
    } catch (error) {
      console.error('[DocumentAnalysis] Failed to initialize Azure service:', error);
      throw new Error('Document analysis service is not available. Please check Azure configuration.');
    }
  }
  return azureDocumentService;
};

// Test endpoint to check Azure configuration
router.get('/test-azure-config', authenticateToken, async (req, res) => {
  try {
    const config = {
      hasEndpoint: !!process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
      hasKey: !!process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY,
      endpointLength: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.length || 0,
      keyLength: process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY?.length || 0,
      nodeEnv: process.env.NODE_ENV,
    };
    
    res.json({
      status: 'Configuration Check',
      azureConfig: config,
      message: config.hasEndpoint && config.hasKey 
        ? 'Azure Document Intelligence credentials appear to be configured' 
        : 'Azure Document Intelligence credentials are missing'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/loans/:loanId/analyze-document
router.post('/:loanId/analyze-document', authenticateToken, upload.single('document'), async (req, res) => {
  const { loanId } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const startTime = Date.now();
  let s3Result: { key: string; bucket: string; url: string } | undefined;

  try {
    console.log(`Starting document analysis for ${file.originalname} (loan: ${loanId})`);

    // Step 1: Upload original to S3 for temporary processing
    console.log('Step 1: Uploading document to S3 for processing...');
    s3Result = await s3Service.uploadDocument(
      loanId,
      file.originalname,
      file.buffer,
      'pending' // Will update with actual type after classification
    );
    console.log(`Document uploaded to S3 for processing: ${s3Result.key}`);

    // Step 2: Enhance PDF for better OCR (if available)
    console.log('Step 2: Enhancing PDF for OCR...');
    let processBuffer = file.buffer;
    
    // Temporary: Disable OCR enhancement to test if original PDFs work with Textract
    const DISABLE_OCR_ENHANCEMENT = process.env.DISABLE_OCR_ENHANCEMENT === 'true';
    
    if (DISABLE_OCR_ENHANCEMENT) {
      console.log('OCR enhancement disabled via environment variable, using original PDF');
    } else {
      try {
        const isEnhancementAvailable = await ocrEnhancementService.isEnhancementAvailable();
        if (isEnhancementAvailable) {
          const enhancedBuffer = await ocrEnhancementService.enhancePDF(file.buffer, file.originalname);
          processBuffer = enhancedBuffer;
          console.log('PDF enhancement completed successfully');
        } else {
          console.log('OCR enhancement not available, using original PDF');
        }
      } catch (enhancementError) {
        console.warn('OCR enhancement failed, using original PDF:', enhancementError);
        // Continue with original buffer
      }
    }

    // Step 3: OCR with Azure Document Intelligence
    console.log('Step 3: Running OCR with Azure Document Intelligence...');
    const ocrResult = await getAzureService().analyzeDocument(processBuffer);
    console.log(`OCR completed. Extracted ${ocrResult.text.length} characters with ${ocrResult.keyValuePairs.size} key-value pairs`);

    // Step 4: Classify document type
    console.log('Step 4: Classifying document...');
    const classification = await documentClassifier.classify(ocrResult);
    console.log(`Document classified as ${classification.documentType} with confidence ${classification.confidence.toFixed(4)}`);

    // Step 5: Extract fields based on document type
    console.log('Step 5: Extracting fields...');
    const extractedFields = await fieldExtractor.extractFields(ocrResult, classification.documentType);
    console.log(`Extracted ${extractedFields.fieldConfidence.size} fields`);

    // Step 6: Save to database
    const processingTime = Date.now() - startTime;
    
    const insertQuery = `
      INSERT INTO document_analysis(
        loan_id,
        file_name,
        document_type,
        confidence_score,
        property_street,
        property_city,
        property_state,
        property_zip,
        borrower_name,
        co_borrower_name,
        loan_amount,
        origination_date,
        lender_name,
        assignor,
        assignee,
        assignment_date,
        recording_date,
        instrument_number,
        ocr_text_blob,
        extraction_metadata,
        processing_time_ms,
        file_size_bytes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *;
    `;

    // Build extraction metadata
    const extractionMetadata = {
      fieldConfidence: Object.fromEntries(extractedFields.fieldConfidence),
      classificationScores: Object.fromEntries(classification.scores),
      ocrConfidence: ocrResult.confidence,
      keyValuePairCount: ocrResult.keyValuePairs.size,
      processingTime,
    };

    const result = await pool.query(insertQuery, [
      loanId,
      file.originalname,
      classification.documentType,
      classification.confidence,
      extractedFields.propertyStreet,
      extractedFields.propertyCity,
      extractedFields.propertyState,
      extractedFields.propertyZip,
      extractedFields.borrowerName,
      extractedFields.coBorrowerName,
      extractedFields.loanAmount,
      extractedFields.originationDate,
      extractedFields.lenderName,
      extractedFields.assignor,
      extractedFields.assignee,
      extractedFields.assignmentDate,
      extractedFields.recordingDate,
      extractedFields.instrumentNumber,
      ocrResult.text, // Store full OCR text for debugging
      JSON.stringify(extractionMetadata),
      processingTime,
      file.size,
    ]);

    const savedDocument = result.rows[0];

    // Step 7: Flag low-confidence fields for QA
    await flagLowConfidenceFields(savedDocument.id, extractedFields);

    // Step 8: Enhanced Collateral Analysis - validate fields and update chain
    try {
      await collateralAnalysisService.analyzeDocument(
        loanId,
        savedDocument.id,
        extractedFields,
        classification.documentType,
        classification.confidence
      );
      console.log(`Enhanced collateral analysis completed for document ${savedDocument.id}`);
    } catch (analysisError) {
      console.warn('Enhanced collateral analysis failed (non-critical):', analysisError);
      // Don't fail the request for analysis issues
    }

    // Step 9: Clean up temporary S3 storage (data now extracted to database)
    try {
      await s3Service.deleteDocument(s3Result.key);
      console.log(`Cleaned up temporary S3 file: ${s3Result.key}`);
    } catch (cleanupError) {
      console.warn('Failed to cleanup S3 file (non-critical):', cleanupError);
      // Don't fail the request for cleanup issues
    }

    // Clear the buffer to free memory (security measure)
    file.buffer = Buffer.alloc(0);

    console.log(`Document analysis completed in ${processingTime}ms`);

    // Return structured response
    res.json({
      success: true,
      document: {
        id: savedDocument.id,
        fileName: savedDocument.file_name,
        documentType: savedDocument.document_type,
        confidence: savedDocument.confidence_score,
        fields: {
          property: {
            street: savedDocument.property_street,
            city: savedDocument.property_city,
            state: savedDocument.property_state,
            zip: savedDocument.property_zip,
          },
          borrower: {
            name: savedDocument.borrower_name,
            coBorrowerName: savedDocument.co_borrower_name,
          },
          loan: {
            amount: savedDocument.loan_amount,
            originationDate: savedDocument.origination_date,
            lender: savedDocument.lender_name,
          },
          assignment: {
            assignor: savedDocument.assignor,
            assignee: savedDocument.assignee,
            date: savedDocument.assignment_date,
            recordingDate: savedDocument.recording_date,
            instrumentNumber: savedDocument.instrument_number,
          },
        },
        metadata: extractionMetadata,
        processingTimeMs: processingTime,
      },
    });

  } catch (error: unknown) {
    console.error('Document analysis failed:', error);
    
    // Cleanup S3 file on error to prevent orphaned files
    if (s3Result && s3Result.key) {
      try {
        await s3Service.deleteDocument(s3Result.key);
        console.log(`Cleaned up S3 file after error: ${s3Result.key}`);
      } catch (cleanupError) {
        console.warn('Failed to cleanup S3 file after error:', cleanupError);
      }
    }
    
    // Clear the buffer even on error (security measure)
    if (file && file.buffer) {
      file.buffer = Buffer.alloc(0);
    }

    res.status(500).json({
      error: 'Document analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/v2/loans/:loanId/analyzed-documents
router.get('/:loanId/analyzed-documents', authenticateToken, async (req, res) => {
  const { loanId } = req.params;

  try {
    const query = `
      SELECT 
        id,
        file_name,
        document_type,
        confidence_score,
        property_street,
        property_city,
        property_state,
        property_zip,
        borrower_name,
        co_borrower_name,
        loan_amount,
        origination_date,
        lender_name,
        assignor,
        assignee,
        assignment_date,
        recording_date,
        instrument_number,
        extraction_metadata,
        processing_time_ms,
        created_at
      FROM document_analysis
      WHERE loan_id = $1
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(query, [loanId]);

    res.json({
      success: true,
      loanId,
      documents: result.rows,
      count: result.rows.length,
    });

  } catch (error: unknown) {
    console.error('Failed to fetch analyzed documents:', error);
    res.status(500).json({
      error: 'Failed to fetch analyzed documents',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/v2/loans/:loanId/collateral
// This endpoint is expected by the frontend for viewing collateral documents
router.get('/:loanId/collateral', authenticateToken, async (req, res) => {
  const { loanId } = req.params;

  try {
    // For now, we'll return the analyzed documents grouped by type
    // This provides compatibility with the frontend expectation
    const query = `
      SELECT 
        id,
        file_name,
        document_type,
        confidence_score,
        property_street,
        property_city,
        property_state,
        property_zip,
        borrower_name,
        co_borrower_name,
        loan_amount,
        origination_date,
        lender_name,
        assignor,
        assignee,
        assignment_date,
        recording_date,
        instrument_number,
        extraction_metadata,
        processing_time_ms,
        created_at
      FROM document_analysis
      WHERE loan_id = $1
      ORDER BY document_type, created_at DESC;
    `;

    const result = await pool.query(query, [loanId]);

    // Group documents by type for easier frontend consumption
    const documentsByType = result.rows.reduce((acc: any, doc: any) => {
      const type = doc.document_type.toLowerCase().replace(' ', '_');
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(doc);
      return acc;
    }, {});

    // Calculate collateral completeness
    const hasNote = documentsByType.note && documentsByType.note.length > 0;
    const hasMortgage = (documentsByType.security_instrument || documentsByType.mortgage || 
                        documentsByType.deed_of_trust) ? true : false;
    const hasAssignments = documentsByType.assignment && documentsByType.assignment.length > 0;
    
    const completeness = {
      hasNote,
      hasMortgage,
      hasAssignments,
      percentComplete: Math.round(((hasNote ? 33 : 0) + (hasMortgage ? 33 : 0) + (hasAssignments ? 34 : 0))),
      missingDocuments: [
        !hasNote && 'Note',
        !hasMortgage && 'Mortgage/Deed of Trust',
        !hasAssignments && 'Assignment(s)'
      ].filter(Boolean)
    };

    res.json({
      success: true,
      loanId,
      documents: result.rows,
      documentsByType,
      completeness,
      totalDocuments: result.rows.length,
    });

  } catch (error: unknown) {
    console.error('Failed to fetch collateral documents:', error);
    res.status(500).json({
      error: 'Failed to fetch collateral documents',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/v2/loans/:loanId/collateral-status
// Enhanced collateral status with validation and chain analysis
router.get('/:loanId/collateral-status', authenticateToken, async (req, res) => {
  const { loanId } = req.params;

  try {
    console.log(`🔍 Fetching enhanced collateral status for loan: ${loanId}`);
    
    const collateralStatus = await collateralAnalysisService.getCollateralStatus(loanId);
    
    res.json({
      success: true,
      loanId,
      status: collateralStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Failed to fetch collateral status:', error);
    res.status(500).json({
      error: 'Failed to fetch collateral status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Note: Document download removed - files are processed and cleaned up automatically
// All extracted data is stored in the database, eliminating need for file storage

// Helper function to flag low-confidence fields
async function flagLowConfidenceFields(
  documentAnalysisId: number, 
  extractedFields: any
): Promise<void> {
  const lowConfidenceThreshold = 0.7;
  const flagPromises: Promise<any>[] = [];

  extractedFields.fieldConfidence.forEach((confidence: number, fieldName: string) => {
    if (confidence < lowConfidenceThreshold) {
      const fieldValue = extractedFields[fieldName];
      
      const insertQuery = `
        INSERT INTO document_analysis_qa_flags(
          document_analysis_id,
          field_name,
          field_value,
          confidence_score,
          flag_reason
        )
        VALUES ($1, $2, $3, $4, $5);
      `;

      flagPromises.push(
        pool.query(insertQuery, [
          documentAnalysisId,
          fieldName,
          fieldValue?.toString() || null,
          confidence,
          `Low confidence score: ${confidence.toFixed(4)}`,
        ])
      );
    }
  });

  if (flagPromises.length > 0) {
    await Promise.all(flagPromises);
    console.log(`Flagged ${flagPromises.length} low-confidence fields for QA`);
  }
}

export default router;