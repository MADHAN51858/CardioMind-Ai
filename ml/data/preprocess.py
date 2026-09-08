import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from ml.config import (
    NUMERICAL_FEATURES, TARGET, RANDOM_STATE, FEATURES, ALL_RAW_FEATURES
)

# We define features that need one-hot encoding vs binary features that can be kept as-is
ONE_HOT_FEATURES = ["cp"]
BINARY_FEATURES = ["sex", "fbs", "exang"]

def build_preprocessing_pipeline():
    """Build a scikit-learn ColumnTransformer preprocessing pipeline."""
    
    # Numerical pipeline: Median Imputation + Standard Scaling
    num_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])
    
    # One-hot encoding pipeline: Most Frequent Imputation + One-Hot Encoding
    cat_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])
    
    # Binary pipeline: Most Frequent Imputation only (keep as 0/1)
    bin_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent"))
    ])
    
    # ColumnTransformer
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", num_pipeline, NUMERICAL_FEATURES),
            ("cat", cat_pipeline, ONE_HOT_FEATURES),
            ("bin", bin_pipeline, BINARY_FEATURES)
        ],
        remainder="drop" # Drop any other columns
    )
    
    return preprocessor

def get_preprocessed_feature_names(preprocessor, cat_cols=ONE_HOT_FEATURES, bin_cols=BINARY_FEATURES):
    """Retrieve feature names after fitting the preprocessor (for model transparency)."""
    feature_names = []
    
    # Numerical columns names
    feature_names.extend(NUMERICAL_FEATURES)
    
    # Categorical columns names after OneHotEncoder
    try:
        onehot_transformer = preprocessor.named_transformers_["cat"].named_steps["onehot"]
        encoded_names = onehot_transformer.get_feature_names_out(cat_cols)
        feature_names.extend(encoded_names)
    except Exception:
        # Fallback if not fitted yet
        pass
        
    # Binary column names
    feature_names.extend(bin_cols)
    return feature_names

def load_and_clean_data(file_path):
    """
    Load data from a CSV file, map the target to a binary value,
    and convert raw target severity (1-4) into binary target (1).
    """
    df = pd.read_csv(file_path, header=None, names=ALL_RAW_FEATURES + [TARGET], na_values="?")
    
    # Target conversion mapping (0 -> 0; 1,2,3,4 -> 1)
    df[TARGET] = df[TARGET].apply(lambda x: 1 if x > 0 else 0)
    
    X = df[FEATURES]
    y = df[TARGET]
    
    return X, y
