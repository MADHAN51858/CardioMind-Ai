import os
import json
import pandas as pd
import numpy as np
from ml.config import (
    RAW_DATA_DIR, MODEL_REPORTS_DIR, FEATURES, TARGET, 
    NUMERICAL_FEATURES, CATEGORICAL_FEATURES
)

def load_raw_dataset():
    """Load the raw Cleveland dataset into a pandas DataFrame."""
    path = os.path.join(RAW_DATA_DIR, "processed.cleveland.data")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Raw data file not found at {path}. Please run download_data.py first.")
    
    # The file has no header, 14 columns
    cols = FEATURES + [TARGET]
    df = pd.read_csv(path, header=None, names=cols, na_values="?")
    return df

def validate_dataset(df):
    """Validate the dataset and return a dictionary validation report."""
    report = {}

    # 1. Structure check
    report["num_rows"] = int(df.shape[0])
    report["num_columns"] = int(df.shape[1])
    report["feature_names"] = list(df.columns)
    
    # 2. Data Types
    dtypes_dict = df.dtypes.astype(str).to_dict()
    report["data_types"] = dtypes_dict
    
    # 3. Missing values summary
    missing_counts = df.isnull().sum().to_dict()
    report["missing_values"] = {k: int(v) for k, v in missing_counts.items()}
    
    # 4. Duplicate rows check
    report["duplicate_rows_count"] = int(df.duplicated().sum())

    # 5. Numerical ranges summary
    numerical_summary = {}
    for col in NUMERICAL_FEATURES:
        if col in df.columns:
            series = df[col].dropna()
            numerical_summary[col] = {
                "min": float(series.min()) if not series.empty else None,
                "max": float(series.max()) if not series.empty else None,
                "mean": float(series.mean()) if not series.empty else None,
                "median": float(series.median()) if not series.empty else None
            }
    report["numerical_ranges"] = numerical_summary

    # 6. Categorical distributions summary
    categorical_summary = {}
    for col in CATEGORICAL_FEATURES:
        if col in df.columns:
            counts = df[col].value_counts(dropna=False).to_dict()
            # Convert keys to strings to be JSON-serializable
            categorical_summary[col] = {str(k): int(v) for k, v in counts.items()}
    report["categorical_distributions"] = categorical_summary

    # 7. Target distribution
    target_counts = df[TARGET].value_counts(dropna=False).to_dict()
    report["target_distribution_raw"] = {str(k): int(v) for k, v in target_counts.items()}

    # Check for mapped binary target distribution (0 -> 0; 1,2,3,4 -> 1)
    mapped_target = df[TARGET].apply(lambda x: 1 if x > 0 else 0)
    mapped_counts = mapped_target.value_counts().to_dict()
    report["target_distribution_mapped"] = {
        "class_0_absence_count": int(mapped_counts.get(0, 0)),
        "class_1_presence_count": int(mapped_counts.get(1, 0)),
        "class_0_percentage": float(mapped_counts.get(0, 0) / len(df) * 100),
        "class_1_percentage": float(mapped_counts.get(1, 0) / len(df) * 100)
    }

    # 8. Out-of-bounds/impossible values verification
    anomalies = []
    
    # Check age range
    invalid_ages = df[~df["age"].between(0, 120)]
    if not invalid_ages.empty:
        anomalies.append(f"Found {len(invalid_ages)} rows with impossible age: {invalid_ages['age'].tolist()}")
        
    # Check sex code (should be 0 or 1)
    invalid_sex = df[~df["sex"].isin([0, 1])]
    if not invalid_sex.empty:
        anomalies.append(f"Found {len(invalid_sex)} rows with invalid sex code: {invalid_sex['sex'].tolist()}")

    # Check cholesterol (impossible values <= 0)
    invalid_chol = df[df["chol"] <= 0]
    if not invalid_chol.empty:
        anomalies.append(f"Found {len(invalid_chol)} rows with cholesterol <= 0")

    # Check blood pressure (impossible values <= 0)
    invalid_trestbps = df[df["trestbps"] <= 0]
    if not invalid_trestbps.empty:
        anomalies.append(f"Found {len(invalid_trestbps)} rows with resting blood pressure <= 0")

    report["validation_anomalies"] = anomalies
    report["is_valid"] = len(anomalies) == 0

    return report

def main():
    os.makedirs(MODEL_REPORTS_DIR, exist_ok=True)
    
    try:
        df = load_raw_dataset()
        report = validate_dataset(df)
        
        # Save report as JSON
        report_path = os.path.join(MODEL_REPORTS_DIR, "data_validation_report.json")
        with open(report_path, "w") as f:
            json.dump(report, f, indent=4)
            
        print("[SUCCESS] Data validation check complete.")
        print(f"Validation report saved to: {report_path}")
        print("\n=== Validation Summary ===")
        print(f"Number of Rows: {report['num_rows']}")
        print(f"Number of Columns: {report['num_columns']}")
        print(f"Duplicate Rows: {report['duplicate_rows_count']}")
        print(f"Missing Values: {report['missing_values']}")
        print("\nTarget Class Distribution (Mapped Binary):")
        print(f"  Class 0 (Absence): {report['target_distribution_mapped']['class_0_absence_count']} ({report['target_distribution_mapped']['class_0_percentage']:.2f}%)")
        print(f"  Class 1 (Presence): {report['target_distribution_mapped']['class_1_presence_count']} ({report['target_distribution_mapped']['class_1_percentage']:.2f}%)")
        print("Anomalies found:", report["validation_anomalies"])
        
    except Exception as e:
        print(f"[ERROR] Validation failed. Reason: {e}")
        raise

if __name__ == "__main__":
    main()
