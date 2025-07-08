import { TextractClient, AnalyzeDocumentCommand, Block, AnalyzeDocumentCommandInput } from '@aws-sdk/client-textract';

export interface TextractResult {
  text: string;
  keyValuePairs: Map<string, string>;
  tables: any[];
  confidence: number;
  blocks: Block[];
}

export class TextractService {
  private client: TextractClient;

  constructor() {
    // Bypass config system completely - read directly from environment variables
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    const region = process.env.AWS_REGION?.trim() || 'us-east-1';

    // Debug log to see what we have directly from environment
    console.log('[TextractService] Direct environment variable check:', {
      hasAccessKeyId: !!accessKeyId,
      accessKeyIdLength: accessKeyId?.length || 0,
      hasSecretAccessKey: !!secretAccessKey,
      secretAccessKeyLength: secretAccessKey?.length || 0,
      region: region,
      nodeEnv: process.env.NODE_ENV,
    });

    // Always use AWS SDK default credential chain
    // This will automatically pick up environment variables
    const clientConfig: any = {
      region: region,
    };

    // DO NOT set explicit credentials - let AWS SDK handle it
    console.log('[TextractService] Using AWS SDK default credential chain');
    console.log('[TextractService] Client config:', {
      region: clientConfig.region,
      credentialSource: 'default_chain',
    });

    this.client = new TextractClient(clientConfig);
  }

  async analyzeDocument(pdfBuffer: Buffer): Promise<TextractResult> {
    // Debug log for analyze document call
    console.log('[TextractService] analyzeDocument called with buffer size:', pdfBuffer.length);
    
    // In production, we'll rely on the AWS SDK credential chain
    // Remove the explicit credential check as AWS SDK will handle this
    console.log('[TextractService] Proceeding with Textract analysis...');

    const params: AnalyzeDocumentCommandInput = {
      Document: {
        Bytes: pdfBuffer,
      },
      FeatureTypes: ['FORMS', 'TABLES'], // Extract both key-value pairs and tables
    };

    try {
      console.log(`Starting Textract analysis for ${pdfBuffer.length} byte document`);
      const command = new AnalyzeDocumentCommand(params);
      const response = await this.client.send(command);
      
      if (!response.Blocks) {
        throw new Error('No blocks returned from Textract');
      }

      console.log(`Textract completed successfully. Found ${response.Blocks.length} blocks`);
      return this.processTextractResponse(response.Blocks);
    } catch (error: unknown) {
      console.error('Textract analysis failed:', error);
      
      // Provide specific error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('security token') || error.message.includes('UnrecognizedClientException')) {
          throw new Error('AWS credentials are invalid or expired. Please check your configuration.');
        }
        if (error.message.includes('AccessDenied')) {
          throw new Error('AWS credentials do not have permission to use Textract service.');
        }
        if (error.message.includes('ValidationException')) {
          throw new Error('Invalid document format. Please ensure you are uploading a valid PDF.');
        }
        if (error.message.includes('UnsupportedDocumentException')) {
          throw new Error('This document format is not supported by Textract even after enhancement. The PDF may be corrupted, password-protected, or use a highly unusual format.');
        }
        throw new Error(`OCR processing failed: ${error.message}`);
      }
      throw new Error('OCR processing failed: Unknown error');
    }
  }

  private processTextractResponse(blocks: Block[]): TextractResult {
    const keyValuePairs = new Map<string, string>();
    const tables: any[] = [];
    let fullText = '';
    let totalConfidence = 0;
    let confidenceCount = 0;

    // Build block map for relationship lookups
    const blockMap = new Map<string, Block>();
    blocks.forEach(block => {
      if (block.Id) {
        blockMap.set(block.Id, block);
      }
    });

    // Process each block
    blocks.forEach(block => {
      // Extract text
      if (block.BlockType === 'LINE' && block.Text) {
        fullText += block.Text + '\n';
      }

      // Track confidence
      if (block.Confidence) {
        totalConfidence += block.Confidence;
        confidenceCount++;
      }

      // Extract key-value pairs
      if (block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY')) {
        const key = this.getTextFromRelationships(block, blockMap, 'VALUE');
        const value = this.getValueFromKey(block, blocks, blockMap);
        if (key && value) {
          keyValuePairs.set(key, value);
        }
      }

      // Extract tables (simplified for MVP)
      if (block.BlockType === 'TABLE') {
        tables.push(this.extractTable(block, blockMap));
      }
    });

    return {
      text: fullText.trim(),
      keyValuePairs,
      tables,
      confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      blocks,
    };
  }

  private getTextFromRelationships(block: Block, blockMap: Map<string, Block>, relationshipType: string): string {
    if (!block.Relationships) return '';

    const relationship = block.Relationships.find(r => r.Type === relationshipType);
    if (!relationship || !relationship.Ids) return '';

    let text = '';
    relationship.Ids.forEach(id => {
      const relatedBlock = blockMap.get(id);
      if (relatedBlock && relatedBlock.Text) {
        text += relatedBlock.Text + ' ';
      }
    });

    return text.trim();
  }

  private getValueFromKey(keyBlock: Block, blocks: Block[], blockMap: Map<string, Block>): string {
    if (!keyBlock.Relationships) return '';

    const valueRelationship = keyBlock.Relationships.find(r => r.Type === 'VALUE');
    if (!valueRelationship || !valueRelationship.Ids) return '';

    const valueBlockId = valueRelationship.Ids[0];
    const valueBlock = blocks.find(b => b.Id === valueBlockId && b.BlockType === 'KEY_VALUE_SET');
    
    if (!valueBlock) return '';

    return this.getTextFromRelationships(valueBlock, blockMap, 'CHILD');
  }

  private extractTable(tableBlock: Block, blockMap: Map<string, Block>): any {
    // Simplified table extraction for MVP
    const cells: any[] = [];
    
    if (tableBlock.Relationships) {
      tableBlock.Relationships.forEach(relationship => {
        if (relationship.Type === 'CHILD' && relationship.Ids) {
          relationship.Ids.forEach(cellId => {
            const cellBlock = blockMap.get(cellId);
            if (cellBlock && cellBlock.BlockType === 'CELL') {
              cells.push({
                rowIndex: cellBlock.RowIndex || 0,
                columnIndex: cellBlock.ColumnIndex || 0,
                text: this.getTextFromRelationships(cellBlock, blockMap, 'CHILD'),
              });
            }
          });
        }
      });
    }

    return { cells };
  }
}