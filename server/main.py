import os
import sys
import json
import uuid
import asyncio
from datetime import datetime
import joblib
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse
from sklearn.metrics import roc_curve
from sklearn.calibration import calibration_curve

# Load .env from project root
_SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SERVER_DIR)

# Load unified root .env
load_dotenv(os.path.join(_PROJECT_ROOT, ".env"))
load_dotenv()

# Ensure project root & server dir are on sys.path
for p in [_PROJECT_ROOT, _SERVER_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

import secrets
import re

try:
    from server.ml.config import (
        FEATURES, NUMERICAL_FEATURES, TARGET, CP_MAPPING, 
        SLOPE_MAPPING, THAL_MAPPING, RESTECG_MAPPING
    )
    from server.ml.clinical_risk import blend_ml_and_clinical_risk, compute_clinical_cardiovascular_risk
    from server.ml.models.explain import explain_patient_prediction
    from server.chatbot import ChatbotEngine
    from server.pdf_report import generate_pdf_report
    from server.auth import (
        get_password_hash, verify_password, create_access_token, 
        TokenData, ACCESS_TOKEN_EXPIRE_MINUTES, timedelta, 
        get_current_user_token, get_optional_user
    )
    from server.database import (
        init_db, create_user, get_user_by_username, get_user_by_email,
        get_user_by_identifier, update_user_password, update_user_profile,
        create_password_reset, verify_password_reset_otp, verify_password_reset_token,
        mark_password_reset_used, save_report, get_all_reports
    )
    from server.mailer import send_password_reset_email
    from server import chat_db
    from server.hospital_service import search_locations, find_nearby_cardiology_hospitals, calculate_routes, scrape_hospital_doctors
except ImportError:
    from ml.config import (
        FEATURES, NUMERICAL_FEATURES, TARGET, CP_MAPPING, 
        SLOPE_MAPPING, THAL_MAPPING, RESTECG_MAPPING
    )
    from ml.clinical_risk import blend_ml_and_clinical_risk, compute_clinical_cardiovascular_risk
    from ml.models.explain import explain_patient_prediction
    from chatbot import ChatbotEngine
    from pdf_report import generate_pdf_report
    from auth import (
        get_password_hash, verify_password, create_access_token, 
        TokenData, ACCESS_TOKEN_EXPIRE_MINUTES, timedelta, 
        get_current_user_token, get_optional_user
    )
    from database import (
        init_db, create_user, get_user_by_username, get_user_by_email,
        get_user_by_identifier, update_user_password, update_user_profile,
        create_password_reset, verify_password_reset_otp, verify_password_reset_token,
        mark_password_reset_used, save_report, get_all_reports
    )
    from mailer import send_password_reset_email
    import chat_db
    from hospital_service import search_locations, find_nearby_cardiology_hospitals, calculate_routes, scrape_hospital_doctors

# Paths — resolve relative to this file
_SERVER_ML_MODELS = os.path.join(_SERVER_DIR, "ml", "models", "artifacts", "models")
MODELS_ARTIFACT_DIR = _SERVER_ML_MODELS if os.path.isdir(_SERVER_ML_MODELS) else os.path.join(_PROJECT_ROOT, "ml", "models", "artifacts", "models")

_SERVER_ML_METRICS = os.path.join(_SERVER_DIR, "ml", "models", "artifacts", "metrics")
METRICS_ARTIFACT_DIR = _SERVER_ML_METRICS if os.path.isdir(_SERVER_ML_METRICS) else os.path.join(_PROJECT_ROOT, "ml", "models", "artifacts", "metrics")

app = FastAPI(title="CardioMind API", description="FastAPI Backend for Heart Disease AI Prediction System")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static frontend serving ──────────────────────────────────────────────────
# FastAPI serves the built React app from root dist/ so a single process handles everything.
_FRONTEND_DIST = os.path.join(_PROJECT_ROOT, "dist")

@app.on_event("startup")
async def mount_static():
    """Mount the React build output if it exists."""
    if os.path.isdir(_FRONTEND_DIST):
        app.mount("/assets", StaticFiles(directory=os.path.join(_FRONTEND_DIST, "assets")), name="assets")
        print(f"[STARTUP] Serving frontend from {_FRONTEND_DIST}")
    else:
        print(f"[STARTUP] No frontend build found at {_FRONTEND_DIST} — API-only mode")

# Global variables to store loaded models and configs
models_cache = {}
feature_names = []
evaluation_metrics = {}
shap_global_importance = {}
chatbot_engine = None

# In-Memory History (Session scope)
prediction_history = []

class PatientInput(BaseModel):
    age: float = Field(ge=0, le=120, description="Age in years")
    sex: int = Field(ge=0, le=1, description="Sex (1 = male, 0 = female)")
    cp: int = Field(ge=1, le=4, description="Chest pain type (1-4)")
    trestbps: float = Field(ge=50, le=250, description="Resting blood pressure (mm Hg)")
    chol: float = Field(ge=50, le=600, description="Serum cholesterol (mg/dl)")
    fbs: int = Field(ge=0, le=1, description="Fasting blood sugar > 120 mg/dl (1 = true, 0 = false)")
    thalach: float = Field(ge=50, le=250, description="Maximum heart rate achieved / pulse (bpm)")
    exang: int = Field(ge=0, le=1, description="Exercise induced angina (1 = yes, 0 = no)")
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
    username: Optional[str] = None
    identifier: Optional[str] = None
    email: Optional[str] = None
    password: str

class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = ""

class UserLogin(BaseModel):
    identifier: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str
    frontend_url: Optional[str] = None

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordRequest(BaseModel):
    email: Optional[str] = None
    otp: Optional[str] = None
    token: Optional[str] = None
    new_password: str

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None

def is_valid_email(email: str) -> bool:
    if not email:
        return False
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email.strip()))

