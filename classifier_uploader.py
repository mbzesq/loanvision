# classifier_uploader.py

import os
import json
from pathlib import Path

INPUT_DIR = Path("ocr_results")
CLASSIFIED_DIR = Path("classified_results")
CLASSIFIED_DIR.mkdir(exist_ok=True)

def mock_classify_text(text: str) -> str:
    """
    Placeholder classifier function.
    Replace with real logic later.
    """
    if "Adjustable Rate" in text:
        return "Note"
    elif "Mortgage" in text:
        return "Mortgage"
    elif "Assignment" in text:
        return "Assignment"
    else:
        return "Unknown"

def extract_text_from_textract(textract_response: dict) -> str:
    """
    Extracts all detected text from Textract JSON response.
    """
    lines = []
    for page in textract_response:
        blocks = page.get("Blocks", [])
        for block in blocks:
            if block.get("BlockType") == "LINE":
                lines.append(block.get("Text", ""))
    return "\n".join(lines)

def main():
    for json_file in INPUT_DIR.glob("*.json"):
        print(f"📄 Classifying {json_file.name}")
        with open(json_file, "r") as f:
            textract_output = json.load(f)

        text = extract_text_from_textract(textract_output)
        doc_type = mock_classify_text(text)

        result = {
            "filename": json_file.name,
            "doc_type": doc_type,
            "text_excerpt": text[:500]  # Optional: preview of extracted text
        }

        output_path = CLASSIFIED_DIR / f"{json_file.stem}_classified.json"
        with open(output_path, "w") as out_f:
            json.dump(result, out_f, indent=2)
        print(f"✅ Saved classification to {output_path}")

if __name__ == "__main__":
    main()
