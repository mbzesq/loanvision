import { Pool } from 'pg';
import { PIIAnonymizationService } from './piiAnonymizationService';
import { OpenAIService } from './openAIService';
import { AIRateLimitService } from './aiRateLimitService';

interface UserContext {
  userId: number;
  organizationId: number;
  permissions: string[];
  firstName: string;
  lastName: string;
}

interface LoanQueryContext {
  totalLoans: number;
  availableFields: string[];
  sampleLoan: Record<string, any>;
  userPermissions: string[];
  filteredLoans?: any[];
  dataSourceInfo?: any;
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
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  anonymizedContent?: string;
  timestamp: Date;
}

export class AIQueryProcessor {
  private pool: Pool;
  private piiService: PIIAnonymizationService;
  private openaiService: OpenAIService;
  private rateLimitService: AIRateLimitService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.piiService = new PIIAnonymizationService(pool);
    this.openaiService = new OpenAIService(pool);
    this.rateLimitService = new AIRateLimitService(pool);
    
    console.log('🧠 AI Query Processor initialized');
  }

  /**
   * Process an AI query with full privacy protection
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
        this.openaiService.estimateTokenCount(request.query)
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

      // 5. Build loan context with user permissions
      const loanContext = await this.buildLoanContext(userContext, request);

      // 6. Get conversation history
      const conversationHistory = await this.getConversationHistory(conversationId, userContext.userId);

      // 7. Anonymize query and build messages
      const { anonymizedQuery, piiMappings } = await this.anonymizeQuery(request.query, loanContext);

      // 8. Prepare messages for OpenAI
      const messages = this.buildChatMessages(conversationHistory, anonymizedQuery);

      // 9. Call OpenAI API
      const openaiResponse = await this.openaiService.generateChatCompletion(
        messages,
        loanContext,
        userContext.userId
      );

      // 10. De-anonymize response
      const deAnonymizedResponse = await this.piiService.deAnonymizeText(
        openaiResponse.content,
        piiMappings
      );

      // 11. Save conversation messages
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

      // 12. Update rate limits
      const rateLimitStatus = await this.rateLimitService.recordUsage(userContext.userId, {
        queries: 1,
        tokens: openaiResponse.tokenUsage.totalTokens
      });

      // 13. Log successful query
      await this.logQuery(userContext.userId, conversationId, messageId, {
        query: request.query,
        responseTime: Date.now() - startTime,
        tokenUsage: openaiResponse.tokenUsage,
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
        piiMappingsUsed: deAnonymizedResponse.mappingsUsed
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
   * Validate user has permission to use AI assistant
   */
  private async validateUserAccess(userContext: UserContext): Promise<void> {
    // Check if user exists
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

    // Check if AI assistant is enabled for this organization
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
   * Build loan context based on user permissions
   */
  private async buildLoanContext(
    userContext: UserContext,
    request: AIQueryRequest
  ): Promise<LoanQueryContext> {
    // Get list of accessible loan IDs first
    const accessibleLoanIds = await this.getAccessibleLoanIds(userContext);
    
    if (accessibleLoanIds.length === 0) {
      return {
        totalLoans: 0,
        availableFields: [],
        sampleLoan: {},
        userPermissions: userContext.permissions,
        filteredLoans: undefined,
        dataSourceInfo: this.getDataSourceInfo()
      };
    }

    // Get core loan data
    const coreLoanData = await this.getCoreLoanData(accessibleLoanIds, request.maxResults);
    
    // Build comprehensive context including data source information
    const context: LoanQueryContext = {
      totalLoans: coreLoanData.length,
      availableFields: coreLoanData.length > 0 ? Object.keys(coreLoanData[0]) : [],
      sampleLoan: {},
      userPermissions: userContext.permissions,
      filteredLoans: request.includeContext ? coreLoanData : undefined,
      dataSourceInfo: this.getDataSourceInfo()
    };

    // Create a sample loan for context (anonymized)
    if (coreLoanData.length > 0) {
      const { anonymizedData } = await this.piiService.anonymizeLoanData([coreLoanData[0]]);
      context.sampleLoan = anonymizedData[0] || {};
    }

    return context;
  }

  /**
   * Get core loan data from daily_metrics_current
   */
  private async getCoreLoanData(loanIds: string[], maxResults?: number): Promise<any[]> {
    const query = `
      SELECT 
        dmc.loan_id,
        CONCAT(COALESCE(dmc.first_name, ''), ' ', COALESCE(dmc.last_name, '')) as borrower_name,
        dmc.address as property_address, 
        dmc.city as property_city, 
        dmc.state as property_state, 
        dmc.zip as property_zip,
        dmc.prin_bal as current_balance,
        dmc.org_amount as original_balance,
        dmc.int_rate as interest_rate,
        dmc.pi_pmt as monthly_payment,
        dmc.last_pymt_received as last_payment_date,
        dmc.next_pymt_due,
        dmc.investor_name,
        dmc.legal_status,
        dmc.loan_type,
        dmc.origination_date,
        dmc.maturity_date,
        dmc.lien_pos as lien_position
      FROM daily_metrics_current dmc
      WHERE dmc.loan_id = ANY($1)
      ORDER BY dmc.created_at DESC
      ${maxResults ? `LIMIT ${maxResults}` : 'LIMIT 1000'}
    `;

    const result = await this.pool.query(query, [loanIds]);
    return result.rows;
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
        collateral_documents: "Uploaded documents by loan",
        document_analysis: "AI analysis of uploaded documents",
        monthly_cashflow_data: "Monthly payment and cash flow history",
        enrichments: "Third-party data enrichments",
        chain_of_title: "Property ownership history"
      },
      queryExamples: {
        "Basic loan info": "SELECT * FROM daily_metrics_current WHERE state = 'NY'",
        "Foreclosure data": "SELECT * FROM foreclosure_events WHERE fc_status = 'Active'",
        "SOL analysis": "SELECT * FROM loan_sol_calculations WHERE days_until_expiration < 90",
        "Property details": "SELECT * FROM property_data_current WHERE estimated_value > 500000",
        "Document status": "SELECT loan_id, COUNT(*) FROM collateral_documents GROUP BY loan_id"
      }
    };
  }

  /**
   * Get list of loan IDs that the user's organization has access to
   */
  private async getAccessibleLoanIds(userContext: UserContext): Promise<string[]> {
    // Debug: Let's see what we're working with
    console.log(`🔍 DEBUG: Getting accessible loans for organization ${userContext.organizationId}`);
    
    // First, check total loans in system
    const totalLoansResult = await this.pool.query(`
      SELECT COUNT(*) as total_loans,
             COUNT(CASE WHEN state = 'NY' THEN 1 END) as ny_loans
      FROM daily_metrics_current
    `);
    console.log(`🔍 DEBUG: Total loans in system: ${totalLoansResult.rows[0].total_loans}, NY loans: ${totalLoansResult.rows[0].ny_loans}`);
    
    // Check organization investors
    const orgInvestorsResult = await this.pool.query(`
      SELECT investor_name, is_active 
      FROM organization_investors 
      WHERE organization_id = $1
    `, [userContext.organizationId]);
    console.log(`🔍 DEBUG: Organization investors:`, orgInvestorsResult.rows);
    
    // Check organization loan access
    const orgLoanAccessResult = await this.pool.query(`
      SELECT COUNT(*) as explicit_grants 
      FROM organization_loan_access 
      WHERE organization_id = $1 AND is_active = true
    `, [userContext.organizationId]);
    console.log(`🔍 DEBUG: Explicit loan grants: ${orgLoanAccessResult.rows[0].explicit_grants}`);
    
    const accessQuery = `
      SELECT DISTINCT dmc.loan_id
      FROM daily_metrics_current dmc
      WHERE (
        -- Primary access: via investor name mapping
        EXISTS (
          SELECT 1 FROM organization_investors oi 
          WHERE oi.organization_id = $1 
          AND oi.investor_name = dmc.investor_name 
          AND oi.is_active = true
        )
        -- Additional access: explicit loan grants
        OR EXISTS (
          SELECT 1 FROM organization_loan_access ola 
          WHERE ola.organization_id = $1 
          AND ola.loan_id = dmc.loan_id 
          AND ola.is_active = true 
          AND (ola.expires_at IS NULL OR ola.expires_at > NOW())
        )
      )
      -- Exclude loans that are explicitly denied
      AND NOT EXISTS (
        SELECT 1 FROM organization_loan_access ola 
        WHERE ola.organization_id = $1 
        AND ola.loan_id = dmc.loan_id 
        AND ola.is_active = false 
        AND ola.access_type IN ('owner', 'servicer', 'viewer', 'collaborator')
        AND (ola.expires_at IS NULL OR ola.expires_at > NOW())
      )
    `;

    const result = await this.pool.query(accessQuery, [userContext.organizationId]);
    console.log(`🔍 DEBUG: Accessible loans found: ${result.rows.length}`);
    
    return result.rows.map(row => row.loan_id);
  }

  /**
   * Anonymize query and any embedded loan data
   */
  private async anonymizeQuery(
    query: string,
    loanContext: LoanQueryContext
  ): Promise<{
    anonymizedQuery: string;
    piiMappings: any[];
  }> {
    let anonymizedQuery = query;
    let allMappings: any[] = [];

    // If we have loan context, anonymize any loan data references
    if (loanContext.filteredLoans) {
      const { anonymizedData, mappings } = await this.piiService.anonymizeLoanData(
        loanContext.filteredLoans
      );
      allMappings = mappings;

      // Build anonymized loan context string
      const contextString = JSON.stringify(anonymizedData, null, 2);
      anonymizedQuery = `${query}\n\nLoan Data Context:\n${contextString}`;
    }

    return {
      anonymizedQuery,
      piiMappings: allMappings
    };
  }

  /**
   * Build chat messages for OpenAI
   */
  private buildChatMessages(
    conversationHistory: ConversationMessage[],
    currentQuery: string
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history (using anonymized content)
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
      'AI Assistant Chat'
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
      LIMIT 20
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
        details.success ? 'ai_query_success' : 'ai_query_error',
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

  /**
   * Get AI assistant statistics
   */
  async getAIStats(organizationId: number): Promise<{
    totalQueries: number;
    totalTokens: number;
    activeUsers: number;
    avgResponseTime: number;
    topQueries: string[];
  }> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_queries,
        SUM(token_count) as total_tokens,
        COUNT(DISTINCT c.user_id) as active_users,
        AVG(response_time_ms) as avg_response_time
      FROM ai_messages m
      JOIN ai_conversations c ON c.id = m.conversation_id
      WHERE c.organization_id = $1
      AND m.created_at >= NOW() - INTERVAL '30 days'
    `, [organizationId]);

    const stats = result.rows[0];
    
    return {
      totalQueries: parseInt(stats.total_queries || '0'),
      totalTokens: parseInt(stats.total_tokens || '0'),
      activeUsers: parseInt(stats.active_users || '0'),
      avgResponseTime: Math.round(parseFloat(stats.avg_response_time || '0')),
      topQueries: [] // Could be implemented with additional query
    };
  }
}