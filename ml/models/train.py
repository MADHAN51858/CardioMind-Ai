import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier

from ml.config import (
    RAW_DATA_DIR, PROCESSED_DATA_DIR, RANDOM_STATE, FEATURES, TARGET
)
from ml.data.preprocess import build_preprocessing_pipeline, load_and_clean_data, get_preprocessed_feature_names

# Define Artifact Paths
MODELS_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "models")
METRICS_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "metrics")
PLOTS_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "plots")

def main():
    # Make sure output folders exist
    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
    os.makedirs(MODELS_ARTIFACT_DIR, exist_ok=True)
    os.makedirs(METRICS_ARTIFACT_DIR, exist_ok=True)
    os.makedirs(PLOTS_ARTIFACT_DIR, exist_ok=True)

    # 1. Load raw dataset and apply target mapping
    raw_path = os.path.join(RAW_DATA_DIR, "processed.cleveland.data")
    X, y = load_and_clean_data(raw_path)
    
    # 2. Stratified train/test split (80% train, 20% test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=RANDOM_STATE
    )
    
    # Save the splits for evaluation scripts to use
    X_train.to_csv(os.path.join(PROCESSED_DATA_DIR, "X_train.csv"), index=False)
    X_test.to_csv(os.path.join(PROCESSED_DATA_DIR, "X_test.csv"), index=False)
    y_train.to_csv(os.path.join(PROCESSED_DATA_DIR, "y_train.csv"), index=False)
    y_test.to_csv(os.path.join(PROCESSED_DATA_DIR, "y_test.csv"), index=False)
    
    print(f"[DATA] Train samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    # 3. Setup Preprocessing Pipeline
    preprocessor = build_preprocessing_pipeline()
    
    # Fit preprocessor on X_train only to retrieve feature names (and check column shape)
    preprocessor.fit(X_train)
    feature_names = get_preprocessed_feature_names(preprocessor)
    
    # Save preprocessing pipeline and feature names
    joblib.dump(preprocessor, os.path.join(MODELS_ARTIFACT_DIR, "preprocessor.joblib"))
    with open(os.path.join(MODELS_ARTIFACT_DIR, "feature_names.json"), "w") as f:
        json.dump(feature_names, f)
        
    # 4. Define Cross Validation & Models
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    
    # We define pipelines and parameter grids for GridSearch
    models_config = {
        "logistic_regression": {
            "model": LogisticRegression(max_iter=1000, random_state=RANDOM_STATE),
            "params": {
                "classifier__C": [0.01, 0.1, 1.0, 10.0],
                "classifier__penalty": ["l2"]
            }
        },
        "random_forest": {
            "model": RandomForestClassifier(random_state=RANDOM_STATE),
            "params": {
                "classifier__n_estimators": [50, 100, 200],
                "classifier__max_depth": [3, 5, 7, None],
                "classifier__min_samples_split": [2, 5]
            }
        },
        "xgboost": {
            "model": XGBClassifier(random_state=RANDOM_STATE, eval_metric="logloss"),
            "params": {
                "classifier__n_estimators": [50, 100, 150],
                "classifier__max_depth": [3, 5, 7],
                "classifier__learning_rate": [0.01, 0.05, 0.1]
            }
        },
        "svm": {
            "model": SVC(probability=True, random_state=RANDOM_STATE),
            "params": {
                "classifier__C": [0.1, 1.0, 10.0],
                "classifier__kernel": ["linear", "rbf"], # Linear & non-linear
                "classifier__gamma": ["scale", "auto"]
            }
        }
    }
    
    best_estimators = {}
    training_metadata = {}

    for name, config in models_config.items():
        print(f"\n[TRAINING] Optimizing {name}...")
        
        # Build composite pipeline: preprocessing + model
        pipeline = Pipeline([
            ("preprocessor", build_preprocessing_pipeline()),
            ("classifier", config["model"])
        ])
        
        # Grid Search with Stratified CV
        grid_search = GridSearchCV(
            pipeline,
            param_grid=config["params"],
            cv=cv,
            scoring="roc_auc",
            n_jobs=-1,
            error_score="raise"
        )
        
        grid_search.fit(X_train, y_train)
        print(f"[BEST PARAMETERS] {grid_search.best_params_}")
        print(f"[BEST CV ROC-AUC] {grid_search.best_score_:.4f}")
        
        best_pipeline = grid_search.best_estimator_
        best_estimators[name] = best_pipeline
        
        # Save base (raw) model pipeline
        joblib.dump(best_pipeline, os.path.join(MODELS_ARTIFACT_DIR, f"{name}_raw.joblib"))
        
        # 5. Fit Calibrated Model (using cross-validation calibration wrapper on X_train)
        print(f"[CALIBRATION] Calibrating probabilities for {name}...")
        calibrated_pipeline = Pipeline([
            ("preprocessor", build_preprocessing_pipeline()),
            ("classifier", CalibratedClassifierCV(
                estimator=best_pipeline.named_steps["classifier"],
                method="sigmoid",
                cv=5
            ))
        ])
        calibrated_pipeline.fit(X_train, y_train)
        
        # Save calibrated model pipeline
        joblib.dump(calibrated_pipeline, os.path.join(MODELS_ARTIFACT_DIR, f"{name}_calibrated.joblib"))
        
        training_metadata[name] = {
            "best_params": grid_search.best_params_,
            "best_cv_roc_auc": float(grid_search.best_score_)
        }

    # Save training metadata
    with open(os.path.join(MODELS_ARTIFACT_DIR, "training_metadata.json"), "w") as f:
        json.dump(training_metadata, f, indent=4)
        
    print("\n[SUCCESS] Model training and persistence complete. Artifacts saved.")

if __name__ == "__main__":
    main()
