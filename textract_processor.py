import os
import time
import boto3
import json
from pathlib import Path
from dotenv import load_dotenv
from botocore.exceptions import BotoCoreError, ClientError

print("Running textract_processor.py...")

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
INPUT_DIR = Path("ocr_optimized_pdfs")
OUTPUT_DIR = Path("ocr_results")
OUTPUT_DIR.mkdir(exist_ok=True)

def upload_to_s3(file_path, s3_key):
    s3.upload_file(str(file_path), S3_BUCKET, s3_key)
    print(f"☁️ Uploaded {file_path.name} to s3://{S3_BUCKET}/{s3_key}")
    return f"s3://{S3_BUCKET}/{s3_key}"

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

def process_file(pdf_path):
    try:
        s3_key = f"uploads/{pdf_path.name}"
        upload_to_s3(pdf_path, s3_key)

        job_id = start_textract_job(s3_key)
        print(f"📤 Textract started for {pdf_path.name} [JobId: {job_id}]")

        while True:
            status, _ = is_job_complete(job_id)
            if status == "SUCCEEDED":
                print(f"✅ Textract succeeded for {pdf_path.name}")
                break
            elif status == "FAILED":
                print(f"❌ Textract failed for {pdf_path.name}")
                return None
            else:
                print("⏳ Waiting for Textract to complete...")
                time.sleep(5)

        return get_job_results(job_id)

    except (BotoCoreError, ClientError) as e:
        print(f"❌ Exception for {pdf_path.name}: {str(e)}")
        return None

def main():
    for pdf in INPUT_DIR.glob("*.pdf"):
        print(f"🔍 Processing {pdf.name}")
        result = process_file(pdf)

        if result:
            output_path = OUTPUT_DIR / f"{pdf.stem}.json"
            with open(output_path, "w") as f:
                json.dump(result, f)
            print(f"📄 Saved Textract output to {output_path}")
        else:
            print(f"⚠️ Skipped {pdf.name} due to error")

if __name__ == "__main__":
    main()
