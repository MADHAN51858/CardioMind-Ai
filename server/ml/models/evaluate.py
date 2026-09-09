import os
import json
import joblib
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, precision_recall_curve, auc, confusion_matrix,
    brier_score_loss, roc_curve
)
from sklearn.calibration import calibration_curve
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression

try:
    from server.ml.config import (
        PROCESSED_DATA_DIR, EXTERNAL_DATA_DIR, MODEL_REPORTS_DIR, 
        NUMERICAL_FEATURES, TARGET, RANDOM_STATE, FEATURES
    )
except ImportError:
    from ml.config import (
        PROCESSED_DATA_DIR, EXTERNAL_DATA_DIR, MODEL_REPORTS_DIR, 
        NUMERICAL_FEATURES, TARGET, RANDOM_STATE, FEATURES
    )

# Define Artifact Paths
MODELS_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "models")
METRICS_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "metrics")
PLOTS_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "plots")

def calculate_metrics(y_true, y_pred, y_prob):
    """Calculate comprehensive binary classification metrics."""
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0 # Also Recall
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    accuracy = (tp + tn) / (tp + tn + fp + fn)
    f1 = 2 * (precision * sensitivity) / (precision + sensitivity) if (precision + sensitivity) > 0 else 0.0
    
    # ROC-AUC
    roc_auc = roc_auc_score(y_true, y_prob)
    
    # PR-AUC
    precisions_pr, recalls_pr, _ = precision_recall_curve(y_true, y_prob)
    pr_auc = auc(recalls_pr, precisions_pr)
    
    # Brier Score
    brier = brier_score_loss(y_true, y_prob)
    
    return {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(sensitivity), # Sensitivity
        "f1_score": float(f1),
        "sensitivity": float(sensitivity),
        "specificity": float(specificity),
        "roc_auc": float(roc_auc),
        "pr_auc": float(pr_auc),
        "brier_score": float(brier),
        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp)
        }
    }

def run_subgroup_analysis(model, X, y):
    """Analyze model performance across age and sex subgroups."""
    results = {}
    
    # Sex Subgroup
    # 0 = Female, 1 = Male
    for sex_val, sex_label in [(0, "female"), (1, "male")]:
        idx = X[X["sex"] == sex_val].index
        if len(idx) > 0:
            X_sub, y_sub = X.loc[idx], y.loc[idx]
            probs = model.predict_proba(X_sub)[:, 1]
            preds = model.predict(X_sub)
            
            sub_metrics = calculate_metrics(y_sub, preds, probs)
            sub_metrics["sample_size"] = len(idx)
            sub_metrics["warning"] = "Sample size too small for statistical significance (<30)" if len(idx) < 30 else None
            results[f"sex_{sex_label}"] = sub_metrics
            
    # Age Subgroups
    age_bins = [
        ("<50", X["age"] < 50),
        ("50-65", X["age"].between(50, 65)),
        (">65", X["age"] > 65)
    ]
    for label, mask in age_bins:
        idx = X[mask].index
        if len(idx) > 0:
            X_sub, y_sub = X.loc[idx], y.loc[idx]
            probs = model.predict_proba(X_sub)[:, 1]
            preds = model.predict(X_sub)
            
            sub_metrics = calculate_metrics(y_sub, preds, probs)
            sub_metrics["sample_size"] = len(idx)
            sub_metrics["warning"] = "Sample size too small for statistical significance (<30)" if len(idx) < 30 else None
            results[f"age_{label}"] = sub_metrics
            
    return results

