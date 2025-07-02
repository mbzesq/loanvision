# Document Classifier Tuning

## Overview
This script evaluates the document classification accuracy using real AWS Textract OCR on a labeled test set of 68 PDF documents.

## Prerequisites
1. **AWS Credentials**: Set environment variables
   ```bash
   export AWS_ACCESS_KEY_ID=your_key
   export AWS_SECRET_ACCESS_KEY=your_secret
   export AWS_REGION=us-east-1
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

## Running the Tuning Script

```bash
npm run tune-classifier
```

This will:
1. Load 68 labeled PDFs from `docs/test_set/`
2. Run AWS Textract OCR on each PDF
3. Classify the OCR output using the current classifier
4. Compare predictions against ground truth labels
5. Generate a confusion matrix and accuracy metrics
6. Save results to `classifier_tuning_results.json`

## Expected Output

### Console Output:
- Real-time OCR progress for each document
- Individual classification results (predicted vs true)
- Confusion matrix showing classification patterns
- Per-class precision, recall, and F1 scores
- Overall accuracy percentage
- Misclassification analysis
- Suggested improvements

### JSON Output:
The script saves detailed results to `classifier_tuning_results.json` including:
- Complete confusion matrix
- All metrics (precision, recall, F1)
- List of misclassified documents
- OCR success/failure counts

## Test Set Distribution
- Note: 11 documents
- Mortgage: 10 documents  
- Allonge: 22 documents
- Assignment: 25 documents
- Deed of Trust: 0 documents
- Other: 0 documents

## Cost Considerations
⚠️ **AWS Textract Pricing**: Each document analysis costs approximately $0.015-$0.05 depending on page count. Running the full test set of 68 documents will incur AWS charges.

## Interpreting Results

### Confusion Matrix
Rows represent true document types, columns represent predicted types. Diagonal values are correct classifications.

### Metrics
- **Precision**: Of all documents predicted as type X, what percentage were actually type X?
- **Recall**: Of all documents that are actually type X, what percentage were correctly identified?
- **F1 Score**: Harmonic mean of precision and recall

### Common Issues
1. **Allonge vs Note confusion**: Short endorsements may be misclassified
2. **Mortgage vs Deed of Trust**: Regional terminology differences
3. **Low confidence**: Documents with poor scan quality or unusual formatting

## Next Steps
Based on the results, you can:
1. Update keyword patterns in `documentClassifier.ts`
2. Adjust confidence thresholds
3. Add document-specific rules
4. Implement suggested improvements from the analysis