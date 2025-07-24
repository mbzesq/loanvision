-- Migration to create document_processing_costs table
-- Date: 2025-01-24

CREATE TABLE IF NOT EXISTS document_processing_costs (
    id SERIAL PRIMARY KEY,
    loan_id VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    precision_cost DECIMAL(10, 4) DEFAULT 0,
    ultra_cost DECIMAL(10, 4) DEFAULT 0,
    total_cost DECIMAL(10, 4) NOT NULL,
    page_count INTEGER NOT NULL,
    processing_mode VARCHAR(20) NOT NULL CHECK (processing_mode IN ('precision', 'ultra', 'both')),
    initial_confidence DECIMAL(5, 4),
    final_confidence DECIMAL(5, 4),
    confidence_improvement DECIMAL(5, 4) DEFAULT 0,
    processing_time_ms INTEGER NOT NULL,
    retry_attempted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_document_costs_loan_id (loan_id),
    INDEX idx_document_costs_date (created_at),
    INDEX idx_document_costs_mode (processing_mode)
);

COMMENT ON TABLE document_processing_costs IS 'Tracks processing costs and performance metrics for DoctlyAI document conversions';