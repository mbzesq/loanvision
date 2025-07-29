import { Router } from 'express';
import multer from 'multer';
import pool from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import { AzureDocumentService } from '../ocr/azureDocumentClient';
import { DocumentClassifier } from '../ml/documentClassifier';
import { FieldExtractor } from '../extraction/fieldExtractor';
import { MarkdownDocumentClassifier } from '../ml/markdownDocumentClassifier';
import { ExtractionAdapter } from '../extraction/ExtractionAdapter';
import { doctlyService } from '../services/doctlyService';
import { s3Service } from '../services/s3Service';
import { ocrEnhancementService } from '../services/ocrEnhancementService';
import { collateralAnalysisService } from '../services/collateralAnalysisService';
import organizationAccessService from '../services/organizationAccessService';

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
const markdownDocumentClassifier = new MarkdownDocumentClassifier();
const extractionAdapter = new ExtractionAdapter();

// Helper to get Azure service with lazy initialization
const getAzureService = () => {
  if (!azureDocumentService) {
    try {
      azureDocumentService = new AzureDocumentService();
    } catch (error) {
      console.error('[DocumentAnalysisV2] Failed to initialize Azure service:', error);
      throw new Error('Document analysis service is not available. Please check Azure configuration.');
    }
  }
  return azureDocumentService;
};

