import os
import time
import boto3
import json
import shutil
from pathlib import Path
from dotenv import load_dotenv
from botocore.exceptions import BotoCoreError, ClientError
from pdf2image import convert_from_path
from PIL import Image
import img2pdf
from datetime import datetime

print("Running unified textract_processor.py with integrated OCR repair...")

# ✅ Load environment variables from .env
load_dotenv()

# ✅ Pull AWS credentials from the environment
AWS_REGION = os.getenv("AWS_REGION")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
S3_BUCKET = os.getenv("S3_BUCKET", "nplvision-textract-inputs")  # Default if not in .env

# ✅ Initialize AWS clients using env credentials
s3 = boto3.client(
    "s3",
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
)

textract = boto3.client(
    "textract",
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
)

# ✅ Input/output directories
INPUT_DIR = Path("docs/test_set")  # Now processing original PDFs directly
TEMP_IMAGE_DIR = Path("temp_images")
OPTIMIZED_PDF_DIR = Path("ocr_optimized_pdfs")
OUTPUT_DIR = Path("ocr_results")
LOG_FILE = Path("ocr_pipeline_log.json")

# Create necessary directories
TEMP_IMAGE_DIR.mkdir(exist_ok=True)
OPTIMIZED_PDF_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

def repair_and_optimize_pdf(pdf_path: Path, temp_dir: Path, output_dir: Path) -> Path:
    """
    Optimizes a PDF for OCR by converting to grayscale images and reassembling.
    
    Args:
        pdf_path: Path to the input PDF
        temp_dir: Directory for temporary image files
        output_dir: Directory for the optimized PDF output
        
    Returns:
        Path to the optimized PDF file
    """
    print(f"🔧 Optimizing PDF: {pdf_path.name}")
    
    # Create subdirectory for this PDF's temporary images
    pdf_temp_dir = temp_dir / pdf_path.stem
    pdf_temp_dir.mkdir(exist_ok=True)
    
    try:
        # Convert PDF to grayscale images at 300 DPI
        images = convert_from_path(str(pdf_path), dpi=300)
        image_paths = []
        
        for idx, img in enumerate(images):
            # Convert to grayscale
            grayscale = img.convert("L")
            
            # Save temporary image
            temp_image_path = pdf_temp_dir / f"page_{idx + 1}.png"
            grayscale.save(temp_image_path)
            image_paths.append(temp_image_path)
        
        # Reassemble optimized PDF
        output_pdf_path = output_dir / f"{pdf_path.stem}_ocr_fixed.pdf"
        with open(output_pdf_path, "wb") as f:
            f.write(img2pdf.convert([str(p) for p in image_paths]))
        
        print(f"✅ Created optimized PDF: {output_pdf_path.name}")
        
        # Clean up temporary images
        for path in image_paths:
            path.unlink()
        pdf_temp_dir.rmdir()  # Remove the subdirectory
        
        return output_pdf_path
        
    except Exception as e:
        # Clean up on error
        if pdf_temp_dir.exists():
            shutil.rmtree(pdf_temp_dir)
        raise Exception(f"Failed to optimize PDF: {str(e)}")

def upload_to_s3(file_path, s3_key):
    s3.upload_file(str(file_path), S3_BUCKET, s3_key)
    print(f"☁️ Uploaded {file_path.name} to s3://{S3_BUCKET}/{s3_key}")

def start_textract_job(s3_key):
    response = textract.start_document_text_detection(
        DocumentLocation={"S3Object": {"Bucket": S3_BUCKET, "Name": s3_key}}
    )
    return response["JobId"]

def is_job_complete(job_id):
    response = textract.get_document_text_detection(JobId=job_id)
    return response["JobStatus"], response

def get_job_results(job_id):
    pages = []
    next_token = None

    while True:
        if next_token:
            response = textract.get_document_text_detection(JobId=job_id, NextToken=next_token)
        else:
            response = textract.get_document_text_detection(JobId=job_id)

        pages.append(response)
        next_token = response.get("NextToken")
        if not next_token:
            break

    return pages


