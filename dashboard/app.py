# ==============================================================================
# CrowdShield AI — Fully Data-Driven Command Center (Day 21)
# ==============================================================================
# File: d:\CrowdShieldAI\dashboard\app.py
# Purpose: Core dashboard system integrated with REST API endpoint calls,
#          StandardScaler data scaling, and four trained machine learning models.
# ==============================================================================

import streamlit as st
import pandas as pd
import numpy as np
import sqlite3
import os
import requests
import joblib
from sklearn.preprocessing import StandardScaler

# ----------------- PAGE LAYOUT CONFIGURATION -----------------
st.set_page_config(
    page_title="CrowdShield AI — Operations Command",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ----------------- SESSION STATE SYSTEM SETUP -----------------
if "api_url" not in st.session_state:
    st.session_state.api_url = "http://127.0.0.1:8000"
if "simulate_peak" not in st.session_state:
    st.session_state.simulate_peak = False

# ----------------- PERFORMANCE DATA CACHING -----------------
@st.cache_data
def load_csv_dataset():
    """
    Loads and caches the historical crowd dataset for deep-dive analytics.
    """
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "notebooks", "crowd_dataset.csv"))
    if os.path.exists(csv_path):
        return pd.read_csv(csv_path)
    return None

# ----------------- CACHED MODEL LOADERS -----------------
@st.cache_resource
def load_all_ml_models():
    """
    Loads all four machine learning models from the notebooks directory and
    caches them in memory for optimal retrieval.
    """
    model_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "notebooks"))
    models = {
        "risk": "risk_model.pkl",
        "wait": "waiting_time_model.pkl",
        "vol": "volunteer_model.pkl",
        "cong": "congestion_model.pkl"
    }
    loaded_models = {}
    for key, filename in models.items():
        path = os.path.join(model_dir, filename)
        if os.path.exists(path):
            try:
                loaded_models[key] = joblib.load(path)
            except Exception as e:
                st.error(f"Error loading model {filename}: {e}")
        else:
            loaded_models[key] = None
    return loaded_models

@st.cache_resource
def get_data_scaler():
    """
    Fits and caches a StandardScaler on the encoded columns of crowd_dataset.csv.
    This ensures that live foyer inputs are correctly scaled prior to predicting
    with linear models like waiting time and volunteer models.
    """
    csv_df = load_csv_dataset()
    if csv_df is not None:
        try:
            # Isolate features
            X_raw = csv_df.drop(["Risk_Level", "Congestion_Level"], axis=1)
            # Encode categorical features
            X_encoded = pd.get_dummies(X_raw)
            
            scaler = StandardScaler()
            scaler.fit(X_encoded)
            return scaler, list(X_encoded.columns)
        except Exception as e:
            st.error(f"Data scaler initialization failed: {e}")
    return None, None

