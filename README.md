# ❤️ CardioMind — Heart Disease AI Risk Prediction System

> **Academic Research Prototype** — Final-Year Engineering Project  
> Demonstrates the complete machine-learning lifecycle for binary cardiovascular risk prediction.

⚠️ **MEDICAL DISCLAIMER**: This system is NOT a medical diagnostic device. It is an academic/research prototype that demonstrates ML-based prediction. It must NOT be used as a substitute for evaluation by a qualified healthcare professional.

---

## 🏗️ Architecture

```
                         CARDIOMIND PLATFORM
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
      PREDICTION ENGINE                    CARDIOAI CHATBOT
              │                                   │
       ┌──────┴──────┐                      ┌─────┴─────┐
       │             │                      │           │
       ▼             ▼                      ▼           ▼
  Preprocessing    ML Models          RAG Retrieval   LLM/Local
       │             │                      │           │
       │       ┌─────┼─────┐                │           │
       │       ▼     ▼     ▼                │           │
       │      LR    RF   XGBoost            │           │
       │           SVM                      │           │
       │                                    │           │
       └─────────────┐                      │           │
                     ▼                      │           │
                 Calibration                │           │
                     │                      │           │
                     ▼                      │           │
                   SHAP                     │           │
                     │                      │           │
                     └──────────┬───────────┘           │
                                ▼                       │
                          React Dashboard ◄─────────────┘
```

---

## 📁 Project Structure

```
CardioMind/
├── backend/
│   ├── main.py              # FastAPI app with SSE, predict, chat, report endpoints
│   ├── chatbot.py           # RAG retrieval + Gemini API / local fallback engine
│   └── pdf_report.py        # ReportLab PDF research report generator
├── ml/
│   ├── config.py            # Feature definitions, mappings, constants, RANDOM_STATE
│   ├── data/
│   │   ├── download_data.py # Automated dataset downloader (UCI + NHANES)
│   │   ├── validate.py      # Schema validation, range checks, distribution reports
│   │   └── preprocess.py    # Scikit-learn Pipeline + ColumnTransformer
│   ├── eda/
│   │   └── exploratory_analysis.py  # Histograms, boxplots, correlation matrix
│   └── models/
│       ├── train.py         # GridSearchCV, StratifiedKFold, calibration
│       ├── evaluate.py      # Test metrics, subgroup analysis, NHANES validation
│       ├── explain.py       # SHAP global/local explainability
│       └── artifacts/       # Persisted models, metrics, plots
├── data/
│   ├── raw/                 # Untouched Cleveland CSV
│   ├── processed/           # Train/test splits
│   └── external/            # NHANES XPT files
├── reports/
│   ├── eda/                 # Generated EDA figures
│   └── model/               # Validation reports
├── knowledge/               # Chatbot RAG grounding documents
│   ├── cardiovascular/
│   ├── prevention/
│   ├── risk_factors/
│   ├── terminology/
│   └── project/
├── frontend/                # Vite + React + MUI dashboard
├── tests/                   # Pytest suite
├── docs/                    # Academic documentation
│   ├── dataset.md
│   ├── methodology.md
│   ├── model-card.md
│   └── limitations.md
├── requirements.txt
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm 8+

### 1. Clone & Setup Python Environment

```bash
cd CardioMind
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Download Datasets

```bash
python -m ml.data.download_data
```

### 3. Validate Data

```bash
python -m ml.data.validate
```

### 4. Generate EDA

```bash
python -m ml.eda.exploratory_analysis
```

### 5. Train Models

```bash
python -m ml.models.train
```

### 6. Evaluate Models

```bash
python -m ml.models.evaluate
```

### 7. Generate SHAP Explanations

```bash
python -m ml.models.explain
```

### 8. Start Full Project (Backend + Frontend)

Run the unified launcher from the project root:

