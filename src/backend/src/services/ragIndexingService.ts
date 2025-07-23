import { Pool } from 'pg';
import OpenAI from 'openai';

interface LoanDocument {
  id: string;
  loan_id: string;
  content: string;
  metadata: {
    type: 'loan_summary' | 'foreclosure' | 'property' | 'sol_analysis' | 'financial' | 'payment_history' | 'chain_of_title' | 'collateral';
    state?: string;
    investor_name?: string;
    legal_status?: string;
    current_balance?: number;
    last_updated: Date;
    // Additional standardized fields
    fc_status?: string; // Original foreclosure status
    payment_status?: string; // Current/Delinquent/Default
    sol_status?: string; // Active/Expired/Near_Expiration
  };
  embedding?: number[];
}

/**
 * Metadata Standardization Mappings
 */
class MetadataStandardizer {
  /**
   * Standardize legal status values for consistent querying
   */
  static standardizeLegalStatus(rawStatus: string, documentType: string): string {
    if (!rawStatus) return 'Unknown';
    
    const status = rawStatus.toUpperCase();
    
    // Foreclosure document statuses
    if (documentType === 'foreclosure') {
      if (['ACTIVE', 'HOLD', 'PENDING'].includes(status)) {
        return 'Foreclosure';
      }
      if (status === 'CLOSED') {
        return 'Foreclosure_Closed';
      }
    }
    
    // Daily metrics statuses
    if (['CURRENT', 'PERFORMING'].includes(status)) {
      return 'Current';
    }
    if (['DELINQUENT', 'DELINQ'].includes(status)) {
      return 'Delinquent';
    }
    if (status.startsWith('BK')) {
      return 'Bankruptcy';
    }
    if (['DEFAULT', 'CHARGED_OFF'].includes(status)) {
      return 'Default';
    }
    
    return rawStatus; // Keep original if no mapping found
  }
  
  /**
   * Standardize state field (handle property_state vs state)
   */
  static standardizeState(stateValue: string): string {
    if (!stateValue) return '';
    return stateValue.toUpperCase().trim();
  }
  
  /**
   * Determine payment status from multiple sources
   */
  static determinePaymentStatus(legalStatus: string, daysPastDue?: number): string {
    if (!legalStatus) return 'Unknown';
    
    const status = legalStatus.toUpperCase();
    if (status === 'CURRENT' || status === 'PERFORMING') return 'Current';
    if (status === 'DELINQUENT' || (daysPastDue && daysPastDue > 0)) return 'Delinquent';
    if (status.startsWith('BK')) return 'Bankruptcy';
    if (['DEFAULT', 'CHARGED_OFF'].includes(status)) return 'Default';
    
    return 'Unknown';
  }
}

interface IndexStats {
  totalDocuments: number;
  lastIndexed: Date;
  documentsPerType: Record<string, number>;
}

/**
 * RAG Indexing Service - Creates searchable embeddings from loan data
 * Runs daily to rebuild the search index with fresh data
 */
export class RAGIndexingService {
  private pool: Pool;
  private openai: OpenAI;
  private embeddingModel = 'text-embedding-3-small'; // Cost-efficient, good performance

  constructor(pool: Pool) {
    this.pool = pool;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    console.log('🔍 RAG Indexing Service initialized');
  }

  /**
   * Main indexing pipeline - runs daily via cron job
   */
  async rebuildIndex(): Promise<IndexStats> {
    const startTime = Date.now();
    console.log('🔄 Starting daily RAG index rebuild...');

    try {
      // Clear existing index
      await this.clearIndex();

      // Generate documents for each data type
      const loanSummaries = await this.generateLoanSummaryDocuments();
      const foreclosureDocuments = await this.generateForeclosureDocuments();
      const propertyDocuments = await this.generatePropertyDocuments();
      const solDocuments = await this.generateSOLDocuments();
      const financialDocuments = await this.generateFinancialDocuments();
      
      // New comprehensive document types
      const paymentHistoryDocuments = await this.generatePaymentHistoryDocuments();
      const chainOfTitleDocuments = await this.generateChainOfTitleDocuments();
      const collateralDocuments = await this.generateCollateralDocuments();

      const allDocuments = [
        ...loanSummaries,
        ...foreclosureDocuments,
        ...propertyDocuments,
        ...solDocuments,
        ...financialDocuments,
        ...paymentHistoryDocuments,
        ...chainOfTitleDocuments,
        ...collateralDocuments
      ];

      console.log(`📊 Generated ${allDocuments.length} documents for indexing`);

      // Generate embeddings in batches
      await this.generateAndStoreEmbeddings(allDocuments);

      const stats: IndexStats = {
        totalDocuments: allDocuments.length,
        lastIndexed: new Date(),
        documentsPerType: {
          loan_summary: loanSummaries.length,
          foreclosure: foreclosureDocuments.length,
          property: propertyDocuments.length,
          sol_analysis: solDocuments.length,
          financial: financialDocuments.length,
          payment_history: paymentHistoryDocuments.length,
          chain_of_title: chainOfTitleDocuments.length,
          collateral: collateralDocuments.length
        }
      };

      // Store indexing metadata
      await this.storeIndexStats(stats);

      console.log(`✅ RAG index rebuilt in ${Date.now() - startTime}ms`);
      console.log('📈 Index stats:', stats);

      return stats;

    } catch (error) {
      console.error('❌ RAG index rebuild failed:', error);
      throw error;
    }
  }

