# Database Migration Required

Before deploying this version, you must run the enrichments table migration:

```sql
-- Run this SQL in your PostgreSQL database (Render or local)
-- File: create_enrichments_table.sql

CREATE TABLE IF NOT EXISTS enrichments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL,
    enrichment_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_enrichments_loan_id ON enrichments(loan_id);
CREATE INDEX IF NOT EXISTS idx_enrichments_type ON enrichments(enrichment_type);
CREATE INDEX IF NOT EXISTS idx_enrichments_created_at ON enrichments(created_at);
```

## What this enables:
- Automatic AVM enrichment after file uploads
- Background processing of property value estimates
- UI display of simulated AVM data with proper labeling
- Future integration with real AVM providers

## Testing:
1. Upload a new file via the UI
2. Check the modal view for any loan - it should show "Enriching..." initially
3. Wait a few seconds and refresh - should show simulated property values