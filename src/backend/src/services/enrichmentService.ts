import pool from '../db';

export interface EnrichmentData {
    value: number;
    date: string;
    confidence?: number;
}

export const enrichLoanWithAvm = async (loanId: number): Promise<void> => {
    try {
        // Simulate AVM API call delay (0.5-2 seconds)
        const delay = Math.random() * 1500 + 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Generate simulated AVM value between $250,000 and $750,000
        const minValue = 250000;
        const maxValue = 750000;
        const simulatedValue = Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
        
        // Create enrichment data
        const enrichmentData: EnrichmentData = {
            value: simulatedValue,
            date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
            confidence: Math.floor(Math.random() * 20) + 80 // Simulated confidence between 80-99%
        };
        
        // Check if AVM enrichment already exists for this loan
        const existingResult = await pool.query(
            'SELECT id FROM enrichments WHERE loan_id = $1 AND enrichment_type = $2',
            [loanId, 'AVM']
        );
        
        if (existingResult.rows.length > 0) {
            // Update existing enrichment
            await pool.query(
                'UPDATE enrichments SET data = $1, updated_at = NOW() WHERE loan_id = $2 AND enrichment_type = $3',
                [JSON.stringify(enrichmentData), loanId, 'AVM']
            );
            console.log(`Updated AVM enrichment for loan ID ${loanId}: $${simulatedValue.toLocaleString()}`);
        } else {
            // Insert new enrichment
            await pool.query(
                'INSERT INTO enrichments (loan_id, enrichment_type, provider, data) VALUES ($1, $2, $3, $4)',
                [loanId, 'AVM', 'Simulated AVM Provider', JSON.stringify(enrichmentData)]
            );
            console.log(`Created AVM enrichment for loan ID ${loanId}: $${simulatedValue.toLocaleString()}`);
        }
    } catch (error) {
        console.error(`Error enriching loan ${loanId} with AVM:`, error);
        // Don't throw error to avoid disrupting the upload process
    }
};

export const runEnrichmentJob = async (uploadSessionId: string): Promise<void> => {
    try {
        console.log(`Starting enrichment job for upload session: ${uploadSessionId}`);
        
        // Get all loans from this upload session
        const result = await pool.query(
            'SELECT id FROM loans WHERE upload_session_id = $1',
            [uploadSessionId]
        );
        
        const loanIds = result.rows.map(row => row.id);
        console.log(`Found ${loanIds.length} loans to enrich`);
        
        // Process enrichments for all loans (don't await to make it truly background)
        const enrichmentPromises = loanIds.map(loanId => enrichLoanWithAvm(loanId));
        
        // Process in batches to avoid overwhelming the system
        const batchSize = 5;
        for (let i = 0; i < enrichmentPromises.length; i += batchSize) {
            const batch = enrichmentPromises.slice(i, i + batchSize);
            await Promise.all(batch);
            
            // Small delay between batches
            if (i + batchSize < enrichmentPromises.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        console.log(`Completed enrichment job for upload session: ${uploadSessionId}`);
    } catch (error) {
        console.error(`Error in enrichment job for session ${uploadSessionId}:`, error);
    }
};