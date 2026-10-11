from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from pathlib import Path
import sqlite3
import requests
import json
import uuid
import joblib
import numpy as np
import pandas as pd


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="CardioAI API",
    version="3.0.0"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# PATHS / CONFIG
# =========================================================

BASE_DIR = Path(__file__).resolve().parent

DB_PATH = BASE_DIR / "cardioai.db"
MODEL_DIR = BASE_DIR / "models"

OLLAMA_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2:latest"

MODEL_PATH = MODEL_DIR / "random_forest.joblib"

# The trained model pipeline already contains preprocessing.
MODEL = joblib.load(MODEL_PATH)

FEATURE_COLUMNS = [
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

PRIMARY_MODEL = "Random Forest"


# =========================================================
# DATABASE
# =========================================================

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():

    conn = get_db()

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS patients (
            patient_id TEXT PRIMARY KEY,
            patient_name TEXT NOT NULL,
            sex TEXT,
            emergency_contact_name TEXT,
            emergency_relationship TEXT,
            emergency_phone TEXT,
            created_at TEXT,
            updated_at TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            time TEXT,
            model TEXT,
            prediction INTEGER,
            probability REAL,
            risk_label TEXT,
            explanation TEXT,
            clinical_json TEXT,
            importance_json TEXT
        )
        """
    )

    conn.commit()
    conn.close()


init_db()


# =========================================================
# DATA MODELS
# =========================================================

class PatientData(BaseModel):

    patient_name: str
    patient_id: str = ""

    sex: str

    emergency_contact_name: str = ""
    emergency_relationship: str = ""
    emergency_phone: str = ""

    age: int
    cp: int
    trestbps: float
    chol: float
    fbs: int
    restecg: int
    thalach: float
    exang: int
    oldpeak: float
    slope: int
    ca: int
    thal: int


class ChatRequest(BaseModel):

    message: str
    mode: str = "medical"
    context: dict = {}


# =========================================================
# SEX CONVERSION
# =========================================================

def convert_sex(sex_value: str) -> int:

    value = str(sex_value).strip().lower()

    if value == "male":
        return 1

    if value == "female":
        return 0

    # The original UCI model was trained with binary sex.
    # For categories not represented in the training data,
    # use the neutral numeric representation rather than
    # sending the text value into the ML model.
    return 0


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "service": "CardioAI API",
        "model": PRIMARY_MODEL,
    }


# =========================================================
# STATUS
# =========================================================

@app.get("/api/status")
def status():

    try:

        response = requests.get(
            f"{OLLAMA_URL}/api/tags",
            timeout=2,
        )

        ollama = response.ok

    except requests.RequestException:

        ollama = False

    return {
        "api": True,
        "ollama": ollama,
        "model": OLLAMA_MODEL,
        "prediction_model": PRIMARY_MODEL,
    }


# =========================================================
# PATIENT ID
# =========================================================

def generate_patient_id():

    return (
        "P-"
        + datetime.now().strftime("%Y%m%d%H%M%S")
        + "-"
        + uuid.uuid4().hex[:4].upper()
    )


# =========================================================
# SAVE PATIENT
# =========================================================

def save_patient(patient: PatientData, patient_id: str):

    now = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    conn = get_db()

    conn.execute(
        """
        INSERT INTO patients (
            patient_id,
            patient_name,
            sex,
            emergency_contact_name,
            emergency_relationship,
            emergency_phone,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)

        ON CONFLICT(patient_id)
        DO UPDATE SET
            patient_name = excluded.patient_name,
            sex = excluded.sex,
            emergency_contact_name =
                excluded.emergency_contact_name,
            emergency_relationship =
                excluded.emergency_relationship,
            emergency_phone =
                excluded.emergency_phone,
            updated_at =
                excluded.updated_at
        """,
        (
            patient_id,
            patient.patient_name,
            patient.sex,
            patient.emergency_contact_name,
            patient.emergency_relationship,
            patient.emergency_phone,
            now,
            now,
        ),
    )

    conn.commit()
    conn.close()


# =========================================================
# PREPARE ML INPUT
# =========================================================

def prepare_model_input(patient: PatientData):

    values = {
        "age": patient.age,
        "sex": convert_sex(patient.sex),
        "cp": patient.cp,
        "trestbps": patient.trestbps,
        "chol": patient.chol,
        "fbs": patient.fbs,
        "restecg": patient.restecg,
        "thalach": patient.thalach,
        "exang": patient.exang,
        "oldpeak": patient.oldpeak,
        "slope": patient.slope,
        "ca": patient.ca,
        "thal": patient.thal,
    }

    return pd.DataFrame(
        [values],
        columns=FEATURE_COLUMNS,
    )


# =========================================================
# REAL ML PREDICTION
# =========================================================

def make_prediction(patient: PatientData):

    model_input = prepare_model_input(patient)

    prediction = int(
        MODEL.predict(model_input)[0]
    )

    probabilities = MODEL.predict_proba(
        model_input
    )[0]

    probability = float(
        probabilities[1]
    )

    if prediction == 1:

        risk_label = "Higher model-predicted risk"

    else:

        risk_label = "Lower model-predicted risk"

    return {
        "prediction": prediction,
        "probability": probability,
        "risk_label": risk_label,
        "model": PRIMARY_MODEL,
    }


# =========================================================
# FEATURE IMPORTANCE
# =========================================================

def get_feature_importance():

    try:

        classifier = MODEL.named_steps["model"]

        importances = classifier.feature_importances_

        result = []

        for name, value in zip(
            FEATURE_COLUMNS,
            importances,
        ):

            result.append(
                {
                    "feature": name,
                    "importance": float(value),
                }
            )

        result.sort(
            key=lambda x: x["importance"],
            reverse=True,
        )

        return result

    except Exception:

        return []


# =========================================================
# OLLAMA
# =========================================================

def ollama_generate(
    system,
    prompt,
    timeout=60,
):

    payload = {
        "model": OLLAMA_MODEL,
        "system": system,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 180,
        },
    }

    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json=payload,
        timeout=timeout,
    )

    response.raise_for_status()

    return response.json().get(
        "response",
        "",
    ).strip()


# =========================================================
# AI EXPLANATION
# =========================================================

def prediction_explanation(
    result,
    patient,
    importance,
):

    system = """
You explain results from an educational
heart-disease machine-learning application.

Never diagnose.

Never claim the model is medically certain.

Never change the model result.

Only use supplied information.

Never invent symptoms, history, tests or medicines.

Keep the explanation concise.

State that this is not a diagnosis.
"""

    # Emergency information is deliberately excluded.
    medical_values = {
        "age": patient.age,
        "sex": patient.sex,
        "cp": patient.cp,
        "trestbps": patient.trestbps,
        "chol": patient.chol,
        "fbs": patient.fbs,
        "restecg": patient.restecg,
        "thalach": patient.thalach,
        "exang": patient.exang,
        "oldpeak": patient.oldpeak,
        "slope": patient.slope,
        "ca": patient.ca,
        "thal": patient.thal,
    }

    top_features = importance[:5]

    prompt = f"""
Model: {result["model"]}

Prediction: {result["prediction"]}

Probability of class 1:
{result["probability"]:.1%}

Risk label:
{result["risk_label"]}

Patient medical values:
{medical_values}

Most important model features:
{top_features}

Explain this result in 4-6 short sentences.
Mention that this is a machine-learning
prediction and not a medical diagnosis.
"""

    try:

        return ollama_generate(
            system,
            prompt,
            timeout=60,
        )

    except requests.RequestException:

        return (
            "The prediction was generated, but "
            "the local AI explanation is currently "
            "unavailable. This is a machine-learning "
            "prediction and not a medical diagnosis."
        )


# =========================================================
# PREDICTION
# =========================================================

@app.post("/api/predict")
def predict(patient: PatientData):

    patient_id = (
        patient.patient_id.strip()
        if patient.patient_id
        else ""
    )

    if not patient_id:

        patient_id = generate_patient_id()

    # Save patient information locally.
    save_patient(
        patient,
        patient_id,
    )

    # REAL trained ML model.
    result = make_prediction(
        patient
    )

    # Real Random Forest feature importance.
    importance = get_feature_importance()

    # Local LLM explanation.
    explanation = prediction_explanation(
        result,
        patient,
        importance,
    )

    now = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    # -----------------------------------------------------
    # Save analysis
    # -----------------------------------------------------

    conn = get_db()

    clinical_values = {
        "age": patient.age,
        "sex": patient.sex,
        "cp": patient.cp,
        "trestbps": patient.trestbps,
        "chol": patient.chol,
        "fbs": patient.fbs,
        "restecg": patient.restecg,
        "thalach": patient.thalach,
        "exang": patient.exang,
        "oldpeak": patient.oldpeak,
        "slope": patient.slope,
        "ca": patient.ca,
        "thal": patient.thal,
    }

    conn.execute(
        """
        INSERT INTO analyses (
            patient_id,
            time,
            model,
            prediction,
            probability,
            risk_label,
            explanation,
            clinical_json,
            importance_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            patient_id,
            now,
            result["model"],
            result["prediction"],
            result["probability"],
            result["risk_label"],
            explanation,
            json.dumps(
                clinical_values
            ),
            json.dumps(
                importance
            ),
        ),
    )

    conn.commit()
    conn.close()

    return {
        "patient": {
            **patient.model_dump(),
            "patient_id": patient_id,
        },
        "prediction": result,
        "importance": importance,
        "feature_importance": {
            item["feature"]:
            item["importance"]
            for item in importance
        },
        "explanation": explanation,
        "ai_explanation": explanation,
    }


