-- Migration: Create extraction_feedback table for enhanced extraction system learning
-- This table stores feedback on extraction accuracy to improve the system over time

CREATE TABLE IF NOT EXISTS extraction_feedback (
    id SERIAL PRIMARY KEY,
    field_name VARCHAR(100) NOT NULL,
    strategy_name VARCHAR(50) NOT NULL,
    extracted_value TEXT,
    is_correct BOOLEAN NOT NULL,
    correct_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_field_name ON extraction_feedback(field_name);
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_strategy_name ON extraction_feedback(strategy_name);
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_created_at ON extraction_feedback(created_at);

-- Add comments for documentation
COMMENT ON TABLE extraction_feedback IS 'Stores feedback on field extraction accuracy for machine learning improvement';
COMMENT ON COLUMN extraction_feedback.field_name IS 'Name of the field being extracted (e.g., assignor, assignee)';
COMMENT ON COLUMN extraction_feedback.strategy_name IS 'Extraction strategy used (Table, KeyValue, Pattern, Context)';
COMMENT ON COLUMN extraction_feedback.extracted_value IS 'Value that was extracted by the system';
COMMENT ON COLUMN extraction_feedback.is_correct IS 'Whether the extracted value was correct';
COMMENT ON COLUMN extraction_feedback.correct_value IS 'The correct value if extraction was wrong';