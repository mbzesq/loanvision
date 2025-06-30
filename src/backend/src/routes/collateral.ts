import express from 'express';
import multer from 'multer';
import pdf from 'pdf-parse';
import pool from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import { classifyDocumentText } from '../services/classificationService';

const router = express.Router();

// Configure multer for file uploads
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

// POST /api/v2/loans/:loanId/collateral
router.post('/:loanId/collateral', authenticateToken, upload.array('files', 10), async (req, res) => {
  const { loanId } = req.params;
  const userId = (req as any).user?.userId;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    const results = [];

    for (const file of files) {
      try {
        // Extract text from PDF
        const pdfData = await pdf(file.buffer);
        
        // Get text from first page for classification
        // Simple approach: split by page indicators and take first section
        const pages = pdfData.text.split(/---\s*page\s*\d+\s*---/i);
        const firstPageText = pages[0] || pdfData.text.substring(0, 2000); // Fallback to first 2000 chars
        
        // Classify document type
        const predictedDocType = classifyDocumentText(firstPageText);

        // Save to database
        const insertQuery = `
          INSERT INTO collateral_documents 
          (loan_id, filename, document_type, page_count, user_id, file_size)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, loan_id, filename, document_type, page_count, upload_date
        `;
        
        const insertResult = await pool.query(insertQuery, [
          loanId,
          file.originalname,
          predictedDocType,
          pdfData.numpages,
          userId,
          file.size
        ]);

        const savedDocument = insertResult.rows[0];

        results.push({
          success: true,
          fileName: file.originalname,
          documentType: predictedDocType,
          pageCount: pdfData.numpages,
          fileSize: file.size,
          id: savedDocument.id,
          uploadDate: savedDocument.upload_date
        });

        console.log(`Successfully processed PDF: ${file.originalname} -> ${predictedDocType} (${pdfData.numpages} pages)`);

      } catch (fileError) {
        console.error(`Failed to process PDF ${file.originalname}:`, fileError);
        
        results.push({
          success: false,
          fileName: file.originalname,
          error: 'Failed to process PDF file'
        });
      }
    }

    // Check if any files were successfully processed
    const successfulUploads = results.filter(r => r.success);
    const failedUploads = results.filter(r => !r.success);

    if (successfulUploads.length > 0) {
      res.json({
        success: true,
        message: `Processed ${successfulUploads.length} of ${files.length} files`,
        results: results,
        loanId: loanId
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to process any files',
        results: results,
        loanId: loanId
      });
    }

  } catch (error) {
    console.error('Error processing collateral upload:', error);
    res.status(500).json({ 
      error: 'Internal server error during file processing',
      loanId: loanId
    });
  }
});

// GET /api/v2/loans/:loanId/collateral - Get collateral documents for a loan
router.get('/:loanId/collateral', authenticateToken, async (req, res) => {
  const { loanId } = req.params;

  try {
    const query = `
      SELECT 
        id,
        loan_id,
        filename,
        document_type,
        page_count,
        upload_date,
        file_size,
        created_at
      FROM collateral_documents 
      WHERE loan_id = $1 
      ORDER BY upload_date DESC
    `;
    
    const result = await pool.query(query, [loanId]);

    res.json({
      success: true,
      loanId: loanId,
      documents: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching collateral documents:', error);
    res.status(500).json({ 
      error: 'Failed to fetch collateral documents',
      loanId: loanId
    });
  }
});

export default router;