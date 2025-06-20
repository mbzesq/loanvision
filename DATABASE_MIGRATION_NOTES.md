# Database Migration Required

## Latest Migration (2025-01-20): Current/History Table Structure

Run the following migration to implement current/history tracking for daily metrics and foreclosure data:

```sql
-- File: create_current_history_tables.sql
-- Run this entire file in your PostgreSQL database
```

This migration creates:
- `daily_metrics_current`: Current daily metrics (one row per loan)
- `daily_metrics_history`: Historical daily metrics (all uploads with report dates)
- `foreclosure_events_history`: Historical foreclosure events (all uploads with report dates)

The `foreclosure_events` table serves as the "current" table for foreclosure data.

**Important**: This migration adds new tables alongside existing ones. The upload logic will now use the new current/history structure.

## Previous Migration: Foreclosure Tracking Tables

Run the following migration to create enhanced foreclosure tracking tables:

```sql
-- File: create_foreclosure_tracking_tables.sql
-- Run this entire file in your PostgreSQL database
```

This migration creates:
- `foreclosure_events`: Main table for loan-level foreclosure data
- `foreclosure_milestone_statuses`: Child table for milestone tracking with benchmarks

**Note**: This migration will DROP and recreate the existing `foreclosure_events` table if it exists.

After running the main migration, also run:
```sql
-- File: add_foreclosure_constraints.sql
ALTER TABLE foreclosure_milestone_statuses 
ADD CONSTRAINT unique_loan_milestone 
UNIQUE (loan_id, milestone_name);
```

## Previous Migrations

### Enrichments Table Migration

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