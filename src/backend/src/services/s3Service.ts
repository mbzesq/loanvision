import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

export class S3Service {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    // Use environment variables directly, bypassing config system
    const region = process.env.AWS_REGION?.trim() || 'us-east-1';
    this.bucketName = process.env.S3_BUCKET?.trim() || 'nplvision-textract-inputs';

    // Debug logging
    console.log('[S3Service] Initializing with:', {
      region,
      bucketName: this.bucketName,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    });

    // Initialize S3 client with default credential chain
    this.client = new S3Client({
      region: region,
      // Let AWS SDK handle credentials automatically
    });
  }

  /**
   * Upload a document to S3
   * @param loanId - The loan ID this document belongs to
   * @param fileName - Original filename
   * @param buffer - File buffer
   * @param documentType - Type of document (note, mortgage, etc.)
   * @returns S3 key and URL
   */
  async uploadDocument(
    loanId: string,
    fileName: string,
    buffer: Buffer,
    documentType?: string
  ): Promise<{ key: string; bucket: string; url: string }> {
    try {
      // Generate unique key with folder structure
      const timestamp = new Date().toISOString().split('T')[0];
      const uniqueId = uuidv4();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `loans/${loanId}/${timestamp}/${uniqueId}_${sanitizedFileName}`;

      console.log(`[S3Service] Uploading document to S3: ${key}`);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
        Metadata: {
          loanId: loanId,
          originalFileName: fileName,
          documentType: documentType || 'unknown',
          uploadDate: new Date().toISOString(),
        },
      });

      await this.client.send(command);

      const url = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

      console.log(`[S3Service] Document uploaded successfully: ${url}`);

      return {
        key,
        bucket: this.bucketName,
        url,
      };
    } catch (error) {
      console.error('[S3Service] Upload failed:', error);
      throw new Error(`Failed to upload document to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download a document from S3
   * @param key - S3 object key
   * @returns Document buffer
   */
  async downloadDocument(key: string): Promise<Buffer> {
    try {
      console.log(`[S3Service] Downloading document from S3: ${key}`);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('No document body returned from S3');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('[S3Service] Download failed:', error);
      throw new Error(`Failed to download document from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a document from S3
   * @param key - S3 object key
   */
  async deleteDocument(key: string): Promise<void> {
    try {
      console.log(`[S3Service] Deleting document from S3: ${key}`);

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      console.log(`[S3Service] Document deleted successfully: ${key}`);
    } catch (error) {
      console.error('[S3Service] Delete failed:', error);
      throw new Error(`Failed to delete document from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a presigned URL for direct browser access
   * @param key - S3 object key
   * @param expiresIn - URL expiration in seconds (default 1 hour)
   * @returns Presigned URL
   */
  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // For MVP, we'll return the public URL
    // In production, implement proper presigned URLs for security
    return `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }
}

// Export singleton instance
export const s3Service = new S3Service();