  /**
   * Generate loan summary documents - one per loan with key information
   */
  private async generateLoanSummaryDocuments(): Promise<LoanDocument[]> {
    const query = `
      SELECT 
        loan_id,
        CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as borrower_name,
        address, city, state, zip,
        prin_bal, org_amount, int_rate, pi_pmt,
        investor_name, legal_status, loan_type,
        origination_date, maturity_date,
        last_pymt_received, next_pymt_due
      FROM daily_metrics_current
    `;

    const result = await this.pool.query(query);
    const documents: LoanDocument[] = [];

    for (const loan of result.rows) {
      const content = this.formatLoanSummary(loan);
      
      documents.push({
        id: `loan_summary_${loan.loan_id}`,
        loan_id: loan.loan_id,
        content,
        metadata: {
          type: 'loan_summary',
          state: MetadataStandardizer.standardizeState(loan.state),
          investor_name: loan.investor_name,
          legal_status: MetadataStandardizer.standardizeLegalStatus(loan.legal_status, 'loan_summary'),
          payment_status: MetadataStandardizer.determinePaymentStatus(loan.legal_status),
          current_balance: loan.prin_bal,
          last_updated: new Date()
        }
      });
    }

    return documents;
  }

  /**
   * Generate foreclosure-specific documents
   */
  private async generateForeclosureDocuments(): Promise<LoanDocument[]> {
    const query = `
      SELECT 
        fe.loan_id,
        fe.fc_status,
        fe.complaint_filed_date,
        fe.sale_scheduled_date,
        fe.current_attorney,
        dmc.state,
        dmc.investor_name,
        dmc.prin_bal
      FROM foreclosure_events fe
      JOIN daily_metrics_current dmc ON fe.loan_id = dmc.loan_id
      WHERE fe.fc_status IS NOT NULL
    `;

    const result = await this.pool.query(query);
    const documents: LoanDocument[] = [];

    for (const fc of result.rows) {
      const content = this.formatForeclosureDocument(fc);
      
      documents.push({
        id: `foreclosure_${fc.loan_id}`,
        loan_id: fc.loan_id,
        content,
        metadata: {
          type: 'foreclosure',
          state: MetadataStandardizer.standardizeState(fc.state),
          investor_name: fc.investor_name,
          legal_status: MetadataStandardizer.standardizeLegalStatus(fc.fc_status, 'foreclosure'),
          fc_status: fc.fc_status, // Keep original status too
          current_balance: fc.prin_bal,
          last_updated: new Date()
        }
      });
    }

    return documents;
  }

  /**
   * Generate property-specific documents
   */
  private async generatePropertyDocuments(): Promise<LoanDocument[]> {
    const query = `
      SELECT 
        pdc.loan_id,
        pdc.property_data,
        pdc.source,
        dmc.address,
        dmc.city,
        dmc.state,
        dmc.zip,
        dmc.investor_name,
        dmc.prin_bal
      FROM property_data_current pdc
      JOIN daily_metrics_current dmc ON pdc.loan_id = dmc.loan_id
      WHERE pdc.property_data IS NOT NULL
    `;

    const result = await this.pool.query(query);
    const documents: LoanDocument[] = [];

    for (const prop of result.rows) {
      const content = this.formatPropertyDocument(prop);
      
      documents.push({
        id: `property_${prop.loan_id}`,
        loan_id: prop.loan_id,
        content,
        metadata: {
          type: 'property',
          state: prop.state,
          investor_name: prop.investor_name,
          current_balance: prop.prin_bal,
          last_updated: new Date()
        }
      });
    }

    return documents;
  }