def mask_email(email: str) -> str:
    if "@" not in email:
        return email
    user_part, domain_part = email.split("@", 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + "***"
    else:
        masked_user = user_part[:2] + "***" + user_part[-1]
    return f"{masked_user}@{domain_part}"

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

# ── Authentication Endpoints ──────────────────────────────────────────────────

@app.post("/api/auth/register")
@app.post("/api/signup")
def register_user(user: UserRegister):
    username = user.username.strip()
    email = user.email.strip() if user.email else ""
    full_name = user.full_name.strip() if user.full_name else ""

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long.")
    if len(user.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    if email and not is_valid_email(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    # Check if username or email is already taken
    if get_user_by_username(username):
        raise HTTPException(status_code=400, detail="Username already exists. Please choose a different username.")
    if email and get_user_by_email(email):
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

    hashed_password = get_password_hash(user.password)
    success = create_user(username=username, hashed_password=hashed_password, email=email, full_name=full_name)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create user account. Please try again.")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": username, "email": email}, expires_delta=access_token_expires
    )
    return {
        "message": "Account created successfully.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": username,
            "email": email,
            "full_name": full_name or username
        }
    }

@app.post("/api/auth/login")
@app.post("/api/login")
def login_user(user: UserLogin):
    identifier = (user.identifier or user.username or user.email or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Username or email is required.")

    db_user = get_user_by_identifier(identifier)
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username/email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = db_user["username"]
    email = db_user["email"] or ""
    full_name = db_user["full_name"] or username

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": username, "email": email}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": username,
            "email": email,
            "full_name": full_name
        }
    }

@app.get("/api/auth/me")
def get_current_user_profile(token_data: TokenData = Depends(get_current_user_token)):
    db_user = get_user_by_username(token_data.username)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {
        "username": db_user["username"],
        "email": db_user["email"] or "",
        "full_name": db_user["full_name"] or db_user["username"],
        "created_at": db_user["created_at"] or ""
    }

@app.put("/api/auth/profile")
def update_user_profile_endpoint(
    req: UserProfileUpdate,
    token_data: TokenData = Depends(get_current_user_token)
):
    db_user = get_user_by_username(token_data.username)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found.")

    new_full_name = req.full_name.strip() if req.full_name is not None else (db_user.get("full_name") or "")
    new_email = req.email.strip() if req.email is not None else (db_user.get("email") or "")

    if new_email:
        if not is_valid_email(new_email):
            raise HTTPException(status_code=400, detail="Please enter a valid email address.")
        existing_user = get_user_by_email(new_email)
        if existing_user and existing_user["username"].lower() != token_data.username.lower():
            raise HTTPException(status_code=400, detail="This email address is already registered to another account.")

    success = update_user_profile(token_data.username, email=new_email, full_name=new_full_name)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update profile.")

    return {
        "message": "Profile updated successfully.",
        "user": {
            "username": token_data.username,
            "email": new_email,
            "full_name": new_full_name or token_data.username
        }
    }

