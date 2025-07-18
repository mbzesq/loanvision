-- Migration: Create RAG (Retrieval-Augmented Generation) tables
-- Date: 2025-07-17
-- Purpose: Support efficient vector search and document retrieval for AI queries

-- Enable vector extension for PostgreSQL (if using pgvector)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Create RAG loan documents table for vector search
CREATE TABLE IF NOT EXISTS rag_loan_documents (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL REFERENCES daily_metrics_current(loan_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL,
    embedding JSONB NOT NULL, -- Store as JSONB for now, can upgrade to vector type later
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create RAG index statistics table
CREATE TABLE IF NOT EXISTS rag_index_stats (
    id SERIAL PRIMARY KEY,
    total_documents INTEGER NOT NULL,
    last_indexed TIMESTAMP WITH TIME ZONE NOT NULL,
    documents_per_type JSONB NOT NULL,
    indexing_duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create RAG query logs for analytics and optimization
CREATE TABLE IF NOT EXISTS rag_query_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_query TEXT NOT NULL,
    query_intent TEXT, -- 'statistical', 'specific_loan', 'foreclosure', 'property', etc.
    retrieved_document_ids TEXT[], -- Array of document IDs that were retrieved
    retrieval_strategy TEXT NOT NULL, -- 'semantic', 'metadata', 'hybrid'
    retrieval_time_ms INTEGER,
    total_documents_retrieved INTEGER,
    final_context_size INTEGER, -- Tokens sent to LLM
    query_successful BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient retrieval
CREATE INDEX IF NOT EXISTS idx_rag_documents_loan_id ON rag_loan_documents(loan_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_metadata ON rag_loan_documents USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_rag_documents_created_at ON rag_loan_documents(created_at);

-- Metadata indexes for common search patterns
CREATE INDEX IF NOT EXISTS idx_rag_documents_type ON rag_loan_documents((metadata->>'type'));
CREATE INDEX IF NOT EXISTS idx_rag_documents_state ON rag_loan_documents((metadata->>'state'));
CREATE INDEX IF NOT EXISTS idx_rag_documents_investor ON rag_loan_documents((metadata->>'investor_name'));
CREATE INDEX IF NOT EXISTS idx_rag_documents_legal_status ON rag_loan_documents((metadata->>'legal_status'));

-- Query logs indexes
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_user_id ON rag_query_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_created_at ON rag_query_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_intent ON rag_query_logs(query_intent);
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_strategy ON rag_query_logs(retrieval_strategy);

-- Index stats indexes
CREATE INDEX IF NOT EXISTS idx_rag_index_stats_created_at ON rag_index_stats(created_at);

-- Add trigger for updated_at on rag_loan_documents
CREATE OR REPLACE FUNCTION update_rag_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rag_documents_updated_at
    BEFORE UPDATE ON rag_loan_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_rag_documents_updated_at();

-- Function to calculate cosine similarity between embeddings (stored as JSONB arrays)
CREATE OR REPLACE FUNCTION cosine_similarity(vec1 JSONB, vec2 JSONB)
RETURNS FLOAT AS $$
DECLARE
    dot_product FLOAT := 0;
    norm1 FLOAT := 0;
    norm2 FLOAT := 0;
    val1 FLOAT;
    val2 FLOAT;
    i INTEGER;
    len INTEGER;
BEGIN
    -- Get array length (assuming both vectors have same length)
    len := jsonb_array_length(vec1);
    
    -- Calculate dot product and norms
    FOR i IN 0..len-1 LOOP
        val1 := (vec1->>i)::FLOAT;
        val2 := (vec2->>i)::FLOAT;
        
        dot_product := dot_product + (val1 * val2);
        norm1 := norm1 + (val1 * val1);
        norm2 := norm2 + (val2 * val2);
    END LOOP;
    
    -- Avoid division by zero
    IF norm1 = 0 OR norm2 = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN dot_product / (sqrt(norm1) * sqrt(norm2));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to search documents by semantic similarity
CREATE OR REPLACE FUNCTION search_similar_documents(
    query_embedding JSONB,
    document_type TEXT DEFAULT NULL,
    loan_state TEXT DEFAULT NULL,
    investor_name TEXT DEFAULT NULL,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
    id TEXT,
    loan_id TEXT,
    content TEXT,
    metadata JSONB,
    similarity_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.loan_id,
        d.content,
        d.metadata,
        cosine_similarity(query_embedding, d.embedding) AS similarity_score
    FROM rag_loan_documents d
    WHERE 
        (document_type IS NULL OR d.metadata->>'type' = document_type)
        AND (loan_state IS NULL OR d.metadata->>'state' = loan_state)
        AND (investor_name IS NULL OR d.metadata->>'investor_name' = investor_name)
        AND cosine_similarity(query_embedding, d.embedding) >= similarity_threshold
    ORDER BY similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old query logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_rag_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM rag_query_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments explaining the purpose of each table
COMMENT ON TABLE rag_loan_documents IS 'Searchable document index with embeddings for RAG-based loan queries';
COMMENT ON COLUMN rag_loan_documents.content IS 'Human-readable text representation of loan data for embedding';
COMMENT ON COLUMN rag_loan_documents.metadata IS 'Searchable metadata for filtering (type, state, investor, etc.)';
COMMENT ON COLUMN rag_loan_documents.embedding IS 'Vector embedding of the content for semantic search';

COMMENT ON TABLE rag_index_stats IS 'Statistics and metadata about RAG index rebuilds';
COMMENT ON TABLE rag_query_logs IS 'Analytics log for RAG query performance and optimization';

COMMENT ON FUNCTION cosine_similarity(JSONB, JSONB) IS 'Calculate cosine similarity between two embedding vectors';
COMMENT ON FUNCTION search_similar_documents IS 'Search documents by semantic similarity with optional metadata filters';
COMMENT ON FUNCTION cleanup_old_rag_logs IS 'Cleanup function for old RAG query logs';

-- Grant permissions to application user (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nplvision_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON rag_loan_documents TO nplvision_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON rag_index_stats TO nplvision_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON rag_query_logs TO nplvision_app;
        GRANT USAGE, SELECT ON SEQUENCE rag_index_stats_id_seq TO nplvision_app;
    END IF;
END $$;