  /**
   * Generate SOL analysis documents
   */
  private async generateSOLDocuments(): Promise<LoanDocument[]> {
    const query = `
      SELECT 
        lsc.loan_id,
        lsc.sol_expiration_date,
        lsc.days_until_expiration,
        lsc.sol_risk_level,
        lsc.sol_risk_score,
        lsc.risk_factors,
        lsc.is_expired,
        dmc.state,
        dmc.investor_name,
        dmc.prin_bal,
        dmc.last_pymt_received
      FROM loan_sol_calculations lsc
      JOIN daily_metrics_current dmc ON lsc.loan_id = dmc.loan_id
    `;

    const result = await this.pool.query(query);
    const documents: LoanDocument[] = [];

    for (const sol of result.rows) {
      const content = this.formatSOLDocument(sol);
      
      documents.push({
        id: `sol_${sol.loan_id}`,
        loan_id: sol.loan_id,
        content,
        metadata: {
          type: 'sol_analysis',
          state: sol.state,
          investor_name: sol.investor_name,
          current_balance: sol.prin_bal,
          last_updated: new Date()
        }
      });
    }

    return documents;
  }

  /**
   * Generate financial performance documents
   */
  private async generateFinancialDocuments(): Promise<LoanDocument[]> {
    const query = `
      SELECT 
        dmc.loan_id,
        dmc.prin_bal,
        dmc.org_amount,
        dmc.int_rate,
        dmc.pi_pmt,
        dmc.unapplied_bal,
        dmc.remg_term,
        dmc.last_pymt_received,
        dmc.next_pymt_due,
        dmc.state,
        dmc.investor_name,
        -- Recent payment history (last 6 months)
        COALESCE(dmc.july_2025, 0) + COALESCE(dmc.august_2025, 0) + 
        COALESCE(dmc.september_2025, 0) + COALESCE(dmc.october_2025, 0) + 
        COALESCE(dmc.november_2025, 0) + COALESCE(dmc.december_2025, 0) as recent_payments
      FROM daily_metrics_current dmc
    `;

    const result = await this.pool.query(query);
    const documents: LoanDocument[] = [];

    for (const financial of result.rows) {
      const content = this.formatFinancialDocument(financial);
      
      documents.push({
        id: `financial_${financial.loan_id}`,
        loan_id: financial.loan_id,
        content,
        metadata: {
          type: 'financial',
          state: financial.state,
          investor_name: financial.investor_name,
          current_balance: financial.prin_bal,
          last_updated: new Date()
        }
      });
    }

    return documents;
  }

  /**
   * Generate payment history documents
   */
  private async generatePaymentHistoryDocuments(): Promise<LoanDocument[]> {
    const query = `
      SELECT 
        mcd.loan_id,
        mcd.month_year,
        mcd.payment_amount,
        mcd.principal_paid,
        mcd.interest_paid,
        mcd.fees_paid,
        mcd.ending_balance,
        mcd.payment_status,
        dmc.state,
        dmc.investor_name,
        dmc.prin_bal
      FROM monthly_cashflow_data mcd
      JOIN daily_metrics_current dmc ON mcd.loan_id = dmc.loan_id
      WHERE mcd.payment_amount IS NOT NULL OR mcd.payment_status IS NOT NULL
      ORDER BY mcd.loan_id, mcd.month_year DESC
    `;

    const result = await this.pool.query(query);
    const documents: LoanDocument[] = [];
    
    // Group by loan_id and create summary documents
    const loanPaymentMap = new Map<string, any[]>();
    result.rows.forEach(row => {
      if (!loanPaymentMap.has(row.loan_id)) {
        loanPaymentMap.set(row.loan_id, []);
      }
      loanPaymentMap.get(row.loan_id)!.push(row);
    });

    for (const [loanId, payments] of loanPaymentMap) {
      const recentPayments = payments.slice(0, 12); // Last 12 months
      const content = this.formatPaymentHistoryDocument(loanId, recentPayments);
      
      documents.push({
        id: `payment_history_${loanId}`,
        loan_id: loanId,
        content,
        metadata: {
          type: 'payment_history',
          state: MetadataStandardizer.standardizeState(recentPayments[0]?.state),
          investor_name: recentPayments[0]?.investor_name,
          payment_status: MetadataStandardizer.determinePaymentStatus(recentPayments[0]?.payment_status),
          current_balance: recentPayments[0]?.prin_bal,
          last_updated: new Date()
        }
      });
    }

    return documents;
  }