@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email_or_user = req.email.strip()
    if not email_or_user:
        raise HTTPException(status_code=400, detail="Email address is required.")

    db_user = get_user_by_identifier(email_or_user)
    if not db_user:
        raise HTTPException(status_code=404, detail="No registered account found matching this email/username.")

    target_email = db_user["email"]
    if not target_email or not is_valid_email(target_email):
        raise HTTPException(
            status_code=400, 
            detail="This account does not have a valid email address configured. Please contact support."
        )

    # Generate 6-digit OTP code and secure token
    otp = f"{secrets.randbelow(900000) + 100000}"
    token = secrets.token_urlsafe(32)

    created = create_password_reset(email=target_email, otp=otp, token=token, expires_minutes=15)
    if not created:
        raise HTTPException(status_code=500, detail="Could not initiate password reset. Please try again.")

    # Build reset link for email CTA
    base_url = (req.frontend_url.rstrip("/") if req.frontend_url else "http://localhost:5173")
    reset_link = f"{base_url}/reset-password?token={token}&email={target_email}"

    try:
        send_password_reset_email(
            to_email=target_email,
            username=db_user["username"],
            otp_code=otp,
            reset_link=reset_link
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send reset email: {str(e)}")

    return {
        "success": True,
        "message": "Password reset code & link sent successfully to your email.",
        "email": mask_email(target_email),
        "target_email": target_email,
        "expires_in_minutes": 15
    }

@app.post("/api/auth/verify-otp")
def verify_otp(req: VerifyOtpRequest):
    email = req.email.strip()
    otp = req.otp.strip()

    if not email or not otp:
        raise HTTPException(status_code=400, detail="Email and 6-digit OTP code are required.")

    record = verify_password_reset_otp(email=email, otp=otp)
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code (OTP).")

    return {
        "valid": True,
        "token": record["token"],
        "email": record["email"],
        "message": "OTP verification successful."
    }

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    target_email = None
    used_key = None

    if req.token and req.token.strip():
        token_str = req.token.strip()
        record = verify_password_reset_token(token_str)
        if not record:
            raise HTTPException(status_code=400, detail="Invalid or expired password reset link.")
        target_email = record["email"]
        used_key = token_str
    elif req.email and req.otp:
        email_str = req.email.strip()
        otp_str = req.otp.strip()
        record = verify_password_reset_otp(email_str, otp_str)
        if not record:
            raise HTTPException(status_code=400, detail="Invalid or expired verification code (OTP).")
        target_email = record["email"]
        used_key = otp_str
    else:
        raise HTTPException(status_code=400, detail="Either a reset token or email with OTP code is required.")

    hashed_password = get_password_hash(req.new_password)
    updated = update_user_password(target_email, hashed_password)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update password. Please try again.")

    # Mark reset code as used so it cannot be re-used
    mark_password_reset_used(used_key)

    return {
        "success": True,
        "message": "Your password has been successfully reset! You can now log in with your new password."
    }


@app.post("/api/predict")
def predict_patient(patient: PatientInput):
    """Synchronous single prediction for testing endpoints."""
    # Convert input to DataFrame filtered to basic features
    df = pd.DataFrame([patient.model_dump()])[FEATURES]
    
    # Get explanation, clinical risk evaluation, and blended prediction
    expl = explain_patient_prediction(df)
    
    return {
        "prediction": expl["prediction"],
        "probability": expl["probability"],
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
            # 1. Validation (~1.4s)
            await asyncio.sleep(1.4)
            yield {
                "event": "message",
                "data": json.dumps({
                    "stage": "validation",
                    "status": "completed",
                    "message": "Basic clinical parameters successfully validated. No hospital instrument procedures required.",
                    "progress": 15
                })
            }
            
            # 2. Preprocessing (~1.5s)
            await asyncio.sleep(1.5)
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
            
            # 3. Model Analysis (Inference on all 4 models) (~1.8s)
            await asyncio.sleep(1.8)
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
            
            # 4. Probability Calibration (~1.4s)
            await asyncio.sleep(1.4)
            # Get calibrated predictions with evidence-based clinical risk blending
            patient_dict = patient.model_dump()
            for name in ["logistic_regression", "random_forest", "xgboost", "svm"]:
                model_cal = models_cache[f"{name}_calibrated"]
                raw_cal_prob = float(model_cal.predict_proba(df)[0, 1])
                blended_m = blend_ml_and_clinical_risk(raw_cal_prob, patient_dict)
                model_outputs[name]["calibrated_probability"] = blended_m["final_probability"]
                
            yield {
                "event": "message",
                "data": json.dumps({
                    "stage": "probability_calibration",
                    "status": "completed",
                    "message": "Sigmoid calibration function (Platt Scaling) and evidence-based clinical weighting applied.",
                    "progress": 75,
                    "details": {
                        "XGBoost Raw Prob": f"{model_outputs['xgboost']['raw_probability']:.2f}",
                        "XGBoost Calibrated Prob": f"{model_outputs['xgboost']['calibrated_probability']:.2f}",
                    }
                })
            }
            
            # 5. Explainable AI / SHAP (~1.8s)
            await asyncio.sleep(1.8)
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
            
            # 6. Final Results & History Save (~1.2s)
            await asyncio.sleep(1.2)
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
def get_prediction_history(username: str = Depends(get_optional_user)):
    db_reports = get_all_reports(limit=50, user_id=username)
    if db_reports:
        return db_reports
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

@app.post("/api/report/generate-and-upload")
def generate_and_upload_report(payload: dict = Body(...), username: str = Depends(get_optional_user)):
    """
    Generate a complete research PDF report, upload it to Cloudinary,
    persist the link and record in the database, and return the secure URL.
    """
    patient = payload.get("patient")
    prediction = payload.get("prediction")
    
    if not patient or not prediction:
        raise HTTPException(status_code=400, detail="Missing patient inputs or prediction results in payload")
        
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    
    if not cloud_name or not api_key or not api_secret:
        raise HTTPException(
            status_code=400, 
            detail="Cloudinary credentials are not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file."
        )

    def _to_float(val, default=0.0):
        try:
            return float(val) if val is not None else default
        except (ValueError, TypeError):
            return default

    patient_display = {**patient}
    patient_display["cp_label"] = CP_MAPPING.get(_to_float(patient.get("cp")), str(patient.get("cp", "")))
    patient_display["slope_label"] = SLOPE_MAPPING.get(_to_float(patient.get("slope")), str(patient.get("slope", "")))
    patient_display["thal_label"] = THAL_MAPPING.get(_to_float(patient.get("thal")), str(patient.get("thal", "")))
    patient_display["restecg_label"] = RESTECG_MAPPING.get(_to_float(patient.get("restecg")), str(patient.get("restecg", "")))

    report_id = f"REP-{uuid.uuid4().hex[:8].upper()}"
    temp_filename = f"temp_report_{uuid.uuid4().hex}.pdf"
    
    try:
        generate_pdf_report(
            patient_display,
            prediction,
            evaluation_metrics.get("models", {}),
            temp_filename
        )
        
        # Configure Cloudinary
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )
        
        # Upload to Cloudinary
        upload_result = cloudinary.uploader.upload(
            temp_filename,
            resource_type="raw",
            folder="cardiomind_reports",
            public_id=f"cardio_report_{report_id}.pdf",
            use_filename=True,
            unique_filename=True
        )
        
        pdf_url = upload_result.get("secure_url") or upload_result.get("url")
        
        if not pdf_url:
            raise Exception("Cloudinary upload succeeded but no URL was returned.")
        
        user_id = username or "guest"
        category = prediction.get("category", "Unknown")
        probability = float(prediction.get("probability", 0.0))
        
        # Save to SQLite database
        save_report(
            report_id=report_id,
            pdf_url=pdf_url,
            category=category,
            probability=probability,
            patient_data=patient,
            prediction_data=prediction,
            user_id=user_id
        )
        
        # Also prepend to in-memory prediction history
        history_record = {
            "id": report_id,
            "created_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "category": category,
            "probability": probability,
            "age": patient.get("age"),
            "sex": patient.get("sex"),
            "trestbps": patient.get("trestbps"),
            "chol": patient.get("chol"),
            "pdf_url": pdf_url,
            "patient_data": patient,
            "prediction_data": prediction
        }
        prediction_history.insert(0, history_record)
        if len(prediction_history) > 20:
            prediction_history.pop()

        return {
            "status": "success",
            "report_id": report_id,
            "pdf_url": pdf_url,
            "category": category,
            "probability": probability,
            "message": "Report generated, uploaded to Cloudinary, and saved to database successfully."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation/upload failed: {str(e)}")
    finally:
        if os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except Exception:
                pass

@app.post("/api/report")
def create_report(payload: dict = Body(...)):
    """Generate and stream PDF report file directly."""
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


# ── SPA catch-all ─────────────────────────────────────────────────────────────
# Must be the LAST route. Returns index.html for any path not matched above
# so React Router handles client-side navigation.

@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    """Serve the React SPA for all non-API routes."""
    if not os.path.isdir(_FRONTEND_DIST):
        return {"error": "Frontend not built. Run: cd frontend && npm run build"}

    # Try serving an exact file first (favicon.svg, etc.)
    file_path = os.path.join(_FRONTEND_DIST, full_path)
    if full_path and os.path.isfile(file_path):
        return FileResponse(file_path)

    # Fall back to index.html for all SPA routes
    return FileResponse(os.path.join(_FRONTEND_DIST, "index.html"))