def main():
    """
    Main pipeline function that processes all PDFs through repair, upload, and OCR.
    Logs all results to ocr_pipeline_log.json for diagnostics.
    """
    print(f"\n🚀 Starting unified OCR pipeline at {datetime.now().isoformat()}")
    print(f"📁 Processing PDFs from: {INPUT_DIR}")
    
    # Initialize processing summary
    processing_summary = {
        "pipeline_start": datetime.now().isoformat(),
        "total_files": 0,
        "successful": 0,
        "repair_failures": 0,
        "textract_failures": 0,
        "files": []
    }
    
    # Get all PDF files
    pdf_files = list(INPUT_DIR.glob("*.pdf"))
    processing_summary["total_files"] = len(pdf_files)
    
    if not pdf_files:
        print("⚠️ No PDF files found in the input directory.")
        return
    
    print(f"📊 Found {len(pdf_files)} PDF files to process\n")
    
    for pdf in pdf_files:
        file_record = {
            "filename": pdf.name,
            "status": "pending",
            "error": None,
            "optimized_path": None,
            "output_path": None,
            "processing_time": None
        }
        
        start_time = time.time()
        
        try:
            print(f"\n{'='*60}")
            print(f"📄 Processing: {pdf.name}")
            print(f"{'='*60}")
            
            # Step 1: Repair and optimize PDF
            try:
                optimized_pdf = repair_and_optimize_pdf(pdf, TEMP_IMAGE_DIR, OPTIMIZED_PDF_DIR)
                file_record["optimized_path"] = str(optimized_pdf)
            except Exception as e:
                file_record["status"] = "repair_failed"
                file_record["error"] = str(e)
                processing_summary["repair_failures"] += 1
                print(f"❌ Repair failed for {pdf.name}: {str(e)}")
                processing_summary["files"].append(file_record)
                continue
            
            # Step 2: Process with Textract
            try:
                # Upload to S3
                s3_key = f"uploads/{optimized_pdf.name}"
                upload_to_s3(optimized_pdf, s3_key)
                
                # Start Textract job
                job_id = start_textract_job(s3_key)
                print(f"📤 Textract job started [JobId: {job_id}]")
                
                # Wait for completion
                while True:
                    status, _ = is_job_complete(job_id)
                    if status == "SUCCEEDED":
                        print(f"✅ Textract succeeded for {pdf.name}")
                        break
                    elif status == "FAILED":
                        raise Exception("Textract job failed")
                    else:
                        print("⏳ Waiting for Textract to complete...")
                        time.sleep(5)
                
                # Get results
                result = get_job_results(job_id)
                
                # Save results
                output_path = OUTPUT_DIR / f"{pdf.stem}.json"
                with open(output_path, "w") as f:
                    json.dump(result, f)
                    
                file_record["output_path"] = str(output_path)
                file_record["status"] = "success"
                processing_summary["successful"] += 1
                print(f"💾 Saved Textract output to {output_path}")
                
            except Exception as e:
                file_record["status"] = "textract_failed"
                file_record["error"] = str(e)
                processing_summary["textract_failures"] += 1
                print(f"❌ Textract failed for {pdf.name}: {str(e)}")
                
        except Exception as e:
            # Catch any unexpected errors
            file_record["status"] = "unexpected_error"
            file_record["error"] = str(e)
            print(f"❌ Unexpected error for {pdf.name}: {str(e)}")
            
        finally:
            # Record processing time
            file_record["processing_time"] = round(time.time() - start_time, 2)
            processing_summary["files"].append(file_record)
    
    # Final summary
    processing_summary["pipeline_end"] = datetime.now().isoformat()
    processing_summary["total_processing_time"] = round(
        (datetime.now() - datetime.fromisoformat(processing_summary["pipeline_start"])).total_seconds(), 2
    )
    
    # Write processing log
    with open(LOG_FILE, "w") as f:
        json.dump(processing_summary, f, indent=2)
    
    # Print summary
    print(f"\n{'='*60}")
    print("📊 PIPELINE SUMMARY")
    print(f"{'='*60}")
    print(f"Total files: {processing_summary['total_files']}")
    print(f"✅ Successful: {processing_summary['successful']}")
    print(f"❌ Repair failures: {processing_summary['repair_failures']}")
    print(f"❌ Textract failures: {processing_summary['textract_failures']}")
    print(f"⏱️  Total time: {processing_summary['total_processing_time']}s")
    print(f"\n📝 Detailed log saved to: {LOG_FILE}")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
