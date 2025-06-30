# Collateral Analysis Tool

A machine learning pipeline for classifying loan collateral documents and extracting key information like borrower names and property addresses.

## Features

- **Automatic Document Classification**: Identifies document types (Note, Mortgage, Assignment, etc.)
- **Information Extraction**: Extracts borrower names and property addresses from documents
- **Configurable Paths**: All paths are centralized in `config.py`
- **Portable**: No hardcoded system-specific paths (removed poppler_path dependency)
- **Command-Line Interface**: Configurable training parameters

## Setup

### Prerequisites

1. Python 3.8+
2. Install required packages:
```bash
pip install pandas scikit-learn joblib pdf2image pytesseract pillow
```

3. Install system dependencies:
   - **Tesseract OCR**: Required for text extraction
     - macOS: `brew install tesseract`
     - Ubuntu: `sudo apt-get install tesseract-ocr`
     - Windows: Download from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)
   
   - **Poppler**: Required for PDF to image conversion
     - macOS: `brew install poppler`
     - Ubuntu: `sudo apt-get install poppler-utils`
     - Windows: Download and add to PATH

### Directory Structure

```
projects/
├── config.py                  # Configuration file
├── loan_doc_classifier.py     # Document processing and labeling
├── train_model.py            # Model training script
├── training_docs/            # Place PDF files here
├── dataset_prelabeled.csv    # Generated dataset
└── doc_classifier_model.joblib # Trained model
```

## Usage

### 1. Prepare Training Documents

Place your PDF documents in the `training_docs/` directory.

### 2. Process Documents and Extract Information

```bash
python loan_doc_classifier.py
```

This will:
- Process all PDFs in the training_docs folder
- Extract text from each page
- Pre-label documents based on content
- Extract borrower names and property addresses
- Save results to `dataset_prelabeled.csv`

### 3. Train the Classification Model

```bash
# Train with default 85% accuracy threshold
python train_model.py

# Train with custom accuracy threshold
python train_model.py --min-accuracy 0.80
```

The model will only be saved if it meets the minimum accuracy threshold.

## Document Classification Logic

Documents are classified in priority order to prevent misclassification:

1. **Note**: Contains "NOTE" AND "PROMISE TO PAY"
2. **Allonge**: Contains "ALLONGE"
3. **Assignment**: Contains "ASSIGNMENT OF MORTGAGE" or "ASSIGNMENT OF DEED OF TRUST"
4. **Mortgage**: Contains "MORTGAGE" AND "THIS MORTGAGE"
5. **Deed of Trust**: Contains "DEED OF TRUST"
6. **Rider**: Contains "RIDER" (lower priority)
7. **Bailee Letter**: Contains "BAILEE LETTER" (lower priority)
8. **UNLABELED**: Default if no patterns match

## Information Extraction

The tool extracts two key identifiers from the first page of each document:

- **Borrower Name**: Searches for patterns like "Borrower:", "Mortgagor:", etc.
- **Property Address**: Searches for patterns like "Property Address:", street addresses, etc.

These identifiers help link collateral to loans even when loan IDs change.

## Output

### dataset_prelabeled.csv
Contains columns:
- `filename`: PDF filename
- `page_number`: Page number in the PDF
- `text`: Extracted text content
- `label`: Document type classification
- `extracted_borrower`: Extracted borrower name
- `extracted_address`: Extracted property address

### doc_classifier_model.joblib
The trained machine learning model for document classification.

### doc_classifier_model_metadata.json
Model performance metrics and configuration.

## Integration as Microservice

This tool is designed to be easily integrated into a larger system:

1. All paths are configurable via `config.py`
2. No system-specific dependencies
3. Clear separation of concerns (processing, training, configuration)
4. JSON metadata output for easy integration

## Troubleshooting

1. **OCR Quality Issues**: Ensure PDFs are clear and readable. Low-quality scans may affect extraction accuracy.

2. **Missing Dependencies**: If you get import errors, ensure all packages are installed:
   ```bash
   pip install -r requirements.txt
   ```

3. **Path Issues**: All paths are relative to the `config.py` location. Ensure your working directory is correct.

4. **Low Model Accuracy**: Try:
   - Adding more training data
   - Improving PDF quality
   - Adjusting the classification logic in `pre_label_page()`