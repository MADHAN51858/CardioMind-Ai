import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np

from ml.config import (
    RAW_DATA_DIR, EDA_REPORTS_DIR, FEATURES, TARGET,
    NUMERICAL_FEATURES, CATEGORICAL_FEATURES, CP_MAPPING
)

def main():
    os.makedirs(EDA_REPORTS_DIR, exist_ok=True)
    
    # Load dataset
    raw_path = os.path.join(RAW_DATA_DIR, "processed.cleveland.data")
    cols = FEATURES + [TARGET]
    df = pd.read_csv(raw_path, header=None, names=cols, na_values="?")
    
    # 1. Convert target to binary for analysis
    df[TARGET] = df[TARGET].apply(lambda x: 1 if x > 0 else 0)
    
    # Set styling
    sns.set_theme(style="whitegrid")
    
    # === A. Numeric Distributions ===
    for col in NUMERICAL_FEATURES:
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))
        
        # Histogram with KDE
        sns.histplot(data=df, x=col, kde=True, ax=axes[0], color="skyblue")
        axes[0].set_title(f"Distribution of {col}")
        
        # Boxplot grouped by target
        sns.boxplot(data=df, x=TARGET, y=col, ax=axes[1], palette="Set2")
        axes[1].set_title(f"{col} by Target (0=Absence, 1=Presence)")
        axes[1].set_xticklabels(["Absence", "Presence"])
        
        plt.tight_layout()
        plt.savefig(os.path.join(EDA_REPORTS_DIR, f"dist_{col}.png"), dpi=150)
        plt.close()

    # === B. Categorical Countplots ===
    for col in CATEGORICAL_FEATURES:
        plt.figure(figsize=(8, 5))
        sns.countplot(data=df, x=col, hue=TARGET, palette="Set1")
        plt.title(f"Target Distribution across {col}")
        plt.xlabel(col)
        plt.ylabel("Count")
        plt.legend(title="Target", labels=["Absence", "Presence"])
        plt.tight_layout()
        plt.savefig(os.path.join(EDA_REPORTS_DIR, f"count_{col}.png"), dpi=150)
        plt.close()

    # === C. Core clinical target relationships ===
    # Age vs Target
    plt.figure(figsize=(8, 5))
    sns.histplot(data=df, x="age", hue=TARGET, multiple="stack", palette="coolwarm", kde=True)
    plt.title("Distribution of Age Stacked by Target")
    plt.xlabel("Age (years)")
    plt.ylabel("Count")
    plt.tight_layout()
    plt.savefig(os.path.join(EDA_REPORTS_DIR, "relationship_age_vs_target.png"), dpi=150)
    plt.close()

    # Cholesterol vs Target
    plt.figure(figsize=(8, 5))
    sns.histplot(data=df, x="chol", hue=TARGET, multiple="stack", palette="coolwarm", kde=True)
    plt.title("Distribution of Cholesterol Stacked by Target")
    plt.xlabel("Cholesterol (mg/dl)")
    plt.ylabel("Count")
    plt.tight_layout()
    plt.savefig(os.path.join(EDA_REPORTS_DIR, "relationship_chol_vs_target.png"), dpi=150)
    plt.close()

    # Trestbps (Resting Blood Pressure) vs Target
    plt.figure(figsize=(8, 5))
    sns.histplot(data=df, x="trestbps", hue=TARGET, multiple="stack", palette="coolwarm", kde=True)
    plt.title("Distribution of Resting Blood Pressure Stacked by Target")
    plt.xlabel("Resting Blood Pressure (mm Hg)")
    plt.ylabel("Count")
    plt.tight_layout()
    plt.savefig(os.path.join(EDA_REPORTS_DIR, "relationship_trestbps_vs_target.png"), dpi=150)
    plt.close()

    # Thalach (Max Heart Rate) vs Target
    plt.figure(figsize=(8, 5))
    sns.histplot(data=df, x="thalach", hue=TARGET, multiple="stack", palette="coolwarm", kde=True)
    plt.title("Distribution of Maximum Heart Rate Stacked by Target")
    plt.xlabel("Max Heart Rate (bpm)")
    plt.ylabel("Count")
    plt.tight_layout()
    plt.savefig(os.path.join(EDA_REPORTS_DIR, "relationship_thalach_vs_target.png"), dpi=150)
    plt.close()

    # Chest Pain vs Target
    plt.figure(figsize=(8, 5))
    cp_temp = df.copy()
    cp_temp["cp_label"] = cp_temp["cp"].map(CP_MAPPING)
    sns.countplot(data=cp_temp, x="cp_label", hue=TARGET, palette="Set2")
    plt.title("Chest Pain Type by Target")
    plt.xlabel("Chest Pain Type")
    plt.ylabel("Count")
    plt.legend(title="Target", labels=["Absence", "Presence"])
    plt.xticks(rotation=15)
    plt.tight_layout()
    plt.savefig(os.path.join(EDA_REPORTS_DIR, "relationship_cp_vs_target.png"), dpi=150)
    plt.close()

    # === D. Correlation Matrix ===
    # For correlation, we convert objects/categorical to numbers and use dropna
    num_df = df.dropna().copy()
    
    # Calculate correlation matrix
    corr = num_df.corr()
    
    plt.figure(figsize=(12, 10))
    sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", vmin=-1, vmax=1, square=True)
    plt.title("Correlation Matrix of Cleveland Features (Target Mapped Binary)")
    plt.tight_layout()
    plt.savefig(os.path.join(EDA_REPORTS_DIR, "correlation_matrix.png"), dpi=150)
    plt.close()
    
    print("[SUCCESS] Exploratory Data Analysis figures generated in reports/eda/.")

if __name__ == "__main__":
    main()
