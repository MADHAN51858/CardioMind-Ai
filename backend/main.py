import os
import json
import uuid
import asyncio
import joblib
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse
from sklearn.metrics import roc_curve
from sklearn.calibration import calibration_curve

from ml.config import (
    FEATURES, NUMERICAL_FEATURES, TARGET, CP_MAPPING, 
    SLOPE_MAPPING, THAL_MAPPING, RESTECG_MAPPING
)
from ml.models.explain import explain_patient_prediction
from backend.chatbot import ChatbotEngine
from backend.pdf_report import generate_pdf_report
from backend.auth import get_password_hash, verify_password, create_access_token, TokenData, ACCESS_TOKEN_EXPIRE_MINUTES, timedelta, get_current_user_token, get_optional_user
from backend.database import init_db, create_user, get_user_by_username
from backend import chat_db
from backend.hospital_service import search_locations, find_nearby_cardiology_hospitals, calculate_routes, scrape_hospital_doctors
from fastapi import Depends

# Paths
MODELS_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml", "models", "artifacts", "models")
METRICS_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml", "models", "artifacts", "metrics")

app = FastAPI(title="CardioMind API", description="FastAPI Backend for Heart Disease AI Prediction System")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables to store loaded models and configs
models_cache = {}
feature_names = []
evaluation_metrics = {}
shap_global_importance = {}
chatbot_engine = None

# In-Memory History (Session scope)
prediction_history = []

class PatientInput(BaseModel):
    age: float = Field(..., ge=0, le=120, description="Age in years")
    sex: int = Field(..., ge=0, le=1, description="Sex (1 = male, 0 = female)")
    cp: int = Field(..., ge=1, le=4, description="Chest pain type (1-4)")
    trestbps: float = Field(..., ge=50, le=250, description="Resting blood pressure (mm Hg)")
    chol: float = Field(..., ge=50, le=600, description="Serum cholesterol (mg/dl)")
    fbs: int = Field(..., ge=0, le=1, description="Fasting blood sugar > 120 mg/dl (1 = true, 0 = false)")
    thalach: float = Field(..., ge=50, le=250, description="Maximum heart rate achieved / pulse (bpm)")
    exang: int = Field(..., ge=0, le=1, description="Exercise induced angina (1 = yes, 0 = no)")
    # Optional hospital instrument defaults for backwards compatibility
    restecg: Optional[int] = Field(0, ge=0, le=2, description="Resting ECG results (0-2)")
    oldpeak: Optional[float] = Field(0.0, ge=0.0, le=10.0, description="ST depression induced by exercise relative to rest")
    slope: Optional[int] = Field(1, ge=1, le=3, description="Slope of peak exercise ST segment (1-3)")
    ca: Optional[int] = Field(0, ge=0, le=3, description="Number of major vessels (0-3) colored by fluoroscopy")
    thal: Optional[int] = Field(3, ge=3, le=7, description="Thalassemia stress result (3, 6, 7)")

class ChatInput(BaseModel):
    message: str
    prediction_context: Optional[dict] = None
    channel_id: Optional[str] = None

class UserAuth(BaseModel):
    username: str
    password: str

@app.on_event("startup")
def load_artifacts():
    global feature_names, evaluation_metrics, shap_global_importance, chatbot_engine
    
    init_db()
    print("[STARTUP] Loading persisted models and configurations...")
    
    try:
        # Load feature names
        with open(os.path.join(MODELS_ARTIFACT_DIR, "feature_names.json"), "r") as f:
            feature_names = json.load(f)
            
        # Load evaluation metrics
        with open(os.path.join(METRICS_ARTIFACT_DIR, "model_evaluation_report.json"), "r") as f:
            evaluation_metrics = json.load(f)
            
        # Load global SHAP importance
        with open(os.path.join(METRICS_ARTIFACT_DIR, "shap_global_importance.json"), "r") as f:
            shap_global_importance = json.load(f)
            
        # Load all calibrated pipelines
        for name in ["logistic_regression", "random_forest", "xgboost", "svm"]:
            models_cache[f"{name}_calibrated"] = joblib.load(
                os.path.join(MODELS_ARTIFACT_DIR, f"{name}_calibrated.joblib")
            )
            models_cache[f"{name}_raw"] = joblib.load(
                os.path.join(MODELS_ARTIFACT_DIR, f"{name}_raw.joblib")
            )
            
        # Initialize Chatbot Engine
        chatbot_engine = ChatbotEngine(knowledge_dir=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "knowledge"))
        
        print("[STARTUP] Successfully loaded all models and chatbot data.")
    except Exception as e:
        print(f"[STARTUP ERROR] Critical failure loading model artifacts: {e}")
        raise e

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "model_loaded": len(models_cache) > 0}