// POST /api/v2/documents/analyze (enhanced version)
router.post('/analyze', authenticateToken, upload.single('document'), async (req, res) => {
  const { loanId } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!loanId) {
    return res.status(400).json({ error: 'Loan ID is required' });
  }

  const startTime = Date.now();
  let s3Result: { key: string; bucket: string; url: string } | undefined;

  try {
    console.log(`[V2] Starting enhanced document analysis for ${file.originalname} (loan: ${loanId})...`);

    // Step 1: Upload original to S3 for temporary processing
    console.log('[V2] Step 1: Uploading document to S3...');
    s3Result = await s3Service.uploadDocument(
      loanId,
      file.originalname,
      file.buffer,
      'pending' // Will update with actual type after classification
    );

    // Step 2: Choose processing method (DoctlyAI vs Azure)
    const USE_DOCTLY = process.env.USE_DOCTLY !== 'false'; // Default to DoctlyAI
    let classification: any;
    let extractedFields: any;
    let processingProvider = 'azure';
    let processingMode: string | undefined;
    let processingCost = 0;
    let pageCount = 1;
    let ocrResult: any = null;

    if (USE_DOCTLY) {
      console.log('[V2] Step 2: Processing with DoctlyAI + Enhanced Extraction...');
      processingProvider = 'doctly-enhanced';

      // Process with DoctlyAI
      const doctlyResult = await doctlyService.processDocumentWithConfidence(
        file.buffer,
        file.originalname,
        async (markdown: string) => {
          const tempClassification = await markdownDocumentClassifier.classify(markdown);
          return {
            confidence: tempClassification.confidence,
            documentType: tempClassification.documentType
          };
        }
      );

      console.log(`[V2] DoctlyAI processing completed. Mode: ${doctlyResult.mode}, Cost: $${doctlyResult.cost.toFixed(4)}`);

      // Classify document from markdown
      console.log('[V2] Step 3: Classifying document from markdown...');
      classification = await markdownDocumentClassifier.classify(doctlyResult.markdown);

      // Extract fields using enhanced extraction system
      console.log('[V2] Step 4: Extracting fields with enhanced extraction system...');
      
      if (extractionAdapter.isAvailable()) {
        try {
          extractedFields = await extractionAdapter.extractFields(doctlyResult.markdown, classification.documentType);
          console.log(`[V2] Enhanced extraction completed: ${extractedFields.fieldConfidence.size} fields extracted`);
        } catch (extractionError) {
          console.warn('[V2] Enhanced extraction failed, falling back to legacy:', extractionError);
          // Fallback to legacy extraction
          const { MarkdownFieldExtractor } = await import('../extraction/markdownFieldExtractor');
          const legacyExtractor = new MarkdownFieldExtractor();
          extractedFields = await legacyExtractor.extractFields(doctlyResult.markdown, classification.documentType);
        }
      } else {
        console.warn('[V2] Enhanced extraction not available, using legacy extractor');
        const { MarkdownFieldExtractor } = await import('../extraction/markdownFieldExtractor');
        const legacyExtractor = new MarkdownFieldExtractor();
        extractedFields = await legacyExtractor.extractFields(doctlyResult.markdown, classification.documentType);
      }

      // Store processing metadata
      processingMode = doctlyResult.mode;
      processingCost = doctlyResult.cost;
      pageCount = doctlyResult.pageCount;

    } else {
      // Fallback to Azure processing
      console.log('[V2] Step 2: Processing with Azure Document Intelligence...');
      
      // OCR enhancement
      let processBuffer = file.buffer;
      const DISABLE_OCR_ENHANCEMENT = process.env.DISABLE_OCR_ENHANCEMENT === 'true';
      
      if (!DISABLE_OCR_ENHANCEMENT) {
        try {
          const isEnhancementAvailable = await ocrEnhancementService.isEnhancementAvailable();
          if (isEnhancementAvailable) {
            processBuffer = await ocrEnhancementService.enhancePDF(file.buffer, file.originalname);
            console.log('[V2] PDF enhancement completed');
          }
        } catch (enhancementError) {
          console.warn('[V2] OCR enhancement failed, using original PDF:', enhancementError);
        }
      }

      // OCR with Azure
      ocrResult = await getAzureService().analyzeDocument(processBuffer);
      classification = await documentClassifier.classify(ocrResult);
      extractedFields = await fieldExtractor.extractFields(ocrResult, classification.documentType);
    }

    // Step 5: Save to database with enhanced metadata
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

    // Build enhanced extraction metadata
    const extractionMetadata = {
      fieldConfidence: Object.fromEntries(extractedFields.fieldConfidence),
      classificationScores: Object.fromEntries(classification.scores),
      ocrConfidence: processingProvider === 'azure' && ocrResult ? ocrResult.confidence : undefined,
      keyValuePairCount: processingProvider === 'azure' && ocrResult ? ocrResult.keyValuePairs?.size : undefined,
      processingTime,
      processingProvider,
      processingMode,
      processingCost,
      enhancedExtraction: extractionAdapter.isAvailable(),
      version: 'v2'
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
      processingProvider === 'azure' && ocrResult ? ocrResult.text : '', // Store text for debugging
      JSON.stringify(extractionMetadata),
      processingTime,
      file.size
    ]);

    const savedDocument = result.rows[0];

    // Step 6: Enhanced Collateral Analysis
    try {
      await collateralAnalysisService.analyzeDocument(
        loanId,
        savedDocument.id,
        extractedFields,
        classification.documentType,
        classification.confidence
      );
      console.log(`[V2] Enhanced collateral analysis completed for document ${savedDocument.id}`);
    } catch (analysisError) {
      console.warn('[V2] Enhanced collateral analysis failed (non-critical):', analysisError);
    }

    // Step 7: Cleanup S3 file
    try {
      await s3Service.deleteDocument(s3Result.key);
      console.log(`[V2] Cleaned up S3 file: ${s3Result.key}`);
    } catch (cleanupError) {
      console.warn('[V2] Failed to cleanup S3 file:', cleanupError);
    }

    // Clear buffer for security
    file.buffer = Buffer.alloc(0);

    console.log(`[V2] Enhanced document analysis completed in ${processingTime}ms`);

    // Return enhanced response
    res.json({
      success: true,
      version: 'v2',
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
    console.error('[V2] Enhanced document analysis failed:', error);
    
    // Cleanup S3 file on error
    if (s3Result && s3Result.key) {
      try {
        await s3Service.deleteDocument(s3Result.key);
      } catch (cleanupError) {
        console.warn('[V2] Failed to cleanup S3 file after error:', cleanupError);
      }
    }
    
    // Clear buffer on error
    if (file && file.buffer) {
      file.buffer = Buffer.alloc(0);
    }

    res.status(500).json({
      error: 'Enhanced document analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      version: 'v2'
    });
  }
});

// GET /api/v2/documents/extraction-stats
router.get('/extraction-stats', authenticateToken, async (req, res) => {
  try {
    const stats = await extractionAdapter.getExtractionStats();
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: unknown) {
    console.error('[V2] Failed to get extraction stats:', error);
    res.status(500).json({
      error: 'Failed to get extraction statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;