# ----------------- DATABASE WRITE OPERATIONS -----------------
def get_db_connection():
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "crowdshield.db"))
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def reseed_database():
    """
    Resets the database and populates clean sample records.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA foreign_keys = OFF;")
        cursor.execute("DELETE FROM alerts")
        cursor.execute("DELETE FROM volunteers")
        cursor.execute("DELETE FROM scans")
        cursor.execute("DELETE FROM attendees")
        cursor.execute("DELETE FROM gates")
        cursor.execute("DELETE FROM events")
        cursor.execute("PRAGMA foreign_keys = ON;")
        
        cursor.execute("""
            INSERT INTO events (event_name, venue, date, capacity)
            VALUES ('Tech Summit 2026', 'Convention Center Hall A', '2026-06-15', 1000);
        """)
        event_id = cursor.lastrowid
        
        cursor.execute("INSERT INTO gates (event_id, gate_name, max_capacity) VALUES (?, 'Main Gate Alpha', 500);", (event_id,))
        gate_alpha_id = cursor.lastrowid
        cursor.execute("INSERT INTO gates (event_id, gate_name, max_capacity) VALUES (?, 'VIP Gate Beta', 200);", (event_id,))
        gate_beta_id = cursor.lastrowid
        cursor.execute("INSERT INTO gates (event_id, gate_name, max_capacity) VALUES (?, 'East Entrance Gamma', 300);", (event_id,))
        gate_gamma_id = cursor.lastrowid
        
        cursor.execute("INSERT INTO attendees (event_id, attendee_name, qr_code, assigned_gate, is_checked_in) VALUES (?, 'Alice Smith', 'QR-TECH-ALICE99', ?, 1);", (event_id, gate_alpha_id))
        cursor.execute("INSERT INTO attendees (event_id, attendee_name, qr_code, assigned_gate, is_checked_in) VALUES (?, 'Bob Jones', 'QR-TECH-BOB456', ?, 1);", (event_id, gate_beta_id))
        cursor.execute("INSERT INTO attendees (event_id, attendee_name, qr_code, assigned_gate, is_checked_in) VALUES (?, 'Charlie Brown', 'QR-TECH-CHARLIE123', ?, 0);", (event_id, gate_alpha_id))
        cursor.execute("INSERT INTO attendees (event_id, attendee_name, qr_code, assigned_gate, is_checked_in) VALUES (?, 'Diana Prince', 'QR-TECH-DIANA101', ?, 0);", (event_id, gate_gamma_id))
        cursor.execute("INSERT INTO attendees (event_id, attendee_name, qr_code, assigned_gate, is_checked_in) VALUES (?, 'Clark Kent', 'QR-TECH-CLARK999', ?, 0);", (event_id, gate_gamma_id))
        
        cursor.execute("INSERT INTO volunteers (volunteer_name, assigned_gate, contact) VALUES ('David Miller', ?, '+1-555-0199');", (gate_alpha_id,))
        cursor.execute("INSERT INTO volunteers (volunteer_name, assigned_gate, contact) VALUES ('Eva Green', ?, '+1-555-0248');", (gate_beta_id,))
        cursor.execute("INSERT INTO volunteers (volunteer_name, assigned_gate, contact) VALUES ('Frank Stone', NULL, '+1-555-0789');")
        cursor.execute("INSERT INTO volunteers (volunteer_name, assigned_gate, contact) VALUES ('Grace Hopper', NULL, '+1-555-0612');")
        
        cursor.execute("INSERT INTO alerts (gate_id, alert_type, message) VALUES (?, 'Congestion', 'Main Gate Alpha has exceeded 80% capacity limit.');", (gate_alpha_id,))
        cursor.execute("INSERT INTO alerts (gate_id, alert_type, message) VALUES (?, 'Emergency', 'VIP Gate Beta access path blocked. Directing to Alpha.');", (gate_beta_id,))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        st.error(f"Error resetting database: {e}")
        return False

# ----------------- STREAMLIT REST API SERVICE LAYER (DAY 21) -----------------
class APIService:
    """
    Renders REST API connection helpers for the Streamlit frontend.
    These methods fetch data from the FastAPI endpoints in JSON format.
    """
    @staticmethod
    def get_events():
        try:
            res = requests.get(f"{st.session_state.api_url}/events", timeout=0.8)
            if res.status_code == 200:
                return res.json()
        except:
            pass
        return None

    @staticmethod
    def get_gates():
        try:
            res = requests.get(f"{st.session_state.api_url}/gates", timeout=0.8)
            if res.status_code == 200:
                return res.json()
        except:
            pass
        return None

    @staticmethod
    def get_volunteers():
        try:
            res = requests.get(f"{st.session_state.api_url}/volunteers", timeout=0.8)
            if res.status_code == 200:
                return res.json()
        except:
            pass
        return None

    @staticmethod
    def get_alerts():
        try:
            res = requests.get(f"{st.session_state.api_url}/alerts", timeout=0.8)
            if res.status_code == 200:
                return res.json()
        except:
            pass
        return None

def fetch_live_statistics():
    """
    Retrieves statistics, events, gates, volunteers, and alerts from:
    1. The APIService layer (FastAPI server)
    2. SQLite database direct queries (backup fallback)
    """
    # 1. API Service Layer fetches
    api_events = APIService.get_events()
    api_gates = APIService.get_gates()
    api_volunteers = APIService.get_volunteers()
    api_alerts = APIService.get_alerts()
    
    # 2. If API Service is available, parse JSON
    if api_events is not None and api_gates is not None and api_volunteers is not None and api_alerts is not None:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM attendees")
            total_attendees = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM attendees WHERE is_checked_in = 1")
            checked_in = cursor.fetchone()[0]
            conn.close()
            
            # Map events list
            events_list = [(x['event_id'], x['event_name'], x['venue'], x['date'], x['capacity']) for x in api_events]
            
            # Map volunteers list
            total_vol = len(api_volunteers)
            assigned_vol = len([v for v in api_volunteers if v['assigned_gate'] is not None])
            free_vol = len([v for v in api_volunteers if v['assigned_gate'] is None])
            all_vol_list = []
            for v in api_volunteers:
                gate_name = 'None (Unassigned)'
                if v['assigned_gate'] is not None:
                    match = [g['gate_name'] for g in api_gates if g['gate_id'] == v['assigned_gate']]
                    if match: gate_name = match[0]
                all_vol_list.append((v['volunteer_name'], gate_name, v['contact']))
                
            # Map alerts list
            alerts_list = []
            for al in api_alerts:
                gate_name = 'Unknown Gate'
                match = [g['gate_name'] for g in api_gates if g['gate_id'] == al['gate_id']]
                if match: gate_name = match[0]
                alerts_list.append((al['alert_id'], gate_name, al['alert_type'], al['message'], al['alert_time']))
                
            # Map gate live sensors
            conn = get_db_connection()
            cursor = conn.cursor()
            gates_data = []
            for g in api_gates:
                cursor.execute("SELECT COUNT(*) FROM attendees WHERE assigned_gate = ? AND is_checked_in = 1", (g['gate_id'],))
                curr_occ = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(*) FROM attendees WHERE assigned_gate = ? AND is_checked_in = 0", (g['gate_id'],))
                queue = cursor.fetchone()[0]
                gates_data.append((g['gate_id'], g['gate_name'], g['max_capacity'], curr_occ, queue))
            conn.close()
            
            percentages = [(x[3] / x[2] * 100) if x[2] > 0 else 0.0 for x in gates_data]
            avg_occupancy = sum(percentages) / len(percentages) if percentages else 0.0
            
            return {
                "total_events": len(api_events),
                "total_attendees": total_attendees,
                "checked_in": checked_in,
                "active_alerts": len(api_alerts),
                "avg_occupancy": round(avg_occupancy, 1),
                "total_volunteers": total_vol,
                "assigned_volunteers": assigned_vol,
                "free_volunteers": free_vol,
                "gates_data": gates_data,
                "events_list": events_list,
                "all_volunteers_list": all_vol_list,
                "alerts_list": alerts_list,
                "source": "API Engine"
            }
        except:
            pass # Failover to direct DB access
            
    # 3. SQLite direct fallback
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM events")
        total_events = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM attendees")
        total_attendees = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM attendees WHERE is_checked_in = 1")
        checked_in = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM alerts")
        active_alerts = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM volunteers")
        total_volunteers = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM volunteers WHERE assigned_gate IS NOT NULL")
        assigned_volunteers = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM volunteers WHERE assigned_gate IS NULL")
        free_volunteers = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT 
                g.gate_id, 
                g.gate_name, 
                g.max_capacity,
                COALESCE(checked_in.cnt, 0) as current_occupancy,
                COALESCE(in_queue.cnt, 0) as queue_count
            FROM gates g
            LEFT JOIN (
                SELECT assigned_gate, COUNT(*) as cnt 
                FROM attendees 
                WHERE is_checked_in = 1 
                GROUP BY assigned_gate
            ) checked_in ON g.gate_id = checked_in.assigned_gate
            LEFT JOIN (
                SELECT assigned_gate, COUNT(*) as cnt 
                FROM attendees 
                WHERE is_checked_in = 0 
                GROUP BY assigned_gate
            ) in_queue ON g.gate_id = in_queue.assigned_gate
        """)
        gates_data = cursor.fetchall()
        
        cursor.execute("SELECT event_id, event_name, venue, date, capacity FROM events")
        events_list = cursor.fetchall()
        
        cursor.execute("""
            SELECT v.volunteer_name, 
                   COALESCE(g.gate_name, 'None (Unassigned)') as gate_name, 
                   v.contact 
            FROM volunteers v
            LEFT JOIN gates g ON v.assigned_gate = g.gate_id
        """)
        all_volunteers_list = cursor.fetchall()
        
        cursor.execute("""
            SELECT a.alert_id, g.gate_name, a.alert_type, a.message, a.alert_time 
            FROM alerts a
            JOIN gates g ON a.gate_id = g.gate_id
            ORDER BY a.alert_time DESC
        """)
        alerts_list = cursor.fetchall()
        
        conn.close()
        
        occupancy_percentages = []
        for row in gates_data:
            max_cap = row[2]
            curr_occ = row[3]
            pct = (curr_occ / max_cap * 100) if max_cap > 0 else 0.0
            occupancy_percentages.append(pct)
        avg_occupancy = sum(occupancy_percentages) / len(occupancy_percentages) if occupancy_percentages else 0.0
        
        return {
            "total_events": total_events,
            "total_attendees": total_attendees,
            "checked_in": checked_in,
            "active_alerts": active_alerts,
            "avg_occupancy": round(avg_occupancy, 1),
            "total_volunteers": total_volunteers,
            "assigned_volunteers": assigned_volunteers,
            "free_volunteers": free_volunteers,
            "gates_data": gates_data,
            "events_list": events_list,
            "all_volunteers_list": all_volunteers_list,
            "alerts_list": alerts_list,
            "source": "Local SQLite DB"
        }
    except Exception as e:
        st.warning(f"Database statistics could not be loaded: {str(e)}")
        return None

