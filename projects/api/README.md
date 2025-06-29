# NPLVision Document Classification API

A Flask microservice for AI-powered document classification of loan collateral documents. This service works alongside the main NPLVision application to provide real-time document analysis capabilities.

## Features

- **REST API**: Simple endpoints for document classification
- **PDF Processing**: Upload PDF files and get page-by-page classification
- **AI-Powered**: Uses trained machine learning models for accurate document type identification
- **Confidence Scores**: Returns prediction confidence when available
- **Health Monitoring**: Built-in health checks and model status monitoring

## Quick Start

### 1. Install Dependencies

```bash
cd projects/api
pip install -r requirements.txt
```

### 2. Ensure Model is Available

Make sure the trained model exists:
```bash
# Should exist: projects/doc_classifier_model.joblib
ls ../doc_classifier_model.joblib
```

If the model doesn't exist, train it first:
```bash
cd ..
python train_model.py --min-accuracy 0.80
```

### 3. Run the API

```bash
python app.py
```

The API will start on `http://localhost:5000`

### 4. Test the API

```bash
# Test all endpoints
python test_api.py

# Test with a specific PDF
python test_api.py path/to/document.pdf
```

## API Endpoints

### Health Check
**GET** `/`

Returns service status and model loading state.

**Response:**
```json
{
  "status": "ok",
  "message": "NPLVision Document Classification API is running.",
  "service": "document_classification",
  "model_status": "loaded"
}
```

### Document Classification
**POST** `/predict`

Upload a PDF file and get AI-powered classification for each page.

**Request:**
- **Content-Type**: `multipart/form-data`
- **Body**: PDF file in `file` field

**Response:**
```json
{
  "success": true,
  "filename": "mortgage_docs.pdf",
  "page_count": 3,
  "predictions": [
    {
      "page": 1,
      "predicted_label": "Note",
      "confidence": 0.95,
      "text_length": 1250
    },
    {
      "page": 2,
      "predicted_label": "Mortgage",
      "confidence": 0.87,
      "text_length": 2100
    }
  ]
}
```

### Model Information
**GET** `/model-info`

Get details about the loaded ML model.

**Response:**
```json
{
  "model_loaded": true,
  "model_type": "<class 'sklearn.pipeline.Pipeline'>",
  "accuracy": 0.92,
  "training_samples": 450,
  "supported_labels": ["Note", "Mortgage", "Assignment", ...]
}
```

### API Information
**GET** `/api-info`

Get comprehensive API documentation.

## Document Types Supported

The API can classify these loan document types:

- **Note**: Promissory notes
- **Mortgage**: Mortgage documents  
- **Deed of Trust**: Deed of trust documents
- **Assignment**: Assignment of mortgage/deed of trust
- **Allonge**: Allonge documents
- **Rider**: Riders and addendums
- **Bailee Letter**: Bailee letters
- **UNLABELED**: Documents that don't match known patterns

## Integration with NPLVision

This microservice is designed to work alongside the main NPLVision Node.js application:

1. **Separate Deployment**: Can be deployed independently on platforms like Render/Heroku
2. **API Integration**: The main NPLVision backend can call this service's endpoints
3. **Shared Models**: Uses the same trained models from the collateral analysis pipeline

### Example Integration

```typescript
// In NPLVision Node.js backend
const classifyDocument = async (pdfBuffer: Buffer) => {
  const formData = new FormData();
  formData.append('file', pdfBuffer, 'document.pdf');
  
  const response = await fetch('https://your-doc-api.onrender.com/predict', {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
};
```

## Deployment

### Local Development
```bash
python app.py
```

### Production (using Gunicorn)
```bash
gunicorn app:app
```

### Platform Deployment
1. **Render**: Deploy using the included `Procfile`
2. **Heroku**: Deploy using the included `Procfile`
3. **Docker**: Can be containerized easily

## System Dependencies

The API requires these system dependencies:
- **Tesseract OCR**: For text extraction from PDFs
- **Poppler**: For PDF to image conversion

Install on different systems:
- **macOS**: `brew install tesseract poppler`
- **Ubuntu**: `sudo apt-get install tesseract-ocr poppler-utils`
- **Windows**: Download and install from official sources

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "details": "Additional error details (if available)"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing file, invalid format)
- `500`: Internal Server Error
- `503`: Service Unavailable (model not loaded)

## Security Considerations

- PDF files are temporarily stored and automatically deleted
- No authentication required (add if needed for production)
- Consider adding rate limiting for production use
- Validate file types and sizes to prevent abuse

## Performance

- Model loading: ~2-5 seconds on startup
- PDF processing: ~1-3 seconds per page depending on complexity
- Memory usage: ~100-500MB depending on model size