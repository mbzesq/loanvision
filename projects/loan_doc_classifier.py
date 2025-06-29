import os
import re
from pathlib import Path
import pandas as pd
from pdf2image import convert_from_path
import pytesseract
from config import DOCS_PATH, LABELED_DATASET_CSV

def pre_label_page(text: str) -> str:
    """
    Improved pre-labeling logic with priority-based classification
    to prevent misclassifications.
    """
    text_upper = text.upper()
    
    # Higher priority checks first
    if "NOTE" in text_upper and "PROMISE TO PAY" in text_upper: 
        return "Note"
    if "ALLONGE" in text_upper: 
        return "Allonge"
    if "ASSIGNMENT OF MORTGAGE" in text_upper or "ASSIGNMENT OF DEED OF TRUST" in text_upper: 
        return "Assignment"
    if "MORTGAGE" in text_upper and "THIS MORTGAGE" in text_upper: 
        return "Mortgage"
    if "DEED OF TRUST" in text_upper: 
        return "Deed of Trust"
    
    # Lower priority checks last
    if "RIDER" in text_upper: 
        return "Rider"
    if "BAILEE LETTER" in text_upper: 
        return "Bailee Letter"
    
    return "UNLABELED"

def extract_borrower_name(text: str) -> str:
    """
    Extract borrower name from document text using regex patterns.
    """
    # Common patterns for borrower names in mortgage documents
    patterns = [
        r"(?:Borrower|Mortgagor|Maker|Obligor)[:\s]+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})",
        r"(?:Name of Borrower|Borrower Name)[:\s]+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})",
        r"(?:I/We|The undersigned),?\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}),?\s+(?:promise|acknowledge|agree)",
        r"THIS (?:NOTE|MORTGAGE|DEED OF TRUST) is given by\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            borrower = match.group(1).strip()
            # Clean up common OCR issues
            borrower = re.sub(r'\s+', ' ', borrower)
            return borrower
    
    return ""

def extract_property_address(text: str) -> str:
    """
    Extract property address from document text using regex patterns.
    """
    # Common patterns for property addresses in mortgage documents
    patterns = [
        r"(?:Property Address|Property Located at|Property Description)[:\s]+([0-9]+[^,\n]+(?:,\s*[^,\n]+){1,3})",
        r"(?:The property|Said property|Subject property) (?:is )?located at[:\s]+([0-9]+[^,\n]+(?:,\s*[^,\n]+){1,3})",
        r"(?:Street Address|Address)[:\s]+([0-9]+[^,\n]+(?:,\s*[^,\n]+){1,3})",
        r"([0-9]+\s+[A-Za-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd)[^,\n]*(?:,\s*[^,\n]+){1,2})",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            address = match.group(1).strip()
            # Clean up common OCR issues
            address = re.sub(r'\s+', ' ', address)
            # Remove common trailing text
            address = re.sub(r'\s*\(.*\)$', '', address)
            address = re.sub(r'\s*hereinafter.*$', '', address, flags=re.IGNORECASE)
            return address
    
    return ""

def update_and_label_dataset():
    """
    Intelligently updates a dataset with new PDFs and removes data for deleted PDFs,
    preserving all existing manual labels. Now also extracts borrower names and property addresses.
    """
    print("--- Smart Dataset Sync ---")
    
    pdf_files_in_folder = {p.name for p in DOCS_PATH.glob('*.pdf')}
    
    if LABELED_DATASET_CSV.exists():
        print(f"Loading existing labeled data from '{LABELED_DATASET_CSV}'...")
        df = pd.read_csv(LABELED_DATASET_CSV)
        
        # Ensure new columns exist in existing dataset
        if 'extracted_borrower' not in df.columns:
            df['extracted_borrower'] = ''
        if 'extracted_address' not in df.columns:
            df['extracted_address'] = ''
        
        # Remove data for deleted PDFs
        initial_rows = len(df)
        df = df[df['filename'].isin(pdf_files_in_folder)]
        removed_rows = initial_rows - len(df)
        if removed_rows > 0:
            print(f"Removed {removed_rows} rows corresponding to deleted PDFs.")

        processed_files = set(df['filename'].unique())
    else:
        df = pd.DataFrame(columns=['filename', 'page_number', 'text', 'label', 'extracted_borrower', 'extracted_address'])
        processed_files = set()

    new_files_to_process = pdf_files_in_folder - processed_files
    
    if not new_files_to_process:
        print("No new documents to add.")
    else:
        print(f"Found {len(new_files_to_process)} new document(s) to process.")
        new_pages_data = []
        
        for pdf_name in new_files_to_process:
            pdf_path = DOCS_PATH / pdf_name
            print(f"Processing: {pdf_path.name}")
            
            try:
                # CRITICAL: Remove poppler_path for portability
                images = convert_from_path(pdf_path)
                
                # Extract identifiers from first page
                first_page_text = ""
                extracted_borrower = ""
                extracted_address = ""
                
                for i, img in enumerate(images):
                    text = pytesseract.image_to_string(img)
                    
                    # Extract borrower and address from first page only
                    if i == 0:
                        first_page_text = text
                        extracted_borrower = extract_borrower_name(text)
                        extracted_address = extract_property_address(text)
                    
                    new_pages_data.append({
                        'filename': pdf_path.name,
                        'page_number': i + 1,
                        'text': text,
                        'label': 'UNLABELED',  # Default for new pages
                        'extracted_borrower': extracted_borrower,
                        'extracted_address': extracted_address
                    })
            except Exception as e:
                print(f"Could not process {pdf_path.name}. Error: {e}")
        
        if new_pages_data:
            df_new = pd.DataFrame(new_pages_data)
            # Apply pre-labeling to new data
            df_new['label'] = df_new['text'].astype(str).apply(pre_label_page)
            df = pd.concat([df, df_new], ignore_index=True)

    # Save updated dataset
    df.to_csv(LABELED_DATASET_CSV, index=False)
    
    print(f"\nProcessing complete.")
    print(f"Dataset synced and saved to '{LABELED_DATASET_CSV}'.")
    print(f"Total pages in dataset: {len(df)}")
    
    # Show sample of extracted identifiers
    if len(df) > 0:
        unique_docs = df.drop_duplicates(subset=['filename']).head(5)
        print("\nSample of extracted identifiers:")
        for _, row in unique_docs.iterrows():
            print(f"  File: {row['filename']}")
            print(f"    Borrower: {row['extracted_borrower'] or 'Not found'}")
            print(f"    Address: {row['extracted_address'] or 'Not found'}")

if __name__ == '__main__':
    update_and_label_dataset()