def perform_external_validation(X_train_full, y_train_full):
    """
    Train a 4-feature model on UCI (Age, Sex, Resting BP, Cholesterol) 
    and validate externally on NHANES 2017-2018.
    """
    overlap_features = ["age", "sex", "trestbps", "chol"]
    
    # 1. Fit sub-model on UCI
    from sklearn.compose import ColumnTransformer
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import StandardScaler
    
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), ["age", "trestbps", "chol"]),
            ("bin", Pipeline([("imp", SimpleImputer(strategy="most_frequent"))]), ["sex"])
        ]
    )
    
    sub_model = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(random_state=RANDOM_STATE))
    ])
    
    sub_model.fit(X_train_full[overlap_features], y_train_full)
    
    # 2. Load and clean NHANES data
    try:
        demo = pd.read_sas(os.path.join(EXTERNAL_DATA_DIR, "DEMO_J.XPT"), format="xport")
        mcq = pd.read_sas(os.path.join(EXTERNAL_DATA_DIR, "MCQ_J.XPT"), format="xport")
        bpx = pd.read_sas(os.path.join(EXTERNAL_DATA_DIR, "BPX_J.XPT"), format="xport")
        tchol = pd.read_sas(os.path.join(EXTERNAL_DATA_DIR, "TCHOL_J.XPT"), format="xport")
        
        # Merge NHANES datasets
        nhanes = demo.merge(mcq, on="SEQN").merge(bpx, on="SEQN").merge(tchol, on="SEQN")
        
        # Keep relevant columns and drop rows where target is missing or refused
        # MCQ160C: Coronary heart disease (1=Yes, 2=No, 7=Refused, 9=Don't know)
        # MCQ160E: Heart attack (1=Yes, 2=No, 7=Refused, 9=Don't know)
        nhanes = nhanes[nhanes["MCQ160C"].isin([1, 2]) & nhanes["MCQ160E"].isin([1, 2])]
        
        # Map variables
        nhanes_df = pd.DataFrame()
        nhanes_df["age"] = nhanes["RIDAGEYR"]
        # NHANES gender: 1=Male, 2=Female -> Cleveland: 1=Male, 0=Female
        nhanes_df["sex"] = nhanes["RIAGENDR"].map({1: 1, 2: 0})
        nhanes_df["trestbps"] = nhanes["BPXSY1"] # Systolic blood pressure (as resting BP proxy)
        nhanes_df["chol"] = nhanes["LBXTC"] # Total cholesterol
        
        # Construct composite self-reported target: 1 if CHD or Heart Attack is 1, else 0
        nhanes_df[TARGET] = ((nhanes["MCQ160C"] == 1) | (nhanes["MCQ160E"] == 1)).astype(int)
        
        # Drop missing values in the overlapping columns
        nhanes_df = nhanes_df.dropna()
        
        if len(nhanes_df) == 0:
            return {"status": "error", "message": "NHANES dataset is empty after merging/cleaning"}
            
        X_nhanes = nhanes_df[overlap_features]
        y_nhanes = nhanes_df[TARGET]
        
        probs = sub_model.predict_proba(X_nhanes)[:, 1]
        preds = sub_model.predict(X_nhanes)
        
        metrics = calculate_metrics(y_nhanes, preds, probs)
        metrics["sample_size"] = len(nhanes_df)
        metrics["status"] = "success"
        
        return metrics
    except Exception as e:
        return {"status": "error", "message": str(e)}

