import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ucimlrepo import fetch_ucirepo

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

from xgboost import XGBClassifier


# ---------------------------------------------------------
# Paths
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------
# 1. Load UCI Heart Disease dataset
# ---------------------------------------------------------

print("\nLoading UCI Heart Disease dataset...")

heart = fetch_ucirepo(id=45)

X = heart.data.features.copy()
y = heart.data.targets.copy()


# ---------------------------------------------------------
# 2. Keep the 13 features used by the project
# ---------------------------------------------------------

features = [
    "age",
    "sex",
    "cp",
    "trestbps",
    "chol",
    "fbs",
    "restecg",
    "thalach",
    "exang",
    "oldpeak",
    "slope",
    "ca",
    "thal",
]

X = X[features]

print("\nFeatures:")
print(X.columns.tolist())

print("\nDataset shape:", X.shape)


# ---------------------------------------------------------
# 3. Clean numeric data
# ---------------------------------------------------------

X = X.replace("?", np.nan)

for column in X.columns:
    X[column] = pd.to_numeric(X[column], errors="coerce")


# ---------------------------------------------------------
# 4. Prepare target
# ---------------------------------------------------------

target_column = y.columns[0]

y = pd.to_numeric(y[target_column], errors="coerce")

# UCI target:
# 0 = absence
# 1,2,3,4 = presence
#
# Convert into binary classification:
# 0 = no disease
# 1 = disease

y = (y > 0).astype(int)


# ---------------------------------------------------------
# 5. Preprocessing
# ---------------------------------------------------------

preprocessor = ColumnTransformer(
    transformers=[
        (
            "numeric",
            Pipeline(
                steps=[
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                ]
            ),
            features,
        )
    ]
)


# ---------------------------------------------------------
# 6. Train/test split
# ---------------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y,
)

print("\nTraining samples:", len(X_train))
print("Testing samples:", len(X_test))


# ---------------------------------------------------------
# 7. Random Forest
# ---------------------------------------------------------

print("\nTraining Random Forest...")

rf = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "model",
            RandomForestClassifier(
                n_estimators=300,
                random_state=42,
                class_weight="balanced",
            ),
        ),
    ]
)

rf.fit(X_train, y_train)

rf_pred = rf.predict(X_test)

rf_accuracy = accuracy_score(y_test, rf_pred)

print("Random Forest Accuracy:", round(rf_accuracy, 4))


# ---------------------------------------------------------
# 8. XGBoost
# ---------------------------------------------------------

print("\nTraining XGBoost...")

xgb = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "model",
            XGBClassifier(
                n_estimators=200,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.9,
                colsample_bytree=0.9,
                random_state=42,
                eval_metric="logloss",
            ),
        ),
    ]
)

xgb.fit(X_train, y_train)

xgb_pred = xgb.predict(X_test)

xgb_accuracy = accuracy_score(y_test, xgb_pred)

print("XGBoost Accuracy:", round(xgb_accuracy, 4))


# ---------------------------------------------------------
# 9. Select primary model
# ---------------------------------------------------------

if xgb_accuracy >= rf_accuracy:
    primary_model = "xgboost"
    primary_pipeline = xgb
else:
    primary_model = "random_forest"
    primary_pipeline = rf

print("\nPrimary model:", primary_model)


# ---------------------------------------------------------
# 10. Save models
# ---------------------------------------------------------

joblib.dump(
    rf,
    MODEL_DIR / "random_forest.joblib"
)

joblib.dump(
    xgb,
    MODEL_DIR / "xgboost.joblib"
)


# ---------------------------------------------------------
# 11. Save primary model name
# ---------------------------------------------------------

(MODEL_DIR / "primary_model.txt").write_text(
    primary_model,
    encoding="utf-8"
)


# ---------------------------------------------------------
# 12. Save feature columns
# ---------------------------------------------------------

with open(
    MODEL_DIR / "feature_columns.json",
    "w",
    encoding="utf-8",
) as f:
    json.dump(features, f, indent=2)


# ---------------------------------------------------------
# 13. Save preprocessing information
# ---------------------------------------------------------

# The complete pipelines already contain their preprocessors.
# Save the primary pipeline separately for easy loading.

joblib.dump(
    primary_pipeline,
    MODEL_DIR / "preprocessor.joblib"
)


# ---------------------------------------------------------
# 14. Final report
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("TRAINING COMPLETE")
print("=" * 60)

print("\nRandom Forest Accuracy:")
print(round(rf_accuracy * 100, 2), "%")

print("\nXGBoost Accuracy:")
print(round(xgb_accuracy * 100, 2), "%")

print("\nPrimary Model:")
print(primary_model)

print("\nGenerated files:")

for file in MODEL_DIR.iterdir():
    print(" -", file.name)

print("\nModels are ready.")