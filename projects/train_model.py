import argparse
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import make_pipeline
from sklearn.metrics import accuracy_score, classification_report
import joblib
from config import LABELED_DATASET_CSV, MODEL_OUTPUT_PATH

def train_and_evaluate_model(min_accuracy=0.80):
    """
    Loads the labeled dataset, splits it, trains a more advanced classifier,
    evaluates its performance, and saves the model if it meets the minimum accuracy threshold.
    
    Args:
        min_accuracy: Minimum accuracy threshold for saving the model (default: 0.80)
    """
    print("--- Starting Model Training and Evaluation ---")
    print(f"Minimum accuracy threshold: {min_accuracy:.2%}")
    
    # Load dataset
    try:
        df = pd.read_csv(LABELED_DATASET_CSV)
    except FileNotFoundError:
        print(f"Error: '{LABELED_DATASET_CSV}' not found. Please ensure you have created and labeled the dataset first.")
        return

    # Use 'label' column if 'ground_truth_label' doesn't exist (for newly generated datasets)
    label_column = 'ground_truth_label' if 'ground_truth_label' in df.columns else 'label'
    
    # Clean data
    df.dropna(subset=['text', label_column], inplace=True)
    df[label_column] = df[label_column].astype(str).str.strip()
    
    # Filter out UNLABELED samples
    df = df[df[label_column] != 'UNLABELED']
    
    print(f"Loaded {len(df)} labeled pages.")
    
    # Remove rare classes (less than 2 samples)
    label_counts = df[label_column].value_counts()
    print("\nLabel distribution:")
    for label, count in label_counts.items():
        print(f"  {label}: {count} samples")
    
    labels_to_keep = label_counts[label_counts >= 2].index
    df = df[df[label_column].isin(labels_to_keep)]
    print(f"\nUsing {len(df)} pages after removing rare classes for training.")

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        df['text'], 
        df[label_column], 
        test_size=0.2, 
        random_state=42,
        stratify=df[label_column]
    )
    print(f"\nData split into {len(X_train)} training samples and {len(X_test)} testing samples.")

    # Define and train model pipeline
    # Using TfidfVectorizer with n-grams and LinearSVC for better performance
    model_pipeline = make_pipeline(
        TfidfVectorizer(
            stop_words='english', 
            ngram_range=(1, 3),
            max_features=5000,
            min_df=2
        ),
        LinearSVC(
            random_state=42,
            max_iter=2000,
            C=1.0
        )
    )

    print("\nTraining the model on the training data...")
    model_pipeline.fit(X_train, y_train)
    print("Training complete.")

    # Evaluate the model
    print("\nEvaluating model performance on the unseen test data...")
    y_pred = model_pipeline.predict(X_test)
    
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\nModel Accuracy: {accuracy:.2%}")
    
    print("\nClassification Report:")
    report_labels = sorted(list(y_train.unique()))
    print(classification_report(y_test, y_pred, labels=report_labels, zero_division=0))

    # Save the model if it meets the threshold
    if accuracy >= min_accuracy:
        joblib.dump(model_pipeline, MODEL_OUTPUT_PATH)
        print(f"\nModel performance meets the {min_accuracy:.2%} threshold.")
        print(f"Model saved to '{MODEL_OUTPUT_PATH}'")
        
        # Also save model metadata
        metadata = {
            'accuracy': accuracy,
            'training_samples': len(X_train),
            'test_samples': len(X_test),
            'labels': report_labels,
            'min_accuracy_threshold': min_accuracy
        }
        metadata_path = MODEL_OUTPUT_PATH.parent / f"{MODEL_OUTPUT_PATH.stem}_metadata.json"
        import json
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"Model metadata saved to '{metadata_path}'")
    else:
        print(f"\nModel performance ({accuracy:.2%}) is below the {min_accuracy:.2%} threshold.")
        print("Model not saved. Consider:")
        print("  - Adding more training data")
        print("  - Improving text extraction quality")
        print("  - Adjusting the minimum accuracy threshold")

def main():
    parser = argparse.ArgumentParser(
        description='Train a document classification model for loan collateral analysis'
    )
    parser.add_argument(
        '--min-accuracy', 
        type=float, 
        default=0.85,
        help='Minimum accuracy threshold for saving the model (default: 0.85)'
    )
    
    args = parser.parse_args()
    
    # Validate min_accuracy is between 0 and 1
    if not 0 < args.min_accuracy <= 1:
        print(f"Error: min-accuracy must be between 0 and 1, got {args.min_accuracy}")
        return
    
    train_and_evaluate_model(min_accuracy=args.min_accuracy)

if __name__ == '__main__':
    main()