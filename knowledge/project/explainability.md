# Machine Learning Methodology & Explainability (SHAP)

### Project Overview
This project is an academic research prototype designed to demonstrate how machine learning can predict the probability of coronary artery disease presence. It utilizes the UCI Cleveland dataset containing 303 samples and 13 clinical features.

### Models Implemented
- **Logistic Regression**: Serves as a clinical baseline, providing readable odds ratios and regularized weights.
- **Random Forest**: Captures non-linear feature interactions using bootstrap-aggregated decision trees.
- **XGBoost**: A state-of-the-art gradient boosted trees framework that optimizes tabular data performance.
- **Support Vector Machine (SVM)**: Uses hyperplanes to split data linearly or non-linearly, with probability calibration enabled.

### Explainable AI (SHAP)
- **What is SHAP?** SHAP (SHapley Additive exPlanations) is a game-theory-based mathematical approach that explains individual predictions by calculating each feature's contribution to the difference between the model output and the base value (average prediction).
- **SHAP vs Causation**: SHAP values explain *why* the machine learning model made a specific prediction (i.e. association with model output). They **do not prove medical causation**. For instance, if 'age' has a positive SHAP value, it means the model increased its probability estimate because of the age value, not that age directly caused a physical arterial lesion.
- **Calibration**: Since raw ML models can output uncalibrated probabilities, we apply `CalibratedClassifierCV` (Platt Scaling) to align predicted probabilities with empirical class frequencies.