```bash
npm run start
```
> This concurrently starts the FastAPI backend (http://localhost:8000) and Vite React dashboard (http://localhost:5173) with unified logging and graceful shutdown.

*Alternatively, run services individually:*
- **Backend only**: `npm run backend` or `uvicorn backend.main:app --reload --port 8000`
- **Frontend only**: `npm run frontend` or `cd frontend && npm run dev`

### 9. Run Tests

```bash
npm test
# or: PYTHONPATH=. pytest
```

---

## 📊 Dataset

- **Primary**: UCI Heart Disease — Cleveland (303 instances, 13 features)
- **Secondary**: NHANES 2017–2018 (external validation only)
- See [docs/dataset.md](docs/dataset.md) for full feature definitions and target mapping

---

## 🤖 Models

| Model | Purpose |
|---|---|
| **Logistic Regression** | Interpretable baseline, clinically familiar |
| **Random Forest** | Non-linear relationships, feature importance |
| **XGBoost** | State-of-the-art tabular performance |
| **SVM** | Hyperplane-based classification, probability calibration |

All models use scikit-learn Pipelines with `ColumnTransformer` for leakage-safe preprocessing. Hyperparameters are tuned via `GridSearchCV` with 5-fold `StratifiedKFold`.

---

## 📈 Evaluation

Metrics computed on the **isolated test set** (20%) include:

- Accuracy, Precision, Recall (Sensitivity), Specificity
- F1-Score, ROC-AUC, PR-AUC
- Brier Score (calibration quality)
- Confusion Matrix
- Subgroup analysis (sex, age groups)
- External validation on NHANES (4-feature sub-model)

---

## 🔍 Explainable AI

- **Global SHAP**: TreeExplainer summary and bar plots showing feature importance across the entire training set
- **Local SHAP**: Per-patient feature contribution vectors explaining individual predictions
- SHAP values describe **model behavior**, NOT medical causation

---

## 🎯 Probability Calibration

Raw ML probabilities are calibrated using `CalibratedClassifierCV` (Platt/sigmoid scaling) to better align predicted probabilities with observed class frequencies. Calibration curves and Brier scores are generated for comparison.

---

## 💬 CardioAI Assistant

A context-aware educational chatbot grounded in a local knowledge base covering:
- Cardiovascular risk factors, prevention, and terminology
- Project methodology, models, and SHAP explanations
- Active prediction context for patient-specific explanations

Supports Gemini API (when `GEMINI_API_KEY` is set) or local RAG fallback.

**Safety**: The chatbot will NOT diagnose, prescribe medication, or claim medical authority.

---

## 📄 PDF Reports

Generated reports include patient parameters, model-estimated probability, SHAP contribution factors, model performance metrics, dataset information, scientific limitations, and medical disclaimers.

---

## 🧪 Testing

```bash
PYTHONPATH=. pytest
```

Tests cover:
- Data validation (columns, target mapping, preprocessing)
- Model inference (probability bounds, prediction format)
- API endpoints (valid requests, missing fields, invalid values)

---

## 📚 Documentation

| Document | Content |
|---|---|
| [docs/dataset.md](docs/dataset.md) | Feature definitions, target mapping, NHANES limitations |
| [docs/methodology.md](docs/methodology.md) | Full ML lifecycle, leakage prevention, model selection |
| [docs/model-card.md](docs/model-card.md) | Model details, metrics, ethical considerations |
| [docs/limitations.md](docs/limitations.md) | Dataset limitations, medical safety disclaimers |

---

## ⚠️ Medical Safety

This system:
- **CANNOT** diagnose heart disease
- **CANNOT** prescribe or recommend medication
- **CANNOT** replace clinical judgment
- Uses terms like "Model-Estimated Probability" rather than "Chance of Heart Disease"
- All risk categories are model output categories, NOT clinically validated thresholds

> This report is generated by an academic machine-learning research prototype. It is NOT a medical diagnosis and must not be used as a substitute for evaluation by a qualified healthcare professional.
