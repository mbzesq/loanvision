/**
 * AI Assistant Configuration
 * Controls whether to use RAG (Retrieval-Augmented Generation) or traditional approach
 */

export interface AIConfig {
  // Enable RAG mode for efficient token usage
  useRAG: boolean;
  
  // RAG-specific settings
  rag: {
    // Maximum documents to retrieve per query
    maxDocumentsPerQuery: number;
    
    // Similarity threshold for semantic search (0-1)
    similarityThreshold: number;
    
    // Enable/disable specific retrieval strategies
    strategies: {
      semantic: boolean;
      metadata: boolean;
      hybrid: boolean;
    };
    
    // Document types to index
    documentTypes: string[];
    
    // Indexing schedule (cron expression)
    indexingSchedule: string;
    
    // Batch size for embedding generation
    embeddingBatchSize: number;
  };
  
  // Traditional approach settings
  traditional: {
    // Maximum loans to include in context
    maxLoansInContext: number;
    
    // Include all accessible loans (up to limit)
    includeAllAccessibleLoans: boolean;
    
    // Maximum token limit for safety
    maxTokensPerQuery: number;
  };
  
  // Shared settings
  shared: {
    // OpenAI model to use
    model: string;
    
    // Temperature for response generation
    temperature: number;
    
    // Maximum tokens for response
    maxResponseTokens: number;
    
    // Rate limiting
    maxQueriesPerDay: number;
    maxTokensPerDay: number;
  };
}

// Default configuration
export const defaultAIConfig: AIConfig = {
  // Enable RAG by default for efficiency
  useRAG: true,
  
  rag: {
    maxDocumentsPerQuery: 10,
    similarityThreshold: 0.7,
    strategies: {
      semantic: true,
      metadata: true,
      hybrid: true
    },
    documentTypes: [
      'loan_summary',
      'foreclosure',
      'property',
      'sol_analysis',
      'financial'
    ],
    indexingSchedule: '0 2 * * *', // 2 AM daily
    embeddingBatchSize: 100
  },
  
  traditional: {
    maxLoansInContext: 100,
    includeAllAccessibleLoans: false,
    maxTokensPerQuery: 500000 // Safety limit
  },
  
  shared: {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    maxResponseTokens: 2048,
    maxQueriesPerDay: 50,
    maxTokensPerDay: 999999999 // Temporarily unlimited
  }
};

// Load configuration from environment
export function loadAIConfig(): AIConfig {
  const config = { ...defaultAIConfig };
  
  // Override with environment variables if set
  if (process.env.AI_USE_RAG !== undefined) {
    config.useRAG = process.env.AI_USE_RAG === 'true';
  }
  
  if (process.env.AI_RAG_MAX_DOCUMENTS) {
    config.rag.maxDocumentsPerQuery = parseInt(process.env.AI_RAG_MAX_DOCUMENTS);
  }
  
  if (process.env.AI_RAG_SIMILARITY_THRESHOLD) {
    config.rag.similarityThreshold = parseFloat(process.env.AI_RAG_SIMILARITY_THRESHOLD);
  }
  
  if (process.env.AI_TRADITIONAL_MAX_LOANS) {
    config.traditional.maxLoansInContext = parseInt(process.env.AI_TRADITIONAL_MAX_LOANS);
  }
  
  if (process.env.AI_MAX_QUERIES_PER_DAY) {
    config.shared.maxQueriesPerDay = parseInt(process.env.AI_MAX_QUERIES_PER_DAY);
  }
  
  if (process.env.AI_MAX_TOKENS_PER_DAY) {
    config.shared.maxTokensPerDay = parseInt(process.env.AI_MAX_TOKENS_PER_DAY);
  }
  
  return config;
}

// Export a function to get current mode
export function getAIMode(): 'RAG' | 'Traditional' {
  const config = loadAIConfig();
  return config.useRAG ? 'RAG' : 'Traditional';
}

// Export configuration validation
export function validateAIConfig(config: AIConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (config.rag.maxDocumentsPerQuery < 1 || config.rag.maxDocumentsPerQuery > 100) {
    errors.push('RAG maxDocumentsPerQuery must be between 1 and 100');
  }
  
  if (config.rag.similarityThreshold < 0 || config.rag.similarityThreshold > 1) {
    errors.push('RAG similarityThreshold must be between 0 and 1');
  }
  
  if (config.traditional.maxLoansInContext < 1) {
    errors.push('Traditional maxLoansInContext must be at least 1');
  }
  
  if (config.shared.maxQueriesPerDay < 1) {
    errors.push('maxQueriesPerDay must be at least 1');
  }
  
  if (config.shared.maxTokensPerDay < 1000) {
    errors.push('maxTokensPerDay must be at least 1000');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}