@app.get("/api/model-info")
def get_model_info():
    with open(os.path.join(MODELS_ARTIFACT_DIR, "training_metadata.json"), "r") as f:
        meta = json.load(f)
    return {
        "features": FEATURES,
        "models_available": list(meta.keys()),
        "production_model": "xgboost",
        "training_metadata": meta
    }

@app.get("/api/metrics")
def get_metrics():
    return evaluation_metrics

@app.get("/api/feature-importance")
def get_feature_importance():
    return shap_global_importance

@app.post("/api/signup")
def signup(user: UserAuth):
    hashed_password = get_password_hash(user.password)
    success = create_user(user.username, hashed_password)
    if not success:
        raise HTTPException(status_code=400, detail="Username already exists")
    return {"message": "User created successfully"}

@app.post("/api/login")
def login(user: UserAuth):
    db_user = get_user_by_username(user.username)
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED if 'status' in globals() else 401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "username": user.username}


@app.post("/api/predict")
def predict_patient(patient: PatientInput):
    """Synchronous single prediction for testing endpoints."""
    # Convert input to DataFrame filtered to basic features
    df = pd.DataFrame([patient.model_dump()])[FEATURES]
    
    # Predict using Calibrated XGBoost
    model = models_cache.get("xgboost_calibrated")
    if not model:
        raise HTTPException(status_code=500, detail="Models not loaded")
        
    prob = float(model.predict_proba(df)[0, 1])
    pred = int(model.predict(df)[0])
    
    # Get explanation
    expl = explain_patient_prediction(df)
    
    return {
        "prediction": pred,
        "probability": prob,
        **expl
    }

@app.post("/api/predict-stream")
def predict_patient_stream(patient: PatientInput):
    """
    Server-Sent Events (SSE) endpoint to simulate real-time pipeline execution,
    sending true intermediate operations and results.
    """
    async def event_generator():
        try:
            # 1. Validation
            await asyncio.sleep(0.5)
            yield {
                "event": "message",
                "data": json.dumps({
                    "stage": "validation",
                    "status": "completed",
                    "message": "Basic clinical parameters successfully validated. No hospital instrument procedures required.",
                    "progress": 15
                })
            }
            
            # 2. Preprocessing
            await asyncio.sleep(0.4)
            # Create df filtered to basic features
            df = pd.DataFrame([patient.model_dump()])[FEATURES]
            yield {
                "event": "message",
                "data": json.dumps({
                    "stage": "preprocessing",
                    "status": "completed",
                    "message": "Numeric vitals scaled. Categorical symptoms encoded.",
                    "progress": 35
                })
            }
            
            # 3. Model Analysis (Inference on all 4 models)
            await asyncio.sleep(0.6)
            model_outputs = {}
            for name in ["logistic_regression", "random_forest", "xgboost", "svm"]:
                model_raw = models_cache[f"{name}_raw"]
                raw_prob = float(model_raw.predict_proba(df)[0, 1])
                model_outputs[name] = {"raw_probability": raw_prob}
                
            yield {
                "event": "message",
                "data": json.dumps({
                    "stage": "model_prediction",
                    "status": "completed",
                    "message": "Inference completed across Logistic Regression, Random Forest, XGBoost, and SVM.",
                    "progress": 60,
                    "details": {
                        "Logistic Regression Raw Prob": f"{model_outputs['logistic_regression']['raw_probability']:.2f}",
                        "Random Forest Raw Prob": f"{model_outputs['random_forest']['raw_probability']:.2f}",
                        "XGBoost Raw Prob": f"{model_outputs['xgboost']['raw_probability']:.2f}",
                        "SVM Raw Prob": f"{model_outputs['svm']['raw_probability']:.2f}",
                    }
                })
            }
            
            # 4. Probability Calibration
            await asyncio.sleep(0.4)
            # Get calibrated predictions
            for name in ["logistic_regression", "random_forest", "xgboost", "svm"]:
                model_cal = models_cache[f"{name}_calibrated"]
                cal_prob = float(model_cal.predict_proba(df)[0, 1])
                model_outputs[name]["calibrated_probability"] = cal_prob
                
            yield {
                "event": "message",
                "data": json.dumps({
                    "stage": "probability_calibration",
                    "status": "completed",
                    "message": "Sigmoid calibration function (Platt Scaling) applied to probabilities.",
                    "progress": 75,
                    "details": {
                        "XGBoost Raw Prob": f"{model_outputs['xgboost']['raw_probability']:.2f}",
                        "XGBoost Calibrated Prob": f"{model_outputs['xgboost']['calibrated_probability']:.2f}",
                    }
                })
            }
            
            # 5. Explainable AI / SHAP
            await asyncio.sleep(0.6)
            expl = explain_patient_prediction(df)
            
            yield {
                "event": "message",
                "data": json.dumps({
                    "stage": "shap_explanation",
                    "status": "completed",
                    "message": "Patient-level feature contribution scores (SHAP values) computed successfully.",
                    "progress": 90,
                    "details": {
                        "top_positive": [x["feature"] for x in expl["top_positive_features"][:2]],
                        "top_negative": [x["feature"] for x in expl["top_negative_features"][:2]]
                    }
                })
            }
            
            # 6. Final Results & History Save
            await asyncio.sleep(0.3)
            prob = expl["probability"]
            
            # Configure risk category based on customizable thresholds (Lower <= 35%, Intermediate 35-70%, Higher > 70%)
            if prob <= 0.35:
                category = "Lower model-estimated probability"
            elif prob <= 0.70:
                category = "Intermediate model-estimated probability"
            else:
                category = "Higher model-estimated probability"
                
            result_payload = {
                "id": str(uuid.uuid4()),
                "timestamp": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
                "prediction": expl["prediction"],
                "probability": prob,
                "category": category,
                "top_positive_features": expl["top_positive_features"],
                "top_negative_features": expl["top_negative_features"],
                "explanation": expl["explanation"],
                "model_outputs": model_outputs
            }
            
            # Save to in-memory history
            history_record = {
                "id": result_payload["id"],
                "timestamp": result_payload["timestamp"],
                "patient_input": patient.model_dump(),
                "result": {
                    "probability": prob,
                    "category": category,
                    "prediction": result_payload["prediction"]
                }
            }
            prediction_history.insert(0, history_record)
            if len(prediction_history) > 10:
                prediction_history.pop()
                
            yield {
                "event": "message",
                "data": json.dumps({
                    "stage": "prediction",
                    "status": "completed",
                    "message": "Risk probability generated successfully.",
                    "progress": 100,
                    "result": result_payload
                })
            }
            
        except Exception as e:
            yield {
                "event": "message",
                "data": json.dumps({
                    "stage": "error",
                    "status": "failed",
                    "message": f"Unable to generate prediction. Server encountered error: {str(e)}",
                    "progress": 0
                })
            }

    return EventSourceResponse(event_generator())

