import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

export interface DocumentAnalysisResult {
  text: string;
  keyValuePairs: Map<string, string>;
  tables: any[];
  confidence: number;
  blocks: any[]; // Azure doesn't use "blocks" but we maintain interface compatibility
}

export class AzureDocumentService {
  private client: DocumentAnalysisClient;

  constructor() {
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.trim();
    const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY?.trim();

    console.log('[AzureDocumentService] Configuration check:', {
      hasEndpoint: !!endpoint,
      endpointLength: endpoint?.length || 0,
      hasKey: !!key,
      keyLength: key?.length || 0,
      endpointStart: endpoint?.substring(0, 30) + '...',
    });

    if (!endpoint || !key) {
      throw new Error('Azure Document Intelligence credentials not configured. Please set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY environment variables.');
    }

    this.client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
    console.log('[AzureDocumentService] Client initialized successfully');
  }

  async analyzeDocument(pdfBuffer: Buffer): Promise<DocumentAnalysisResult> {
    console.log('[AzureDocumentService] analyzeDocument called with buffer size:', pdfBuffer.length);

    try {
      console.log('Starting Azure Document Intelligence analysis...');
      
      // Use the "prebuilt-document" model for general document analysis
      // This model extracts text, key-value pairs, tables, and structure from any document
      const poller = await this.client.beginAnalyzeDocument("prebuilt-document", pdfBuffer);
      const result = await poller.pollUntilDone();

      if (!result) {
        throw new Error('No result returned from Azure Document Intelligence');
      }

      console.log(`Azure Document Intelligence completed successfully.`);
      console.log(`- Pages: ${result.pages?.length || 0}`);
      console.log(`- Key-value pairs: ${result.keyValuePairs?.length || 0}`);
      console.log(`- Tables: ${result.tables?.length || 0}`);
      
      return this.processAzureResponse(result);
    } catch (error: unknown) {
      console.error('Azure Document Intelligence analysis failed:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('InvalidRequest')) {
          throw new Error('Invalid document format. Please ensure you are uploading a valid PDF.');
        }
        if (error.message.includes('UnsupportedMediaType')) {
          throw new Error('This document format is not supported by Azure Document Intelligence.');
        }
        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
          throw new Error('Azure credentials are invalid. Please check your configuration.');
        }
        if (error.message.includes('QuotaExceeded')) {
          throw new Error('Azure Document Intelligence quota exceeded. Please check your subscription.');
        }
        throw new Error(`OCR processing failed: ${error.message}`);
      }
      throw new Error('OCR processing failed: Unknown error');
    }
  }

  private processAzureResponse(result: any): DocumentAnalysisResult {
    const keyValuePairs = new Map<string, string>();
    const tables: any[] = [];
    let fullText = '';
    let totalConfidence = 0;
    let confidenceCount = 0;

    // Extract full text from all pages
    if (result.content) {
      fullText = result.content;
    }

    // Process key-value pairs
    if (result.keyValuePairs) {
      result.keyValuePairs.forEach((kvp: any) => {
        if (kvp.key && kvp.value) {
          const key = kvp.key.content || '';
          const value = kvp.value.content || '';
          if (key && value) {
            keyValuePairs.set(key.trim(), value.trim());
          }
          
          // Track confidence from key-value pairs
          if (kvp.confidence) {
            totalConfidence += kvp.confidence;
            confidenceCount++;
          }
        }
      });
    }

    // Process tables
    if (result.tables) {
      result.tables.forEach((table: any) => {
        const tableData = {
          rowCount: table.rowCount || 0,
          columnCount: table.columnCount || 0,
          cells: []
        };

        if (table.cells) {
          tableData.cells = table.cells.map((cell: any) => ({
            rowIndex: cell.rowIndex || 0,
            columnIndex: cell.columnIndex || 0,
            text: cell.content || '',
            confidence: cell.confidence || 0
          }));
        }

        tables.push(tableData);
      });
    }

    // Calculate overall confidence from pages if we don't have it from key-value pairs
    if (confidenceCount === 0 && result.pages) {
      result.pages.forEach((page: any) => {
        if (page.words) {
          page.words.forEach((word: any) => {
            if (word.confidence) {
              totalConfidence += word.confidence;
              confidenceCount++;
            }
          });
        }
      });
    }

    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    return {
      text: fullText.trim(),
      keyValuePairs,
      tables,
      confidence: averageConfidence * 100, // Convert to percentage to match AWS format
      blocks: [], // Azure doesn't have blocks concept, but we maintain interface
    };
  }
}