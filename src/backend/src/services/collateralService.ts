import axios from 'axios';
import FormData from 'form-data';

interface DocumentPrediction {
    page: number;
    predicted_label: string;
    confidence?: number;
    text_length: number;
}

interface ClassificationResponse {
    success: boolean;
    filename: string;
    page_count: number;
    predictions: DocumentPrediction[];
}

/**
 * Service for communicating with the Python document classification microservice
 */
export class CollateralService {
    private readonly apiUrl: string;

    constructor() {
        // Reuse the existing environment variable for the Python API
        this.apiUrl = process.env.PROPERTY_DATA_API_URL || 'http://localhost:5000';
    }

    /**
     * Classify a document using the Python microservice
     * @param fileBuffer - The PDF file buffer
     * @param fileName - The original filename
     * @returns Classification results or null if error
     */
    async classifyDocument(fileBuffer: Buffer, fileName: string): Promise<ClassificationResponse | null> {
        const url = `${this.apiUrl}/predict`;
        const form = new FormData();
        form.append('file', fileBuffer, fileName);

        try {
            console.log(`Classifying document: ${fileName} via ${url}`);
            
            const response = await axios.post(url, form, { 
                headers: {
                    ...form.getHeaders(),
                    'Accept': 'application/json'
                },
                timeout: 60000 // 60 second timeout to handle cold starts and document processing
            });

            if (response.data && response.data.success) {
                console.log(`Successfully classified ${fileName}: ${response.data.page_count} pages`);
                return response.data as ClassificationResponse;
            } else {
                console.error(`Classification failed for ${fileName}:`, response.data);
                return null;
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(`Error classifying document ${fileName}:`, {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    message: error.message
                });
            } else {
                console.error(`Unexpected error classifying document ${fileName}:`, error);
            }
            return null;
        }
    }

    /**
     * Check if the Python microservice is available
     * @returns True if service is healthy, false otherwise
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.apiUrl}/`, { timeout: 5000 });
            return response.status === 200 && response.data?.status === 'ok';
        } catch (error) {
            console.error('Collateral service health check failed:', error);
            return false;
        }
    }

    /**
     * Get information about the loaded model
     * @returns Model information or null if error
     */
    async getModelInfo(): Promise<any | null> {
        try {
            const response = await axios.get(`${this.apiUrl}/model-info`, { timeout: 5000 });
            return response.data;
        } catch (error) {
            console.error('Error getting model info:', error);
            return null;
        }
    }
}

// Export a singleton instance
export const collateralService = new CollateralService();