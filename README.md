# CardioAI Interactive Project

This is the new standalone version discussed:
- React + Vite frontend
- FastAPI backend
- Interactive risk assessment
- Feature importance
- History
- Local Ollama/Llama 3.2
- Right-side AI pop-out panel
- Medical AI mode for general medical education
- Page Help mode for explaining the interface
- ML prediction remains separate from LLM explanation
- No Streamlit

## Start backend

```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn api:app --reload
```

## Start frontend

Open a second CMD:

```cmd
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Ollama

```cmd
ollama serve
ollama list
ollama run llama3.2:latest
```

The demo backend predictor should be replaced with the user's trained Random Forest/XGBoost prediction code when integrating the existing model.