# =========================================================
# HISTORY
# =========================================================

@app.get("/api/history")
def get_history():

    conn = get_db()

    rows = conn.execute(
        """
        SELECT
            a.id,
            a.patient_id,
            p.patient_name,
            a.time,
            a.model,
            a.prediction,
            a.risk_label,
            a.probability
        FROM analyses a
        LEFT JOIN patients p
        ON a.patient_id = p.patient_id
        ORDER BY a.id DESC
        LIMIT 50
        """
    ).fetchall()

    conn.close()

    records = [
        {
            **dict(row),
            "created_at": row["time"],
        }
        for row in rows
    ]

    return records


# =========================================================
# PATIENT LIST
# =========================================================

@app.get("/api/patients")
def get_patients():

    conn = get_db()

    rows = conn.execute(
        """
        SELECT
            p.patient_id,
            p.patient_name,
            p.sex,
            p.emergency_contact_name,
            p.emergency_relationship,
            p.emergency_phone,
            p.created_at,
            p.updated_at,
            COUNT(a.id) AS analysis_count,
            MAX(a.time) AS last_analysis
        FROM patients p
        LEFT JOIN analyses a
        ON p.patient_id = a.patient_id
        GROUP BY p.patient_id
        ORDER BY p.updated_at DESC
        """
    ).fetchall()

    conn.close()

    return {
        "patients": [
            dict(row)
            for row in rows
        ]
    }