  /**
   * Generate chain of title documents
   */
  private async generateChainOfTitleDocuments(): Promise<LoanDocument[]> {
    const query = `
      SELECT 
        cot.loan_id,
        cot.transfer_date,
        cot.from_entity,
        cot.to_entity,
        cot.transfer_type,
        cot.recording_info,
        cot.document_type,
        dmc.state,
        dmc.investor_name,
        dmc.prin_bal
      FROM chain_of_title cot
      JOIN daily_metrics_current dmc ON cot.loan_id = dmc.loan_id
      ORDER BY cot.loan_id, cot.transfer_date DESC
    `;

    const result = await this.pool.query(query);
    const documents: LoanDocument[] = [];
    
    // Group by loan_id
    const loanTitleMap = new Map<string, any[]>();
    result.rows.forEach(row => {
      if (!loanTitleMap.has(row.loan_id)) {
        loanTitleMap.set(row.loan_id, []);
      }
      loanTitleMap.get(row.loan_id)!.push(row);
    });

    for (const [loanId, titleHistory] of loanTitleMap) {
      const content = this.formatChainOfTitleDocument(loanId, titleHistory);
      
      documents.push({
        id: `chain_of_title_${loanId}`,
        loan_id: loanId,
        content,
        metadata: {
          type: 'chain_of_title',
          state: MetadataStandardizer.standardizeState(titleHistory[0]?.state),
          investor_name: titleHistory[0]?.investor_name,
          current_balance: titleHistory[0]?.prin_bal,
          last_updated: new Date()
        }
      });
    }

    return documents;
  }

  /**
   * Generate collateral status documents
   */
  private async generateCollateralDocuments(): Promise<LoanDocument[]> {
    const query = `
      SELECT 
        lcs.loan_id,
        lcs.collateral_type,
        lcs.collateral_status,
        lcs.valuation_date,
        lcs.current_value,
        lcs.original_value,
        lcs.valuation_method,
        lcs.notes,
        dmc.state,
        dmc.investor_name,
        dmc.prin_bal
      FROM loan_collateral_status lcs
      JOIN daily_metrics_current dmc ON lcs.loan_id = dmc.loan_id
    `;

    const result = await this.pool.query(query);
    const documents: LoanDocument[] = [];

    for (const collateral of result.rows) {
      const content = this.formatCollateralDocument(collateral);
      
      documents.push({
        id: `collateral_${collateral.loan_id}`,
        loan_id: collateral.loan_id,
        content,
        metadata: {
          type: 'collateral',
          state: MetadataStandardizer.standardizeState(collateral.state),
          investor_name: collateral.investor_name,
          current_balance: collateral.prin_bal,
          last_updated: new Date()
        }
      });
    }

    return documents;
  }

  /**
   * Format loan summary for embedding
   */
  private formatLoanSummary(loan: any): string {
    return `Loan ${loan.loan_id} for borrower ${loan.borrower_name} located at ${loan.address}, ${loan.city}, ${loan.state} ${loan.zip}. 
Current balance: $${loan.prin_bal?.toLocaleString() || 'N/A'}, Original amount: $${loan.org_amount?.toLocaleString() || 'N/A'}, 
Interest rate: ${loan.int_rate}%, Monthly payment: $${loan.pi_pmt?.toLocaleString() || 'N/A'}. 
Investor: ${loan.investor_name}, Legal status: ${loan.legal_status}, Loan type: ${loan.loan_type}. 
Originated: ${loan.origination_date}, Matures: ${loan.maturity_date}. 
Last payment: ${loan.last_pymt_received}, Next due: ${loan.next_pymt_due}.`;
  }

  /**
   * Format foreclosure document for embedding
   */
  private formatForeclosureDocument(fc: any): string {
    return `Foreclosure case for loan ${fc.loan_id} in ${fc.state}. 
Status: ${fc.fc_status}, Filed: ${fc.complaint_filed_date || 'Not filed'}, Sale date: ${fc.sale_scheduled_date || 'Not scheduled'}. 
Attorney: ${fc.current_attorney || 'Not assigned'}. 
Current balance: $${fc.prin_bal?.toLocaleString() || 'N/A'}, Investor: ${fc.investor_name}.`;
  }

