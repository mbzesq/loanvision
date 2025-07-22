import { Pool } from 'pg';
import OpenAI from 'openai';

interface RetrievalQuery {
  query: string;
  userId: number;
  organizationId: number;
  maxResults?: number;
  filters?: {
    state?: string;
    investor?: string;
    legalStatus?: string;
    documentType?: string;
  };
}

interface RetrievedDocument {
  id: string;
  loan_id: string;
  content: string;
  metadata: any;
  similarity_score?: number;
  relevance_reason?: string;
}

interface RetrievalResult {
  documents: RetrievedDocument[];
  strategy: 'semantic' | 'metadata' | 'hybrid';
  queryIntent: string;
  retrievalTimeMs: number;
  totalTokens: number;
}

type QueryIntent = 
  | 'statistical'      // How many, average, sum, percentage
  | 'specific_loan'    // Questions about particular loans
  | 'foreclosure'      // Foreclosure-related queries
  | 'property'         // Property details and valuations
  | 'sol_analysis'     // Statute of limitations queries
  | 'financial'        // Payment history, balances
  | 'comparison'       // Comparing multiple loans
  | 'general';         // Broad portfolio questions

/**
 * RAG Retrieval Service - Intelligently retrieves relevant loan documents
 * Uses multiple strategies to find the most relevant information
 */
export class RAGRetrievalService {
  private pool: Pool;
  private openai: OpenAI;
  private embeddingModel = 'text-embedding-3-small';

  constructor(pool: Pool) {
    this.pool = pool;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    console.log('🎯 RAG Retrieval Service initialized');
  }

  /**
   * Main retrieval method - analyzes query and retrieves relevant documents
   */
  async retrieve(request: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = Date.now();

    try {
      // 1. Classify query intent
      const queryIntent = await this.classifyQueryIntent(request.query);
      console.log(`📋 Query intent: ${queryIntent}`);

      // 2. Determine retrieval strategy based on intent
      const strategy = this.determineStrategy(queryIntent);

      // 3. Execute retrieval based on strategy
      let documents: RetrievedDocument[];
      
      switch (strategy) {
        case 'metadata':
          documents = await this.metadataBasedRetrieval(request, queryIntent);
          break;
        case 'semantic':
          documents = await this.semanticRetrieval(request, queryIntent);
          break;
        case 'hybrid':
          documents = await this.hybridRetrieval(request, queryIntent);
          break;
      }

      // 4. Post-process and rank documents
      documents = await this.rankAndFilterDocuments(documents, request);

      // 5. Calculate token usage
      const totalTokens = this.estimateTokenCount(documents);

      // 6. Log the retrieval for analytics
      await this.logRetrieval(request, documents, strategy, queryIntent, Date.now() - startTime);

      return {
        documents,
        strategy,
        queryIntent,
        retrievalTimeMs: Date.now() - startTime,
        totalTokens
      };

    } catch (error) {
      console.error('❌ Retrieval failed:', error);
      throw error;
    }
  }

  /**
   * Classify the intent of the user's query
   */
  private async classifyQueryIntent(query: string): Promise<QueryIntent> {
    const lowerQuery = query.toLowerCase();

    // Statistical queries
    if (this.containsAny(lowerQuery, [
      'how many', 'count', 'total', 'number of', 'average', 'sum', 
      'percentage', 'percent', 'ratio', 'distribution', 'breakdown'
    ])) {
      return 'statistical';
    }

    // Specific loan queries
    if (this.containsAny(lowerQuery, [
      'loan id', 'specific loan', 'tell me about loan', 'show loan',
      'details for loan', 'information on loan'
    ]) || /loan\s+[A-Z0-9]{5,}/i.test(query)) {
      return 'specific_loan';
    }

    // Foreclosure queries
    if (this.containsAny(lowerQuery, [
      'foreclosure', 'fc status', 'attorney', 'sale date', 'filing date',
      'foreclosed', 'pre-foreclosure', 'auction'
    ])) {
      return 'foreclosure';
    }

    // Property queries
    if (this.containsAny(lowerQuery, [
      'property', 'house', 'home', 'address', 'bedroom', 'bathroom',
      'square feet', 'sq ft', 'property value', 'estimated value'
    ])) {
      return 'property';
    }

    // SOL queries
    if (this.containsAny(lowerQuery, [
      'statute of limitations', 'sol', 'expiration', 'expire', 'risk level',
      'days until', 'limitation period'
    ])) {
      return 'sol_analysis';
    }

    // Financial queries
    if (this.containsAny(lowerQuery, [
      'payment', 'balance', 'principal', 'interest', 'monthly payment',
      'payment history', 'delinquent', 'current', 'performing'
    ])) {
      return 'financial';
    }

    // Comparison queries
    if (this.containsAny(lowerQuery, [
      'compare', 'versus', 'vs', 'difference between', 'comparison'
    ])) {
      return 'comparison';
    }

    return 'general';
  }

