import { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { 
  FileText, Activity, Users, ShieldCheck, 
  TrendingUp, Download, PlayCircle, AlertTriangle 
} from 'lucide-react';
import './App.css';

const API_BASE = 'http://localhost:5000';

function App() {
  const [activeTab, setActiveTab] = useState('xray');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [coupleData, setCoupleData] = useState(null);

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await axios.post(`${API_BASE}/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setData(res.data);
      setActiveTab('score'); // auto-switch to score
    } catch (err) {
      console.error(err);
      alert('Error analyzing PDF. Make sure the backend is running and you have a valid Gemini API key.');
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const fetchCouplePlan = async (e) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    
    // convert numeric values
    for (const key in payload) {
      if (!isNaN(payload[key])) payload[key] = Number(payload[key]);
    }

    try {
      const res = await axios.post(`${API_BASE}/couple`, payload);
      setCoupleData(res.data);
    } catch (err) {
      console.error(err);
      alert('Error analyzing FIRE plan. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const renderTabs = () => (
    <div className="tabs">
      <button className={activeTab === 'xray' ? 'active' : ''} onClick={() => setActiveTab('xray')}>
        <FileText size={18} /> Portfolio X-Ray
      </button>
      <button className={activeTab === 'score' ? 'active' : ''} onClick={() => setActiveTab('score')} disabled={!data}>
        <Activity size={18} /> Money Health Score
      </button>
      <button className={activeTab === 'couple' ? 'active' : ''} onClick={() => setActiveTab('couple')}>
        <Users size={18} /> Couple's Planner
      </button>
      <button className={activeTab === 'audit' ? 'active' : ''} onClick={() => setActiveTab('audit')} disabled={!data}>
        <ShieldCheck size={18} /> Audit Trail
      </button>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <TrendingUp color="#3b82f6" size={28} />
          <h1>ET AI Money Mentor</h1>
        </div>
        <p className="tagline">India's first AI financial advisor for the middle-class family</p>
      </header>
      
      <main className="main-content">
        {renderTabs()}

        <div className="tab-content">
          
          {/* TAB 1: PORTFOLIO X-RAY */}
          {activeTab === 'xray' && (
            <div className="fade-in">
              <h2>Upload CAMS Mutual Fund Statement</h2>
              {!data && (
                <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active-drop' : ''}`}>
                  <input {...getInputProps()} />
                  <Download size={48} color="#94a3b8" />
                  <h3>{isDragActive ? "Drop the PDF here" : "Drag & drop your CAMS PDF here"}</h3>
                  <p>Or click to select file</p>
                  {loading && <div className="loader">Analyzing with Gemini AI...</div>}
                </div>
              )}

              {data && (
                <div className="xray-dashboard">
                  <div className="summary-cards">
                    <div className="card">
                      <h3>Total Invested</h3>
                      <p className="value">₹{data.math.total_invested.toLocaleString()}</p>
                    </div>
                    <div className="card">
                      <h3>Current Value</h3>
                      <p className="value">₹{data.math.total_current_value.toLocaleString()}</p>
                    </div>
                    <div className="card highlight">
                      <h3>True XIRR</h3>
                      <p className="value">{data.math.xirr_percent}%</p>
                    </div>
                    <div className="card danger">
                      <h3>Annual Expense Drag</h3>
                      <p className="value">₹{data.math.annual_expense_drag_inr.toLocaleString()}</p>
                      <p className="sub">Siphoned as fees</p>
                    </div>
                  </div>

                  <div className="charts-row">
                    <div className="chart-container card">
                      <h3>Holdings Breakdown</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={data.holdings} dataKey="current_value" nameKey="fund_name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8">
                            {data.holdings.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="chart-container card">
                      <h3>Fund Overlaps & Warnings</h3>
                      {data.math.overlaps.length === 0 ? (
                        <p className="success-msg">No significant overlaps detected.</p>
                      ) : (
                        <ul className="warning-list">
                          {data.math.overlaps.map((ov, i) => (
                            <li key={i}><AlertTriangle size={16} color="#ef4444"/> {ov.warning}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MONEY HEALTH SCORE */}
          {activeTab === 'score' && data && (
            <div className="fade-in score-view">
              <div className="score-header">
                <div className="score-circle">
                  <span>{data.ai_recommendation.health_score}</span>
                  <sub>/100</sub>
                </div>
                <div>
                  <h2>Grade: {data.ai_recommendation.health_grade}</h2>
                  <p className="ai-summary">{data.ai_recommendation.summary}</p>
                </div>
              </div>

              <div className="recommendations-grid">
                <div className="card bg-red-light">
                  <h3>Top Issues</h3>
                  <ul>
                    {data.ai_recommendation.top_issues.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                </div>
                <div className="card bg-green-light">
                  <h3>Actionable Steps</h3>
                  <ul>
                    {data.ai_recommendation.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                  </ul>
                </div>
              </div>

              <div className="fire-metrics card">
                <h3>Financial Independence (FIRE) Estimate</h3>
                <div className="metric-row">
                  <div>
                    <label>Years to FIRE</label>
                    <p>{data.ai_recommendation.fire_years_estimate} years</p>
                  </div>
                  <div>
                    <label>Estimated Savings by Rebalancing</label>
                    <p className="green">₹{data.ai_recommendation.estimated_annual_savings_inr?.toLocaleString()}/yr</p>
                  </div>
                </div>
              </div>
              
              <div className="tamil-voice card">
                <h3><PlayCircle size={20} /> Tamil Voice Advisory</h3>
                <p className="tamil-text">{data.ai_recommendation.tamil_summary}</p>
                <p className="note">Audio is playing via your laptop speakers automatically.</p>
              </div>
            </div>
          )}

          {/* TAB 3: COUPLE'S PLANNER */}
          {activeTab === 'couple' && (
            <div className="fade-in couple-planner">
              <h2>Couple's FIRE Planner</h2>
              <form onSubmit={fetchCouplePlan} className="couple-form card">
                <div className="form-group">
                  <label>Husband Age</label>
                  <input type="number" name="husband_age" required defaultValue="30"/>
                  <label>Wife Age</label>
                  <input type="number" name="wife_age" required defaultValue="28"/>
                </div>
                <div className="form-group">
                  <label>Combined Monthly Income (₹)</label>
                  <input type="number" name="combined_income" required defaultValue="150000"/>
                  <label>Current Monthly Expenses (₹)</label>
                  <input type="number" name="monthly_expenses" required defaultValue="60000"/>
                </div>
                <div className="form-group">
                  <label>Total Existing Corpus (₹)</label>
                  <input type="number" name="existing_corpus" required defaultValue="500000"/>
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Analyzing...' : 'Generate Joint FIRE Plan'}
                </button>
              </form>

              {coupleData && (
                <div className="couple-results fade-in mt-4">
                  <div className="summary-cards">
                    <div className="card highlight">
                      <h3>FIRE Target Corpus</h3>
                      <p className="value">₹{coupleData.fire_target_corpus.toLocaleString()}</p>
                    </div>
                    <div className="card">
                      <h3>Years to FIRE</h3>
                      <p className="value">{coupleData.years_to_fire} yrs</p>
                    </div>
                    <div className="card">
                      <h3>Recommended SIP</h3>
                      <p className="value">₹{coupleData.recommended_monthly_sip.toLocaleString()}/mo</p>
                    </div>
                  </div>

                  <div className="recommendations-grid mt-4">
                    <div className="card">
                      <h3>Optimizations</h3>
                      <p><strong>HRA:</strong> {coupleData.hra_optimization}</p>
                      <p><strong>NPS:</strong> {coupleData.nps_recommendation}</p>
                      <p><strong>Insurance:</strong> {coupleData.insurance_gaps}</p>
                      <p><strong>SIP Strategy:</strong> {coupleData.joint_vs_separate_sip}</p>
                    </div>
                    <div className="card bg-gray">
                      <h3>Tamil Advisory</h3>
                      <p className="tamil-text">{coupleData.tamil_summary}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL */}
          {activeTab === 'audit' && data && (
            <div className="fade-in card audit-trail">
              <h2>AI Agent Audit Trail</h2>
              <ul>
                {data.audit_log.map((log, i) => (
                  <li key={i}>
                    <span className="log-time">{new Date().toLocaleTimeString()}</span>
                    <span className="log-msg">{log}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