  /**
   * Format property document for embedding
   */
  private formatPropertyDocument(prop: any): string {
    // Extract property details from JSONB data
    const propertyData = prop.property_data || {};
    const propertyType = propertyData.property_type || propertyData.type || 'Unknown';
    const bedrooms = propertyData.bedrooms || propertyData.beds || 'N/A';
    const bathrooms = propertyData.bathrooms || propertyData.baths || 'N/A';
    const squareFeet = propertyData.square_feet || propertyData.sqft || propertyData.size || 'N/A';
    const yearBuilt = propertyData.year_built || propertyData.built || 'N/A';
    const estimatedValue = propertyData.estimated_value || propertyData.value || propertyData.appraisal;
    
    return `Property for loan ${prop.loan_id} at ${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}. 
Type: ${propertyType}, ${bedrooms} bedrooms, ${bathrooms} bathrooms, ${squareFeet} sq ft. 
Built: ${yearBuilt}, Estimated value: $${estimatedValue ? estimatedValue.toLocaleString() : 'N/A'}. 
Data source: ${prop.source || 'Manual'}, Current loan balance: $${prop.prin_bal?.toLocaleString() || 'N/A'}, Investor: ${prop.investor_name}.`;
  }

  /**
   * Format SOL document for embedding
   */
  private formatSOLDocument(sol: any): string {
    const riskFactors = sol.risk_factors ? Object.keys(sol.risk_factors).join(', ') : 'None identified';
    const statusText = sol.is_expired ? 'EXPIRED' : `${sol.days_until_expiration} days remaining`;
    
    return `Statute of limitations analysis for loan ${sol.loan_id} in ${sol.state}. 
SOL expires: ${sol.sol_expiration_date}, Status: ${statusText}, Risk level: ${sol.sol_risk_level}, Risk score: ${sol.sol_risk_score}. 
Risk factors: ${riskFactors}. Last payment: ${sol.last_pymt_received}. 
Current balance: $${sol.prin_bal?.toLocaleString() || 'N/A'}, Investor: ${sol.investor_name}.`;
  }

  /**
   * Format financial document for embedding
   */
  private formatFinancialDocument(financial: any): string {
    const paymentStatus = financial.recent_payments > 0 ? 'Making payments' : 'No recent payments';
    const ltv = financial.prin_bal && financial.org_amount ? 
      ((financial.prin_bal / financial.org_amount) * 100).toFixed(1) : 'N/A';

    return `Financial profile for loan ${financial.loan_id}. 
Current balance: $${financial.prin_bal?.toLocaleString() || 'N/A'} (${ltv}% of original), 
Monthly payment: $${financial.pi_pmt?.toLocaleString() || 'N/A'}, Interest rate: ${financial.int_rate}%. 
Payment status: ${paymentStatus}, Unapplied balance: $${financial.unapplied_bal?.toLocaleString() || '0'}. 
Remaining term: ${financial.remg_term} months, Next payment due: ${financial.next_pymt_due}. 
State: ${financial.state}, Investor: ${financial.investor_name}.`;
  }

  /**
   * Format payment history document for embedding
   */
  private formatPaymentHistoryDocument(loanId: string, payments: any[]): string {
    if (payments.length === 0) {
      return `Payment history for loan ${loanId}: No payment records available.`;
    }

    const totalPayments = payments.length;
    const totalAmount = payments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
    const avgPayment = totalAmount / totalPayments;
    const recentPayment = payments[0];
    const missedPayments = payments.filter(p => p.payment_status === 'MISSED').length;

    return `Payment history for loan ${loanId} over last ${totalPayments} months. 
Total payments: $${totalAmount.toLocaleString()}, Average: $${avgPayment.toLocaleString()}, 
Missed payments: ${missedPayments}. Recent payment (${recentPayment.month_year}): $${recentPayment.payment_amount?.toLocaleString() || '0'}, 
Status: ${recentPayment.payment_status}, Ending balance: $${recentPayment.ending_balance?.toLocaleString() || 'N/A'}. 
State: ${recentPayment.state}, Investor: ${recentPayment.investor_name}.`;
  }

  /**
   * Format chain of title document for embedding
   */
  private formatChainOfTitleDocument(loanId: string, titleHistory: any[]): string {
    if (titleHistory.length === 0) {
      return `Chain of title for loan ${loanId}: No title transfer records available.`;
    }

    const transfers = titleHistory.length;
    const currentOwner = titleHistory[0];
    const originalOwner = titleHistory[titleHistory.length - 1];
    const transferTypes = [...new Set(titleHistory.map(t => t.transfer_type))].join(', ');

    return `Chain of title for loan ${loanId} with ${transfers} transfers. 
Current owner: ${currentOwner.to_entity}, Original owner: ${originalOwner.from_entity}. 
Transfer types: ${transferTypes}. Most recent transfer: ${currentOwner.transfer_date} 
from ${currentOwner.from_entity} to ${currentOwner.to_entity} (${currentOwner.transfer_type}). 
State: ${currentOwner.state}, Investor: ${currentOwner.investor_name}.`;
  }

