import { Router } from 'express';
import multer from 'multer';
import pool from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import { TextractService } from '../ocr/textractClient';
import { DocumentClassifier } from '../ml/documentClassifier';
import { FieldExtractor } from '../extraction/fieldExtractor';

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

// Initialize services
const textractService = new TextractService();
const documentClassifier = new DocumentClassifier();
const fieldExtractor = new FieldExtractor();

// POST /api/v2/loans/:loanId/analyze-document
router.post('/:loanId/analyze-document', authenticateToken, upload.single('document'), async (req, res) => {
  const { loanId } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const startTime = Date.now();

  try {
    console.log(`Starting document analysis for ${file.originalname} (loan: ${loanId})`);

    // Step 1: OCR with Textract
    console.log('Step 1: Running OCR...');
    const textractResult = await textractService.analyzeDocument(file.buffer);
    console.log(`OCR completed. Extracted ${textractResult.text.length} characters with ${textractResult.keyValuePairs.size} key-value pairs`);

    // Step 2: Classify document type
    console.log('Step 2: Classifying document...');
    const classification = await documentClassifier.classify(textractResult);
    console.log(`Document classified as ${classification.documentType} with confidence ${classification.confidence.toFixed(4)}`);

    // Step 3: Extract fields based on document type
    console.log('Step 3: Extracting fields...');
    const extractedFields = await fieldExtractor.extractFields(textractResult, classification.documentType);
    console.log(`Extracted ${extractedFields.fieldConfidence.size} fields`);

    // Step 4: Save to database
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
        processing_time_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *;
    `;

    // Build extraction metadata
    const extractionMetadata = {
      fieldConfidence: Object.fromEntries(extractedFields.fieldConfidence),
      classificationScores: Object.fromEntries(classification.scores),
      ocrConfidence: textractResult.confidence,
      keyValuePairCount: textractResult.keyValuePairs.size,
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
      textractResult.text, // Store full OCR text for debugging
      JSON.stringify(extractionMetadata),
      processingTime,
    ]);

    const savedDocument = result.rows[0];

    // Step 5: Flag low-confidence fields for QA
    await flagLowConfidenceFields(savedDocument.id, extractedFields);

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

  } catch (error) {
    console.error('Document analysis failed:', error);
    
    // Clear the buffer even on error (security measure)
    if (file && file.buffer) {
      file.buffer = Buffer.alloc(0);
    }

    res.status(500).json({
      error: 'Document analysis failed',
      details: error.message,
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

  } catch (error) {
    console.error('Failed to fetch analyzed documents:', error);
    res.status(500).json({
      error: 'Failed to fetch analyzed documents',
      details: error.message,
    });
  }
});

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