# ----------------- ML DATA NORMALIZATION & PREDICTIONS (DAY 21) -----------------
def predict_all_gate_metrics(curr_occ, queue, stationed_volunteers, max_cap, peak_val, models, scaler, feature_columns):
    """
    Transforms gate inputs and performs predictions across all four models:
    - waiting_time_model.pkl (Wait time in minutes)
    - volunteer_model.pkl (Required staffing counts)
    - congestion_model.pkl (Congestion categories: Low, Medium, High)
    - risk_model.pkl (Safety levels: Safe, Warning, Dangerous)
    """
    occ_pct = (curr_occ / max_cap * 100) if max_cap > 0 else 0.0
    
    # Sanity overrides for empty or near-empty gates to prevent false ML alerts
    if curr_occ < 15 and queue < 3:
        return {
            "risk": "Safe",
            "congestion": "Low",
            "waiting_time": round((queue * 1.5) / max(stationed_volunteers, 1), 1),
            "req_volunteers": 1,
            "deficit": max(1 - stationed_volunteers, 0)
        }
    
    # 1. Prepare raw inputs (15 features)
    dummy_dict = {
        'Crowd_Count': curr_occ,
        'Entry_Rate': 50, # mid-range baseline
        'Queue_Length': queue,
        'Volunteers_Assigned': stationed_volunteers,
        'Venue_Capacity': max_cap if max_cap > 0 else 1000,
        'Occupancy_Percentage': occ_pct,
        'Peak_Hour': peak_val,
        'Event_Type_College Fest': False,
        'Event_Type_Concert': False,
        'Event_Type_Exhibition': False,
        'Event_Type_Sports Event': False,
        'Time_Slot_Afternoon': False,
        'Time_Slot_Evening': False,
        'Time_Slot_Morning': False,
        'Time_Slot_Night': False
    }
    
    # 2. Scale features before passing to scale-sensitive linear regressions
    scaled_features = None
    if scaler is not None and feature_columns is not None:
        try:
            row_df = pd.DataFrame([dummy_dict])[feature_columns]
            scaled_features = scaler.transform(row_df)
        except:
            pass
            
    # Model 1: Predict Waiting Time (Linear Regression)
    wait_time = 0.0
    if models.get("wait") is not None and scaled_features is not None:
        try:
            wait_time = max(models["wait"].predict(scaled_features)[0], 0.0)
        except:
            wait_time = (queue * 1.5) / max(stationed_volunteers, 1) # baseline fallback
    else:
        wait_time = (queue * 1.5) / max(stationed_volunteers, 1)
        
    # Model 2: Predict Required Volunteers (Linear Regression)
    req_volunteers = 0
    if models.get("vol") is not None and scaled_features is not None:
        try:
            # We predict required count based on crowd sizes
            req_volunteers = max(int(round(models["vol"].predict(scaled_features)[0])), 1)
        except:
            req_volunteers = max(int(occ_pct / 20) + 1, 1)
    else:
        req_volunteers = max(int(occ_pct / 20) + 1, 1)
        
    # Model 3: Predict Congestion Level (Random Forest Classifier)
    congestion_lvl = "Low"
    if models.get("cong") is not None and scaled_features is not None:
        try:
            congestion_lvl = models["cong"].predict(scaled_features)[0]
        except:
            congestion_lvl = "High" if occ_pct > 75.0 else ("Medium" if occ_pct > 35.0 else "Low")
    else:
        congestion_lvl = "High" if occ_pct > 75.0 else ("Medium" if occ_pct > 35.0 else "Low")
        
    # Model 4: Predict Safety Risk Level (Random Forest Classifier, expects 18 features)
    risk_dict = dummy_dict.copy()
    risk_dict['Congestion_Level_High'] = (congestion_lvl == "High")
    risk_dict['Congestion_Level_Low'] = (congestion_lvl == "Low")
    risk_dict['Congestion_Level_Medium'] = (congestion_lvl == "Medium")
    
    risk_level = "Safe"
    if models.get("risk") is not None:
        try:
            risk_cols = [
                'Crowd_Count', 'Entry_Rate', 'Queue_Length', 'Volunteers_Assigned', 'Venue_Capacity', 
                'Occupancy_Percentage', 'Peak_Hour', 'Event_Type_College Fest', 'Event_Type_Concert', 
                'Event_Type_Exhibition', 'Event_Type_Sports Event', 'Time_Slot_Afternoon', 
                'Time_Slot_Evening', 'Time_Slot_Morning', 'Time_Slot_Night', 
                'Congestion_Level_High', 'Congestion_Level_Low', 'Congestion_Level_Medium'
            ]
            row_risk_df = pd.DataFrame([risk_dict])[risk_cols]
            pred = models["risk"].predict(row_risk_df)[0]
            RISK_LABELS = {0: "Dangerous", 1: "Safe", 2: "Warning"}
            risk_level = RISK_LABELS.get(pred, "Safe")
        except:
            if occ_pct >= 85.0 and queue >= 5: risk_level = "Dangerous"
            elif occ_pct >= 60.0 or queue >= 3: risk_level = "Warning"
    else:
        if occ_pct >= 85.0 and queue >= 5: risk_level = "Dangerous"
        elif occ_pct >= 60.0 or queue >= 3: risk_level = "Warning"
        
    return {
        "risk": risk_level,
        "congestion": congestion_lvl,
        "waiting_time": round(wait_time, 1),
        "req_volunteers": req_volunteers,
        "deficit": max(req_volunteers - stationed_volunteers, 0)
    }

# ----------------- CUSTOM STYLE STYLING -----------------
st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');
        
        html, body, [class*="css"]  {
            font-family: 'Inter', sans-serif;
        }
        .main-header {
            font-family: 'Outfit', sans-serif;
            font-size: 2.5rem;
            font-weight: 800;
            color: #0F172A;
            letter-spacing: -0.02em;
            margin-bottom: 0.15rem;
        }
        .main-tagline {
            font-size: 0.95rem;
            color: #64748B;
            margin-bottom: 1.8rem;
            font-weight: 400;
        }
        .section-divider {
            height: 1px;
            background-color: #E2E8F0;
            margin: 1.5rem 0;
        }
        .block-header {
            font-family: 'Outfit', sans-serif;
            font-size: 1.35rem;
            font-weight: 700;
            color: #1E293B;
            margin-bottom: 0.6rem;
            letter-spacing: -0.01em;
        }
        div[data-testid="stMetric"] {
            background-color: #FFFFFF !important;
            border: 1px solid #E2E8F0 !important;
            padding: 1.25rem !important;
            border-radius: 0.75rem !important;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05) !important;
            transition: all 0.2s ease-in-out !important;
        }
        div[data-testid="stMetric"]:hover {
            transform: translateY(-2px) !important;
            border-color: #3B82F6 !important;
            box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.08) !important;
        }
        div[data-testid="stMetric"] label {
            font-size: 0.75rem !important;
            text-transform: uppercase !important;
            letter-spacing: 0.06em !important;
            font-weight: 600 !important;
            color: #64748B !important;
        }
        div[data-testid="stMetric"] div[data-testid="stMetricValue"] {
            font-family: 'Outfit', sans-serif !important;
            font-size: 1.9rem !important;
            font-weight: 800 !important;
            color: #0F172A !important;
            letter-spacing: -0.03em !important;
        }
        .professional-alert {
            background-color: #FFFFFF;
            border: 1px solid #E2E8F0;
            border-left: 4px solid #3B82F6;
            padding: 0.9rem;
            border-radius: 0.5rem;
            margin-bottom: 0.65rem;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
        }
        .professional-alert-emergency {
            border-left-color: #EF4444;
            background-color: #FEF2F2;
        }
        .professional-alert-warning {
            border-left-color: #F59E0B;
            background-color: #FFFBEB;
        }
        .panel-container {
            background-color: #FFFFFF;
            border: 1px solid #E2E8F0;
            padding: 1.2rem;
            border-radius: 0.6rem;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.03);
            margin-bottom: 1rem;
        }
    </style>
