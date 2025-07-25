-- Create document_processing_costs table for tracking OCR processing costs
CREATE TABLE IF NOT EXISTS document_processing_costs (
    id SERIAL PRIMARY KEY,
    loan_id VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    precision_cost DECIMAL(10, 4) DEFAULT 0,
    ultra_cost DECIMAL(10, 4) DEFAULT 0,
    total_cost DECIMAL(10, 4) NOT NULL,
    page_count INTEGER DEFAULT 1,
    processing_mode VARCHAR(50),
    initial_confidence DECIMAL(5, 4),
    final_confidence DECIMAL(5, 4),
    confidence_improvement DECIMAL(5, 4),
    processing_time_ms INTEGER,
    retry_attempted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for document_processing_costs
CREATE INDEX IF NOT EXISTS idx_document_processing_costs_loan_id 
ON document_processing_costs(loan_id);

CREATE INDEX IF NOT EXISTS idx_document_processing_costs_created_at 
ON document_processing_costs(created_at DESC);

-- Add index for cost analysis
CREATE INDEX IF NOT EXISTS idx_document_processing_costs_mode 
ON document_processing_costs(processing_mode, total_cost);