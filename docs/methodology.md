# Research Methodology

## Problem Definition

Predict the binary presence/absence of coronary artery disease from 13 clinical features using supervised machine learning. The system is an **academic research prototype** — not a clinical diagnostic tool.

## Machine-Learning Lifecycle

```
Raw Data Acquisition (UCI Cleveland + NHANES)
        ↓
Data Validation (schema, ranges, missing values)
        ↓
Exploratory Data Analysis (distributions, correlations, target relationships)
        ↓
Target Mapping (multi-class 0–4 → binary 0/1)
        ↓
Stratified Train/Test Split (80/20, seed=42)
        ↓
Preprocessing Pipeline (ColumnTransformer + Pipeline — fitted on training data only)
  ├── Numerical: Median imputation → StandardScaler
  ├── Categorical: Mode imputation → OneHotEncoder
  └── Binary: Mode imputation (kept as 0/1)
        ↓
Model Training (GridSearchCV + StratifiedKFold, 5 folds)
  ├── Logistic Regression (C regularization)
  ├── Random Forest (n_estimators, max_depth, min_samples_split)
  ├── XGBoost (learning_rate, max_depth, n_estimators)
  └── SVM (C, kernel, gamma, probability=True)
        ↓
Model Evaluation on Isolated Test Set
  ├── Accuracy, Precision, Recall, F1
  ├── Sensitivity (TP / (TP+FN)), Specificity (TN / (TN+FP))
  ├── ROC-AUC, PR-AUC
  ├── Confusion Matrix
  └── Brier Score
        ↓
Probability Calibration (CalibratedClassifierCV, sigmoid/Platt scaling)
        ↓
Calibration Curve Comparison
        ↓
SHAP Explainability
  ├── Global: TreeExplainer summary/bar plots
  └── Local: Per-patient feature contribution vectors
        ↓
External Validation (4-feature sub-model on NHANES 2017–2018)
        ↓
Model Persistence (joblib serialization)
        ↓
REST API (FastAPI + SSE streaming)
        ↓
Research Dashboard (React + MUI + Recharts)
        ↓
PDF Report Generation (ReportLab)
```

## Data Leakage Prevention

All preprocessing transformations (imputation, scaling, encoding) are fitted **exclusively on training folds** during cross-validation and never on the test set. The final test set remains untouched until final evaluation.

```
✗ WRONG:  Scale → Split → Train
✓ RIGHT:  Split → Pipeline(Scale + Model) → Evaluate
```

## Model Selection Strategy

We do **not** automatically select the model with the highest accuracy. The selection considers:

1. **ROC-AUC** (primary discrimination metric)
2. **Sensitivity / Recall** (ability to correctly identify positive cases)
3. **Specificity** (ability to correctly identify negative cases)
4. **F1-Score** (harmonic mean of precision and recall)
5. **Calibration quality** (Brier score, calibration curve alignment)
6. **Interpretability** (clinical familiarity of the model class)

## Reproducibility

- Random seed: `RANDOM_STATE = 42` used across all splits, model initializations, and cross-validation
- All package versions pinned in `requirements.txt`
- All preprocessing and model parameters stored in `training_metadata.json`

## Research Questions This System Can Address

1. Which ML algorithm performs best on this clinical tabular dataset?
2. Does a nonlinear ensemble (Random Forest, XGBoost) outperform Logistic Regression?
3. Which features contribute most strongly to model predictions?
4. How does probability calibration affect Brier score and reliability?
5. How well does the model identify positive cases (sensitivity) vs negative cases (specificity)?
6. Are predictions consistent across sex and age subgroups?
7. Does the model generalize to NHANES (external population)?
8. What are the limitations of using a 303-sample benchmark dataset?
