import { Pool } from 'pg';

export const up = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- Create property_data_current table
    -- This table stores the most recent enrichment snapshot for each loan
    CREATE TABLE property_data_current (
        loan_id TEXT PRIMARY KEY,
        source TEXT,
        property_data JSONB,
        last_updated TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT fk_loan
            FOREIGN KEY(loan_id)
            REFERENCES daily_metrics_current(loan_id)
            ON DELETE CASCADE
    );

    -- Create property_data_history table  
    -- This table stores every enrichment event for historical analysis
    CREATE TABLE property_data_history (
        id SERIAL PRIMARY KEY,
        loan_id TEXT NOT NULL,
        source TEXT,
        property_data JSONB,
        enrichment_date TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT fk_loan
            FOREIGN KEY(loan_id)
            REFERENCES daily_metrics_current(loan_id)
            ON DELETE CASCADE
    );

    -- Create indexes for performance
    CREATE INDEX idx_property_data_current_loan_id ON property_data_current(loan_id);
    CREATE INDEX idx_property_data_current_source ON property_data_current(source);
    CREATE INDEX idx_property_data_history_loan_id ON property_data_history(loan_id);
    CREATE INDEX idx_property_data_history_enrichment_date ON property_data_history(enrichment_date);
    CREATE INDEX idx_property_data_history_source ON property_data_history(source);

    -- Add comments for documentation
    COMMENT ON TABLE property_data_current IS 'Current property enrichment data - one row per loan (most recent)';
    COMMENT ON TABLE property_data_history IS 'Historical property enrichment data - all enrichment events';
    COMMENT ON COLUMN property_data_current.source IS 'Source of the property data (e.g., PropertyData/HomeHarvest)';
    COMMENT ON COLUMN property_data_current.property_data IS 'JSON data containing property details from enrichment source';
    COMMENT ON COLUMN property_data_history.enrichment_date IS 'Timestamp when the enrichment was performed';
  `);
};

export const down = async (pool: Pool): Promise<void> => {
  await pool.query(`
    -- Drop tables in reverse order to respect foreign key constraints
    DROP TABLE IF EXISTS property_data_history CASCADE;
    DROP TABLE IF EXISTS property_data_current CASCADE;
  `);
};