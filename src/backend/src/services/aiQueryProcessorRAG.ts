import { Pool } from 'pg';
import { PIIAnonymizationService } from './piiAnonymizationService';
import { OpenAIService } from './openAIService';
import { AIRateLimitService } from './aiRateLimitService';
import { RAGRetrievalService } from './ragRetrievalService';

interface UserContext {
  userId: number;
  organizationId: number;
  permissions: string[];
  firstName: string;
  lastName: string;
}

interface AIQueryRequest {
  query: string;
  conversationId?: string;
  includeContext?: boolean;
  maxResults?: number;
}

interface AIQueryResponse {
  response: string;
  conversationId: string;
  messageId: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  rateLimitStatus: {
    queriesRemaining: number;
    tokensRemaining: number;
    resetTime: Date;
  };
  responseTimeMs: number;
  anonymizedQuery: string;
  piiMappingsUsed: string[];
  retrievalStats?: {
    documentsRetrieved: number;
    retrievalStrategy: string;
    queryIntent: string;
    retrievalTimeMs: number;
  };
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  anonymizedContent?: string;
  timestamp: Date;
}

interface RAGContext {
  retrievedDocuments: string;
  documentCount: number;
  queryIntent: string;
  portfolioStats: any;
  dataSourceInfo: any;
}

/**
 * AI Query Processor with RAG (Retrieval-Augmented Generation)
 * Efficiently processes queries by retrieving only relevant loan data
 */
export class AIQueryProcessorRAG {
  private pool: Pool;
  private piiService: PIIAnonymizationService;
  private openaiService: OpenAIService;
  private rateLimitService: AIRateLimitService;
  private ragRetrievalService: RAGRetrievalService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.piiService = new PIIAnonymizationService(pool);
    this.openaiService = new OpenAIService(pool);
    this.rateLimitService = new AIRateLimitService(pool);
    this.ragRetrievalService = new RAGRetrievalService(pool);
    
