import { TextractClient, AnalyzeDocumentCommand, Block, AnalyzeDocumentCommandInput } from '@aws-sdk/client-textract';
import { config } from '../config';

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
    this.client = new TextractClient({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });
  }

  async analyzeDocument(pdfBuffer: Buffer): Promise<TextractResult> {
    const params: AnalyzeDocumentCommandInput = {
      Document: {
        Bytes: pdfBuffer,
      },
      FeatureTypes: ['FORMS', 'TABLES'], // Extract both key-value pairs and tables
    };

    try {
      const command = new AnalyzeDocumentCommand(params);
      const response = await this.client.send(command);
      
      if (!response.Blocks) {
        throw new Error('No blocks returned from Textract');
      }

      return this.processTextractResponse(response.Blocks);
    } catch (error: unknown) {
      console.error('Textract analysis failed:', error);
      if (error instanceof Error) {
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