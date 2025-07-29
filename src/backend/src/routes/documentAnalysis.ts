import { Router } from 'express';
import multer from 'multer';
import pool from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import { AzureDocumentService } from '../ocr/azureDocumentClient';
import { DocumentClassifier } from '../ml/documentClassifier';
import { FieldExtractor } from '../extraction/fieldExtractor';
import { MarkdownDocumentClassifier } from '../ml/markdownDocumentClassifier';
import { MarkdownFieldExtractor } from '../extraction/markdownFieldExtractor';
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
const markdownFieldExtractor = new MarkdownFieldExtractor();
const enhancedExtractionAdapter = new ExtractionAdapter();

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
      console.log('Step 2: Processing with DoctlyAI...');
      processingProvider = 'doctly';

      // Process with intelligent mode selection
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

      console.log(`DoctlyAI processing completed. Mode: ${doctlyResult.mode}, Cost: $${doctlyResult.cost.toFixed(4)}, Confidence: ${doctlyResult.finalConfidence.toFixed(4)}`);

      // Classify document from markdown
      console.log('Step 3: Classifying document from markdown...');
      classification = await markdownDocumentClassifier.classify(doctlyResult.markdown);
      
      // Log allonge detection
      if (classification.hasEmbeddedAllonges) {
        console.log(`Detected ${classification.allongeCount} embedded allonges in ${classification.documentType}`);
      }

      // Extract fields from markdown with enhanced system
      console.log('Step 4: Extracting fields with enhanced extraction system...');
      
      if (enhancedExtractionAdapter.isAvailable()) {
        try {
          extractedFields = await enhancedExtractionAdapter.extractFields(doctlyResult.markdown, classification.documentType);
          console.log(`Enhanced extraction completed: ${extractedFields.fieldConfidence.size} fields extracted`);
        } catch (extractionError) {
          console.warn('Enhanced extraction failed, falling back to legacy:', extractionError);
          extractedFields = await markdownFieldExtractor.extractFields(doctlyResult.markdown, classification.documentType);
        }
      } else {
        console.warn('Enhanced extraction not available, using legacy extractor');
        extractedFields = await markdownFieldExtractor.extractFields(doctlyResult.markdown, classification.documentType);
      }

      // Store processing metadata
      processingMode = doctlyResult.mode;
      processingCost = doctlyResult.cost;
      pageCount = doctlyResult.pageCount;

      // Log cost tracking data (optional - don't fail if table doesn't exist)
      try {
        await pool.query(`
          INSERT INTO document_processing_costs (
            loan_id, file_name, precision_cost, ultra_cost, total_cost, 
            page_count, processing_mode, initial_confidence, final_confidence, 
            confidence_improvement, processing_time_ms, retry_attempted
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          loanId,
          file.originalname,
          doctlyResult.mode === 'precision' ? doctlyResult.cost : (doctlyResult.attempts > 1 ? 0.02 * pageCount : 0),
          doctlyResult.mode === 'ultra' || doctlyResult.attempts > 1 ? (doctlyResult.mode === 'ultra' ? doctlyResult.cost : 0.05 * pageCount) : 0,
          doctlyResult.cost,
          pageCount,
          doctlyResult.attempts > 1 ? 'both' : doctlyResult.mode,
          doctlyResult.attempts > 1 ? (doctlyResult.finalConfidence - (doctlyResult.cost > 0.02 * pageCount ? 0.1 : 0)) : doctlyResult.finalConfidence, // Estimate initial confidence
          doctlyResult.finalConfidence,
          doctlyResult.attempts > 1 ? (doctlyResult.cost > 0.02 * pageCount ? 0.1 : 0) : 0, // Estimate improvement
          doctlyResult.processingTime,
          doctlyResult.attempts > 1
        ]);
        console.log('Cost tracking data saved successfully');
      } catch (costTrackingError) {
        console.warn('Failed to save cost tracking data (non-critical):', costTrackingError instanceof Error ? costTrackingError.message : costTrackingError);
        // Continue processing - don't fail the entire document analysis for this
      }

    } else {
      // Fallback to Azure processing
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
      ocrResult = await getAzureService().analyzeDocument(processBuffer);
      console.log(`OCR completed. Extracted ${ocrResult.text.length} characters with ${ocrResult.keyValuePairs.size} key-value pairs`);

      // Step 4: Classify document type
      console.log('Step 4: Classifying document...');
      classification = await documentClassifier.classify(ocrResult);
      console.log(`Document classified as ${classification.documentType} with confidence ${classification.confidence.toFixed(4)}`);

      // Step 5: Extract fields based on document type
      console.log('Step 5: Extracting fields...');
      extractedFields = await fieldExtractor.extractFields(ocrResult, classification.documentType);
      console.log(`Extracted ${extractedFields.fieldConfidence.size} fields`);
    }

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
      ocrConfidence: processingProvider === 'azure' && ocrResult ? ocrResult.confidence : undefined,
      keyValuePairCount: processingProvider === 'azure' && ocrResult ? ocrResult.keyValuePairs?.size : undefined,
      processingTime,
      processingProvider,
      processingMode,
      processingCost,
      enhancedExtraction: enhancedExtractionAdapter.isAvailable(),
      extractionVersion: 'enhanced-integrated'
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
      processingProvider === 'azure' && ocrResult ? ocrResult.text : '', // Store text for debugging (empty for DoctlyAI to save space)
      JSON.stringify(extractionMetadata),
      processingTime,
      file.size
    ]);

    const savedDocument = result.rows[0];

    // Step 6.5: Store allonge chain if present
    if (classification.hasEmbeddedAllonges && classification.allongeChain) {
      console.log(`Storing ${classification.allongeChain.length} allonge endorsements...`);
      
      for (const endorsement of classification.allongeChain) {
        await pool.query(`
          INSERT INTO note_allonge_chains (
            document_analysis_id, loan_id, sequence_number, endorser, endorsee, 
            endorsement_type, endorsement_text
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          savedDocument.id,
          loanId,
          endorsement.sequenceNumber,
          endorsement.endorser,
          endorsement.endorsee,
          endorsement.endorsementType,
          endorsement.endorsementText
        ]);
      }
      
      console.log(`Allonge chain stored successfully for document ${savedDocument.id}`);
    }

    // Step 6.6: Also save to collateral_documents for alert triggers
    try {
      await pool.query(`
        INSERT INTO collateral_documents (
          loan_id, file_name, storage_path, document_type, 
          confidence_score, user_id, file_size
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        loanId,
        file.originalname,
        s3Result?.key || `analysis_${savedDocument.id}`,
        classification.documentType,
        classification.confidence,
        (req as any).user?.id,
        file.size
      ]);
      console.log('Document saved to collateral_documents for alert triggers');
    } catch (collateralError) {
      console.warn('Failed to save to collateral_documents (non-critical):', collateralError);
    }

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

// GET /api/v2/loans/:loanId/chain-analysis
// Returns comprehensive chain analysis including endorsement and assignment chains
router.get('/:loanId/chain-analysis', authenticateToken, async (req, res) => {
  const { loanId } = req.params;

  try {
    console.log(`🔗 Fetching comprehensive chain analysis for loan: ${loanId}`);
    
    // Get document presence summary
    const documentQuery = `
      SELECT 
        COUNT(CASE WHEN document_type = 'Note' THEN 1 END) as note_count,
        COUNT(CASE WHEN document_type = 'Security Instrument' THEN 1 END) as security_instrument_count,
        COUNT(CASE WHEN document_type = 'Assignment' THEN 1 END) as assignment_count
      FROM document_analysis 
      WHERE loan_id = $1
    `;
    
    const documentResult = await pool.query(documentQuery, [loanId]);
    const docCounts = documentResult.rows[0];
    
    // Get endorsement chain data from notes
    const endorsementQuery = `
      SELECT 
        da.id as document_analysis_id,
        da.file_name,
        da.confidence_score,
        da.has_endorsements,
        da.endorsement_count,
        da.endorsement_chain,
        da.ends_with_current_investor,
        da.ends_in_blank
      FROM document_analysis da
      WHERE da.loan_id = $1 
        AND da.document_type = 'Note'
        AND da.has_endorsements = true
      ORDER BY da.created_at DESC
      LIMIT 1
    `;
    
    const endorsementResult = await pool.query(endorsementQuery, [loanId]);
    
    // Get assignment chain data 
    const assignmentQuery = `
      SELECT 
        da.id as document_analysis_id,
        da.file_name,
        da.confidence_score,
        da.has_assignment_chain,
        da.assignment_count,
        da.assignment_chain,
        da.assignment_ends_with_current_investor
      FROM document_analysis da
      WHERE da.loan_id = $1 
        AND da.document_type = 'Assignment'
        AND da.has_assignment_chain = true
      ORDER BY da.created_at DESC
      LIMIT 1
    `;
    
    const assignmentResult = await pool.query(assignmentQuery, [loanId]);
    
    // Get legacy assignment chain status for backward compatibility
    const legacyChainQuery = `
      SELECT assignment_chain_complete, chain_gap_details
      FROM loan_collateral_status
      WHERE loan_id = $1
    `;
    
    const legacyResult = await pool.query(legacyChainQuery, [loanId]);
    
    // Build comprehensive response
    const endorsementData = endorsementResult.rows[0];
    const assignmentData = assignmentResult.rows[0];
    const legacyData = legacyResult.rows[0];
    
    const response = {
      success: true,
      loanId,
      timestamp: new Date().toISOString(),
      
      // Document presence
      documentPresence: {
        hasNote: parseInt(docCounts.note_count) > 0,
        hasSecurityInstrument: parseInt(docCounts.security_instrument_count) > 0,
        noteCount: parseInt(docCounts.note_count),
        securityInstrumentCount: parseInt(docCounts.security_instrument_count),
        assignmentCount: parseInt(docCounts.assignment_count)
      },
      
      // Endorsement chain analysis
      endorsementChain: {
        hasEndorsements: endorsementData?.has_endorsements || false,
        endorsementCount: endorsementData?.endorsement_count || 0,
        endorsementChain: endorsementData?.endorsement_chain || [],
        endsWithCurrentInvestor: endorsementData?.ends_with_current_investor || false,
        endsInBlank: endorsementData?.ends_in_blank || false,
        sourceDocument: endorsementData ? {
          fileName: endorsementData.file_name,
          confidence: endorsementData.confidence_score
        } : null
      },
      
      // Assignment chain analysis
      assignmentChain: {
        hasAssignmentChain: assignmentData?.has_assignment_chain || false,
        assignmentCount: assignmentData?.assignment_count || 0,
        assignmentChain: assignmentData?.assignment_chain || [],
        assignmentEndsWithCurrentInvestor: assignmentData?.assignment_ends_with_current_investor || false,
        sourceDocument: assignmentData ? {
          fileName: assignmentData.file_name,
          confidence: assignmentData.confidence_score
        } : null
      },
      
      // Legacy compatibility
      legacy: {
        assignmentChainComplete: legacyData?.assignment_chain_complete || false,
        chainGaps: legacyData?.chain_gap_details ? [legacyData.chain_gap_details] : []
      }
    };
    
    res.json(response);
    
  } catch (error: unknown) {
    console.error('Failed to fetch chain analysis:', error);
    res.status(500).json({
      error: 'Failed to fetch chain analysis',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/v2/loans/:loanId/note-ownership
// Returns current note ownership based on allonge chain analysis
router.get('/:loanId/note-ownership', authenticateToken, async (req, res) => {
  const { loanId } = req.params;

  try {
    console.log(`Fetching note ownership analysis for loan: ${loanId}`);
    
    // Get current note ownership
    const ownershipQuery = `
      SELECT * FROM note_current_ownership 
      WHERE loan_id = $1
      ORDER BY note_analysis_date DESC
      LIMIT 1
    `;
    
    const ownershipResult = await pool.query(ownershipQuery, [loanId]);
    
    if (ownershipResult.rows.length === 0) {
      return res.json({
        success: true,
        loanId,
        hasNote: false,
        message: 'No note found for this loan'
      });
    }

    const ownership = ownershipResult.rows[0];
    
    // Get complete allonge chain if available
    const chainQuery = `
      SELECT * FROM allonge_chain_analysis 
      WHERE loan_id = $1 AND document_analysis_id = $2
    `;
    
    const chainResult = await pool.query(chainQuery, [loanId, ownership.document_analysis_id]);
    
    res.json({
      success: true,
      loanId,
      hasNote: true,
      currentOwner: ownership.current_owner,
      isBlankEndorsed: ownership.is_blank_endorsed,
      totalEndorsements: ownership.total_endorsements,
      noteAnalysisDate: ownership.note_analysis_date,
      borrowerName: ownership.borrower_name,
      fileName: ownership.file_name,
      allongeChain: chainResult.rows.length > 0 ? chainResult.rows[0].endorsement_chain : null,
      chainAnalysis: chainResult.rows.length > 0 ? {
        chainLength: chainResult.rows[0].chain_length,
        hasBlankEndorsement: chainResult.rows[0].has_blank_endorsement,
        blankEndorsementPosition: chainResult.rows[0].blank_endorsement_position
      } : null
    });

  } catch (error: unknown) {
    console.error('Failed to fetch note ownership:', error);
    res.status(500).json({
      error: 'Failed to fetch note ownership',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/v2/loans/:loanId/documents/:documentId
// Delete a specific document and clean up related data
router.delete('/:loanId/documents/:documentId', authenticateToken, organizationAccessService.createLoanAccessMiddleware(), async (req, res) => {
  const { loanId, documentId } = req.params;

  if (!loanId || !documentId) {
    return res.status(400).json({ error: 'Loan ID and Document ID are required' });
  }

  try {
    console.log(`🗑️ Deleting document ${documentId} for loan ${loanId}`);
    
    // Start a transaction to ensure all-or-nothing deletion
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // First, verify the document exists and belongs to this loan
      const documentCheck = await client.query(
        'SELECT id, file_name, document_type FROM document_analysis WHERE id = $1 AND loan_id = $2',
        [documentId, loanId]
      );
      
      if (documentCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Document not found or does not belong to this loan' });
      }
      
      const document = documentCheck.rows[0];
      console.log(`Found document: ${document.file_name} (${document.document_type})`);
      
      // Delete related data in the correct order (due to foreign key constraints)
      
      // 1. Delete document classification feedback
      await client.query('DELETE FROM document_classification_feedback WHERE document_analysis_id = $1', [documentId]);
      console.log('Deleted classification feedback');
      
      // 2. Delete QA flags
      await client.query('DELETE FROM document_analysis_qa_flags WHERE document_analysis_id = $1', [documentId]);
      console.log('Deleted QA flags');
      
      // 3. Delete from collateral_documents table (if it exists there)
      const collateralDeleteResult = await client.query(
        'DELETE FROM collateral_documents WHERE loan_id = $1 AND file_name = $2',
        [loanId, document.file_name]
      );
      console.log(`Deleted ${collateralDeleteResult.rowCount} records from collateral_documents`);
      
      // 4. Delete allonge chain data if present (ignore if table doesn't exist)
      try {
        await client.query('DELETE FROM note_allonge_chains WHERE document_analysis_id = $1', [documentId]);
        console.log('Deleted allonge chain data');
      } catch (chainError) {
        console.log('Note allonge chains table not present or deletion failed (non-critical)');
      }
      
      // 5. Delete chain of title data if present (ignore if table doesn't exist)
      try {
        await client.query('DELETE FROM chain_of_title WHERE document_analysis_id = $1', [documentId]);
        console.log('Deleted chain of title data');
      } catch (titleError) {
        console.log('Chain of title table not present or deletion failed (non-critical)');
      }
      
      // 6. Clean up RAG documents related to this file (if they reference the file name)
      try {
        const ragDeleteResult = await client.query(
          "DELETE FROM rag_loan_documents WHERE loan_id = $1 AND metadata->>'source_file' = $2",
          [loanId, document.file_name]
        );
        console.log(`Deleted ${ragDeleteResult.rowCount} RAG document entries`);
      } catch (ragError) {
        console.log('RAG documents table not present or deletion failed (non-critical)');
      }
      
      // 7. Delete the main document analysis record
      const deleteResult = await client.query('DELETE FROM document_analysis WHERE id = $1', [documentId]);
      
      if (deleteResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Document not found' });
      }
      
      // 8. Update collateral status for the loan (trigger collateral analysis refresh)
      try {
        // Get updated collateral status to refresh the cached data
        await collateralAnalysisService.getCollateralStatus(loanId);
        console.log('Updated collateral status after document deletion');
      } catch (analysisError) {
        console.warn('Failed to update collateral status after deletion (non-critical):', analysisError);
        // Don't fail the transaction for this
      }
      
      await client.query('COMMIT');
      console.log(`✅ Successfully deleted document ${documentId} (${document.file_name})`);
      
      res.json({
        success: true,
        message: `Document "${document.file_name}" deleted successfully`,
        deletedDocument: {
          id: documentId,
          fileName: document.file_name,
          documentType: document.document_type
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error: unknown) {
    console.error('Failed to delete document:', error);
    res.status(500).json({
      error: 'Failed to delete document',
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