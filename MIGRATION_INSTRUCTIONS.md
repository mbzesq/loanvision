# Document Analysis Table Migration

## Problem
The backend is throwing `error: relation "document_analysis" does not exist` because the table hasn't been created in production.

## Solution
Apply the SQL migration to create the required tables.

## Migration File
`src/backend/migrations/20250702120000_create_document_analysis.sql`

## How to Apply in Render Production

### Option 1: Via Render Dashboard
1. Go to your Render PostgreSQL dashboard
2. Connect to your database console
3. Copy and paste the entire contents of `20250702120000_create_document_analysis.sql`
4. Execute the migration

### Option 2: Via psql Command Line
```bash
# Connect to Render PostgreSQL
psql [YOUR_RENDER_DATABASE_URL]

# Run the migration
\i src/backend/migrations/20250702120000_create_document_analysis.sql
```

### Option 3: Via SQL Client
1. Connect to your Render PostgreSQL using your preferred SQL client (pgAdmin, DBeaver, etc.)
2. Open and execute `20250702120000_create_document_analysis.sql`

## What the Migration Creates

### Tables:
1. **document_analysis** - Main table for OCR results and extracted metadata
2. **document_analysis_qa_flags** - Tracks low-confidence extractions for manual review
3. **document_classification_feedback** - Stores ML model training feedback

### Key Features:
- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Indexes** - Optimized for performance on loan_id, document_type, etc.
- ✅ **Foreign keys** - Proper referential integrity
- ✅ **Validation** - Checks if tables exist before creating

## Verification
After running the migration, test with:
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('document_analysis', 'document_analysis_qa_flags', 'document_classification_feedback');

-- Test structure
SELECT * FROM document_analysis LIMIT 1;
```

## Expected Result
- No more "relation does not exist" errors
- Document upload and analysis should work in production
- OCR results will be stored and retrievable via the frontend