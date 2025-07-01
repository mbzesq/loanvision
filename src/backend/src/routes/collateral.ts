import { Router } from 'express';
import multer from 'multer';
import pool from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import { PDFDocument } from 'pdf-lib';

const router = Router();

// Configure multer for PDF file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// POST /:loanId/collateral - Upload collateral document
router.post('/:loanId/collateral', authenticateToken, upload.single('collateralDocument'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { loanId } = req.params;
  const { documentType = 'collateral' } = req.body;
  const userId = (req as any).user?.id;

  try {
    // Count PDF pages
    let pageCount = 1;
    try {
      const pdfDoc = await PDFDocument.load(req.file.buffer);
      pageCount = pdfDoc.getPageCount();
    } catch (error) {
      console.warn('Could not parse PDF to count pages:', error);
    }

    // Insert document record into database with correct column name
    const insertQuery = `
      INSERT INTO collateral_documents 
      (loan_id, file_name, document_type, page_count, user_id, file_size)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, loan_id, file_name, document_type, page_count, upload_date
    `;

    const result = await pool.query(insertQuery, [
      loanId,
      req.file.originalname,
      documentType,
      pageCount,
      userId,
      req.file.size
    ]);

    res.json({
      status: 'success',
      message: 'Collateral document uploaded successfully',
      document: result.rows[0]
    });

  } catch (error) {
    console.error('Error uploading collateral document:', error);
    res.status(500).json({ 
      error: 'Failed to upload collateral document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /:loanId/collateral - Get collateral documents for a loan
router.get('/:loanId/collateral', authenticateToken, async (req, res) => {
  const { loanId } = req.params;

  try {
    const query = `
      SELECT 
        id,
        loan_id,
        file_name,
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
      status: 'success',
      documents: result.rows
    });

  } catch (error) {
    console.error('Error fetching collateral documents:', error);
    res.status(500).json({ 
      error: 'Failed to fetch collateral documents',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;