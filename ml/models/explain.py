import os
import json
import joblib
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import shap

from ml.config import (
    PROCESSED_DATA_DIR, MODEL_REPORTS_DIR,
    FEATURES, TARGET
)

# Define Artifact Paths
MODELS_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "models")
METRICS_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "metrics")
PLOTS_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "plots")

def generate_global_shap():
    """Compute global SHAP values on the training data and save summaries."""
    print("[SHAP] Starting global SHAP calculation...")
    
    # 1. Load data
    X_train = pd.read_csv(os.path.join(PROCESSED_DATA_DIR, "X_train.csv"))
    
    # Load preprocessing pipeline and raw XGBoost model (which has native tree structure for TreeExplainer)
    preprocessor = joblib.load(os.path.join(MODELS_ARTIFACT_DIR, "preprocessor.joblib"))
    model = joblib.load(os.path.join(MODELS_ARTIFACT_DIR, "xgboost_raw.joblib"))
    
    with open(os.path.join(MODELS_ARTIFACT_DIR, "feature_names.json"), "r") as f:
        feature_names = json.load(f)
        
    # Preprocess training data
    X_train_transformed = preprocessor.transform(X_train)
    X_train_df = pd.DataFrame(X_train_transformed, columns=feature_names)
    
    # 2. Fit TreeExplainer on XGBoost
    classifier = model.named_steps["classifier"]
    explainer = shap.TreeExplainer(classifier, data=X_train_df)
    shap_values = explainer(X_train_df)
    
    # 3. Generate summary plots
    # Bar Plot
    plt.figure(figsize=(10, 6))
    shap.plots.bar(shap_values, show=False)
    plt.title("SHAP Feature Importance (Global Bar Plot)", fontsize=14)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_ARTIFACT_DIR, "shap_bar.png"), dpi=150)
    plt.close()
    
    # Summary Dot Plot
    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values, X_train_df, show=False)
    plt.title("SHAP Feature Summary (Global Dot Plot)", fontsize=14)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_ARTIFACT_DIR, "shap_summary.png"), dpi=150)
    plt.close()
    
    # 4. Save global feature importance scores
    mean_abs_shap = np.abs(shap_values.values).mean(axis=0)
    shap_importance = dict(zip(feature_names, [float(x) for x in mean_abs_shap]))
    
    # Sort descending
    shap_importance_sorted = sorted(shap_importance.items(), key=lambda x: x[1], reverse=True)
    
    importance_path = os.path.join(METRICS_ARTIFACT_DIR, "shap_global_importance.json")
    with open(importance_path, "w") as f:
        json.dump(dict(shap_importance_sorted), f, indent=4)
        
    # Persist the explainer for local predictions
    joblib.dump(explainer, os.path.join(MODELS_ARTIFACT_DIR, "shap_explainer.joblib"))
    X_train_df.to_csv(os.path.join(PROCESSED_DATA_DIR, "X_train_transformed.csv"), index=False)
    
    print(f"[SUCCESS] Global SHAP plots and values generated. Saved to: {importance_path}")

def explain_patient_prediction(patient_df):
    """
    Generate local explanation for a single patient record.
    Returns probability, prediction class, top positive contributors, 
    top negative contributors, and explanation list.
    """
    # Load components
    preprocessor = joblib.load(os.path.join(MODELS_ARTIFACT_DIR, "preprocessor.joblib"))
    model_cal = joblib.load(os.path.join(MODELS_ARTIFACT_DIR, "xgboost_calibrated.joblib"))
    explainer = joblib.load(os.path.join(MODELS_ARTIFACT_DIR, "shap_explainer.joblib"))
    
    with open(os.path.join(MODELS_ARTIFACT_DIR, "feature_names.json"), "r") as f:
        feature_names = json.load(f)
        
    # Preprocess patient features
    patient_transformed = preprocessor.transform(patient_df)
    patient_transformed_df = pd.DataFrame(patient_transformed, columns=feature_names)
    
    # Compute probability & prediction
    prob = float(model_cal.predict_proba(patient_df)[0, 1])
    pred = int(model_cal.predict(patient_df)[0])
    
    # Compute local SHAP values
    shap_values = explainer(patient_transformed_df)
    shap_vector = shap_values.values[0]
    
    # Zip feature names, feature values, and SHAP values
    explanation_details = []
    for f_name, val, s_val in zip(feature_names, patient_transformed_df.iloc[0], shap_vector):
        explanation_details.append({
            "feature": f_name,
            "transformed_value": float(val),
            "shap_value": float(s_val)
        })
        
    # Sort by SHAP value magnitude
    explanation_details_sorted = sorted(explanation_details, key=lambda x: x["shap_value"])
    
    # Categorize contributors
    positive_contribs = [x for x in explanation_details_sorted if x["shap_value"] > 0]
    negative_contribs = [x for x in explanation_details_sorted if x["shap_value"] < 0]
    
    # Sort positive descending, negative ascending
    positive_contribs = sorted(positive_contribs, key=lambda x: x["shap_value"], reverse=True)
    negative_contribs = sorted(negative_contribs, key=lambda x: x["shap_value"])
    
    # Generate user-friendly text descriptions
    text_explanations = []
    
    for c in positive_contribs[:3]:
        text_explanations.append(
            f"Feature '{c['feature']}' contributed positively to the model prediction (SHAP: +{c['shap_value']:.4f})."
        )
    for c in negative_contribs[:3]:
        text_explanations.append(
            f"Feature '{c['feature']}' contributed negatively to the model prediction (SHAP: {c['shap_value']:.4f})."
        )
        
    return {
        "prediction": pred,
        "probability": prob,
        "top_positive_features": positive_contribs,
        "top_negative_features": negative_contribs,
        "explanation": text_explanations
    }

def main():
    try:
        generate_global_shap()
    except Exception as e:
        print(f"[ERROR] SHAP generation failed. Reason: {e}")
        raise

if __name__ == "__main__":
    main()
