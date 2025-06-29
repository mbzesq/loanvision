import os
import tempfile
from flask import Flask, request, jsonify
import pandas as pd
import joblib
from pdf2image import convert_from_path
import pytesseract
import sys
from pathlib import Path

# Add parent directory to path to import config
sys.path.append(str(Path(__file__).parent.parent))
from config import MODEL_OUTPUT_PATH

app = Flask(__name__)

# Load the trained document classification model on startup
doc_model = None
try:
    doc_model = joblib.load(MODEL_OUTPUT_PATH)
    print(f"Document classification model '{MODEL_OUTPUT_PATH}' loaded successfully.")
except FileNotFoundError:
    print(f"WARNING: Document classification model file not found at '{MODEL_OUTPUT_PATH}'. The /predict endpoint will not work.")

@app.route('/')
def health_check():
    """A simple health check endpoint."""
    model_status = "loaded" if doc_model is not None else "not_loaded"
    return jsonify({
        "status": "ok", 
        "message": "NPLVision Document Classification API is running.",
        "service": "document_classification",
        "model_status": model_status
    })

@app.route('/predict', methods=['POST'])
def predict_document_type():
    """
    Accepts a PDF file upload and returns the predicted document type for each page.
    """
    if doc_model is None:
        return jsonify({"error": "Document classification model not loaded. Cannot perform prediction."}), 503

    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected for uploading"}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDF files are supported"}), 400

    try:
        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name

        # Use pdf2image and pytesseract to extract text, just like in the training script
        images = convert_from_path(temp_path)
        
        predictions = []
        for i, img in enumerate(images):
            text = pytesseract.image_to_string(img)
            # The model expects a list of documents, so we pass the text in a list
            prediction = doc_model.predict([text])
            
            # Get prediction confidence/probability if available
            try:
                prediction_proba = doc_model.predict_proba([text])
                confidence = float(max(prediction_proba[0]))
            except AttributeError:
                # Model doesn't support predict_proba
                confidence = None
            
            predictions.append({
                "page": i + 1,
                "predicted_label": prediction[0],
                "confidence": confidence,
                "text_length": len(text)
            })
        
        # Clean up temporary file
        os.unlink(temp_path)
            
        return jsonify({
            "success": True,
            "filename": file.filename,
            "page_count": len(predictions),
            "predictions": predictions
        })

    except Exception as e:
        # Clean up temporary file if it exists
        try:
            os.unlink(temp_path)
        except:
            pass
        
        print(f"An error occurred during document prediction: {e}")
        return jsonify({"error": "Failed to process PDF", "details": str(e)}), 500

@app.route('/model-info', methods=['GET'])
def model_info():
    """
    Get information about the loaded document classification model.
    """
    if doc_model is None:
        return jsonify({
            "model_loaded": False,
            "error": "Document classification model not loaded"
        }), 503
    
    try:
        # Try to load model metadata if available
        metadata_path = MODEL_OUTPUT_PATH.parent / f"{MODEL_OUTPUT_PATH.stem}_metadata.json"
        metadata = {}
        try:
            import json
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
        except FileNotFoundError:
            pass
        
        # Get model information
        model_info_data = {
            "model_loaded": True,
            "model_type": str(type(doc_model)),
            "model_path": str(MODEL_OUTPUT_PATH)
        }
        
        # Add metadata if available
        if metadata:
            model_info_data.update({
                "accuracy": metadata.get("accuracy"),
                "training_samples": metadata.get("training_samples"),
                "test_samples": metadata.get("test_samples"),
                "supported_labels": metadata.get("labels"),
                "min_accuracy_threshold": metadata.get("min_accuracy_threshold")
            })
        
        return jsonify(model_info_data)
        
    except Exception as e:
        return jsonify({
            "model_loaded": True,
            "error": f"Could not retrieve model information: {str(e)}"
        }), 500

@app.route('/api-info', methods=['GET'])
def api_info():
    """
    Get information about the document classification API endpoints.
    """
    model_status = "loaded" if doc_model is not None else "not_loaded"
    
    return jsonify({
        "service_name": "NPLVision Document Classification API",
        "version": "1.0",
        "model_status": model_status,
        "endpoints": {
            "/": "Health check",
            "/predict": "POST - Classify PDF document pages",
            "/model-info": "GET - Get document classification model information",
            "/api-info": "GET - Get API information"
        },
        "supported_document_types": [
            "Note", "Mortgage", "Deed of Trust", "Assignment", 
            "Allonge", "Rider", "Bailee Letter", "UNLABELED"
        ]
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)