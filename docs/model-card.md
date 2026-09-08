# Model Card — CardioMind Heart Disease Prediction System

## Model Details

| Property | Value |
|---|---|
| **Project** | CardioMind — Heart Disease AI Risk Prediction System |
| **Type** | Academic Research Prototype |
| **Production Model** | XGBoost (Calibrated) |
| **Baseline Models** | Logistic Regression, Random Forest, SVM |
| **Framework** | scikit-learn 1.5.0, XGBoost 2.0.3 |
| **Training Date** | August 2026 |
| **Random Seed** | 42 |

## Intended Use

- **Primary**: Final-year engineering project demonstration
- **Secondary**: ML pipeline educational reference
- **NOT for**: Clinical diagnosis, treatment decisions, emergency triage, medication prescriptions

## Training Data

- UCI Heart Disease — Cleveland subset (303 instances, 13 features)
- 80% train / 20% test stratified split
- 5-fold stratified cross-validation for hyperparameter tuning

## Evaluation Metrics (Calibrated Models, Test Set)

| Model | Accuracy | Sensitivity | Specificity | F1 | ROC-AUC | Brier |
|---|---|---|---|---|---|---|
| Logistic Regression | 90.2% | 92.9% | 87.9% | — | 0.9686 | — |
| Random Forest | 88.5% | 92.9% | 84.9% | — | 0.9524 | — |
| XGBoost | 85.2% | 85.7% | 84.9% | — | 0.9405 | — |
| SVM | 86.9% | 92.9% | 81.8% | — | 0.9578 | — |

*Note: Exact values may vary on re-training due to stochastic elements.*

## External Validation

- NHANES 2017–2018 (4-feature sub-model): ROC-AUC ≈ 0.7858
- Target definitions differ (self-reported vs angiographic)

## Explainability

- SHAP TreeExplainer for global and local feature importance
- SHAP values describe **model behavior**, not medical causation

## Ethical Considerations

- The model is trained on a small, demographically limited dataset
- Cleveland cohort over-represents symptomatic male patients
- Model outputs are **not** clinically validated probabilities
- No subgroup has sufficient sample size for statistically robust performance guarantees
- Users must be informed that outputs are ML predictions, not diagnoses

## Limitations

1. **Small dataset**: 303 samples cannot represent global population diversity
2. **Selection bias**: Patients were referred for coronary angiography (symptomatic cohort)
3. **Feature constraints**: Only 13 clinical variables; no genetic, lifestyle, or modern biomarker data
4. **Temporal**: Data from 1988; clinical practices and demographics have evolved
5. **Single-center**: Cleveland Clinic Foundation only
6. **External validation gap**: NHANES uses self-reported cardiovascular history
