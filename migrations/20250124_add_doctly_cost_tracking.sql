-- Migration to add DoctlyAI cost tracking
-- Date: 2025-01-24

-- Add DoctlyAI processing cost tracking table
CREATE TABLE IF NOT EXISTS document_processing_costs (
    id SERIAL PRIMARY KEY,
    loan_id VARCHAR(255) NOT NULL,
    document_id INTEGER REFERENCES document_analysis(id),
    file_name VARCHAR(255),
    precision_cost DECIMAL(10,4) DEFAULT 0,
    ultra_cost DECIMAL(10,4) DEFAULT 0,
    total_cost DECIMAL(10,4) NOT NULL,
    page_count INTEGER DEFAULT 1,
    processing_mode VARCHAR(20) DEFAULT 'precision', -- 'precision', 'ultra', 'both'
    initial_confidence DECIMAL(5,4),
    final_confidence DECIMAL(5,4),
    confidence_improvement DECIMAL(5,4) DEFAULT 0,
    processing_time_ms INTEGER,
    retry_attempted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_loan_processing_costs (loan_id),
    INDEX idx_processing_date (created_at),
    INDEX idx_processing_mode (processing_mode)
);

-- Add DoctlyAI processing metadata to document_analysis table
ALTER TABLE document_analysis ADD COLUMN IF NOT EXISTS processing_provider VARCHAR(20) DEFAULT 'azure'; -- 'azure', 'doctly'
ALTER TABLE document_analysis ADD COLUMN IF NOT EXISTS processing_mode VARCHAR(20); -- 'precision', 'ultra'
ALTER TABLE document_analysis ADD COLUMN IF NOT EXISTS processing_cost DECIMAL(10,4);
ALTER TABLE document_analysis ADD COLUMN IF NOT EXISTS page_count INTEGER;

-- Create view for DoctlyAI cost analysis
CREATE OR REPLACE VIEW doctly_cost_summary AS
SELECT 
    DATE(created_at) as processing_date,
    COUNT(*) as total_documents,
    SUM(page_count) as total_pages,
    SUM(total_cost) as total_cost,
    SUM(CASE WHEN processing_mode = 'precision' THEN 1 ELSE 0 END) as precision_count,
    SUM(CASE WHEN processing_mode = 'ultra' OR processing_mode = 'both' THEN 1 ELSE 0 END) as ultra_count,
    AVG(confidence_improvement) as avg_confidence_improvement,
    SUM(CASE WHEN retry_attempted = true THEN 1 ELSE 0 END) as retry_count,
    AVG(final_confidence) as avg_final_confidence
FROM document_processing_costs
GROUP BY DATE(created_at)
ORDER BY processing_date DESC;

-- Create index for cost analysis queries
CREATE INDEX IF NOT EXISTS idx_document_processing_costs_date_mode ON document_processing_costs(created_at, processing_mode);

COMMENT ON TABLE document_processing_costs IS 'Tracks DoctlyAI processing costs and confidence improvements';
COMMENT ON VIEW doctly_cost_summary IS 'Daily summary of DoctlyAI processing costs and performance metrics';