def main():
    # Load processed splits
    X_train = pd.read_csv(os.path.join(PROCESSED_DATA_DIR, "X_train.csv"))
    X_test = pd.read_csv(os.path.join(PROCESSED_DATA_DIR, "X_test.csv"))
    y_train = pd.read_csv(os.path.join(PROCESSED_DATA_DIR, "y_train.csv"))[TARGET]
    y_test = pd.read_csv(os.path.join(PROCESSED_DATA_DIR, "y_test.csv"))[TARGET]

    models = ["logistic_regression", "random_forest", "xgboost", "svm"]
    results = {}
    
    plt.figure(figsize=(10, 8))
    
    for name in models:
        # Load raw & calibrated models
        model_raw = joblib.load(os.path.join(MODELS_ARTIFACT_DIR, f"{name}_raw.joblib"))
        model_cal = joblib.load(os.path.join(MODELS_ARTIFACT_DIR, f"{name}_calibrated.joblib"))
        
        # Raw Model predictions on test set
        y_prob_raw = model_raw.predict_proba(X_test)[:, 1]
        y_pred_raw = model_raw.predict(X_test)
        metrics_raw = calculate_metrics(y_test, y_pred_raw, y_prob_raw)
        
        # Calibrated Model predictions on test set
        y_prob_cal = model_cal.predict_proba(X_test)[:, 1]
        y_pred_cal = model_cal.predict(X_test)
        metrics_cal = calculate_metrics(y_test, y_pred_cal, y_prob_cal)
        
        # Run subgroups analysis on the calibrated model
        subgroups = run_subgroup_analysis(model_cal, X_test, y_test)
        
        results[name] = {
            "raw": metrics_raw,
            "calibrated": metrics_cal,
            "subgroups": subgroups
        }
        
        # Plot ROC curve for Calibrated models
        fpr, tpr, _ = roc_curve(y_test, y_prob_cal)
        roc_auc = metrics_cal["roc_auc"]
        plt.plot(fpr, tpr, label=f"{name.replace('_', ' ').title()} (AUC = {roc_auc:.2f})")

    # Finalize ROC plot
    plt.plot([0, 1], [0, 1], color="navy", linestyle="--")
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title("Receiver Operating Characteristic (ROC) Curves (Calibrated)")
    plt.legend(loc="lower right")
    plt.savefig(os.path.join(PLOTS_ARTIFACT_DIR, "roc_curves.png"), dpi=150)
    plt.close()
    
    # Calibration Curve Plot
    plt.figure(figsize=(8, 6))
    for name in models:
        model_cal = joblib.load(os.path.join(MODELS_ARTIFACT_DIR, f"{name}_calibrated.joblib"))
        y_prob = model_cal.predict_proba(X_test)[:, 1]
        prob_true, prob_pred = calibration_curve(y_test, y_prob, n_bins=5)
        plt.plot(prob_pred, prob_true, marker="o", label=name.replace('_', ' ').title())
    plt.plot([0, 1], [0, 1], linestyle="--", color="gray", label="Perfectly Calibrated")
    plt.xlabel("Mean Predicted Probability")
    plt.ylabel("Fraction of Positives")
    plt.title("Calibration Curves")
    plt.legend(loc="lower right")
    plt.savefig(os.path.join(PLOTS_ARTIFACT_DIR, "calibration_curves.png"), dpi=150)
    plt.close()

    # External Validation on NHANES
    print("[NHANES] Running external validation...")
    nhanes_metrics = perform_external_validation(
        pd.concat([X_train, X_test], ignore_index=True),
        pd.concat([y_train, y_test], ignore_index=True)
    )
    
    evaluation_report = {
        "models": results,
        "nhanes_external_validation": nhanes_metrics
    }
    
    # Save validation reports
    report_path = os.path.join(METRICS_ARTIFACT_DIR, "model_evaluation_report.json")
    with open(report_path, "w") as f:
        json.dump(evaluation_report, f, indent=4)
        
    print(f"[SUCCESS] Model evaluation complete. Metrics report saved to: {report_path}")
    print("Test set performance for Calibrated models:")
    for name in models:
        m = results[name]["calibrated"]
        print(f"  {name:20} -> Acc: {m['accuracy']:.4f}, Sens: {m['sensitivity']:.4f}, Spec: {m['specificity']:.4f}, ROC-AUC: {m['roc_auc']:.4f}")
    if nhanes_metrics.get("status") == "success":
        print(f"NHANES External Validation (4-Feature Sub-Model) -> Sample Size: {nhanes_metrics['sample_size']}, ROC-AUC: {nhanes_metrics['roc_auc']:.4f}")
    else:
        print(f"NHANES Validation error: {nhanes_metrics.get('message')}")

if __name__ == "__main__":
    main()