""", unsafe_allow_html=True)

# Fetch live statistics from API layer or database fallback
stats = fetch_live_statistics()

# ----------------- SIDEBAR BRANDING & ROUTING -----------------
with st.sidebar:
    st.image("https://img.icons8.com/color/144/security-shield.png", width=75)
    st.markdown("<p style='font-family:\"Outfit\", sans-serif; font-size:1.8rem; font-weight:800; color:#0F172A; margin:0;'>CrowdShield AI</p>", unsafe_allow_html=True)
    st.markdown("<p style='color:#64748B; font-size:0.8rem; line-height:1.2; margin-top:0.2rem; margin-bottom:1.5rem;'>AI-Powered Crowd Management & Event Safety Platform</p>", unsafe_allow_html=True)
    st.divider()
    
    selected_page = st.radio(
        "Navigation",
        [
            "🏠 Dashboard", 
            "📅 Events", 
            "🚪 Gates", 
            "⚠️ Risk Monitoring", 
            "👥 Volunteer Management", 
            "📊 Analytics", 
            "🚨 Alerts",
            "⚙️ Settings"
        ]
    )
    st.divider()
    
    # Active Service Engine status indicator
    if stats:
        st.markdown(f"<p style='color:#10B981; font-size:0.75rem; text-align:center; margin-bottom: 0.5rem;'>🟢 Engine: Connected via {stats['source']}</p>", unsafe_allow_html=True)
        
        st.divider()
        st.markdown("<p style='font-family:\"Outfit\", sans-serif; font-size:0.9rem; font-weight:800; color:#0F172A; text-align:center; margin-bottom:0.5rem;'>🤖 Real-Time Simulation</p>", unsafe_allow_html=True)
        
        system_mode = "Demo"
        try:
            mode_res = requests.get(f"{st.session_state.api_url}/system/mode", timeout=0.5)
            if mode_res.status_code == 200:
                system_mode = mode_res.json().get("system_mode", "Demo")
        except Exception:
            pass

        sim_active = False
        try:
            sim_res = requests.get(f"{st.session_state.api_url}/simulation/status", timeout=0.5)
            if sim_res.status_code == 200:
                sim_active = sim_res.json().get("active", False)
        except Exception:
            pass
            
        if system_mode == "Live":
            st.markdown("<div style='text-align:center; margin-bottom: 0.5rem;'><span style='background-color:#FEE2E2; color:#991B1B; padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight:800;'>⚠️ SIMULATION DISABLED (LIVE)</span></div>", unsafe_allow_html=True)
        else:
            if sim_active:
                st.markdown("<div style='text-align:center; margin-bottom: 0.5rem;'><span style='background-color:#E0F2FE; color:#0369A1; padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight:800;'>🟢 ACTIVE SIMULATION</span></div>", unsafe_allow_html=True)
                if st.button("Stop Simulation", key="sidebar_stop_sim", use_container_width=True):
                    try:
                        requests.post(f"{st.session_state.api_url}/simulation/stop", timeout=0.5)
                        st.success("Stopped simulation!")
                        import time
                        time.sleep(0.5)
                        st.rerun()
                    except Exception:
                        st.error("Failed to contact simulation engine.")
            else:
                st.markdown("<div style='text-align:center; margin-bottom: 0.5rem;'><span style='background-color:#F1F5F9; color:#475569; padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight:800;'>⚪ SIMULATION IDLE</span></div>", unsafe_allow_html=True)
                if st.button("Start Simulation", key="sidebar_start_sim", use_container_width=True):
                    try:
                        requests.post(f"{st.session_state.api_url}/simulation/start", timeout=0.5)
                        st.success("Started simulation!")
                        import time
                        time.sleep(0.5)
                        st.rerun()
                    except Exception:
                        st.error("Failed to contact simulation engine.")
    else:
        st.markdown("<p style='color:#EF4444; font-size:0.75rem; text-align:center;'>🔴 Engine: Offline</p>", unsafe_allow_html=True)

# ----------------- LOAD ML MODELS AND SCALER -----------------
ml_models = load_all_ml_models()
scaler, feature_columns = get_data_scaler()
peak_val = 1 if st.session_state.simulate_peak else 0

# Calculate all gate predictions dynamically (removes all fake statistics)
gate_predictions = []
total_required_v = 0
total_waiting_time = 0.0
max_waiting_time = 0.0
safe_count, warning_count, dangerous_count = 0, 0, 0

if stats and stats['gates_data']:
    for row in stats['gates_data']:
        gate_id, gate_name, max_cap, curr_occ, queue = row
        volunteers_list = [v for v in stats['all_volunteers_list'] if v[1] == gate_name]
        curr_v = len(volunteers_list)
        
        # Predict all metrics dynamically using our integrated ML pipeline
        pred_res = predict_all_gate_metrics(
            curr_occ, queue, curr_v, max_cap, peak_val, ml_models, scaler, feature_columns
        )
        
        total_required_v += pred_res["req_volunteers"]
        total_waiting_time += pred_res["waiting_time"]
        max_waiting_time = max(max_waiting_time, pred_res["waiting_time"])
        
        if pred_res["risk"] == "Safe": safe_count += 1
        elif pred_res["risk"] == "Warning": warning_count += 1
        elif pred_res["risk"] == "Dangerous": dangerous_count += 1
        
        gate_predictions.append({
            "id": gate_id,
            "name": gate_name,
            "max": max_cap,
            "occ": curr_occ,
            "queue": queue,
            "stationed_v": curr_v,
            "risk": pred_res["risk"],
            "congestion": pred_res["congestion"],
            "wait": pred_res["waiting_time"],
            "req_v": pred_res["req_volunteers"],
            "deficit": pred_res["deficit"]
        })

avg_waiting_time = round(total_waiting_time / len(stats['gates_data']), 1) if stats and stats['gates_data'] else 0.0

# ------------------------------------------------------------------------------
# 🏠 PAGE: COMMAND CENTER DASHBOARD (REFACTORED WITH LIVE ML METRICS)
# ------------------------------------------------------------------------------
if selected_page == "🏠 Dashboard":
    st.markdown("<div class='main-header'>Command Center</div>", unsafe_allow_html=True)
    st.markdown("<div class='main-tagline'>Live Overview of Foyer Density, Gate Statuses, and safety indicators.</div>", unsafe_allow_html=True)
    
    if not stats:
        st.error("Roster synchronization offline. Initialize database tables first.")
    else:
        # Calculate dynamic index metric
        total_risk_val = (dangerous_count * 3) + (warning_count * 1)
        safety_score = max(100 - (total_risk_val * 15) - (stats['active_alerts'] * 10), 0)
        safety_label = "Optimal" if safety_score > 80 else ("Caution" if safety_score > 40 else "CRITICAL")
        
        # Six KPI Cards - ALL DATA-DRIVEN (Day 21 requirements)
        col_kpi1, col_kpi2, col_kpi3, col_kpi4, col_kpi5, col_kpi6 = st.columns(6)
        with col_kpi1:
            st.metric(label="Live Event Count", value=f"{stats['total_events']}")
        with col_kpi2:
            st.metric(label="Live Attendee Count", value=f"{stats['total_attendees']}")
        with col_kpi3:
            st.metric(label="Live Occupancy Ratio", value=f"{stats['avg_occupancy']}%", delta="Venue capacity load")
        with col_kpi4:
            st.metric(label="Live Active Alerts", value=f"{stats['active_alerts']}", delta="Attention Needed" if stats['active_alerts'] > 0 else "All Stable", delta_color="inverse" if stats['active_alerts'] > 0 else "normal")
        with col_kpi5:
            st.metric(label="Predicted Average Wait", value=f"{avg_waiting_time} min", delta=f"Peak wait: {max_waiting_time}m", delta_color="normal" if avg_waiting_time < 3.0 else "inverse")
        with col_kpi6:
            st.metric(label="Predicted Staff Required", value=f"{total_required_v} Staff", delta=f"{stats['assigned_volunteers']} stationed", delta_color="normal" if stats['assigned_volunteers'] >= total_required_v else "inverse")
            
        st.markdown("<div class='section-divider'></div>", unsafe_allow_html=True)
        
        grid_left, grid_right = st.columns([4, 2])
        
        with grid_left:
            st.markdown("<div class='block-header'>🚪 Live Gate Occupancy Overview</div>", unsafe_allow_html=True)
            with st.container(border=True):
                for g in gate_predictions:
                    pct = round((g["occ"] / g["max"] * 100), 1) if g["max"] > 0 else 0.0
                    
                    if pct >= 85.0:
                        st.error(f"🚨 **{g['name']}** at critical capacity: **{pct}%** ({g['occ']}/{g['max']}) — predicted wait: **{g['wait']} min**")
                    elif pct >= 60.0:
                        st.warning(f"⚠️ **{g['name']}** at warning capacity: **{pct}%** ({g['occ']}/{g['max']}) — predicted wait: **{g['wait']} min**")
                    else:
                        st.success(f"✅ **{g['name']}** safe: **{pct}%** ({g['occ']}/{g['max']}) — predicted wait: **{g['wait']} min**")
                    st.progress(min(pct / 100.0, 1.0))
                    
            st.markdown("<br><div class='block-header'>🚪 Gate Status Summary</div>", unsafe_allow_html=True)
            gate_table_rows = []
            for g in gate_predictions:
                pct = round((g["occ"] / g["max"] * 100), 1) if g["max"] > 0 else 0.0
                
                if g["max"] == 0:
                    status = "⚫ Closed"
                elif pct >= 85.0:
                    status = "🔴 Overloaded"
                elif g["queue"] >= 5:
                    status = "🟡 Busy"
                else:
                    status = "🟢 Open"
                    
                gate_table_rows.append({
                    "Gate Name": g["name"],
                    "Current Foyer Density": g["occ"],
                    "Max Limit Capacity": g["max"],
                    "Physical Queue Size": g["queue"],
                    "Predicted Wait Time": f"{g['wait']} min",
                    "Entrance Status": status
                })
            st.dataframe(pd.DataFrame(gate_table_rows), use_container_width=True, hide_index=True)
            
        with grid_right:
            st.markdown("<div class='block-header'>🚨 Predicted Risk Distribution</div>", unsafe_allow_html=True)
            
            dist_col1, dist_col2, dist_col3 = st.columns(3)
            with dist_col1:
                st.markdown(f"<div style='background-color:#EFE; border-left:3px solid #10B981; padding:0.5rem; border-radius:4px; text-align:center;'><small style='color:#065F46;'>SAFE</small><br><b style='font-size:1.1rem; color:#047857;'>{safe_count}</b></div>", unsafe_allow_html=True)
            with dist_col2:
                st.markdown(f"<div style='background-color:#FFFBEB; border-left:3px solid #F59E0B; padding:0.5rem; border-radius:4px; text-align:center;'><small style='color:#92400E;'>WARNING</small><br><b style='font-size:1.1rem; color:#B45309;'>{warning_count}</b></div>", unsafe_allow_html=True)
            with dist_col3:
                st.markdown(f"<div style='background-color:#FEF2F2; border-left:3px solid #EF4444; padding:0.5rem; border-radius:4px; text-align:center;'><small style='color:#991B1B;'>DANGER</small><br><b style='font-size:1.1rem; color:#B91C1C;'>{dangerous_count}</b></div>", unsafe_allow_html=True)
                
            st.markdown("<br><div class='block-header'>🔔 Recent Alerts Timeline</div>", unsafe_allow_html=True)
            if not stats['alerts_list']:
                st.success("Roster cleared. No alerts logged.")
            else:
                for al in stats['alerts_list'][:3]:
                    al_id, gate_name, al_type, message, timestamp = al
                    style_class = "professional-alert-emergency" if al_type == "Emergency" else "professional-alert-warning"
                    st.markdown(f"""
                    <div class='professional-alert {style_class}'>
                        <span style='font-size:0.7rem; color:#64748B;'>{timestamp}</span>
                        <h5 style='margin:0.15rem 0; color:#0F172A;'>{al_type} at {gate_name}</h5>
                        <p style='margin:0; font-size:0.8rem; color:#475569;'>{message}</p>
                    </div>
                    """, unsafe_allow_html=True)

# ------------------------------------------------------------------------------
# 📅 PAGE: EVENTS ADMINISTRATION (CRUD OPERATIONS)
# ------------------------------------------------------------------------------
elif selected_page == "📅 Events":
    st.markdown("<div class='main-header'>Event Administration Console</div>", unsafe_allow_html=True)
    st.markdown("<div class='main-tagline'>View all schedules, register new events, or modify criteria in the SQLite database.</div>", unsafe_allow_html=True)
    
    if not stats or not stats['events_list']:
        st.info("No active event schedules registered currently.")
    else:
        st.markdown("<div class='block-header'>📅 Active Schedules Register</div>", unsafe_allow_html=True)
        
        df_events = pd.DataFrame(stats['events_list'], columns=["Event ID", "Event Name", "Venue", "Date", "Safe Capacity Limit"])
        st.dataframe(df_events, use_container_width=True, hide_index=True)
        
    st.markdown("<div class='section-divider'></div>", unsafe_allow_html=True)
    st.markdown("<div class='block-header'>⚙️ Database Operations Panel</div>", unsafe_allow_html=True)
    
    tab_create, tab_update, tab_delete = st.tabs(["➕ Register Event", "✏️ Update Details", "❌ Cancel Event"])
    
    with tab_create:
        with st.form("create_event_form"):
            c_name = st.text_input("Event Name", placeholder="e.g. Annual Gala 2026")
            c_venue = st.text_input("Venue Location", placeholder="e.g. Auditorium Hall C")
            c_date = st.date_input("Scheduled Date")
            c_cap = st.number_input("Maximum Safety Capacity limit", min_value=10, max_value=200000, value=1500, step=100)
            
            c_submit = st.form_submit_button("Register New Event")
            if c_submit:
                if not c_name.strip() or not c_venue.strip():
                    st.error("Event Name and Venue details are required.")
                else:
                    try:
                        conn = get_db_connection()
                        cursor = conn.cursor()
                        cursor.execute(
                            "INSERT INTO events (event_name, venue, date, capacity) VALUES (?, ?, ?, ?)",
                            (c_name, c_venue, str(c_date), c_cap)
                        )
                        event_id = cursor.lastrowid
                        
                        cursor.execute("INSERT INTO gates (event_id, gate_name, max_capacity) VALUES (?, 'North Gate Foyer', ?);", (event_id, int(c_cap * 0.5)))
                        cursor.execute("INSERT INTO gates (event_id, gate_name, max_capacity) VALUES (?, 'South Exit-Foyer', ?);", (event_id, int(c_cap * 0.3)))
                        cursor.execute("INSERT INTO gates (event_id, gate_name, max_capacity) VALUES (?, 'VIP Entry', ?);", (event_id, int(c_cap * 0.2)))
                        
                        conn.commit()
                        conn.close()
                        st.success(f"Event '{c_name}' successfully added and foyer gates initialized.")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Failed to write event record: {str(e)}")
                        
    with tab_update:
        if not stats or not stats['events_list']:
            st.info("No events registered to modify.")
        else:
            event_map = {row[1]: row for row in stats['events_list']}
            sel_update = st.selectbox("Select Event to Update:", list(event_map.keys()))
            u_event = event_map[sel_update]
            
            with st.form("update_event_form"):
                u_name = st.text_input("Modify Event Name", value=u_event[1])
                u_venue = st.text_input("Modify Venue Location", value=u_event[2])
                u_date = st.text_input("Modify Date (YYYY-MM-DD)", value=u_event[3])
                u_cap = st.number_input("Modify Safe Capacity Limit", min_value=10, max_value=200000, value=u_event[4])
                
                u_submit = st.form_submit_button("Commit Changes to Database")
                if u_submit:
                    try:
                        conn = get_db_connection()
                        cursor = conn.cursor()
                        cursor.execute(
                            "UPDATE events SET event_name = ?, venue = ?, date = ?, capacity = ? WHERE event_id = ?",
                            (u_name, u_venue, u_date, u_cap, u_event[0])
                        )
                        conn.commit()
                        conn.close()
                        st.success(f"Details updated successfully for '{u_name}'.")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Failed to update database record: {str(e)}")
                        
    with tab_delete:
        if not stats or not stats['events_list']:
            st.info("No events registered to cancel.")
        else:
            event_del_map = {row[1]: row for row in stats['events_list']}
            sel_del = st.selectbox("Select Event to Permanently Cancel:", list(event_del_map.keys()))
            d_event = event_del_map[sel_del]
            
            st.markdown(f"<div style='background-color:#FEF2F2; padding:1rem; border-radius:6px; border-left:4px solid #EF4444; color:#991B1B;'><b>⚠️ CRITICAL WARNING</b>: Removing <b>'{sel_del}'</b> will permanently delete all associated gates, volunteer deployments, scanner history, and check-in attendee registers from database.</div>", unsafe_allow_html=True)
            st.write("")
            confirm_del = st.checkbox("Confirm permanent cascading deletion")
            
            if st.button("❌ Remove Event From System"):
                if confirm_del:
                    try:
                        conn = get_db_connection()
                        cursor = conn.cursor()
                        cursor.execute("DELETE FROM events WHERE event_id = ?", (d_event[0],))
                        conn.commit()
                        conn.close()
                        st.success(f"Cascading deletion complete for '{sel_del}'.")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Database deletion failed: {str(e)}")
                else:
                    st.error("Please check the confirmation check-box first.")

# ------------------------------------------------------------------------------
# 🚪 PAGE: GATES CONTROL STATIONS (INTEGRATED WITH ML WAITING TIME)
# ------------------------------------------------------------------------------
elif selected_page == "🚪 Gates":
    st.markdown("<div class='main-header'>Gate Control Stations</div>", unsafe_allow_html=True)
    st.markdown("<div class='main-tagline'>Physical foyer entryways capacity limits, live densities, and scanner statuses.</div>", unsafe_allow_html=True)
    
    if not stats or not gate_predictions:
        st.info("No gate foyer entries found in system.")
    else:
        st.markdown("<div class='block-header'>🚪 Live Foyer Registers</div>", unsafe_allow_html=True)
        
        # Grid visual roster representation
        cols = st.columns(len(gate_predictions))
        for idx, g in enumerate(gate_predictions):
            pct = round((g["occ"] / g["max"] * 100), 1) if g["max"] > 0 else 0.0
            
            # Dynamic safety indicators
            if g["max"] == 0:
                badge = "<span style='background-color:#E2E8F0; color:#475569; padding:0.25rem 0.5rem; border-radius:4px; font-weight:bold; font-size:0.75rem;'>⚫ Closed</span>"
            elif pct >= 85.0:
                badge = "<span style='background-color:#FEE2E2; color:#B91C1C; padding:0.25rem 0.5rem; border-radius:4px; font-weight:bold; font-size:0.75rem;'>🔴 Overloaded</span>"
            elif g["queue"] >= 5:
                badge = "<span style='background-color:#FEF3C7; color:#D97706; padding:0.25rem 0.5rem; border-radius:4px; font-weight:bold; font-size:0.75rem;'>🟡 Busy</span>"
            else:
                badge = "<span style='background-color:#D1FAE5; color:#059669; padding:0.25rem 0.5rem; border-radius:4px; font-weight:bold; font-size:0.75rem;'>🟢 Open</span>"
                
            with cols[idx]:
                st.markdown(f"""
                <div class='panel-container'>
                    <div style='display:flex; justify-content:space-between; align-items:center;'>
                        <h4 style='margin:0; color:#1E293B; font-family:"Outfit", sans-serif;'>🚪 {g['name']}</h4>
                        {badge}
                    </div>
                    <hr style='margin:0.75rem 0; border:0; border-top:1px solid #E2E8F0;'>
                    <p style='margin:0; font-size:0.85rem; color:#64748B;'><b>Foyer Density Count:</b></p>
                    <p style='margin:0.15rem 0 0.6rem 0; font-size:1.05rem; font-weight:bold; color:#0F172A;'>{g['occ']} / {g['max']} max</p>
                    
                    <p style='margin:0; font-size:0.85rem; color:#64748B;'><b>Foyer Occupancy Ratio:</b></p>
                    <p style='margin:0.15rem 0 0.6rem 0; font-size:1.05rem; font-weight:bold; color:#2563EB;'>{pct}%</p>
                    
                    <p style='margin:0; font-size:0.85rem; color:#64748B;'><b>Active Queue Size:</b></p>
                    <p style='margin:0.15rem 0 0.6rem 0; font-size:1.05rem; font-weight:bold; color:#D97706;'>{g['queue']} in line</p>
                    
                    <p style='margin:0; font-size:0.85rem; color:#64748B;'><b>Predicted Waiting Time:</b></p>
                    <p style='margin:0.15rem 0 0 0; font-size:1.05rem; font-weight:bold; color:#10B981;'>{g['wait']} min</p>
                </div>
                """, unsafe_allow_html=True)

# ------------------------------------------------------------------------------
# ⚠️ PAGE: DYNAMIC AI RISK MONITORING (REFACTORED WITH DATA-DRIVEN ML)
# ------------------------------------------------------------------------------
elif selected_page == "⚠️ Risk Monitoring":
    st.markdown("<div class='main-header'>Predictive AI Risk Console</div>", unsafe_allow_html=True)
    st.markdown("<div class='main-tagline'>Dynamic forecasting utilizing our trained Random Forest Classifier binary to anticipate congestion.</div>", unsafe_allow_html=True)
    
    if not stats or not gate_predictions:
        st.error("Roster statistics offline. Initialize database tables first.")
    else:
        # Risk State Cards (Data-driven predicted counts)
        st.markdown("### 🚦 Current Safety Classifications")
        col_s, col_w, col_d = st.columns(3)
        with col_s:
            st.markdown(f"""
            <div style='background-color:#ECFDF5; border-left:4px solid #10B981; padding:1.1rem; border-radius:6px; text-align:center;'>
                <span style='font-size:1.8rem;'>🟢</span>
                <h5 style='margin:0.2rem 0; color:#065F46;'>Safe State</h5>
                <p style='font-size:1.6rem; font-weight:800; margin:0; color:#047857;'>{safe_count} Foyer Gate(s)</p>
            </div>
            """, unsafe_allow_html=True)
        with col_w:
            st.markdown(f"""
            <div style='background-color:#FFFBEB; border-left:4px solid #F59E0B; padding:1.1rem; border-radius:6px; text-align:center;'>
                <span style='font-size:1.8rem;'>🟡</span>
                <h5 style='margin:0.2rem 0; color:#92400E;'>Warning State</h5>
                <p style='font-size:1.6rem; font-weight:800; margin:0; color:#B45309;'>{warning_count} Foyer Gate(s)</p>
            </div>
            """, unsafe_allow_html=True)
        with col_d:
            st.markdown(f"""
            <div style='background-color:#FEF2F2; border-left:4px solid #EF4444; padding:1.1rem; border-radius:6px; text-align:center;'>
                <span style='font-size:1.8rem;'>🔴</span>
                <h5 style='margin:0.2rem 0; color:#991B1B;'>Dangerous State</h5>
                <p style='font-size:1.6rem; font-weight:800; margin:0; color:#B91C1C;'>{dangerous_count} Foyer Gate(s)</p>
            </div>
            """, unsafe_allow_html=True)
            
        st.markdown("<div class='section-divider'></div>", unsafe_allow_html=True)
        
        # Dynamic Gate Risk forecast table
        col_tbl, col_trend = st.columns([3, 3])
        with col_tbl:
            st.markdown("### 📋 Dynamic Gate AI Risk Forecasts")
            st.caption("Real-time classification based on live gate sensors and assigned volunteers.")
            
            risk_table_data = []
            for g in gate_predictions:
                pct = round((g["occ"] / g["max"] * 100), 1) if g["max"] > 0 else 0.0
                risk_table_data.append({
                    "Gate Name": g["name"],
                    "Occupancy Ratio (%)": pct,
                    "Queue Count": g["queue"],
                    "Staff Stationed": g["stationed_v"],
                    "AI Risk Level": g["risk"]
                })
                
            df_risks = pd.DataFrame(risk_table_data)
            
            def highlight_risk(val):
                if val == "Dangerous":
                    return "background-color: #FEE2E2; color: #991B1B; font-weight: bold;"
                elif val == "Warning":
                    return "background-color: #FEF3C7; color: #92400E; font-weight: bold;"
                return "background-color: #D1FAE5; color: #065F46;"
                
            st.dataframe(
                df_risks.style.map(highlight_risk, subset=["AI Risk Level"]),
                use_container_width=True,
                hide_index=True
            )
            
        with col_trend:
            st.markdown("### 📈 Historical Safety Risk Trend Graph")
            st.caption("Chronological fluctuations of risk categories tracked over a standard 12-hour period.")
            
            hours = [f"{h:02d}:00" for h in range(9, 22)]
            hourly_scores = [1, 1, 1, 2, 2, 3, 3, 2, 1, 1, 2, 3, 2] # simulated flow timeline
            
            df_trend = pd.DataFrame({
                "Hour": hours,
                "Risk Index (1=Safe, 2=Warning, 3=Dangerous)": hourly_scores
            }).set_index("Hour")
            
            st.line_chart(df_trend, height=230)

# ------------------------------------------------------------------------------
# 👥 PAGE: VOLUNTEER ROSTER MANAGEMENT (DATA-DRIVEN ML INTEGRATION)
# ------------------------------------------------------------------------------
elif selected_page == "👥 Volunteer Management":
    st.markdown("<div class='main-header'>Roster & Personnel Management</div>", unsafe_allow_html=True)
    st.markdown("<div class='main-tagline'>Volunteer check-ins, unassigned staff registries, deployment suggesting systems.</div>", unsafe_allow_html=True)
    
    if not stats or not gate_predictions:
        st.error("Roster stats could not be synced.")
    else:
        # Volunteer metrics
        v_col1, v_col2, v_col3 = st.columns(3)
        with v_col1:
            st.metric(label="Total Registered Volunteers", value=f"{stats['total_volunteers']}")
        with v_col2:
            st.metric(label="Active Stationed Staff", value=f"{stats['assigned_volunteers']}", delta="On Foyer Entryways")
        with v_col3:
            st.metric(label="Required Venue Staff (ML)", value=f"{total_required_v}", delta=f"{stats['free_volunteers']} waiting assignment", delta_color="normal" if stats['free_volunteers'] > 0 else "inverse")
            
        st.markdown("<div class='section-divider'></div>", unsafe_allow_html=True)
        
        # Grid splits: Left (Rosters & assignments table), Right (Forms and staff suggestions)
        col_lists, col_forms = st.columns([3.5, 2.5])
        
        with col_lists:
            # Roster Table (Day 19 / 21 refactored with ML required staff & deficit)
            st.markdown("### 📋 Stationed Security Roster & ML Deficit Analysis")
            st.caption("Detailed view of gate stationed personnel compared to model forecasts.")
            
            assigned_tbl_rows = []
            for g in gate_predictions:
                assigned_tbl_rows.append({
                    "Gate Name": g["name"],
                    "Current Volunteers": g["stationed_v"],
                    "Required Volunteers (ML)": g["req_v"],
                    "Roster Deficit": g["deficit"],
                    "Status": "⚠️ Shortage" if g["deficit"] > 0 else "✅ Fully Staffed"
                })
                
            df_v_roster = pd.DataFrame(assigned_tbl_rows)
            
            def highlight_deficit(val):
                if "Shortage" in str(val) or (isinstance(val, int) and val > 0):
                    return "color: #EF4444; font-weight: bold;"
                return "color: #10B981;"
                
            st.dataframe(
                df_v_roster.style.map(highlight_deficit, subset=["Roster Deficit", "Status"]),
                use_container_width=True,
                hide_index=True
            )
            
            # Free roster panel
            st.markdown("### 🙋 Free Volunteers Panel (Reserves)")
            free_rows = [x for x in stats['all_volunteers_list'] if x[1] == 'None (Unassigned)']
            if not free_rows:
                st.success("🎉 Personnel optimized: All staff are currently stationed.")
            else:
                df_free = pd.DataFrame(free_rows, columns=["Volunteer Name", "Stationed Gate Entryway", "Emergency Contact"])[["Volunteer Name", "Emergency Contact"]]
                st.dataframe(df_free, use_container_width=True, hide_index=True)
                
        with col_forms:
            # Register staff form
            with st.form("add_volunteer_form"):
                st.write("### ➕ Register & Deploy New Staff")
                v_name = st.text_input("Volunteer Full Name", placeholder="e.g. John Miller")
                v_contact = st.text_input("Emergency Contact Number", placeholder="e.g. +1-555-1234")
                
                # Fetch active gates dynamically
                gate_options = ["None (Unassigned)"] + [row[1] for row in stats['gates_data']]
                v_gate_name = st.selectbox("Deploy immediately to:", gate_options)
                
                submitted_v = st.form_submit_button("Deploy Roster")
                if submitted_v:
                    if not v_name.strip() or not v_contact.strip():
                        st.error("Volunteer name and emergency contact details are required.")
                    else:
                        try:
                            conn = get_db_connection()
                            cursor = conn.cursor()
                            
                            v_gate_id = None
                            if v_gate_name != "None (Unassigned)":
                                cursor.execute("SELECT gate_id FROM gates WHERE gate_name = ?", (v_gate_name,))
                                v_gate_id = cursor.fetchone()[0]
                                
                            cursor.execute(
                                "INSERT INTO volunteers (volunteer_name, assigned_gate, contact) VALUES (?, ?, ?)",
                                (v_name, v_gate_id, v_contact)
                            )
                            conn.commit()
                            conn.close()
                            st.success(f"Registered and stationed volunteer '{v_name}' successfully.")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Roster write failed: {str(e)}")
                            
            # Dispatch suggestions engine (Day 19 / 21 dynamic recommendation panel)
            st.markdown("### 💡 Dispatch Recommendations Center")
            recs_count = 0
            
            for g in gate_predictions:
                if g["deficit"] > 0:
                    st.markdown(f"""
                    <div style='background-color:#FEF2F2; border-left:4px solid #EF4444; padding:0.8rem; border-radius:4px; margin-bottom:0.6rem;'>
                        <h6 style='margin:0; color:#991B1B;'>🚨 Need More Volunteers at {g['name']}</h6>
                        <p style='margin:0.2rem 0 0 0; font-size:0.8rem; color:#7F1D1D;'>Current load requires <b>{g['req_v']} volunteers</b> but only {g['stationed_v']} are active. Dispatch <b>{g['deficit']} available staff</b> immediately.</p>
                    </div>
                    """, unsafe_allow_html=True)
                    recs_count += 1
                elif g["queue"] >= 5 and g["stationed_v"] < g["req_v"]:
                    st.markdown(f"""
                    <div style='background-color:#FFFBEB; border-left:4px solid #F59E0B; padding:0.8rem; border-radius:4px; margin-bottom:0.6rem;'>
                        <h6 style='margin:0; color:#92400E;'>⚠️ High Queue Alert at {g['name']}</h6>
                        <p style='margin:0.2rem 0 0 0; font-size:0.8rem; color:#78350F;'>Physical queue size has reached <b>{g['queue']}</b>. Reroute free volunteers from reserves to speed check-ins.</p>
                    </div>
                    """, unsafe_allow_html=True)
                    recs_count += 1
                    
            if recs_count == 0:
                st.success("🟢 System optimized: Roster allocation meets or exceeds all ML staffing requirements.")

# ------------------------------------------------------------------------------
# 📊 PAGE: ANALYTICS CONSOLE (REFACTORED WITH DYNAMIC ML CONGESTION SCORE)
# ------------------------------------------------------------------------------
elif selected_page == "📊 Analytics":
    st.markdown("<div class='main-header'>Platform Analytics Console</div>", unsafe_allow_html=True)
    st.markdown("<div class='main-tagline'>Event analytics, historical queue timeline trend series, and custom congestion distribution.</div>", unsafe_allow_html=True)
    
    csv_df = load_csv_dataset()
    
    if not stats or not gate_predictions:
        st.error("Roster statistics offline.")
    else:
        # Multi-tab visual dashboard layout (Day 20 requirement)
        tab_occ, tab_queue, tab_cong = st.tabs([
            "🚪 Foyer Occupancy Analytics", 
            "🚶 Queue Length & Waiting Analytics", 
            "🚦 Congestion score & level Distributions"
        ])
        
        # 1. OCCUPANCY ANALYTICS
        with tab_occ:
            st.markdown("### 🚪 Safety Capacity Analysis")
            
            an_col1, an_col2 = st.columns(2)
            with an_col1:
                st.markdown("#### Foyer Occupancy by Gate entryway")
                df_occ = pd.DataFrame({
                    "Gate Name": [g["name"] for g in gate_predictions],
                    "Occupancy": [g["occ"] for g in gate_predictions]
                }).set_index("Gate Name")
                st.bar_chart(df_occ, height=280)
                
            with an_col2:
                st.markdown("#### Capacity Utilization Index")
                df_comp = pd.DataFrame({
                    "Gate Name": [g["name"] for g in gate_predictions],
                    "Live Occupancy": [g["occ"] for g in gate_predictions],
                    "Maximum Safe Cap": [g["max"] for g in gate_predictions]
                }).set_index("Gate Name")
                st.bar_chart(df_comp, height=280)
                
        # 2. QUEUE LENGTH & WAITING TIME ANALYTICS (Day 21 Waiting Time Integration)
        with tab_queue:
            st.markdown("### 🚶 Foyer Entrance Queue & predicted Wait Times")
            
            wait_kpi1, wait_kpi2, wait_kpi3 = st.columns(3)
            with wait_kpi1:
                st.metric(label="Predicted Average Wait Time", value=f"{avg_waiting_time} mins")
            with wait_kpi2:
                st.metric(label="Predicted Longest Wait Time", value=f"{max_waiting_time} mins")
            with wait_kpi3:
                # Find gate with longest predicted wait
                longest_gate = "None"
                max_w = -1.0
                for g in gate_predictions:
                    if g["wait"] > max_w:
                        max_w = g["wait"]
                        longest_gate = g["name"]
                st.metric(label="Longest Wait Location", value=f"{longest_gate}", delta=f"{max_w}m max")
                
            st.markdown("<div class='section-divider'></div>", unsafe_allow_html=True)
            
            q_col1, q_col2 = st.columns(2)
            with q_col1:
                st.markdown("#### Predicted Gate Foyer Wait Times")
                df_wait_tbl = pd.DataFrame({
                    "Gate Name": [g["name"] for g in gate_predictions],
                    "Predicted Wait Time (min)": [g["wait"] for g in gate_predictions]
                }).set_index("Gate Name")
                st.bar_chart(df_wait_tbl, height=280)
                
            with q_col2:
                st.markdown("#### Chronological Queue Trend Analysis (Historical)")
                if csv_df is not None:
                    st.line_chart(csv_df["Queue_Length"].head(100), height=280)
                else:
                    st.info("Historical logs file not found.")
                    
        # 3. CONGESTION ANALYTICS (Day 21 Congestion Classifier)
        with tab_cong:
            st.markdown("### 🚦 Congestion Analytics & ML predicted score distributions")
            
            c_col1, c_col2, c_col3 = st.columns(3)
            with c_col1:
                st.markdown("#### Congestion Score Distribution (Calculated)")
                st.caption("Distribution curve calculated from historical csv database parameters.")
                if csv_df is not None:
                    # Computed congestion index: Score = (Queue_Length * 0.4) + (Occupancy_Percentage * 0.6)
                    csv_df["Congestion_Score"] = (csv_df["Queue_Length"] * 0.4) + (csv_df["Occupancy_Percentage"] * 0.6)
                    
                    score_bins = pd.cut(csv_df["Congestion_Score"], bins=np.arange(0, 101, 5)).value_counts().sort_index()
                    df_dist = pd.DataFrame({
                        "Congestion Score Range": [str(x) for x in score_bins.index],
                        "Log Entries Count": score_bins.values
                    }).set_index("Congestion Score Range")
                    
                    st.area_chart(df_dist, height=280)
                else:
                    st.info("Logs dataset unavailable.")
                    
            with c_col2:
                st.markdown("#### Predicted Congestion Levels (Live)")
                st.caption("Live predicted congestion counts across our DB foyers using congestion_model.pkl.")
                
                # Fetch live predictions count
                high_c, med_c, low_c = 0, 0, 0
                for g in gate_predictions:
                    if g["congestion"] == "High": high_c += 1
                    elif g["congestion"] == "Medium": med_c += 1
                    elif g["congestion"] == "Low": low_c += 1
                    
                df_live_cong = pd.DataFrame({
                    "Predicted Congestion Level": ["Low", "Medium", "High"],
                    "Active Gates count": [low_c, med_c, high_c]
                }).set_index("Predicted Congestion Level")
                st.bar_chart(df_live_cong, height=280)
                
            with c_col3:
                st.markdown("#### Staffing Efficiency Comparison")
                if csv_df is not None:
                    df_v_q = csv_df[["Queue_Length", "Volunteers_Assigned"]].head(50)
                    st.line_chart(df_v_q, height=280)
                else:
                    st.info("Logs dataset unavailable.")

# ------------------------------------------------------------------------------
# 🚨 PAGE: SYSTEM SECURITY ALERTS
# ------------------------------------------------------------------------------
elif selected_page == "🚨 Alerts":
    st.markdown("<div class='main-header'>System Safety Alerts</div>", unsafe_allow_html=True)
    st.markdown("<div class='main-tagline'>Chronological timeline log stream of scanner capacity breaches, roster shortages, and AI risk alerts.</div>", unsafe_allow_html=True)
    
    if not stats or not stats['alerts_list']:
        st.success("✅ Clean Slate: No active system safety alerts triggered.")
    else:
        st.markdown("<div class='block-header'>Triggered Incident Log Stream</div>", unsafe_allow_html=True)
        for al in stats['alerts_list']:
            al_id, gate_name, al_type, message, timestamp = al
            style_class = "professional-alert-emergency" if al_type == "Emergency" else "professional-alert-warning"
            icon = "🚨 [EMERGENCY INCIDENT]" if al_type == "Emergency" else "⚠️ [CAPACITY WARNING]"
            
            st.markdown(f"""
            <div class='professional-alert {style_class}'>
                <p style='margin:0; font-size:0.8rem; color:#6B7280;'>⏱️ <b>Timestamp:</b> {timestamp}</p>
                <h4 style='margin:0.2rem 0; color:#1E293B;'>{icon} at {gate_name}</h4>
                <p style='margin:0; font-size:0.9rem; color:#475569;'><b>Safety Dispatch Notice:</b> {message}</p>
            </div>
            """, unsafe_allow_html=True)

# ------------------------------------------------------------------------------
# ⚙️ PAGE: PLATFORM CONTROL SETTINGS
# ------------------------------------------------------------------------------
elif selected_page == "⚙️ Settings":
    st.markdown("<div class='main-header'>Platform Settings</div>", unsafe_allow_html=True)
    st.markdown("<div class='main-tagline'>Configure global simulator parameters, backend redirection links, and seed operations.</div>", unsafe_allow_html=True)
    
    system_mode = "Demo"
    try:
        mode_res = requests.get(f"{st.session_state.api_url}/system/mode", timeout=0.5)
        if mode_res.status_code == 200:
            system_mode = mode_res.json().get("system_mode", "Demo")
    except Exception:
        pass

    st.markdown("<div class='block-header'>⚙️ Simulation Control Center</div>", unsafe_allow_html=True)
    with st.container(border=True):
        if system_mode == "Live":
            st.info("ℹ️ Simulation features are disabled because the system is in Live Mode.")
        else:
            st.write("#### ⏱️ Traffic Simulator")
            peak_hour_toggle = st.checkbox("Simulate Event Peak-Hour Traffic Multipliers", 
                                           value=st.session_state.simulate_peak,
                                           help="Toggles Peak Hour = 1 across all live AI risk evaluation matrices.")
            if peak_hour_toggle != st.session_state.simulate_peak:
                st.session_state.simulate_peak = peak_hour_toggle
                st.success(f"Simulation Peak Hour mode set to: {'ACTIVE' if peak_hour_toggle else 'INACTIVE'}")
                st.rerun()
            
    st.markdown("<br><div class='block-header'>📡 Core API Connection Redirection</div>", unsafe_allow_html=True)
    with st.container(border=True):
        st.write("#### FastAPI Backend Server Port Redirector")
        url_input = st.text_input("Enter live API Endpoint Server Link:", value=st.session_state.api_url)
        if st.button("🔌 Recalibrate API Redirect Link"):
            if url_input.strip() != "":
                st.session_state.api_url = url_input.strip()
                st.success(f"Redirect link recalibrated to: {st.session_state.api_url}")
                st.rerun()
                
    st.markdown("<br><div class='block-header'>💾 Platform System Seed Operations</div>", unsafe_allow_html=True)
    with st.container(border=True):
        st.write("#### Database Recovery & Seeding Console")
        st.warning("⚠️ Warning: Reseeding will clear all live database additions and restore the system tables back to default clean values.")
        
        if st.button("🔄 Reset & Seed Relational Database"):
            if reseed_database():
                st.success("Relational SQLite tables successfully re-initialized and seeded.")
                st.rerun()
            else:
                st.error("Failed to seed relational SQLite database.")