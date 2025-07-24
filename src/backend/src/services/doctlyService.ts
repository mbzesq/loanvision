import axios from 'axios';
import FormData from 'form-data';

export interface DoctlyProcessingResult {
  markdown: string;
  pageCount: number;
  processingTime: number;
  mode: 'precision' | 'ultra';
  cost: number;
}

export interface DoctlyConfig {
  apiKey: string;
  baseUrl: string;
  defaultMode: 'precision' | 'ultra';
  confidenceThreshold: number;
  retryWithUltra: boolean;
}

export class DoctlyService {
  private config: DoctlyConfig;

  constructor() {
    const apiKey = process.env.DOCTLYAI_API_KEY?.trim();
    
    if (!apiKey) {
      throw new Error('DoctlyAI API key not configured. Please set DOCTLYAI_API_KEY environment variable.');
    }

    this.config = {
      apiKey,
      baseUrl: 'https://api.doctly.ai',
      defaultMode: 'precision',
      confidenceThreshold: 0.75,
      retryWithUltra: true
    };
  }

  /**
   * Convert PDF to markdown using DoctlyAI
   */
  async convertPdfToMarkdown(
    pdfBuffer: Buffer, 
    fileName: string,
    mode: 'precision' | 'ultra' = 'precision'
  ): Promise<DoctlyProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[DoctlyAI] Starting ${mode} mode conversion for ${fileName}`);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', pdfBuffer, {
        filename: fileName,
        contentType: 'application/pdf'
      });
      
      // Map our internal mode to Doctly's accuracy parameter
      if (mode === 'ultra') {
        formData.append('accuracy', 'ultra');
      }
      // Precision mode is default, so no need to specify it
      
      // Use the correct Doctly API endpoint
      const endpoint = `${this.config.baseUrl}/api/v1/documents/`;
      
      console.log(`[DoctlyAI] Calling endpoint: ${endpoint}`);
      const response = await axios.post(
        endpoint,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          timeout: 300000 // 5 minute timeout
        }
      );

      const processingTime = Date.now() - startTime;
      const pageCount = this.estimatePageCount(pdfBuffer.length);
      const cost = this.calculateCost(pageCount, mode);

      // Handle Doctly API response format - check if processing is complete
      const responseData = response.data as { 
        id?: string;
        status?: string;
        markdown?: string; 
        content?: string; 
        text?: string;
        message?: string;
        page_count?: number;
        file_size?: number;
      };

      // If status is PENDING, we need to poll for results
      if (responseData.status === 'PENDING' && responseData.id) {
        console.log(`[DoctlyAI] Document processing is pending. Polling for results with ID: ${responseData.id}`);
        const pollResult = await this.pollForResults(responseData.id, mode);
        
        const finalProcessingTime = Date.now() - startTime;
        console.log(`[DoctlyAI] Conversion completed in ${finalProcessingTime}ms. Pages: ${pageCount}, Cost: $${cost.toFixed(4)}`);
        
        return {
          markdown: pollResult,
          pageCount: responseData.page_count || pageCount,
          processingTime: finalProcessingTime,
          mode,
          cost
        };
      }
      
      // Handle immediate response (shouldn't happen with current Doctly API)
      const markdownContent = responseData.markdown || responseData.content || responseData.text || '';
      
      const finalProcessingTime = Date.now() - startTime;
      console.log(`[DoctlyAI] Conversion completed in ${finalProcessingTime}ms. Pages: ${pageCount}, Cost: $${cost.toFixed(4)}`);

      return {
        markdown: markdownContent,
        pageCount: responseData.page_count || pageCount,
        processingTime: finalProcessingTime,
        mode,
        cost
      };

    } catch (error: unknown) {
      console.error('[DoctlyAI] Conversion failed:', error);
      
      // Type guard for axios errors
      const isAxiosError = (err: unknown): err is { response?: { status?: number; data?: any }; message: string } => {
        return typeof err === 'object' && err !== null && 'response' in err;
      };
      
      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Doctly authentication failed. Please check your API key.');
        }
        if (error.response?.status === 404) {
          throw new Error('Doctly API endpoint not found. Please verify the service is available.');
        }
        if (error.response?.status === 413) {
          throw new Error('PDF file too large for Doctly processing.');
        }
        if (error.response?.status === 422) {
          throw new Error('Invalid PDF format or corrupted file.');
        }
        const errorData = error.response?.data as { message?: string; error?: string; detail?: string };
        const errorMessage = errorData?.message || errorData?.error || errorData?.detail || error.message;
        throw new Error(`Doctly API error: ${errorMessage}`);
      }
      
      if (error instanceof Error) {
        throw new Error(`Doctly processing failed: ${error.message}`);
      }
      
      throw new Error('Failed to convert PDF to markdown with Doctly');
    }
  }

  /**
   * Poll for document processing results
   */
  private async pollForResults(documentId: string, mode: 'precision' | 'ultra'): Promise<string> {
    const maxAttempts = 30; // 5 minutes max (10 second intervals)
    const pollInterval = 10000; // 10 seconds
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[DoctlyAI] Polling attempt ${attempt}/${maxAttempts} for document ${documentId}`);
        
        const response = await axios.get(
          `${this.config.baseUrl}/api/v1/documents/${documentId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
            timeout: 30000 // 30 second timeout for polling
          }
        );

        const data = response.data as {
          status?: string;
          markdown?: string;
          content?: string;
          text?: string;
          error?: string;
        };

        if (data.status === 'COMPLETED' || data.status === 'SUCCESS') {
          const markdownContent = data.markdown || data.content || data.text || '';
          if (markdownContent) {
            console.log(`[DoctlyAI] Document processing completed successfully after ${attempt} polls`);
            return markdownContent;
          } else {
            console.warn(`[DoctlyAI] Document marked as complete but no content received:`, data);
            return '';
          }
        }
        
        if (data.status === 'FAILED' || data.status === 'ERROR') {
          throw new Error(`Document processing failed: ${data.error || 'Unknown error'}`);
        }
        
        if (data.status === 'PENDING' || data.status === 'PROCESSING') {
          if (attempt < maxAttempts) {
            console.log(`[DoctlyAI] Document still processing (${data.status}), waiting ${pollInterval/1000}s before next poll...`);
            await this.delay(pollInterval);
            continue;
          }
        }
        
        // Unknown status or final attempt
        if (attempt === maxAttempts) {
          throw new Error(`Document processing timed out after ${maxAttempts} attempts. Last status: ${data.status}`);
        }

      } catch (error: unknown) {
        const isAxiosError = (err: unknown): err is { response?: { status?: number; data?: any }; message: string } => {
          return typeof err === 'object' && err !== null && 'response' in err;
        };
        
        if (isAxiosError(error) && error.response?.status === 404) {
          throw new Error(`Document ${documentId} not found. It may have expired or been deleted.`);
        }
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        console.warn(`[DoctlyAI] Polling attempt ${attempt} failed, retrying:`, error instanceof Error ? error.message : error);
        await this.delay(pollInterval);
      }
    }
    
    throw new Error('Document processing polling failed after maximum attempts');
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process document with intelligent mode selection
   */
  async processDocumentWithConfidence(
    pdfBuffer: Buffer,
    fileName: string,
    onClassification: (markdown: string) => Promise<{ confidence: number; documentType: string }>
  ): Promise<DoctlyProcessingResult & { finalConfidence: number; attempts: number }> {
    let result = await this.convertPdfToMarkdown(pdfBuffer, fileName, 'precision');
    let attempts = 1;
    
    // Get initial classification confidence
    const { confidence: initialConfidence, documentType } = await onClassification(result.markdown);
    
    console.log(`[DoctlyAI] Initial confidence: ${initialConfidence.toFixed(3)} for ${documentType}`);
    
    // Determine if we should retry with Ultra
    const shouldRetry = this.shouldRetryWithUltra(initialConfidence, documentType);
    
    if (shouldRetry && this.config.retryWithUltra) {
      console.log(`[DoctlyAI] Low confidence detected. Retrying with Ultra mode...`);
      
      const ultraResult = await this.convertPdfToMarkdown(pdfBuffer, fileName, 'ultra');
      const { confidence: ultraConfidence } = await onClassification(ultraResult.markdown);
      
      console.log(`[DoctlyAI] Ultra mode confidence: ${ultraConfidence.toFixed(3)} (improvement: ${(ultraConfidence - initialConfidence).toFixed(3)})`);
      
      // Update total cost
      ultraResult.cost += result.cost;
      result = ultraResult;
      attempts = 2;
      
      return {
        ...result,
        finalConfidence: ultraConfidence,
        attempts
      };
    }
    
    return {
      ...result,
      finalConfidence: initialConfidence,
      attempts
    };
  }

  /**
   * Determine if we should retry with Ultra mode based on confidence and document type
   */
  private shouldRetryWithUltra(confidence: number, documentType: string): boolean {
    // Document-specific thresholds
    const thresholds: Record<string, number> = {
      'Assignment': 0.80,    // Higher threshold for assignments (name accuracy critical)
      'Note': 0.70,         // Standard threshold for notes
      'Security Instrument': 0.70,  // Standard threshold for mortgages
      'Allonge': 0.75,      // Medium threshold for allonges
      'Other': 0.60         // Lower threshold for unknown documents
    };

    const threshold = thresholds[documentType] || this.config.confidenceThreshold;
    return confidence < threshold;
  }

  /**
   * Estimate page count from PDF buffer size
   */
  private estimatePageCount(bufferSize: number): number {
    // Rough estimate: average PDF page is ~100KB
    const estimatedPages = Math.ceil(bufferSize / (100 * 1024));
    return Math.max(1, estimatedPages);
  }

  /**
   * Calculate processing cost
   */
  private calculateCost(pageCount: number, mode: 'precision' | 'ultra'): number {
    const costPerPage = mode === 'ultra' ? 0.05 : 0.02;
    return pageCount * costPerPage;
  }

  /**
   * Get processing statistics for cost tracking
   */
  async getProcessingStats(startDate?: Date, endDate?: Date): Promise<{
    totalDocuments: number;
    totalPages: number;
    totalCost: number;
    precisionCount: number;
    ultraCount: number;
    averageConfidenceImprovement: number;
  }> {
    // This would query the document_processing_costs table
    // Implementation depends on database schema
    return {
      totalDocuments: 0,
      totalPages: 0,
      totalCost: 0,
      precisionCount: 0,
      ultraCount: 0,
      averageConfidenceImprovement: 0
    };
  }
}

export const doctlyService = new DoctlyService();