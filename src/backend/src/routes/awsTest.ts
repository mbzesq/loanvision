import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { config } from '../config';
import { TextractClient, ListAdaptersCommand } from '@aws-sdk/client-textract';

const router = Router();

// Test AWS Textract configuration
router.get('/test-aws-config', authenticateToken, async (req, res) => {
  try {
    // Check environment variables
    const envCheck = {
      hasAccessKeyId: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretAccessKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyIdLength: process.env.AWS_ACCESS_KEY_ID?.length || 0,
      // Don't log the actual secret, just its presence and length
      secretAccessKeyLength: process.env.AWS_SECRET_ACCESS_KEY?.length || 0,
    };

    // Try to create a Textract client
    const clientConfig: any = {
      region: config.aws.region || 'us-east-1',
    };

    if (config.aws.accessKeyId && config.aws.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      };
    }

    const client = new TextractClient(clientConfig);

    // Try a simple API call that doesn't require a document
    try {
      // Use a lightweight operation to test credentials
      const command = new ListAdaptersCommand({});
      await client.send(command);
      
      res.json({
        status: 'success',
        message: 'AWS Textract credentials are working correctly',
        environment: envCheck,
        clientRegion: clientConfig.region,
        credentialSource: config.aws.accessKeyId ? 'explicit' : 'default_chain'
      });
    } catch (awsError: any) {
      res.status(400).json({
        status: 'aws_error',
        message: 'AWS credentials test failed',
        error: awsError.message,
        errorCode: awsError.name,
        environment: envCheck,
        clientRegion: clientConfig.region,
        credentialSource: config.aws.accessKeyId ? 'explicit' : 'default_chain'
      });
    }
  } catch (error: any) {
    console.error('Error testing AWS config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to test AWS configuration',
      error: error.message
    });
  }
});

export default router;