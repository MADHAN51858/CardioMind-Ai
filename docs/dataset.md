# Dataset Documentation

## Primary Dataset — UCI Heart Disease (Cleveland)

| Property | Value |
|---|---|
| **Source** | [UCI Machine Learning Repository](https://archive.ics.uci.edu/dataset/45/heart+disease) |
| **File** | `processed.cleveland.data` |
| **Instances** | 303 |
| **Features** | 13 predictive + 1 target |
| **Donated** | 1988 |
| **License** | CC BY 4.0 (Creative Commons Attribution) |
| **Principal Investigator** | Robert Detrano, M.D., Ph.D. (Cleveland Clinic Foundation) |

### Feature Definitions

| Feature | Type | Description | Values |
|---|---|---|---|
| `age` | Numerical | Age in years | 29–77 |
| `sex` | Binary | Biological sex | 1 = Male, 0 = Female |
| `cp` | Categorical | Chest pain type | 1 = Typical angina, 2 = Atypical angina, 3 = Non-anginal pain, 4 = Asymptomatic |
| `trestbps` | Numerical | Resting blood pressure (mm Hg on admission) | 94–200 |
| `chol` | Numerical | Serum cholesterol (mg/dl) | 126–564 |
| `fbs` | Binary | Fasting blood sugar > 120 mg/dl | 1 = True, 0 = False |
| `restecg` | Categorical | Resting ECG results | 0 = Normal, 1 = ST-T wave abnormality, 2 = Left ventricular hypertrophy |
| `thalach` | Numerical | Maximum heart rate achieved | 71–202 |
| `exang` | Binary | Exercise-induced angina | 1 = Yes, 0 = No |
| `oldpeak` | Numerical | ST depression induced by exercise relative to rest | 0.0–6.2 |
| `slope` | Categorical | Slope of peak exercise ST segment | 1 = Upsloping, 2 = Flat, 3 = Downsloping |
| `ca` | Categorical | Number of major vessels (0–3) colored by fluoroscopy | 0, 1, 2, 3 |
| `thal` | Categorical | Thalassemia stress result | 3 = Normal, 6 = Fixed defect, 7 = Reversible defect |

### Target Variable

| Original value | Mapped value | Meaning |
|---|---|---|
| 0 | 0 | Absence of heart disease |
| 1, 2, 3, 4 | 1 | Presence of heart disease (any severity) |

This binary mapping follows the standard UCI documentation practice. Values 1–4 originally represented increasing severity of angiographic coronary narrowing (> 50% diameter).

### Missing Values

The raw Cleveland dataset contains missing values encoded as `?` in columns `ca` (4 missing) and `thal` (2 missing). These are handled by the scikit-learn preprocessing pipeline via `SimpleImputer` using the most-frequent strategy, fitted only on training data.

---

## Secondary Dataset — NHANES 2017–2018

| Property | Value |
|---|---|
| **Source** | [CDC National Health and Nutrition Examination Survey](https://www.cdc.gov/nchs/nhanes/) |
| **Cycle** | 2017–2018 |
| **Files Used** | DEMO_J.XPT, MCQ_J.XPT, BPX_J.XPT, TCHOL_J.XPT |
| **Purpose** | External validation only (NOT merged with UCI for training) |

### Variable Mapping

| UCI Feature | NHANES Variable | Notes |
|---|---|---|
| `age` | `RIDAGEYR` | Direct mapping |
| `sex` | `RIAGENDR` | NHANES: 1=Male 2=Female → Mapped to 1=Male 0=Female |
| `trestbps` | `BPXSY1` | Systolic blood pressure (proxy for resting BP) |
| `chol` | `LBXTC` | Total cholesterol |
| Target | `MCQ160C`, `MCQ160E` | Self-reported coronary heart disease or heart attack |

### Scientific Limitations of External Validation

The NHANES target is **self-reported** cardiovascular history (survey questionnaire), while the UCI Cleveland target is based on **diagnostic coronary angiography** (objective clinical measurement). These are fundamentally different outcome definitions. The external validation ROC-AUC should be interpreted with this caveat. The two datasets are **never merged** for model training.
