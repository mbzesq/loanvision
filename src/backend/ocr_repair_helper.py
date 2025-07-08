#!/usr/bin/env python3
"""
OCR Enhancement Script for NPLVision
Optimizes PDFs for better OCR results by converting to grayscale images and reassembling
Usage: python3 ocr_repair_helper.py <input_pdf> <output_pdf>
"""

import sys
import os
from pathlib import Path
from pdf2image import convert_from_path
from PIL import Image
import img2pdf
import tempfile
import gc

def enhance_pdf(input_path: str, output_path: str) -> bool:
    """
    Enhance a PDF for better OCR results
    
    Args:
        input_path: Path to input PDF
        output_path: Path for output PDF
        
    Returns:
        bool: Success status
    """
    try:
        print(f"[OCR Enhancement] Processing: {Path(input_path).name}")
        
        # Create temporary directory for images
        with tempfile.TemporaryDirectory() as temp_dir:
            # Convert PDF to grayscale images at lower DPI to reduce memory usage
            images = convert_from_path(input_path, dpi=150)  # Reduced from 300 to 150
            image_paths = []
            
            for idx, img in enumerate(images):
                # Convert to grayscale and reduce size for memory efficiency
                grayscale = img.convert("L")
                
                # Resize if image is very large (width > 1500 pixels)
                if grayscale.width > 1500:
                    ratio = 1500 / grayscale.width
                    new_height = int(grayscale.height * ratio)
                    grayscale = grayscale.resize((1500, new_height), Image.Resampling.LANCZOS)
                
                # Save temporary image
                temp_image_path = Path(temp_dir) / f"page_{idx + 1}.png"
                grayscale.save(temp_image_path, optimize=True)
                image_paths.append(str(temp_image_path))
                
                # Clear from memory immediately
                grayscale.close()
                img.close()
            
            # Reassemble optimized PDF
            with open(output_path, "wb") as f:
                f.write(img2pdf.convert(image_paths))
            
            # Force garbage collection to free memory
            gc.collect()
            
            print(f"[OCR Enhancement] Successfully created: {Path(output_path).name}")
            return True
            
    except Exception as e:
        print(f"[OCR Enhancement] Error: {str(e)}")
        return False

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 ocr_repair_helper.py <input_pdf> <output_pdf>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    # Validate input file exists
    if not Path(input_path).exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)
    
    # Ensure output directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    # Process the PDF
    success = enhance_pdf(input_path, output_path)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()