@app.get("/api/roc-data")
def get_roc_data():
    X_test_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "processed", "X_test.csv")
    y_test_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "processed", "y_test.csv")
    if not os.path.exists(X_test_path) or not os.path.exists(y_test_path):
        raise HTTPException(status_code=404, detail="Processed test split data not found. Please train models first.")
        
    X_test = pd.read_csv(X_test_path)
    y_test = pd.read_csv(y_test_path)[TARGET]
    
    roc_data = {}
    for name in ["logistic_regression", "random_forest", "xgboost", "svm"]:
        model = models_cache[f"{name}_calibrated"]
        probs = model.predict_proba(X_test)[:, 1]
        fpr, tpr, _ = roc_curve(y_test, probs)
        # Downsample to ~50 points for lighter frontend payload
        step = max(1, len(fpr) // 50)
        roc_data[name] = [{"fpr": float(f), "tpr": float(t)} for f, t in zip(fpr[::step], tpr[::step])]
        # Make sure the last point (1.0, 1.0) is included
        if not roc_data[name] or roc_data[name][-1] != {"fpr": 1.0, "tpr": 1.0}:
            roc_data[name].append({"fpr": 1.0, "tpr": 1.0})
            
    return roc_data

@app.get("/api/calibration-data")
def get_calibration_data():
    X_test_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "processed", "X_test.csv")
    y_test_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "processed", "y_test.csv")
    if not os.path.exists(X_test_path) or not os.path.exists(y_test_path):
        raise HTTPException(status_code=404, detail="Processed test split data not found. Please train models first.")
        
    X_test = pd.read_csv(X_test_path)
    y_test = pd.read_csv(y_test_path)[TARGET]
    
    calibration_data = {}
    for name in ["logistic_regression", "random_forest", "xgboost", "svm"]:
        model = models_cache[f"{name}_calibrated"]
        probs = model.predict_proba(X_test)[:, 1]
        prob_true, prob_pred = calibration_curve(y_test, probs, n_bins=5)
        calibration_data[name] = [{"prob_pred": float(p), "prob_true": float(t)} for p, t in zip(prob_pred, prob_true)]
        
    return calibration_data

