import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/authMiddleware';
import { collateralService } from '../services/collateralService';
import pool from '../db';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow PDF files
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

/**
 * Upload collateral documents for a specific loan
 * POST /api/v2/loans/:loanId/collateral
 */
router.post('/loans/:loanId/collateral', authenticateToken, upload.array('documents', 10), async (req, res) => {
    const { loanId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    try {
        // Verify loan exists in the database
        const loanCheck = await pool.query(
            'SELECT loan_id FROM daily_metrics_current WHERE loan_id = $1',
            [loanId]
        );

        if (loanCheck.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Loan not found',
                details: `Loan ID ${loanId} does not exist in the system`
            });
        }

        // Check collateral service health
        const isHealthy = await collateralService.healthCheck();
        if (!isHealthy) {
            return res.status(503).json({
                error: 'Document classification service is unavailable',
                details: 'The AI classification service is currently down. Please try again later.'
            });
        }

        const results = [];
        const errors = [];

        // Process each uploaded file
        for (const file of files) {
            try {
                console.log(`Processing file: ${file.originalname} for loan ${loanId}`);

                // Classify the document using the Python microservice
                const classification = await collateralService.classifyDocument(file.buffer, file.originalname);

                if (!classification) {
                    errors.push(`Failed to classify document: ${file.originalname}`);
                    continue;
                }

                // Create storage path (for now, use a simple path structure)
                // In production, this would be a cloud storage path
                const storagePath = `uploads/collateral/${loanId}/${Date.now()}_${file.originalname}`;

                // Determine the primary document type from predictions
                let primaryDocumentType = 'UNLABELED';
                let totalPages = classification.page_count;

                if (classification.predictions && classification.predictions.length > 0) {
                    // Find the most common document type with highest confidence
                    const typeMap = new Map<string, { count: number, totalConfidence: number }>();
                    
                    classification.predictions.forEach(pred => {
                        if (pred.predicted_label && pred.predicted_label !== 'UNLABELED') {
                            const existing = typeMap.get(pred.predicted_label) || { count: 0, totalConfidence: 0 };
                            typeMap.set(pred.predicted_label, {
                                count: existing.count + 1,
                                totalConfidence: existing.totalConfidence + (pred.confidence || 0)
                            });
                        }
                    });

                    // Find the type with highest average confidence
                    let bestType = 'UNLABELED';
                    let bestScore = 0;
                    
                    for (const [type, stats] of typeMap.entries()) {
                        const avgConfidence = stats.totalConfidence / stats.count;
                        const score = avgConfidence * stats.count; // Weight by frequency
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestType = type;
                        }
                    }
                    
                    if (bestScore > 0) {
                        primaryDocumentType = bestType;
                    }
                }

                // Save document metadata to database
                const insertQuery = `
                    INSERT INTO collateral_documents (
                        loan_id, file_name, storage_path, document_type, page_count, uploaded_at
                    ) VALUES ($1, $2, $3, $4, $5, NOW())
                    RETURNING *
                `;

                const insertResult = await pool.query(insertQuery, [
                    loanId,
                    file.originalname,
                    storagePath,
                    primaryDocumentType,
                    totalPages
                ]);

                const savedDocument = insertResult.rows[0];

                // TODO: In production, save the actual file to cloud storage here
                // For now, we'll just simulate the storage path

                results.push({
                    id: savedDocument.id,
                    fileName: file.originalname,
                    documentType: primaryDocumentType,
                    pageCount: totalPages,
                    storagePath: storagePath,
                    uploadedAt: savedDocument.uploaded_at,
                    classification: {
                        success: classification.success,
                        predictions: classification.predictions
                    }
                });

                console.log(`Successfully processed ${file.originalname}: ${primaryDocumentType} (${totalPages} pages)`);

            } catch (error) {
                console.error(`Error processing file ${file.originalname}:`, error);
                errors.push(`Error processing ${file.originalname}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // Return results
        const response = {
            success: true,
            loanId,
            processedFiles: results.length,
            totalFiles: files.length,
            results,
            errors: errors.length > 0 ? errors : undefined
        };

        if (errors.length > 0) {
            response.success = false;
        }

        res.json(response);

    } catch (error) {
        console.error(`Error uploading collateral documents for loan ${loanId}:`, error);
        res.status(500).json({
            error: 'Failed to process collateral documents',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get collateral documents for a specific loan
 * GET /api/v2/loans/:loanId/collateral
 */
router.get('/loans/:loanId/collateral', authenticateToken, async (req, res) => {
    const { loanId } = req.params;

    try {
        const query = `
            SELECT 
                id,
                loan_id,
                file_name,
                storage_path,
                document_type,
                page_count,
                uploaded_at
            FROM collateral_documents 
            WHERE loan_id = $1 
            ORDER BY uploaded_at DESC
        `;

        const result = await pool.query(query, [loanId]);

        res.json({
            success: true,
            loanId,
            documents: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error(`Error fetching collateral documents for loan ${loanId}:`, error);
        res.status(500).json({
            error: 'Failed to fetch collateral documents',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Get classification service status
 * GET /api/v2/collateral/status
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const isHealthy = await collateralService.healthCheck();
        const modelInfo = await collateralService.getModelInfo();

        res.json({
            service: 'collateral_classification',
            status: isHealthy ? 'healthy' : 'unhealthy',
            model: modelInfo || { error: 'Model information unavailable' }
        });

    } catch (error) {
        console.error('Error checking collateral service status:', error);
        res.status(500).json({
            service: 'collateral_classification',
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Delete a collateral document
 * DELETE /api/v2/collateral/:documentId
 */
router.delete('/:documentId', authenticateToken, async (req, res) => {
    const { documentId } = req.params;

    try {
        // Get document info before deletion
        const docQuery = 'SELECT * FROM collateral_documents WHERE id = $1';
        const docResult = await pool.query(docQuery, [documentId]);

        if (docResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Document not found',
                details: `Document with ID ${documentId} does not exist`
            });
        }

        const document = docResult.rows[0];

        // Delete from database
        const deleteQuery = 'DELETE FROM collateral_documents WHERE id = $1';
        await pool.query(deleteQuery, [documentId]);

        // TODO: In production, also delete the file from cloud storage
        // await deleteFromCloudStorage(document.storage_path);

        res.json({
            success: true,
            message: 'Document deleted successfully',
            deletedDocument: {
                id: document.id,
                fileName: document.file_name,
                loanId: document.loan_id
            }
        });

    } catch (error) {
        console.error(`Error deleting collateral document ${documentId}:`, error);
        res.status(500).json({
            error: 'Failed to delete document',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;