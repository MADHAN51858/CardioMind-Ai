import os
import sys
import pytest
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient

# Ensure project root is in sys.path
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

try:
    from server.ml.config import (
        RAW_DATA_DIR, FEATURES, TARGET, NUMERICAL_FEATURES, CATEGORICAL_FEATURES
    )
    from server.ml.data.preprocess import load_and_clean_data, build_preprocessing_pipeline
    from server.main import app, models_cache, load_artifacts
except ImportError:
    from ml.config import (
        RAW_DATA_DIR, FEATURES, TARGET, NUMERICAL_FEATURES, CATEGORICAL_FEATURES
    )
    from ml.data.preprocess import load_and_clean_data, build_preprocessing_pipeline
    from main import app, models_cache, load_artifacts

# Pre-load artifacts for testing
load_artifacts()

client = TestClient(app)

# 1. DATA PIPELINE TESTS
def test_raw_data_exists():
    raw_path = os.path.join(RAW_DATA_DIR, "processed.cleveland.data")
    assert os.path.exists(raw_path), "Raw Cleveland dataset file is missing"

def test_load_and_clean_data():
    raw_path = os.path.join(RAW_DATA_DIR, "processed.cleveland.data")
    X, y = load_and_clean_data(raw_path)
    
    # Assert columns
    assert X.shape[1] == len(FEATURES)
    assert len(X) == 303
    assert set(X.columns) == set(FEATURES)
    
    # Assert target mapping (only 0 and 1 allowed)
    assert set(y.unique()).issubset({0, 1})
    assert (y == 1).sum() == 139
    assert (y == 0).sum() == 164

def test_preprocessing_pipeline():
    raw_path = os.path.join(RAW_DATA_DIR, "processed.cleveland.data")
    X, y = load_and_clean_data(raw_path)
    
    preprocessor = build_preprocessing_pipeline()
    preprocessor.fit(X)
    X_trans = preprocessor.transform(X)
    
    # Imputation & scaling check (should not contain NaNs)
    assert not np.isnan(np.asarray(X_trans)).any()
    
    # One-hot encoding check (features columns should expand)
    assert X_trans.shape[1] >= len(FEATURES)


# 2. MODEL INFERENCE TESTS
def test_models_loaded():
    assert "xgboost_calibrated" in models_cache
    assert "logistic_regression_calibrated" in models_cache
    assert "svm_calibrated" in models_cache
    assert "random_forest_calibrated" in models_cache

def test_model_predictions():
    # Mock single patient record
    patient = pd.DataFrame([{
        "age": 50, "sex": 1, "cp": 3, "trestbps": 120, "chol": 230, "fbs": 0,
        "thalach": 160, "exang": 0, "oldpeak": 0.0
    }])
    
    model = models_cache["xgboost_calibrated"]
    prob = model.predict_proba(patient)[0, 1]
    pred = model.predict(patient)[0]
    
    assert 0.0 <= prob <= 1.0, "Probability output is out of bounds [0, 1]"
    assert pred in [0, 1], "Prediction target must be binary (0 or 1)"

def test_high_risk_and_normal_clinical_predictions():
    # 1. Very severe input (Severe hypertension, high cholesterol, diabetes, ST depression, angina)
    bad_payload = {
        "age": 68, "sex": 0, "cp": 1, "trestbps": 190, "chol": 380, "fbs": 1,
        "thalach": 120, "exang": 1, "oldpeak": 2.0
    }
    res_bad = client.post("/api/predict", json=bad_payload)
    assert res_bad.status_code == 200
    data_bad = res_bad.json()
    assert data_bad["probability"] >= 0.75, f"Expected high risk >= 0.75, got {data_bad['probability']}"
    assert data_bad["category"] == "Higher model-estimated probability"
    assert data_bad["prediction"] == 1

    # 2. Healthy normal input
    healthy_payload = {
        "age": 28, "sex": 0, "cp": 3, "trestbps": 110, "chol": 160, "fbs": 0,
        "thalach": 150, "exang": 0, "oldpeak": 0.0
    }
    res_healthy = client.post("/api/predict", json=healthy_payload)
    assert res_healthy.status_code == 200
    data_healthy = res_healthy.json()
    assert data_healthy["probability"] <= 0.35, f"Expected low risk <= 0.35, got {data_healthy['probability']}"
    assert data_healthy["category"] == "Lower model-estimated probability"
    assert data_healthy["prediction"] == 0


# 3. API ENDPOINT TESTS
def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

def test_api_predict_valid():
    payload = {
        "age": 55, "sex": 1, "cp": 4, "trestbps": 130, "chol": 250, "fbs": 0,
        "restecg": 0, "thalach": 150, "exang": 0, "oldpeak": 1.2, "slope": 2,
        "ca": 0, "thal": 3
    }
    res = client.post("/api/predict", json=payload)
    assert res.status_code == 200
    
    data = res.json()
    assert "prediction" in data
    assert "probability" in data
    assert "top_positive_features" in data
    assert "top_negative_features" in data
    assert 0.0 <= data["probability"] <= 1.0

def test_api_predict_missing_field():
    # Age is missing
    payload = {
        "sex": 1, "cp": 4, "trestbps": 130, "chol": 250, "fbs": 0,
        "restecg": 0, "thalach": 150, "exang": 0, "oldpeak": 1.2, "slope": 2,
        "ca": 0, "thal": 3
    }
    res = client.post("/api/predict", json=payload)
    assert res.status_code == 422 # Unprocessable Entity (Validation Error)

def test_api_predict_invalid_value():
    # Cholesterol <= 0 is invalid according to validators
    payload = {
        "age": 55, "sex": 1, "cp": 4, "trestbps": 130, "chol": -10, "fbs": 0,
        "restecg": 0, "thalach": 150, "exang": 0, "oldpeak": 1.2, "slope": 2,
        "ca": 0, "thal": 3
    }
    res = client.post("/api/predict", json=payload)
    assert res.status_code == 422 # Pydantic range check validation error