    console.log('🧠 AI Query Processor (RAG) initialized');
  }

  /**
   * Process an AI query using RAG workflow
   */
  async processQuery(
    userContext: UserContext,
    request: AIQueryRequest
  ): Promise<AIQueryResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Validate user permissions and rate limits
      await this.validateUserAccess(userContext);
      
      // 2. Check rate limits
      const canQuery = await this.rateLimitService.canMakeQuery(
        userContext.userId,
        1000 // Estimate lower token usage with RAG
      );
      
      if (!canQuery.canProceed) {
        throw new Error(`Rate limit exceeded: ${canQuery.reason}`);
      }

      // 3. Validate query content
      const validation = this.openaiService.validateMessage(request.query);
      if (!validation.isValid) {
        throw new Error(`Invalid query: ${validation.reason}`);
      }

      // 4. Get or create conversation
      const conversationId = request.conversationId || await this.createConversation(userContext);

      // 5. Retrieve relevant documents using RAG
      console.log(`🔍 Retrieving relevant documents for: "${request.query}"`);
      const retrievalResult = await this.ragRetrievalService.retrieve({
        query: request.query,
        userId: userContext.userId,
        organizationId: userContext.organizationId,
        maxResults: request.maxResults || 10
      });

      console.log(`📚 Retrieved ${retrievalResult.documents.length} documents using ${retrievalResult.strategy} strategy`);

      // 6. Get portfolio statistics for context
      const portfolioStats = await this.getPortfolioStatistics(userContext.organizationId);

      // 7. Build RAG context
      const ragContext: RAGContext = {
        retrievedDocuments: this.formatRetrievedDocuments(retrievalResult.documents),
        documentCount: retrievalResult.documents.length,
        queryIntent: retrievalResult.queryIntent,
        portfolioStats,
        dataSourceInfo: this.getDataSourceInfo()
      };

      // 8. Get conversation history
      const conversationHistory = await this.getConversationHistory(conversationId, userContext.userId);

      // 9. Anonymize query
      const { anonymizedQuery, piiMappings } = await this.anonymizeQuery(request.query);

      // 10. Prepare messages for OpenAI with RAG context
      const messages = this.buildChatMessages(conversationHistory, anonymizedQuery, ragContext);

      // 11. Call OpenAI API with minimal context
      const openaiResponse = await this.openaiService.generateChatCompletionRAG(
        messages,
        ragContext,
        userContext.userId
      );

      // 12. De-anonymize response
      const deAnonymizedResponse = await this.piiService.deAnonymizeText(
        openaiResponse.content,
        piiMappings
      );

      // 13. Save conversation messages
      const messageId = await this.saveConversationMessage(
        conversationId,
        userContext.userId,
        request.query,
        anonymizedQuery,
        deAnonymizedResponse.originalText,
        openaiResponse.content,
        openaiResponse.tokenUsage,
        piiMappings.map(m => m.id)
      );

      // 14. Update rate limits
      const rateLimitStatus = await this.rateLimitService.recordUsage(userContext.userId, {
        queries: 1,
        tokens: openaiResponse.tokenUsage.totalTokens
      });

      // 15. Log successful query
      await this.logQuery(userContext.userId, conversationId, messageId, {
        query: request.query,
        responseTime: Date.now() - startTime,
        tokenUsage: openaiResponse.tokenUsage,
        retrievalStats: {
          documentsRetrieved: retrievalResult.documents.length,
          retrievalStrategy: retrievalResult.strategy,
          queryIntent: retrievalResult.queryIntent,
          retrievalTimeMs: retrievalResult.retrievalTimeMs
        },
        success: true
      });

      return {
        response: deAnonymizedResponse.originalText,
        conversationId,
        messageId,
        tokenUsage: openaiResponse.tokenUsage,
        rateLimitStatus: {
          queriesRemaining: rateLimitStatus.queriesRemaining,
          tokensRemaining: rateLimitStatus.tokensRemaining,
          resetTime: rateLimitStatus.resetTime
        },
        responseTimeMs: Date.now() - startTime,
        anonymizedQuery,
        piiMappingsUsed: deAnonymizedResponse.mappingsUsed,
        retrievalStats: {
          documentsRetrieved: retrievalResult.documents.length,
          retrievalStrategy: retrievalResult.strategy,
          queryIntent: retrievalResult.queryIntent,
          retrievalTimeMs: retrievalResult.retrievalTimeMs
        }
      };

    } catch (error) {
      // Log failed query
      await this.logQuery(userContext.userId, request.conversationId || '', '', {
        query: request.query,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      });

      throw error;
    }
  }

  /**
   * Format retrieved documents for the AI context
   */
  private formatRetrievedDocuments(documents: any[]): string {
    if (documents.length === 0) {
      return 'No specific loan documents found for this query.';
    }

    return documents.map((doc, index) => 
      `Document ${index + 1} (${doc.metadata.type}):\n${doc.content}\n`
    ).join('\n---\n');
  }

  /**
   * Get portfolio statistics for the organization
   */
  private async getPortfolioStatistics(organizationId: number): Promise<any> {
    // Get accessible loan IDs for the organization
    const accessQuery = `
      SELECT DISTINCT dmc.loan_id
      FROM daily_metrics_current dmc
      WHERE EXISTS (
        SELECT 1 FROM organization_investors oi 
        WHERE oi.organization_id = $1 
        AND oi.investor_name = dmc.investor_name 
        AND oi.is_active = true
      )
    `;
    
    const accessResult = await this.pool.query(accessQuery, [organizationId]);
    const loanIds = accessResult.rows.map(row => row.loan_id);

    if (loanIds.length === 0) {
      return {
        totalLoans: 0,
        message: 'No loans accessible for this organization'
      };
    }

    // Get aggregated statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_loans,
        COUNT(CASE WHEN state = 'NY' THEN 1 END) as loans_in_ny,
        COUNT(CASE WHEN state = 'CA' THEN 1 END) as loans_in_ca,
        COUNT(CASE WHEN state = 'FL' THEN 1 END) as loans_in_fl,
        COUNT(CASE WHEN state = 'TX' THEN 1 END) as loans_in_tx,
        COUNT(CASE WHEN state = 'PA' THEN 1 END) as loans_in_pa,
        COUNT(DISTINCT state) as states_represented,
        COUNT(DISTINCT investor_name) as unique_investors,
        AVG(prin_bal) as avg_current_balance,
        SUM(prin_bal) as total_principal_balance,
        COUNT(CASE WHEN legal_status = 'Current' THEN 1 END) as current_loans,
        COUNT(CASE WHEN legal_status = 'Delinquent' THEN 1 END) as delinquent_loans,
        COUNT(CASE WHEN legal_status = 'Foreclosure' THEN 1 END) as foreclosure_loans,
        AVG(int_rate) as avg_interest_rate,
        MIN(int_rate) as min_interest_rate,
        MAX(int_rate) as max_interest_rate
      FROM daily_metrics_current 
      WHERE loan_id = ANY($1)
    `;
    
    const statsResult = await this.pool.query(statsQuery, [loanIds]);
    return statsResult.rows[0];
  }

  /**
   * Get information about available data sources
   */
  private getDataSourceInfo(): any {
    return {
      availableTables: {
        daily_metrics_current: "Core loan information: borrower, property, balances, payment history",
        foreclosure_events: "Foreclosure status, timeline, attorney info, key dates",
        loan_sol_calculations: "Statute of limitations analysis, expiration dates, risk levels",
        property_data_current: "Property details: type, bedrooms, bathrooms, square feet, estimated value",
        loan_collateral_status: "Collateral analysis, scores, and notes",
        monthly_cashflow_data: "Monthly payment and cash flow history"
      }
    };
  }

  /**
   * Build chat messages with RAG context
   */
  private buildChatMessages(
    conversationHistory: ConversationMessage[],
    currentQuery: string,
    ragContext: RAGContext
  ): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

    // Add system message with RAG context
    messages.push({
      role: 'system',
      content: `You are an AI assistant for a mortgage portfolio management platform. 
You help users analyze loan data based on the specific documents retrieved for their query.

RETRIEVED DOCUMENTS:
${ragContext.retrievedDocuments}

PORTFOLIO STATISTICS:
- Total loans: ${ragContext.portfolioStats.total_loans || 0}
- Loans in NY: ${ragContext.portfolioStats.loans_in_ny || 0}
- Loans in CA: ${ragContext.portfolioStats.loans_in_ca || 0}
- Loans in FL: ${ragContext.portfolioStats.loans_in_fl || 0}
- Loans in TX: ${ragContext.portfolioStats.loans_in_tx || 0}
- Average balance: $${ragContext.portfolioStats.avg_current_balance ? Math.round(ragContext.portfolioStats.avg_current_balance).toLocaleString() : 'N/A'}
- Total portfolio balance: $${ragContext.portfolioStats.total_principal_balance ? Math.round(ragContext.portfolioStats.total_principal_balance).toLocaleString() : 'N/A'}
- Current loans: ${ragContext.portfolioStats.current_loans || 0}
- Delinquent loans: ${ragContext.portfolioStats.delinquent_loans || 0}
- Foreclosure loans: ${ragContext.portfolioStats.foreclosure_loans || 0}

INSTRUCTIONS:
1. Answer based on the retrieved documents and portfolio statistics provided
2. If the retrieved documents don't contain the requested information, explain what data is available
3. Be specific and reference the actual data from the documents
4. Use the portfolio statistics for counts and aggregates
5. Format numbers appropriately (currency, percentages)
6. Keep responses concise and focused
7. IMPORTANT: When listing loans, ensure each loan appears only ONCE in your response. If you find the same loan_id in multiple documents, consolidate the information into a single entry.
8. For "top N" requests, provide exactly N unique loans, not duplicates that fill the list`
    });

    // Add conversation history
    for (const message of conversationHistory) {
      messages.push({
        role: message.role,
        content: message.anonymizedContent || message.content
      });
    }

    // Add current query
    messages.push({
      role: 'user',
      content: currentQuery
    });

    return messages;
  }

  /**
   * Validate user has permission to use AI assistant
   */
  private async validateUserAccess(userContext: UserContext): Promise<void> {
    const userResult = await this.pool.query(`
      SELECT id, organization_id 
      FROM users 
      WHERE id = $1
    `, [userContext.userId]);

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];
    if (user.organization_id !== userContext.organizationId) {
      throw new Error('Organization mismatch');
    }

    const orgResult = await this.pool.query(`
      SELECT ai_assistant_enabled 
      FROM organizations 
      WHERE id = $1
    `, [userContext.organizationId]);

    if (orgResult.rows.length === 0 || !orgResult.rows[0].ai_assistant_enabled) {
      throw new Error('AI Assistant is not enabled for your organization');
    }
  }

  /**
   * Anonymize query text
   */
  private async anonymizeQuery(
    query: string
  ): Promise<{
    anonymizedQuery: string;
    piiMappings: any[];
  }> {
    // For now, simple passthrough - can enhance with PII detection
    return {
      anonymizedQuery: query,
      piiMappings: []
    };
  }

  /**
   * Create new conversation
   */
  private async createConversation(userContext: UserContext): Promise<string> {
    const result = await this.pool.query(`
      INSERT INTO ai_conversations (user_id, organization_id, conversation_title)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [
      userContext.userId,
      userContext.organizationId,
      'AI Assistant Chat (RAG)'
    ]);

    return result.rows[0].id;
  }

  /**
   * Get conversation history
   */
  private async getConversationHistory(
    conversationId: string,
    userId: number
  ): Promise<ConversationMessage[]> {
    const result = await this.pool.query(`
      SELECT message_type, content, anonymized_content, created_at
      FROM ai_messages
      WHERE conversation_id = $1
      AND conversation_id IN (
        SELECT id FROM ai_conversations WHERE user_id = $2
      )
      ORDER BY created_at ASC
      LIMIT 10
    `, [conversationId, userId]);

    return result.rows.map(row => ({
      role: row.message_type === 'user' ? 'user' : 'assistant',
      content: row.content,
      anonymizedContent: row.anonymized_content,
      timestamp: row.created_at
    }));
  }

  /**
   * Save conversation message
   */
  private async saveConversationMessage(
    conversationId: string,
    userId: number,
    userQuery: string,
    anonymizedQuery: string,
    assistantResponse: string,
    anonymizedResponse: string,
    tokenUsage: any,
    piiMappingIds: string[]
  ): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Save user message
      await client.query(`
        INSERT INTO ai_messages (
          conversation_id, message_type, content, anonymized_content, 
          token_count, pii_mappings_used
        ) VALUES ($1, 'user', $2, $3, $4, $5)
      `, [
        conversationId,
        userQuery,
        anonymizedQuery,
        this.openaiService.estimateTokenCount(userQuery),
        JSON.stringify(piiMappingIds)
      ]);

      // Save assistant message
      const messageResult = await client.query(`
        INSERT INTO ai_messages (
          conversation_id, message_type, content, anonymized_content,
          token_count, model_used, pii_mappings_used
        ) VALUES ($1, 'assistant', $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        conversationId,
        assistantResponse,
        anonymizedResponse,
        tokenUsage.totalTokens,
        'gpt-4.1-nano',
        JSON.stringify(piiMappingIds)
      ]);

      await client.query('COMMIT');
      return messageResult.rows[0].id;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Log query for audit purposes
   */
  private async logQuery(
    userId: number,
    conversationId: string,
    messageId: string,
    details: any
  ): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO ai_audit_log (
          user_id, conversation_id, message_id, action, details
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        userId,
        conversationId || null,
        messageId || null,
        details.success ? 'ai_query_success_rag' : 'ai_query_error_rag',
        JSON.stringify(details)
      ]);
    } catch (error) {
      console.error('Failed to log AI query:', error);
    }
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(userId: number): Promise<Array<{
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    lastMessage?: string;
  }>> {
    const result = await this.pool.query(`
      SELECT 
        c.id, c.conversation_title, c.created_at, c.updated_at,
        COUNT(m.id) as message_count,
        (
          SELECT content FROM ai_messages 
          WHERE conversation_id = c.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message
      FROM ai_conversations c
      LEFT JOIN ai_messages m ON m.conversation_id = c.id
      WHERE c.user_id = $1 AND c.is_archived = false
      GROUP BY c.id, c.conversation_title, c.created_at, c.updated_at
      ORDER BY c.updated_at DESC
    `, [userId]);

    return result.rows.map(row => ({
      id: row.id,
      title: row.conversation_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: parseInt(row.message_count),
      lastMessage: row.last_message
    }));
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(
    conversationId: string,
    userId: number
  ): Promise<Array<{
    id: string;
    type: 'user' | 'assistant';
    content: string;
    tokenCount: number;
    createdAt: Date;
  }>> {
    const result = await this.pool.query(`
      SELECT id, message_type, content, token_count, created_at
      FROM ai_messages
      WHERE conversation_id = $1
      AND conversation_id IN (
        SELECT id FROM ai_conversations WHERE user_id = $2
      )
      ORDER BY created_at ASC
    `, [conversationId, userId]);

    return result.rows.map(row => ({
      id: row.id,
      type: row.message_type,
      content: row.content,
      tokenCount: row.token_count || 0,
      createdAt: row.created_at
    }));
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string, userId: number): Promise<void> {
    await this.pool.query(`
      UPDATE ai_conversations 
      SET is_archived = true 
      WHERE id = $1 AND user_id = $2
    `, [conversationId, userId]);
  }
}