# =========================================================
# INDIVIDUAL PATIENT
# =========================================================

@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: str):

    conn = get_db()

    patient = conn.execute(
        """
        SELECT *
        FROM patients
        WHERE patient_id = ?
        """,
        (patient_id,),
    ).fetchone()

    analyses = conn.execute(
        """
        SELECT *
        FROM analyses
        WHERE patient_id = ?
        ORDER BY id DESC
        """,
        (patient_id,),
    ).fetchall()

    conn.close()

    if not patient:

        return {
            "error": "Patient not found"
        }

    return {
        "patient": dict(patient),
        "analyses": [
            dict(row)
            for row in analyses
        ],
    }


# =========================================================
# AI CHAT
# =========================================================

@app.post("/api/chat")
def chat(request: ChatRequest):

    if request.mode == "page":

        system = """
You are the page-help assistant inside CardioAI.

Explain buttons, fields, charts, navigation
and workflow.

Be concise.

Do not give medical diagnoses.
"""

    else:

        system = """
You are the medical education assistant
inside CardioAI.

Explain general medical concepts,
heart disease concepts, risk factors,
common tests, terminology and values
shown by this educational application.

Do not diagnose.

Do not invent symptoms, history,
tests or medicines.

Do not override the ML prediction.

Explain that app predictions are not
diagnoses when relevant.

For potentially urgent symptoms,
advise appropriate urgent professional
or emergency medical care.
"""

    prompt = f"""
User question:

{request.message}

Current CardioAI context:

{request.context}

Answer directly and clearly.
"""

    try:

        answer = ollama_generate(
            system,
            prompt,
            timeout=60,
        )

        return {
            "answer": answer,
            "response": answer,
            "mode": request.mode,
        }

    except requests.RequestException as exc:

        return {
            "answer": (
                "The local AI service is unavailable. "
                "Check that Ollama is running and "
                "llama3.2:latest is installed."
            ),
            "response": (
                "The local AI service is unavailable."
            ),
            "mode": request.mode,
            "error": str(exc),
        }