  /**
   * Determine the best retrieval strategy based on query intent
   */
  private determineStrategy(intent: QueryIntent): 'semantic' | 'metadata' | 'hybrid' {
    switch (intent) {
      case 'statistical':
        // Statistical queries often need broad metadata filtering
        return 'metadata';
      
      case 'specific_loan':
        // Specific loans can be found with metadata
        return 'metadata';
      
      case 'foreclosure':
      case 'property':
      case 'sol_analysis':
        // Domain-specific queries benefit from hybrid approach
        return 'hybrid';
      
      case 'financial':
      case 'comparison':
      case 'general':
        // Complex queries need semantic understanding
        return 'semantic';
      
      default:
        return 'hybrid';
    }
  }

  /**
   * Metadata-based retrieval using filters and structured queries
   */
  private async metadataBasedRetrieval(
    request: RetrievalQuery, 
    intent: QueryIntent
  ): Promise<RetrievedDocument[]> {
    // Extract metadata filters from query
    const extractedFilters = this.extractFiltersFromQuery(request.query);
    const filters = { ...extractedFilters, ...request.filters };

    // Determine document types to search based on intent
    const documentTypes = this.getDocumentTypesForIntent(intent);

    let query = `
      SELECT id, loan_id, content, metadata
      FROM rag_loan_documents
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    // Add document type filter
    if (documentTypes.length > 0) {
      query += ` AND metadata->>'type' = ANY($${paramCount})`;
      params.push(documentTypes);
      paramCount++;
    }

    // Add other filters
    if (filters.state) {
      query += ` AND metadata->>'state' = $${paramCount}`;
      params.push(filters.state);
      paramCount++;
    }

    if (filters.investor) {
      query += ` AND metadata->>'investor_name' ILIKE $${paramCount}`;
      params.push(`%${filters.investor}%`);
      paramCount++;
    }

    if (filters.legalStatus) {
      query += ` AND metadata->>'legal_status' = $${paramCount}`;
      params.push(filters.legalStatus);
      paramCount++;
    }

    // Add organization access control
    console.log(`🔍 [DEBUG] Organization access filter - organizationId: ${request.organizationId}`);
    
    query += ` AND loan_id IN (
      SELECT DISTINCT dmc.loan_id
      FROM daily_metrics_current dmc
      WHERE EXISTS (
        SELECT 1 FROM organization_investors oi 
        WHERE oi.organization_id = $${paramCount} 
        AND oi.investor_name = dmc.investor_name 
        AND oi.is_active = true
      )
    )`;
    params.push(request.organizationId);
    paramCount++;
    
    console.log(`🔍 [DEBUG] Final metadata query:`, query);
    console.log(`🔍 [DEBUG] Query params:`, params);

    query += ` LIMIT ${request.maxResults || 20}`;

    const result = await this.pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      loan_id: row.loan_id,
      content: row.content,
      metadata: row.metadata,
      relevance_reason: 'Matched metadata filters'
    }));
  }

  /**
   * Semantic retrieval using vector similarity search
   */
  private async semanticRetrieval(
    request: RetrievalQuery,
    intent: QueryIntent
  ): Promise<RetrievedDocument[]> {
    // Generate embedding for the query
    const queryEmbedding = await this.generateQueryEmbedding(request.query);

    // Use the PostgreSQL function for similarity search
    const result = await this.pool.query(`
      SELECT 
        id, loan_id, content, metadata, similarity_score
      FROM search_similar_documents(
        $1::jsonb,  -- query embedding
        $2,         -- document type
        $3,         -- state
        $4,         -- investor
        $5,         -- similarity threshold
        $6          -- max results
      )
      WHERE loan_id IN (
        SELECT DISTINCT dmc.loan_id
        FROM daily_metrics_current dmc
        WHERE EXISTS (
          SELECT 1 FROM organization_investors oi 
          WHERE oi.organization_id = $7
          AND oi.investor_name = dmc.investor_name 
          AND oi.is_active = true
        )
      )
    `, [
      JSON.stringify(queryEmbedding),
      this.getDocumentTypesForIntent(intent)[0] || null,
      request.filters?.state || null,
      request.filters?.investor || null,
      0.7, // similarity threshold
      request.maxResults || 20,
      request.organizationId
    ]);

    return result.rows.map(row => ({
      id: row.id,
      loan_id: row.loan_id,
      content: row.content,
      metadata: row.metadata,
      similarity_score: row.similarity_score,
      relevance_reason: `Semantic similarity: ${(row.similarity_score * 100).toFixed(1)}%`
    }));
  }

  /**
   * Hybrid retrieval combining metadata and semantic search
   */
  private async hybridRetrieval(
    request: RetrievalQuery,
    intent: QueryIntent
  ): Promise<RetrievedDocument[]> {
    // Run both strategies in parallel
    const [metadataResults, semanticResults] = await Promise.all([
      this.metadataBasedRetrieval(request, intent),
      this.semanticRetrieval(request, intent)
    ]);

    // Combine and deduplicate results
    const combinedMap = new Map<string, RetrievedDocument>();

    // Add metadata results
    metadataResults.forEach(doc => {
      combinedMap.set(doc.id, doc);
    });

    // Add semantic results, merging scores if duplicate
    semanticResults.forEach(doc => {
      if (combinedMap.has(doc.id)) {
        const existing = combinedMap.get(doc.id)!;
        existing.similarity_score = doc.similarity_score;
        existing.relevance_reason = 'Matched both metadata and semantic search';
      } else {
        combinedMap.set(doc.id, doc);
      }
    });

    return Array.from(combinedMap.values());
  }

  /**
   * Extract filters from natural language query
   */
  private extractFiltersFromQuery(query: string): Partial<RetrievalQuery['filters']> {
    const filters: Partial<RetrievalQuery['filters']> = {};
    const lowerQuery = query.toLowerCase();

    // Extract state names and codes more accurately
    const stateMap: Record<string, string> = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 
      'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
      'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
      'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
      'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
      'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
      'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
      'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
      'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
      'wisconsin': 'WI', 'wyoming': 'WY'
    };

    // Check for full state names first
    for (const [stateName, stateCode] of Object.entries(stateMap)) {
      if (lowerQuery.includes(stateName)) {
        filters.state = stateCode;
        console.log(`🔍 [DEBUG] Extracted state: ${stateName} -> ${stateCode}`);
        break;
      }
    }

    // If no full name found, try state codes (but be more careful)
    if (!filters.state) {
      const stateCodeMatch = query.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/);
      if (stateCodeMatch) {
        filters.state = stateCodeMatch[1].toUpperCase();
        console.log(`🔍 [DEBUG] Extracted state code: ${stateCodeMatch[1]}`);
      }
    }

    // Only set legal status if the query is specifically asking for loans with that status
    // Don't filter by foreclosure status just because the word appears in context
    if (lowerQuery.includes('current loans') || lowerQuery.includes('performing loans')) {
      filters.legalStatus = 'Current';
    } else if (lowerQuery.includes('delinquent loans')) {
      filters.legalStatus = 'Delinquent';
    } else if (lowerQuery.includes('foreclosed loans') || lowerQuery.includes('loans in foreclosure')) {
      filters.legalStatus = 'Foreclosure';
    }
    // Don't set legal status for queries about "foreclosure timeline" or "foreclosure status"

    console.log(`🔍 [DEBUG] Extracted filters:`, filters);
    return filters;
  }

  /**
   * Get relevant document types based on query intent
   */
  private getDocumentTypesForIntent(intent: QueryIntent): string[] {
    switch (intent) {
      case 'statistical':
        return ['loan_summary', 'financial'];
      case 'specific_loan':
        return ['loan_summary'];
      case 'foreclosure':
        return ['foreclosure', 'loan_summary'];
      case 'property':
        return ['property', 'loan_summary'];
      case 'sol_analysis':
        return ['sol_analysis', 'loan_summary'];
      case 'financial':
        return ['financial', 'loan_summary'];
      case 'comparison':
        return ['loan_summary', 'financial'];
      default:
        return [];
    }
  }

  /**
   * Generate embedding for a query
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: query
    });

    return response.data[0].embedding;
  }

  /**
   * Rank and filter documents based on relevance
   */
  private async rankAndFilterDocuments(
    documents: RetrievedDocument[],
    request: RetrievalQuery
  ): Promise<RetrievedDocument[]> {
    // Sort by similarity score if available
    documents.sort((a, b) => {
      const scoreA = a.similarity_score || 0;
      const scoreB = b.similarity_score || 0;
      return scoreB - scoreA;
    });

    // Limit results
    const maxResults = request.maxResults || 10;
    return documents.slice(0, maxResults);
  }

  /**
   * Estimate token count for documents
   */
  private estimateTokenCount(documents: RetrievedDocument[]): number {
    // Rough estimate: 1 token per 4 characters
    const totalChars = documents.reduce((sum, doc) => sum + doc.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Log retrieval for analytics
   */
  private async logRetrieval(
    request: RetrievalQuery,
    documents: RetrievedDocument[],
    strategy: 'semantic' | 'metadata' | 'hybrid',
    queryIntent: string,
    retrievalTimeMs: number
  ): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO rag_query_logs (
          user_id, original_query, query_intent, retrieved_document_ids,
          retrieval_strategy, retrieval_time_ms, total_documents_retrieved,
          final_context_size, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        request.userId,
        request.query,
        queryIntent,
        documents.map(d => d.id),
        strategy,
        retrievalTimeMs,
        documents.length,
        this.estimateTokenCount(documents)
      ]);
    } catch (error) {
      console.error('Failed to log retrieval:', error);
    }
  }

  /**
   * Helper to check if string contains any of the keywords
   */
  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  /**
   * Get retrieval statistics for optimization
   */
  async getRetrievalStats(days: number = 7): Promise<{
    totalQueries: number;
    avgRetrievalTime: number;
    avgDocumentsRetrieved: number;
    avgContextSize: number;
    queryIntentBreakdown: Record<string, number>;
    strategyBreakdown: Record<string, number>;
  }> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_queries,
        AVG(retrieval_time_ms) as avg_retrieval_time,
        AVG(total_documents_retrieved) as avg_documents_retrieved,
        AVG(final_context_size) as avg_context_size,
        query_intent,
        retrieval_strategy,
        COUNT(*) as count_per_type
      FROM rag_query_logs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY ROLLUP(query_intent, retrieval_strategy)
    `);

    const stats = {
      totalQueries: 0,
      avgRetrievalTime: 0,
      avgDocumentsRetrieved: 0,
      avgContextSize: 0,
      queryIntentBreakdown: {} as Record<string, number>,
      strategyBreakdown: {} as Record<string, number>
    };

    result.rows.forEach(row => {
      if (!row.query_intent && !row.retrieval_strategy) {
        // Overall stats
        stats.totalQueries = parseInt(row.count_per_type);
        stats.avgRetrievalTime = Math.round(parseFloat(row.avg_retrieval_time));
        stats.avgDocumentsRetrieved = Math.round(parseFloat(row.avg_documents_retrieved));
        stats.avgContextSize = Math.round(parseFloat(row.avg_context_size));
      } else if (row.query_intent && !row.retrieval_strategy) {
        // Intent breakdown
        stats.queryIntentBreakdown[row.query_intent] = parseInt(row.count_per_type);
      } else if (!row.query_intent && row.retrieval_strategy) {
        // Strategy breakdown
        stats.strategyBreakdown[row.retrieval_strategy] = parseInt(row.count_per_type);
      }
    });

    return stats;
  }
}