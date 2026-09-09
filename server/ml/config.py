import os

# Project Roots
_CURR_DIR = os.path.dirname(os.path.abspath(__file__))
_PARENT_1 = os.path.dirname(_CURR_DIR)
_PARENT_2 = os.path.dirname(_PARENT_1)
if os.path.isdir(os.path.join(_PARENT_2, "data")):
    BASE_DIR = _PARENT_2
elif os.path.isdir(os.path.join(_PARENT_1, "data")):
    BASE_DIR = _PARENT_1
else:
    BASE_DIR = _PARENT_2

DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_DATA_DIR = os.path.join(DATA_DIR, "raw")
PROCESSED_DATA_DIR = os.path.join(DATA_DIR, "processed")
EXTERNAL_DATA_DIR = os.path.join(DATA_DIR, "external")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
EDA_REPORTS_DIR = os.path.join(REPORTS_DIR, "eda")
MODEL_REPORTS_DIR = os.path.join(REPORTS_DIR, "model")
FIGURES_DIR = os.path.join(REPORTS_DIR, "figures")

# Reproducibility
RANDOM_STATE = 42

# Primary Features: Clinical vitals, symptoms, and basic ECG ST depression
FEATURES = [
    "age", "sex", "cp", "trestbps", "chol", "fbs", 
    "thalach", "exang", "oldpeak"
]
ALL_RAW_FEATURES = [
    "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", 
    "thalach", "exang", "oldpeak", "slope", "ca", "thal"
]
TARGET = "target"

# Categories
NUMERICAL_FEATURES = ["age", "trestbps", "chol", "thalach", "oldpeak"]
CATEGORICAL_FEATURES = ["sex", "cp", "fbs", "exang"]

# Categorical Code Mappings for Display
CP_MAPPING = {
    1.0: "Typical angina",
    2.0: "Atypical angina",
    3.0: "Non-anginal pain",
    4.0: "Asymptomatic"
}

RESTECG_MAPPING = {
    0.0: "Normal",
    1.0: "ST-T wave abnormality",
    2.0: "Left ventricular hypertrophy"
}

SLOPE_MAPPING = {
    1.0: "Upsloping",
    2.0: "Flat",
    3.0: "Downsloping"
}

THAL_MAPPING = {
    3.0: "Normal",
    6.0: "Fixed defect",
    7.0: "Reversable defect"
}

# NHANES 2017-2018 Mappings
# DEMO_J: RIDAGEYR (Age), RIAGENDR (Sex)
# MCQ_J: MCQ160C (Coronary Heart Disease), MCQ160E (Myocardial Infarction)
# BPX_J: BPXSY1 (Systolic BP), BPXDI1 (Diastolic BP)
# TCHOL_J: LBXTC (Total Cholesterol)
NHANES_MAP = {
    "age": "RIDAGEYR",
    "sex": "RIAGENDR",
    "trestbps": "BPXSY1",
    "chol": "LBXTC",
    "target_chd": "MCQ160C",
    "target_mi": "MCQ160E"
}
