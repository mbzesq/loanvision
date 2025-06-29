# config.py
from pathlib import Path

# Define the base directory of the project
BASE_DIR = Path(__file__).parent

# Path to the folder containing training documents
DOCS_PATH = BASE_DIR / "training_docs"

# Path to the output labeled dataset CSV
LABELED_DATASET_CSV = BASE_DIR / "dataset_prelabeled.csv"

# Path for the trained model output
MODEL_OUTPUT_PATH = BASE_DIR / "doc_classifier_model.joblib"