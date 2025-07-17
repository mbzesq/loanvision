import { Pool } from 'pg';
import OpenAI from 'openai';

interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  content: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  responseTimeMs: number;
}

interface LoanContext {
  totalLoans: number;
  availableFields: string[];
  sampleLoan: Record<string, any>;
  userPermissions: string[];
}

export class OpenAIService {
  private pool: Pool;
  private openai: OpenAI;
  private config: OpenAIConfig;

  constructor(pool: Pool, config?: Partial<OpenAIConfig>) {
    this.pool = pool;
    
    this.config = {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2048'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
      timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000'),
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout
    });

    console.log('🤖 OpenAI Service initialized with model:', this.config.model);
  }

  /**
   * Generate system prompt for loan portfolio assistant
   */
  private generateSystemPrompt(context: LoanContext): string {
    return `You are an AI assistant for a mortgage portfolio management platform. You help users analyze loan data and answer questions about their mortgage portfolios.

IMPORTANT PRIVACY NOTICE:
- All personally identifiable information (PII) has been anonymized before reaching you
- Names appear as PERSON_XXXX, addresses as ADDRESS_XXXX, SSNs as SSN_XXXX, etc.
- NEVER attempt to guess or reveal actual PII values
- Always respond using the anonymized placeholders provided

PORTFOLIO CONTEXT:
- Total loans in portfolio: ${context.totalLoans}
- Available data fields: ${context.availableFields.join(', ')}
- User permissions: ${context.userPermissions.join(', ')}

SAMPLE LOAN DATA STRUCTURE:
${JSON.stringify(context.sampleLoan, null, 2)}

RESPONSE GUIDELINES:
1. Be concise and professional
2. Use specific data when available
3. Provide actionable insights
4. Format numbers appropriately (currency, percentages)
5. If you need more data, ask specific questions
6. Always use anonymized placeholders in responses
7. Focus on portfolio analysis, risk assessment, and loan performance

EXAMPLE INTERACTIONS:
User: "What's the average credit score?"
Assistant: "The average credit score across your portfolio is 642, with scores ranging from 520 to 780."

User: "Tell me about PERSON_A1B2's loan"
Assistant: "PERSON_A1B2 has a loan with a current balance of $145,000, credit score of 680, and is current on payments."

Remember: You're analyzing anonymized data to protect borrower privacy while providing valuable portfolio insights.`;
  }

  /**
   * Generate a chat completion using OpenAI
   */
  async generateChatCompletion(
    messages: ChatMessage[],
    context: LoanContext,
    userId: number
  ): Promise<OpenAIResponse> {
    const startTime = Date.now();

    try {
      // Add system prompt as first message
      const systemPrompt = this.generateSystemPrompt(context);
      const fullMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      console.log(`🤖 OpenAI request for user ${userId}:`, {
        model: this.config.model,
        messageCount: fullMessages.length,
        maxTokens: this.config.maxTokens
      });

      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: fullMessages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });

      const responseTimeMs = Date.now() - startTime;
      const response = completion.choices[0]?.message?.content || '';
      
      const tokenUsage = {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      };

      console.log(`✅ OpenAI response for user ${userId}:`, {
        responseTimeMs,
        tokenUsage,
        responseLength: response.length
      });

      // Log the API call for monitoring
      await this.logApiCall(userId, {
        model: this.config.model,
        tokenUsage,
        responseTimeMs,
        success: true
      });

      return {
        content: response,
        tokenUsage,
        model: this.config.model,
        responseTimeMs
      };

    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      
      console.error(`❌ OpenAI error for user ${userId}:`, error);
      
      // Log the failed API call
      await this.logApiCall(userId, {
        model: this.config.model,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        responseTimeMs,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Handle specific OpenAI errors
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          throw new Error('OpenAI rate limit exceeded. Please try again later.');
        } else if (error.status === 401) {
          throw new Error('OpenAI authentication failed. Please check API key.');
        } else if (error.status === 400) {
          throw new Error('Invalid request to OpenAI. Please try rephrasing your question.');
        }
      }

      throw new Error(`OpenAI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate that a message is appropriate for loan portfolio analysis
   */
  validateMessage(message: string): { isValid: boolean; reason?: string } {
    const lowerMessage = message.toLowerCase();
    
    // Check for inappropriate content
    const inappropriatePatterns = [
      /personal.*information/i,
      /private.*data/i,
      /hack|exploit|breach/i,
      /password|credential/i,
      /unrelated.*topic/i
    ];

    for (const pattern of inappropriatePatterns) {
      if (pattern.test(message)) {
        return {
          isValid: false,
          reason: 'Message contains inappropriate content for loan portfolio analysis'
        };
      }
    }

    // Check message length
    if (message.length > 2000) {
      return {
        isValid: false,
        reason: 'Message is too long. Please keep queries under 2000 characters.'
      };
    }

    if (message.length < 3) {
      return {
        isValid: false,
        reason: 'Message is too short. Please provide a meaningful question.'
      };
    }

    return { isValid: true };
  }

  /**
   * Estimate token count for a message (rough approximation)
   */
  estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Log OpenAI API call for monitoring and billing
   */
  private async logApiCall(userId: number, details: {
    model: string;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    responseTimeMs: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO ai_audit_log (
          user_id, 
          action, 
          details, 
          created_at
        ) VALUES ($1, $2, $3, NOW())
      `, [
        userId,
        details.success ? 'openai_api_call' : 'openai_api_error',
        JSON.stringify(details)
      ]);
    } catch (error) {
      console.error('Failed to log OpenAI API call:', error);
    }
  }

  /**
   * Get OpenAI service statistics
   */
  async getServiceStats(days: number = 30): Promise<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalTokensUsed: number;
    averageResponseTime: number;
    topUsers: Array<{
      userId: number;
      callCount: number;
      tokenCount: number;
    }>;
  }> {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_calls,
        SUM(CASE WHEN action = 'openai_api_call' THEN 1 ELSE 0 END) as successful_calls,
        SUM(CASE WHEN action = 'openai_api_error' THEN 1 ELSE 0 END) as failed_calls,
        SUM(COALESCE((details->>'tokenUsage')::jsonb->>'totalTokens', '0')::integer) as total_tokens,
        AVG(COALESCE((details->>'responseTimeMs')::integer, 0)) as avg_response_time,
        user_id
      FROM ai_audit_log 
      WHERE action IN ('openai_api_call', 'openai_api_error')
      AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY user_id
      ORDER BY total_calls DESC
    `);

    const totalCalls = result.rows.reduce((sum, row) => sum + parseInt(row.total_calls), 0);
    const successfulCalls = result.rows.reduce((sum, row) => sum + parseInt(row.successful_calls), 0);
    const failedCalls = result.rows.reduce((sum, row) => sum + parseInt(row.failed_calls), 0);
    const totalTokensUsed = result.rows.reduce((sum, row) => sum + parseInt(row.total_tokens || '0'), 0);
    const averageResponseTime = result.rows.reduce((sum, row) => sum + parseFloat(row.avg_response_time || '0'), 0) / result.rows.length;

    const topUsers = result.rows.slice(0, 10).map(row => ({
      userId: row.user_id,
      callCount: parseInt(row.total_calls),
      tokenCount: parseInt(row.total_tokens || '0')
    }));

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      totalTokensUsed,
      averageResponseTime: Math.round(averageResponseTime),
      topUsers
    };
  }

  /**
   * Test OpenAI connectivity
   */
  async testConnection(): Promise<{
    success: boolean;
    model: string;
    responseTimeMs: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'user', content: 'Test connection. Please respond with "Connection successful".' }
        ],
        max_tokens: 10,
        temperature: 0
      });

      const responseTimeMs = Date.now() - startTime;
      const response = completion.choices[0]?.message?.content || '';

      return {
        success: true,
        model: this.config.model,
        responseTimeMs,
      };

    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      
      return {
        success: false,
        model: this.config.model,
        responseTimeMs,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update OpenAI configuration
   */
  updateConfig(newConfig: Partial<OpenAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.apiKey) {
      this.openai = new OpenAI({
        apiKey: newConfig.apiKey,
        timeout: this.config.timeout
      });
    }
    
    console.log('⚙️ OpenAI Service config updated:', {
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): Omit<OpenAIConfig, 'apiKey'> & { apiKey: string } {
    return {
      apiKey: '***hidden***',
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      timeout: this.config.timeout
    };
  }
}