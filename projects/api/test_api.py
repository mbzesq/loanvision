#!/usr/bin/env python3
"""
Test script for the NPLVision Document Classification API.
Usage: python test_api.py [pdf_file_path]
"""

import requests
import sys
import json
from pathlib import Path

def test_api_health(base_url="http://localhost:5000"):
    """Test the API health check endpoint."""
    try:
        response = requests.get(f"{base_url}/")
        if response.status_code == 200:
            print("✅ API Health Check:", response.json())
            return True
        else:
            print("❌ API Health Check failed:", response.status_code)
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Could not connect to API: {e}")
        return False

def test_model_info(base_url="http://localhost:5000"):
    """Test the model info endpoint."""
    try:
        response = requests.get(f"{base_url}/model-info")
        print("📊 Model Info:", json.dumps(response.json(), indent=2))
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        print(f"❌ Could not get model info: {e}")
        return False

def test_api_info(base_url="http://localhost:5000"):
    """Test the API info endpoint."""
    try:
        response = requests.get(f"{base_url}/api-info")
        print("📋 API Info:", json.dumps(response.json(), indent=2))
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        print(f"❌ Could not get API info: {e}")
        return False

def test_document_prediction(pdf_path, base_url="http://localhost:5000"):
    """Test the document prediction endpoint."""
    pdf_file = Path(pdf_path)
    
    if not pdf_file.exists():
        print(f"❌ PDF file not found: {pdf_path}")
        return False
    
    if not pdf_file.suffix.lower() == '.pdf':
        print(f"❌ File must be a PDF: {pdf_path}")
        return False
    
    try:
        with open(pdf_file, 'rb') as f:
            files = {'file': (pdf_file.name, f, 'application/pdf')}
            response = requests.post(f"{base_url}/predict", files=files)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Document Prediction Results for '{pdf_file.name}':")
            print(f"   📄 Pages: {result['page_count']}")
            
            for prediction in result['predictions']:
                confidence_str = f" (confidence: {prediction['confidence']:.2%})" if prediction['confidence'] else ""
                print(f"   Page {prediction['page']}: {prediction['predicted_label']}{confidence_str}")
                
            return True
        else:
            error_info = response.json() if response.headers.get('content-type') == 'application/json' else response.text
            print(f"❌ Prediction failed ({response.status_code}):", error_info)
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Could not send prediction request: {e}")
        return False
    except Exception as e:
        print(f"❌ Error during prediction: {e}")
        return False

def main():
    print("🧪 NPLVision Document Classification API Test Script")
    print("=" * 50)
    
    # Test API health
    if not test_api_health():
        print("\n❌ API is not running. Please start the Flask app first:")
        print("   cd projects/api && python app.py")
        return
    
    print()
    
    # Test API info
    test_api_info()
    print()
    
    # Test model info
    test_model_info()
    print()
    
    # Test document prediction if PDF file provided
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        print(f"🔍 Testing document prediction with: {pdf_path}")
        test_document_prediction(pdf_path)
    else:
        print("💡 To test document prediction, provide a PDF file:")
        print(f"   python {sys.argv[0]} path/to/document.pdf")

if __name__ == "__main__":
    main()