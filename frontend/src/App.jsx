import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Activity,
  AlertCircle,
  BookOpen,
  Brain,
  CheckCircle,
  ChevronRight,
  Clock,
  Heart,
  HelpCircle,
  History,
  Home,
  Menu,
  MessageCircle,
  Phone,
  RefreshCw,
  Shield,
  Stethoscope,
  User,
  Users,
  X
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

import "./index.css";

const API = "http://127.0.0.1:8000";

const initialForm = {
  patient_name: "",
  patient_id: "",
  emergency_contact_name: "",
  emergency_relationship: "",
  emergency_phone: "",

  age: "",
  sex: "Male",
  cp: "0",
  trestbps: "",
  chol: "",
  fbs: "0",
  restecg: "0",
  thalach: "",
  exang: "0",
  oldpeak: "0",
  slope: "0",
  ca: "0",
  thal: "0"
};

function CardTitle({ icon, text }) {
  return (
    <div className="card-title">
      <div className="card-title-icon">{icon}</div>
      <h3>{text}</h3>
    </div>
  );
}

function StatCard({ icon, title, value, subtitle }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-title">{title}</div>
        <div className="stat-value">{value}</div>
        {subtitle && <div className="stat-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [form, setForm] = useState(initialForm);

  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [patients, setPatients] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [apiOnline, setApiOnline] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  const [healthologyTab, setHealthologyTab] = useState("Anatomy");

  useEffect(() => {
    checkStatus();
    loadHistory();
    loadPatients();
  }, []);

  async function checkStatus() {
    try {
      const response = await axios.get(`${API}/api/status`);
      setApiOnline(response.data.api === true);
      setOllamaOnline(response.data.ollama === true);
    } catch (error) {
      setApiOnline(false);
      setOllamaOnline(false);
    }
  }

  async function loadHistory() {
    try {
      setLoadingHistory(true);

      const response = await axios.get(`${API}/api/history`);

      if (Array.isArray(response.data)) {
        setHistory(response.data);
      } else {
        setHistory(response.data.records || []);
      }
    } catch (error) {
      console.error("History error:", error);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadPatients() {
    try {
      const response = await axios.get(`${API}/api/patients`);
      setPatients(response.data.patients || []);
    } catch (error) {
      console.error("Patients error:", error);
      setPatients([]);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setResult(null);
  }

  async function handlePrediction(event) {
    event.preventDefault();

    if (!form.patient_name.trim()) {
      alert("Please enter the patient name.");
      return;
    }

    if (!form.age || !form.trestbps || !form.chol || !form.thalach) {
      alert("Please fill in the required medical fields.");
      return;
    }

    const payload = {
      patient_name: form.patient_name,
      patient_id: form.patient_id,

      sex: form.sex,

      emergency_contact_name: form.emergency_contact_name,
      emergency_relationship: form.emergency_relationship,
      emergency_phone: form.emergency_phone,

      age: Number(form.age),
      cp: Number(form.cp),
      trestbps: Number(form.trestbps),
      chol: Number(form.chol),
      fbs: Number(form.fbs),
      restecg: Number(form.restecg),
      thalach: Number(form.thalach),
      exang: Number(form.exang),
      oldpeak: Number(form.oldpeak),
      slope: Number(form.slope),
      ca: Number(form.ca),
      thal: Number(form.thal)
    };

    try {
      setLoading(true);

      const response = await axios.post(
        `${API}/api/predict`,
        payload
      );

      setResult(response.data);

      await loadHistory();
      await loadPatients();

      setActivePage("Assessment");
    } catch (error) {
      console.error("Prediction error:", error);

      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Unable to connect to the prediction server.";

      alert(message);
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    const message = chatMessage.trim();

    if (!message) {
      return;
    }

    setChatMessages((previous) => [
      ...previous,
      {
        role: "user",
        text: message
      }
    ]);

    setChatMessage("");

    try {
      const context = {
        page: activePage,
        prediction: result?.prediction || null,
        risk_label: result?.prediction?.risk_label || null,
        probability: result?.prediction?.probability || null
      };

      const response = await axios.post(`${API}/api/chat`, {
        message,
        mode: "medical",
        context
      });

      const answer =
        response.data.answer ||
        response.data.response ||
        "I could not generate a response.";

      setChatMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text: answer
        }
      ]);
    } catch (error) {
      setChatMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          text:
            "The local AI service is unavailable. Please make sure Ollama is running."
        }
      ]);
    }
  }

  function navigate(page) {
    setActivePage(page);
  }

  function renderDashboard() {
    const totalPatients = patients.length;
    const totalAnalyses = history.length;

    const highRiskCount = history.filter(
      (item) =>
        item.prediction === 1 ||
        String(item.risk_label || "")
          .toLowerCase()
          .includes("higher")
    ).length;

    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>CardioAI Dashboard</h1>
            <p>
              Heart disease risk assessment powered by machine learning
              and local AI.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={checkStatus}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="status-row">
          <div className={`status-pill ${apiOnline ? "online" : "offline"}`}>
            <span className="status-dot"></span>
            API {apiOnline ? "Online" : "Offline"}
          </div>

          <div
            className={`status-pill ${
              ollamaOnline ? "online" : "offline"
            }`}
          >
            <span className="status-dot"></span>
            Ollama {ollamaOnline ? "Online" : "Offline"}
          </div>

          <div className="status-pill local">
            <Shield size={15} />
            Local & Private
          </div>
        </div>

        <div className="stats-grid">
          <StatCard
            icon={<Users size={24} />}
            title="Patients"
            value={totalPatients}
            subtitle="Stored locally"
          />

          <StatCard
            icon={<Activity size={24} />}
            title="Assessments"
            value={totalAnalyses}
            subtitle="Prediction records"
          />

          <StatCard
            icon={<AlertCircle size={24} />}
            title="Higher Risk"
            value={highRiskCount}
            subtitle="Model predictions"
          />

          <StatCard
            icon={<Brain size={24} />}
            title="ML Model"
            value="Random Forest"
            subtitle="UCI Heart Disease"
          />
        </div>

        <div className="dashboard-grid">
          <div className="card">
            <CardTitle
              icon={<Heart size={20} />}
              text="Start a Risk Assessment"
            />

            <p className="card-description">
              Enter patient information and medical measurements to
              generate a model-based risk prediction.
            </p>

            <button
              className="primary-button"
              onClick={() => setActivePage("Assessment")}
            >
              Start Assessment
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="card">
            <CardTitle
              icon={<Brain size={20} />}
              text="AI Assistant"
            />

            <p className="card-description">
              Ask questions about heart disease, medical terminology,
              tests, risk factors and your application results.
            </p>

            <button
              className="secondary-button"
              onClick={() => setChatOpen(true)}
            >
              <MessageCircle size={18} />
              Open AI Assistant
            </button>
          </div>
        </div>

        <div className="card">
          <CardTitle
            icon={<Shield size={20} />}
            text="Important Information"
          />

          <div className="info-box">
            <AlertCircle size={20} />

            <p>
              CardioAI provides machine-learning predictions for
              educational and decision-support purposes. A prediction
              from this application is <strong>not a medical diagnosis</strong>.
              Consult a qualified healthcare professional for medical
              decisions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  function renderAssessment() {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Risk Assessment</h1>
            <p>
              Enter patient details and clinical measurements.
            </p>
          </div>
        </div>

        <form onSubmit={handlePrediction}>
          <div className="card">
            <CardTitle
              icon={<User size={20} />}
              text="Patient Information"
            />

            <div className="fields">
              <div className="field">
                <label>Patient Name *</label>
                <input
                  name="patient_name"
                  value={form.patient_name}
                  onChange={handleChange}
                  placeholder="Enter patient name"
                />
              </div>

              <div className="field">
                <label>Patient ID</label>
                <input
                  name="patient_id"
                  value={form.patient_id}
                  onChange={handleChange}
                  placeholder="Leave empty for automatic ID"
                />
              </div>

              <div className="field">
                <label>Age *</label>
                <input
                  type="number"
                  name="age"
                  value={form.age}
                  onChange={handleChange}
                  min="1"
                  max="120"
                  placeholder="Age"
                />
              </div>

              <div className="field">
                <label>Sex / Gender</label>
                <select
                  name="sex"
                  value={form.sex}
                  onChange={handleChange}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Transgender">Transgender</option>
                  <option value="LGBTQ+">LGBTQ+</option>
                  <option value="Prefer not to say">
                    Prefer not to say
                  </option>
                </select>

                <small>
                  The trained UCI model uses a binary sex feature.
                </small>
              </div>
            </div>
          </div>

          <div className="card">
            <CardTitle
              icon={<Shield size={20} />}
              text="Emergency Contact"
            />

            <div className="fields">
              <div className="field">
                <label>Contact Name</label>
                <input
                  name="emergency_contact_name"
                  value={form.emergency_contact_name}
                  onChange={handleChange}
                  placeholder="Emergency contact name"
                />
              </div>

              <div className="field">
                <label>Relationship</label>
                <input
                  name="emergency_relationship"
                  value={form.emergency_relationship}
                  onChange={handleChange}
                  placeholder="Parent, sibling, friend..."
                />
              </div>

              <div className="field">
                <label>Emergency Phone</label>
                <input
                  name="emergency_phone"
                  value={form.emergency_phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                />
              </div>
            </div>

            <div className="privacy-note">
              <Shield size={16} />
              Emergency contact information is stored locally and is
              not sent to the AI explanation service.
            </div>
          </div>

          <div className="card">
            <CardTitle
              icon={<Stethoscope size={20} />}
              text="Medical Measurements"
            />

            <div className="fields">
              <div className="field">
                <label>Chest Pain Type (CP)</label>
                <select
                  name="cp"
                  value={form.cp}
                  onChange={handleChange}
                >
                  <option value="0">0 - Typical angina</option>
                  <option value="1">1 - Atypical angina</option>
                  <option value="2">2 - Non-anginal pain</option>
                  <option value="3">3 - Asymptomatic</option>
                </select>
              </div>

              <div className="field">
                <label>Resting Blood Pressure *</label>
                <input
                  type="number"
                  name="trestbps"
                  value={form.trestbps}
                  onChange={handleChange}
                  placeholder="mm Hg"
                />
              </div>

              <div className="field">
                <label>Cholesterol *</label>
                <input
                  type="number"
                  name="chol"
                  value={form.chol}
                  onChange={handleChange}
                  placeholder="mg/dl"
                />
              </div>

              <div className="field">
                <label>Fasting Blood Sugar</label>
                <select
                  name="fbs"
                  value={form.fbs}
                  onChange={handleChange}
                >
                  <option value="0">0 - Normal</option>
                  <option value="1">1 - Greater than 120 mg/dl</option>
                </select>
              </div>

              <div className="field">
                <label>Resting ECG</label>
                <select
                  name="restecg"
                  value={form.restecg}
                  onChange={handleChange}
                >
                  <option value="0">0 - Normal</option>
                  <option value="1">1 - ST-T abnormality</option>
                  <option value="2">2 - LV hypertrophy</option>
                </select>
              </div>

              <div className="field">
                <label>Maximum Heart Rate *</label>
                <input
                  type="number"
                  name="thalach"
                  value={form.thalach}
                  onChange={handleChange}
                  placeholder="Maximum heart rate"
                />
              </div>

              <div className="field">
                <label>Exercise-Induced Angina</label>
                <select
                  name="exang"
                  value={form.exang}
                  onChange={handleChange}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>

              <div className="field">
                <label>Oldpeak</label>
                <input
                  type="number"
                  step="0.1"
                  name="oldpeak"
                  value={form.oldpeak}
                  onChange={handleChange}
                  placeholder="ST depression"
                />
              </div>

              <div className="field">
                <label>Slope</label>
                <select
                  name="slope"
                  value={form.slope}
                  onChange={handleChange}
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>

              <div className="field">
                <label>CA</label>
                <select
                  name="ca"
                  value={form.ca}
                  onChange={handleChange}
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>

              <div className="field">
                <label>Thal</label>
                <select
                  name="thal"
                  value={form.thal}
                  onChange={handleChange}
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={resetForm}
            >
              Clear
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="spin" />
                  Predicting...
                </>
              ) : (
                <>
                  <Activity size={18} />
                  Predict Risk
                </>
              )}
            </button>
          </div>
        </form>

        {result && renderPredictionResult()}
      </div>
    );
  }

  function renderPredictionResult() {
    const prediction = result.prediction || {};
    const probability = Number(prediction.probability || 0);
    const isHigherRisk = Number(prediction.prediction) === 1;

    const importance =
      result.feature_importance ||
      result.importance ||
      [];

    let chartData = [];

    if (Array.isArray(importance)) {
      chartData = importance.map((item) => ({
        feature: item.feature,
        importance: Number(item.importance || 0)
      }));
    } else if (typeof importance === "object") {
      chartData = Object.entries(importance).map(
        ([feature, value]) => ({
          feature,
          importance: Number(value || 0)
        })
      );
    }

    chartData = chartData.slice(0, 10);

    return (
      <div className="results-section">
        <div className="card result-card">
          <CardTitle
            icon={<Heart size={20} />}
            text="Prediction Result"
          />

          <div className="risk-result">
            <div
              className={`risk-circle ${
                isHigherRisk ? "risk-high" : "risk-low"
              }`}
            >
              <strong>{Math.round(probability * 100)}%</strong>
              <span>Model probability</span>
            </div>

            <div className="risk-details">
              <div
                className={`risk-label ${
                  isHigherRisk ? "high" : "low"
                }`}
              >
                {prediction.risk_label ||
                  (isHigherRisk
                    ? "Higher model-predicted risk"
                    : "Lower model-predicted risk")}
              </div>

              <p>
                Prediction class:{" "}
                <strong>
                  {prediction.prediction}
                </strong>
              </p>

              <p>
                Model:{" "}
                <strong>
                  {prediction.model || "Random Forest"}
                </strong>
              </p>

              <div className="not-diagnosis">
                <AlertCircle size={18} />
                This is a machine-learning prediction,
                not a medical diagnosis.
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <CardTitle
            icon={<Brain size={20} />}
            text="AI Explanation"
          />

          <div className="ai-explanation">
            {result.ai_explanation ||
              result.explanation ||
              "No AI explanation available."}
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="card">
            <CardTitle
              icon={<Activity size={20} />}
              text="Feature Importance"
            />

            <p className="card-description">
              These values show which model features contributed
              most to the Random Forest decision. They do not prove
              that a feature caused the outcome.
            </p>

            <div className="chart-container">
              <ResponsiveContainer
                width="100%"
                height={350}
              >
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{
                    top: 10,
                    right: 30,
                    left: 30,
                    bottom: 10
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis type="number" />

                  <YAxis
                    type="category"
                    dataKey="feature"
                    width={90}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="importance"
                    name="Importance"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderPatients() {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Patients</h1>
            <p>
              Patient records stored in the local SQLite database.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={loadPatients}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="card">
          {patients.length === 0 ? (
            <div className="empty-state">
              <Users size={42} />
              <h3>No patients yet</h3>
              <p>
                Complete a risk assessment to create the first
                patient record.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Patient ID</th>
                    <th>Name</th>
                    <th>Sex</th>
                    <th>Analyses</th>
                    <th>Last Analysis</th>
                  </tr>
                </thead>

                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.patient_id}>
                      <td>{patient.patient_id}</td>
                      <td>{patient.patient_name}</td>
                      <td>{patient.sex}</td>
                      <td>{patient.analysis_count}</td>
                      <td>
                        {patient.last_analysis || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderHistory() {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Assessment History</h1>
            <p>
              Previous CardioAI prediction results.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={loadHistory}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="card">
          {loadingHistory ? (
            <div className="loading-state">
              <RefreshCw className="spin" size={24} />
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <History size={42} />
              <h3>No assessment history</h3>
              <p>
                Your completed assessments will appear here.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Patient</th>
                    <th>Patient ID</th>
                    <th>Model</th>
                    <th>Prediction</th>
                    <th>Probability</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>{item.time}</td>

                      <td>
                        {item.patient_name || "-"}
                      </td>

                      <td>{item.patient_id}</td>

                      <td>{item.model}</td>

                      <td>
                        <span
                          className={`table-risk ${
                            Number(item.prediction) === 1
                              ? "high"
                              : "low"
                          }`}
                        >
                          {item.risk_label ||
                            (Number(item.prediction) === 1
                              ? "Higher risk"
                              : "Lower risk")}
                        </span>
                      </td>

                      <td>
                        {item.probability !== undefined
                          ? `${Math.round(
                              Number(item.probability) * 100
                            )}%`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderModelInsights() {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Model Insights</h1>
            <p>
              Information about the machine-learning model used by
              CardioAI.
            </p>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard
            icon={<Brain size={24} />}
            title="Primary Model"
            value="Random Forest"
            subtitle="Prediction model"
          />

          <StatCard
            icon={<Activity size={24} />}
            title="Training Accuracy"
            value="91.8%"
            subtitle="Reported test accuracy"
          />

          <StatCard
            icon={<Activity size={24} />}
            title="Alternative"
            value="XGBoost"
            subtitle="90.16% test accuracy"
          />

          <StatCard
            icon={<Shield size={24} />}
            title="Dataset"
            value="UCI"
            subtitle="Heart Disease dataset"
          />
        </div>

        <div className="card">
          <CardTitle
            icon={<Brain size={20} />}
            text="How CardioAI Works"
          />

          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div>
                <h3>Patient Input</h3>
                <p>
                  Clinical measurements are entered into the
                  assessment form.
                </p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <div>
                <h3>Random Forest</h3>
                <p>
                  The trained Random Forest model processes the
                  medical features.
                </p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">3</div>
              <div>
                <h3>Prediction</h3>
                <p>
                  The model returns a prediction and probability.
                </p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">4</div>
              <div>
                <h3>Local AI Explanation</h3>
                <p>
                  Ollama provides a concise educational
                  explanation without changing the prediction.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <CardTitle
            icon={<AlertCircle size={20} />}
            text="Important Limitation"
          />

          <p className="card-description">
            Model predictions depend on the data and training
            process. They should not be interpreted as a diagnosis
            or a replacement for professional medical evaluation.
          </p>
        </div>
      </div>
    );
  }

  function renderHealthology() {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Healthology</h1>
            <p>
              Educational information about the heart, diseases,
              tests and prevention.
            </p>
          </div>
        </div>

        <div className="healthology-tabs">
          {[
            "Anatomy",
            "Diseases",
            "Medical Tests",
            "Prevention",
            "Glossary"
          ].map((tab) => (
            <button
              key={tab}
              className={
                healthologyTab === tab
                  ? "health-tab active"
                  : "health-tab"
              }
              onClick={() => setHealthologyTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="card">
          {healthologyTab === "Anatomy" && (
            <div>
              <CardTitle
                icon={<Heart size={20} />}
                text="Heart Anatomy"
              />

              <div className="health-content">
                <img
                  src="/heart-logo.jpg"
                  alt="Heart"
                  className="heart-image"
                />

                <div>
                  <h3>The Heart</h3>

                  <p>
                    The heart is a muscular organ that pumps blood
                    throughout the body. It supplies tissues with
                    oxygen and nutrients and helps remove metabolic
                    waste.
                  </p>

                  <h3>Four Chambers</h3>

                  <ul>
                    <li>Right atrium</li>
                    <li>Right ventricle</li>
                    <li>Left atrium</li>
                    <li>Left ventricle</li>
                  </ul>

                  <h3>Major Blood Vessels</h3>

                  <ul>
                    <li>Aorta</li>
                    <li>Pulmonary arteries</li>
                    <li>Pulmonary veins</li>
                    <li>Superior and inferior vena cava</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {healthologyTab === "Diseases" && (
            <div>
              <CardTitle
                icon={<AlertCircle size={20} />}
                text="Common Heart Conditions"
              />

              <div className="education-grid">
                <div className="education-item">
                  <h3>Coronary Artery Disease</h3>
                  <p>
                    A condition involving narrowing or blockage of
                    coronary arteries.
                  </p>
                </div>

                <div className="education-item">
                  <h3>Heart Failure</h3>
                  <p>
                    A condition in which the heart cannot pump blood
                    as effectively as the body requires.
                  </p>
                </div>

                <div className="education-item">
                  <h3>Arrhythmia</h3>
                  <p>
                    An abnormal heart rhythm that may be too fast,
                    too slow or irregular.
                  </p>
                </div>

                <div className="education-item">
                  <h3>Hypertension</h3>
                  <p>
                    Persistently elevated blood pressure that can
                    increase cardiovascular risk.
                  </p>
                </div>
              </div>
            </div>
          )}

          {healthologyTab === "Medical Tests" && (
            <div>
              <CardTitle
                icon={<Stethoscope size={20} />}
                text="Common Medical Tests"
              />

              <div className="education-grid">
                <div className="education-item">
                  <h3>Blood Pressure</h3>
                  <p>
                    Measures pressure in the arteries during and
                    between heartbeats.
                  </p>
                </div>

                <div className="education-item">
                  <h3>Electrocardiogram</h3>
                  <p>
                    Records the electrical activity of the heart.
                  </p>
                </div>

                <div className="education-item">
                  <h3>Echocardiogram</h3>
                  <p>
                    Uses ultrasound to create images of the heart.
                  </p>
                </div>

                <div className="education-item">
                  <h3>Blood Tests</h3>
                  <p>
                    Different blood tests can provide information
                    relevant to cardiovascular health.
                  </p>
                </div>
              </div>
            </div>
          )}

          {healthologyTab === "Prevention" && (
            <div>
              <CardTitle
                icon={<Shield size={20} />}
                text="Heart Health and Prevention"
              />

              <div className="education-grid">
                <div className="education-item">
                  <h3>Healthy Eating</h3>
                  <p>
                    A balanced eating pattern can support
                    cardiovascular health.
                  </p>
                </div>

                <div className="education-item">
                  <h3>Physical Activity</h3>
                  <p>
                    Regular physical activity can support overall
                    cardiovascular fitness.
                  </p>
                </div>

                <div className="education-item">
                  <h3>Regular Checkups</h3>
                  <p>
                    Appropriate medical checkups can help identify
                    cardiovascular risk factors.
                  </p>
                </div>

                <div className="education-item">
                  <h3>Avoid Tobacco</h3>
                  <p>
                    Avoiding tobacco products can reduce cardiovascular
                    health risks.
                  </p>
                </div>
              </div>
            </div>
          )}

          {healthologyTab === "Glossary" && (
            <div>
              <CardTitle
                icon={<BookOpen size={20} />}
                text="Medical Glossary"
              />

              <div className="glossary">
                <div>
                  <strong>Cholesterol</strong>
                  <p>
                    A lipid that is important for normal body
                    functions but can contribute to cardiovascular
                    disease when levels are unhealthy.
                  </p>
                </div>

                <div>
                  <strong>Blood Pressure</strong>
                  <p>
                    The pressure exerted by circulating blood on
                    blood vessel walls.
                  </p>
                </div>

                <div>
                  <strong>Heart Rate</strong>
                  <p>
                    The number of heartbeats per minute.
                  </p>
                </div>

                <div>
                  <strong>Angina</strong>
                  <p>
                    Chest discomfort associated with reduced blood
                    flow to the heart muscle.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="disclaimer">
          <AlertCircle size={18} />
          <span>
            Healthology is for educational purposes only and does
            not replace professional medical advice.
          </span>
        </div>
      </div>
    );
  }

  function renderPage() {
    if (activePage === "Dashboard") {
      return renderDashboard();
    }

    if (activePage === "Assessment") {
      return renderAssessment();
    }

    if (activePage === "Patients") {
      return renderPatients();
    }

    if (activePage === "History") {
      return renderHistory();
    }

    if (activePage === "Model Insights") {
      return renderModelInsights();
    }

    if (activePage === "Healthology") {
      return renderHealthology();
    }

    return renderDashboard();
  }

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${
          sidebarOpen ? "sidebar-open" : "sidebar-closed"
        }`}
      >
        <div className="brand">
          <img
            src="/heart-logo.jpg"
            alt="CardioAI"
            className="brand-logo"
          />

          {sidebarOpen && (
            <div>
              <h2>CardioAI</h2>
              <span>Interactive Health AI</span>
            </div>
          )}
        </div>

        <nav className="navigation">
          <button
            className={
              activePage === "Dashboard"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("Dashboard")}
          >
            <Home size={20} />
            {sidebarOpen && <span>Dashboard</span>}
          </button>

          <button
            className={
              activePage === "Assessment"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("Assessment")}
          >
            <Activity size={20} />
            {sidebarOpen && <span>Risk Assessment</span>}
          </button>

          <button
            className={
              activePage === "Patients"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("Patients")}
          >
            <Users size={20} />
            {sidebarOpen && <span>Patients</span>}
          </button>

          <button
            className={
              activePage === "History"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("History")}
          >
            <History size={20} />
            {sidebarOpen && <span>History</span>}
          </button>

          <button
            className={
              activePage === "Model Insights"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("Model Insights")}
          >
            <Brain size={20} />
            {sidebarOpen && <span>Model Insights</span>}
          </button>

          <button
            className={
              activePage === "Healthology"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => navigate("Healthology")}
          >
            <BookOpen size={20} />
            {sidebarOpen && <span>Healthology</span>}
          </button>
        </nav>

        <div className="sidebar-bottom">
          {sidebarOpen && (
            <div className="privacy-card">
              <Shield size={18} />
              <div>
                <strong>Local & Private</strong>
                <span>
                  Data stays on your system.
                </span>
              </div>
            </div>
          )}

          <button
            className="sidebar-toggle"
            onClick={() =>
              setSidebarOpen((previous) => !previous)
            }
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </aside>

      <main
        className={`main-content ${
          sidebarOpen ? "main-expanded" : "main-full"
        }`}
      >
        <header className="topbar">
          <div>
            <span className="topbar-title">
              {activePage}
            </span>
          </div>

          <div className="topbar-actions">
            <div className="connection-status">
              <span
                className={`connection-dot ${
                  apiOnline ? "online" : "offline"
                }`}
              ></span>
              {apiOnline ? "Connected" : "Offline"}
            </div>

            <button
              className="assistant-button"
              onClick={() => setChatOpen(true)}
            >
              <MessageCircle size={18} />
              AI Assistant
            </button>
          </div>
        </header>

        {renderPage()}
      </main>

      {chatOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-header-title">
              <div className="chat-icon">
                <Brain size={20} />
              </div>

              <div>
                <strong>CardioAI Assistant</strong>
                <span>Local AI · Ollama</span>
              </div>
            </div>

            <button
              className="icon-button"
              onClick={() => setChatOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          <div className="chat-messages">
            {chatMessages.length === 0 && (
              <div className="chat-welcome">
                <Brain size={36} />

                <h3>How can I help?</h3>

                <p>
                  Ask me about heart disease concepts, medical
                  terminology, tests, risk factors or the CardioAI
                  application.
                </p>

                <div className="suggestion-list">
                  <button
                    onClick={() =>
                      setChatMessage(
                        "What does the prediction probability mean?"
                      )
                    }
                  >
                    What does prediction probability mean?
                  </button>

                  <button
                    onClick={() =>
                      setChatMessage(
                        "What is cholesterol?"
                      )
                    }
                  >
                    What is cholesterol?
                  </button>

                  <button
                    onClick={() =>
                      setChatMessage(
                        "What does blood pressure mean?"
                      )
                    }
                  >
                    What does blood pressure mean?
                  </button>
                </div>
              </div>
            )}

            {chatMessages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "chat-message user-message"
                    : "chat-message assistant-message"
                }
              >
                {message.text}
              </div>
            ))}
          </div>

          <div className="chat-input-area">
            <textarea
              value={chatMessage}
              onChange={(event) =>
                setChatMessage(event.target.value)
              }
              placeholder="Ask a question..."
              rows={2}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  sendChat();
                }
              }}
            />

            <button
              className="primary-button chat-send"
              onClick={sendChat}
              disabled={!chatMessage.trim()}
            >
              <MessageCircle size={17} />
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;