@app.get("/api/history")
def get_prediction_history():
    return prediction_history

@app.post("/api/chat")
async def chat_assistant(chat_input: ChatInput, username: str = Depends(get_optional_user)):
    """Grounded educational chat assistant returning direct stream of data."""
    if not chatbot_engine:
        raise HTTPException(status_code=500, detail="Chatbot engine not initialized")
        
    user_id = username or "default_user"
    channel_id = chat_input.channel_id
    if not channel_id:
        title = chat_input.message[:30].strip() + ("..." if len(chat_input.message.strip()) > 30 else "")
        channel_id = await chat_db.create_channel(user_id, title or "New Chat")

    return StreamingResponse(
        chatbot_engine.generate_text_stream(
            chat_input.message,
            prediction_context=chat_input.prediction_context,
            channel_id=channel_id,
            user_id=user_id
        ),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Channel-Id": channel_id,
            "Access-Control-Expose-Headers": "X-Channel-Id"
        }
    )

@app.get("/api/chat/channels")
async def get_channels(username: str = Depends(get_optional_user)):
    return await chat_db.get_channels_for_user(username)

@app.post("/api/chat/channels")
async def create_channel(body: dict = Body(...), username: str = Depends(get_optional_user)):
    title = body.get("title", "New Chat")
    channel_id = await chat_db.create_channel(username, title)
    return {"id": channel_id}

@app.get("/api/chat/channels/{channel_id}/messages")
async def get_messages(channel_id: str):
    return await chat_db.get_messages_for_channel(channel_id)

@app.delete("/api/chat/channels/{channel_id}")
async def delete_channel(channel_id: str):
    await chat_db.delete_channel(channel_id)
    return {"status": "success"}

@app.post("/api/report")
def create_report(payload: dict = Body(...)):
    """Generate and stream PDF report file."""
    patient = payload.get("patient")
    prediction = payload.get("prediction")
    
    if not patient or not prediction:
        raise HTTPException(status_code=400, detail="Missing patient inputs or prediction results in payload")
        
    # Map raw chest pain codes, etc. to friendly labels for the report
    patient_display = {**patient}
    patient_display["cp_label"] = CP_MAPPING.get(float(patient.get("cp")), str(patient.get("cp")))
    patient_display["slope_label"] = SLOPE_MAPPING.get(float(patient.get("slope")), str(patient.get("slope")))
    patient_display["thal_label"] = THAL_MAPPING.get(float(patient.get("thal")), str(patient.get("thal")))
    patient_display["restecg_label"] = RESTECG_MAPPING.get(float(patient.get("restecg")), str(patient.get("restecg")))
    
    # Path for temporary PDF file
    temp_filename = f"temp_report_{uuid.uuid4().hex}.pdf"
    
    try:
        generate_pdf_report(
            patient_display,
            prediction,
            evaluation_metrics.get("models", {}),
            temp_filename
        )
        
        # Read the file and stream it
        def iterfile():
            with open(temp_filename, mode="rb") as fh:
                yield from fh
            # Clean up after sending
            os.remove(temp_filename)
            
        return StreamingResponse(
            iterfile(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=cardio_health_ai_report.pdf"}
        )
    except Exception as e:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


# ==========================================
# HOSPITAL LOCATOR, ROUTING & DOCTOR SCRAPER
# ==========================================

class HospitalDoctorRequest(BaseModel):
    hospital_name: str
    website_url: Optional[str] = None

@app.get("/api/hospitals/geocode")
def geocode_location(q: str):
    """Geocode manual text input into lat/lng and location details."""
    return search_locations(q)

@app.get("/api/hospitals/nearby")
def get_nearby_hospitals(lat: float, lng: float, radius_km: float = 30.0):
    """Find cardiology hospitals and medical centers near given coordinates."""
    return find_nearby_cardiology_hospitals(lat, lng, radius_km)

@app.get("/api/hospitals/routes")
def get_hospital_routes(from_lat: float, from_lng: float, to_lat: float, to_lng: float):
    """Calculate driving, transit, and walking route options with distance and directions."""
    return calculate_routes(from_lat, from_lng, to_lat, to_lng)

@app.post("/api/hospitals/doctors")
def get_hospital_doctors(req: HospitalDoctorRequest):
    """Scrape and extract heart-related doctors with education and specialization."""
    return scrape_hospital_doctors(req.hospital_name, req.website_url)