  /**
   * Format collateral document for embedding
   */
  private formatCollateralDocument(collateral: any): string {
    const valueChange = collateral.current_value && collateral.original_value ? 
      ((collateral.current_value - collateral.original_value) / collateral.original_value * 100).toFixed(1) : 'N/A';
    
    return `Collateral for loan ${collateral.loan_id}: ${collateral.collateral_type}, 
Status: ${collateral.collateral_status}. Original value: $${collateral.original_value?.toLocaleString() || 'N/A'}, 
Current value: $${collateral.current_value?.toLocaleString() || 'N/A'} (${valueChange}% change). 
Valuation date: ${collateral.valuation_date}, Method: ${collateral.valuation_method}. 
Notes: ${collateral.notes || 'None'}. State: ${collateral.state}, Investor: ${collateral.investor_name}.`;
  }

  /**
   * Generate embeddings for documents in batches
   */
  private async generateAndStoreEmbeddings(documents: LoanDocument[]): Promise<void> {
    const batchSize = 100; // OpenAI embedding batch limit
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`🔄 Processing embeddings batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);

      try {
        // Generate embeddings for the batch
        const embeddingResponse = await this.openai.embeddings.create({
          model: this.embeddingModel,
          input: batch.map(doc => doc.content)
        });

        // Store documents with embeddings
        for (let j = 0; j < batch.length; j++) {
          batch[j].embedding = embeddingResponse.data[j].embedding;
        }

        // Save to database
        await this.storeLoanDocuments(batch);

      } catch (error) {
        console.error(`❌ Failed to process batch ${i / batchSize + 1}:`, error);
        throw error;
      }
    }
  }

  /**
   * Store loan documents with embeddings in database
   */
  private async storeLoanDocuments(documents: LoanDocument[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      for (const doc of documents) {
        await client.query(`
          INSERT INTO rag_loan_documents (
            id, loan_id, content, metadata, embedding, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          doc.id,
          doc.loan_id,
          doc.content,
          JSON.stringify(doc.metadata),
          JSON.stringify(doc.embedding)
        ]);
      }

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clear existing index
   */
  private async clearIndex(): Promise<void> {
    await this.pool.query('DELETE FROM rag_loan_documents');
    console.log('🗑️ Cleared existing RAG index');
  }

  /**
   * Store indexing statistics
   */
  private async storeIndexStats(stats: IndexStats): Promise<void> {
    await this.pool.query(`
      INSERT INTO rag_index_stats (
        total_documents, last_indexed, documents_per_type, created_at
      ) VALUES ($1, $2, $3, NOW())
    `, [
      stats.totalDocuments,
      stats.lastIndexed,
      JSON.stringify(stats.documentsPerType)
    ]);
  }

  /**
   * Get current index statistics
   */
  async getIndexStats(): Promise<IndexStats | null> {
    const result = await this.pool.query(`
      SELECT total_documents, last_indexed, documents_per_type
      FROM rag_index_stats
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) return null;

    return {
      totalDocuments: result.rows[0].total_documents,
      lastIndexed: result.rows[0].last_indexed,
      documentsPerType: result.rows[0].documents_per_type
    };
  }

  /**
   * Health check for the indexing service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'needs_reindex' | 'error';
    lastIndexed?: Date;
    totalDocuments?: number;
    message: string;
  }> {
    try {
      const stats = await this.getIndexStats();
      
      if (!stats) {
        return {
          status: 'needs_reindex',
          message: 'No index found - initial indexing required'
        };
      }

      const hoursSinceIndex = (Date.now() - stats.lastIndexed.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceIndex > 26) { // More than 26 hours old
        return {
          status: 'needs_reindex',
          lastIndexed: stats.lastIndexed,
          totalDocuments: stats.totalDocuments,
          message: 'Index is stale - reindexing recommended'
        };
      }

      return {
        status: 'healthy',
        lastIndexed: stats.lastIndexed,
        totalDocuments: stats.totalDocuments,
        message: 'Index is current and healthy'
      };

    } catch (error) {
      return {
        status: 'error',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}