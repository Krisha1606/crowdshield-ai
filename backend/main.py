# main.py
# This is the entry point for the FastAPI application of CrowdShield AI.
# In Day 14, we connect ML models with FastAPI for real-time risk prediction.

import os
import sqlite3
import joblib
import numpy as np
import pandas as pd
import json
import uuid
from fastapi import FastAPI, HTTPException, Depends, Header, File, UploadFile, Form, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt
import bcrypt
from datetime import datetime, timedelta
from sklearn.preprocessing import StandardScaler
from backend.database import get_connection
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend")

def add_volunteer_notification(cursor, volunteer_id, notif_type, title, message, related_id=None):
    """Inserts a notification for a volunteer if a duplicate unread one doesn't exist."""
    if related_id is not None:
        cursor.execute("""
            SELECT notification_id FROM volunteer_notifications 
            WHERE volunteer_id = ? AND related_id = ? AND status = 'Unread' AND notification_type = ?
        """, (volunteer_id, related_id, notif_type))
        if cursor.fetchone():
            return
    else:
        cursor.execute("""
            SELECT notification_id FROM volunteer_notifications 
            WHERE volunteer_id = ? AND title = ? AND message = ? AND status = 'Unread'
        """, (volunteer_id, title, message))
        if cursor.fetchone():
            return
            
    cursor.execute("""
        INSERT INTO volunteer_notifications (volunteer_id, notification_type, title, message, related_id, status)
        VALUES (?, ?, ?, ?, ?, 'Unread')
    """, (volunteer_id, notif_type, title, message, related_id))

# ---- LOAD ML MODELS AND PREPROCESSING AT STARTUP ----
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "notebooks")

# Load models (will fail loudly if any required pickle is missing)
risk_model = joblib.load(os.path.join(MODEL_DIR, "risk_model.pkl"))
congestion_model = joblib.load(os.path.join(MODEL_DIR, "congestion_model.pkl"))
waiting_time_model = joblib.load(os.path.join(MODEL_DIR, "waiting_time_model.pkl"))
volunteer_model = joblib.load(os.path.join(MODEL_DIR, "volunteer_model.pkl"))
congestion_score_model = joblib.load(os.path.join(MODEL_DIR, "congestion_score_model.pkl"))

# Load optional cluster models if present (prefer crowd_cluster_model.pkl to match cluster_scaler.pkl)
cluster_model_path = os.path.join(MODEL_DIR, "crowd_cluster_model.pkl")
if not os.path.exists(cluster_model_path):
    cluster_model_path = os.path.join(MODEL_DIR, "cluster_model.pkl")
cluster_scaler_path = os.path.join(MODEL_DIR, "cluster_scaler.pkl")
cluster_model = joblib.load(cluster_model_path) if os.path.exists(cluster_model_path) else None
cluster_scaler = joblib.load(cluster_scaler_path) if os.path.exists(cluster_scaler_path) else None

# Load scalers
risk_scaler = joblib.load(os.path.join(MODEL_DIR, "risk_scaler.pkl"))
congestion_scaler = joblib.load(os.path.join(MODEL_DIR, "congestion_scaler.pkl"))
waiting_time_scaler = joblib.load(os.path.join(MODEL_DIR, "waiting_time_scaler.pkl"))
volunteer_scaler = joblib.load(os.path.join(MODEL_DIR, "volunteer_scaler.pkl"))
congestion_score_scaler = joblib.load(os.path.join(MODEL_DIR, "congestion_score_scaler.pkl"))

# Load encoders
risk_label_encoder = joblib.load(os.path.join(MODEL_DIR, "risk_label_encoder.pkl"))
congestion_label_encoder = joblib.load(os.path.join(MODEL_DIR, "congestion_label_encoder.pkl"))



# JWT Config
SECRET_KEY = "CROWDSHIELD_AI_SECRET_KEY_FOR_JWT_TOKEN_GENERATION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 600

# Initialize the FastAPI application.
app = FastAPI(
    title="CrowdShield AI - API Backend",
    description="Backend API for CrowdShield AI crowd safety and congestion monitoring system.",
    version="1.3.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── LIVE MODE QR ROUTER ───────────────────────────────────────────────────────
# Registers all /live/* endpoints. Completely isolated from Demo Mode simulation.
# Every endpoint in live_import.py verifies system_mode == 'Live' before executing.
from backend.live_import import router as live_router
from fastapi.staticfiles import StaticFiles
app.include_router(live_router)

# Serve generated QR images as static files at /qr-images/{event_id}/{attendee_id}.png
_qr_generated_dir = os.path.join(os.path.dirname(__file__), "..", "qr_system", "generated")
os.makedirs(_qr_generated_dir, exist_ok=True)
app.mount("/qr-images", StaticFiles(directory=_qr_generated_dir), name="qr_images")
# Serve uploaded incident photos as static files at /uploads/incidents/...
_uploads_incidents_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads", "incidents"))
os.makedirs(_uploads_incidents_dir, exist_ok=True)
app.mount("/uploads/incidents", StaticFiles(directory=_uploads_incidents_dir), name="uploads_incidents")
# ─────────────────────────────────────────────────────────────────────────────

# ── SIMULATION TIMER RECOVERY ON STARTUP ────────────────────────────────────
def sync_volunteer_attendance_status(volunteer_id: int, cursor):
    """Dynamically sync a volunteer's attendance status for today in Live Mode."""
    try:
        cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
        mode_row = cursor.fetchone()
        system_mode = mode_row[0] if mode_row else "Demo"
        
        if system_mode != "Live":
            return
            
        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("SELECT check_in_time, check_out_time FROM attendance WHERE volunteer_id = ? AND date = ?", (volunteer_id, today_str))
        att_row = cursor.fetchone()
        if not att_row:
            # Force reset to Absent/Offline
            cursor.execute("""
                UPDATE volunteers 
                SET attendance_status = 'Absent', 
                    status = 'Offline', 
                    gate_duty_start_time = NULL 
                WHERE volunteer_id = ?
            """, (volunteer_id,))
        else:
            check_in, check_out = att_row
            if check_out:
                cursor.execute("""
                    UPDATE volunteers 
                    SET attendance_status = 'Checked Out', 
                        status = 'Offline', 
                        gate_duty_start_time = NULL 
                    WHERE volunteer_id = ?
                """, (volunteer_id,))
            elif check_in:
                cursor.execute("""
                    UPDATE volunteers 
                    SET attendance_status = 'Checked In' 
                    WHERE volunteer_id = ?
                """, (volunteer_id,))
    except Exception as e:
        print(f"[Self-Healing] Error syncing volunteer {volunteer_id}: {e}")

def sync_all_volunteers_attendance_status(cursor):
    """Dynamically sync all volunteers' attendance status for today in Live Mode."""
    try:
        cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
        mode_row = cursor.fetchone()
        system_mode = mode_row[0] if mode_row else "Demo"
        
        if system_mode != "Live":
            return
            
        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("SELECT volunteer_id FROM volunteers")
        vol_ids = [r[0] for r in cursor.fetchall()]
        for vol_id in vol_ids:
            cursor.execute("SELECT check_in_time, check_out_time FROM attendance WHERE volunteer_id = ? AND date = ?", (vol_id, today_str))
            att_row = cursor.fetchone()
            if not att_row:
                cursor.execute("""
                    UPDATE volunteers 
                    SET attendance_status = 'Absent', 
                        status = 'Offline', 
                        gate_duty_start_time = NULL 
                    WHERE volunteer_id = ?
                """, (vol_id,))
            else:
                check_in, check_out = att_row
                if check_out:
                    cursor.execute("""
                        UPDATE volunteers 
                        SET attendance_status = 'Checked Out', 
                            status = 'Offline', 
                            gate_duty_start_time = NULL 
                        WHERE volunteer_id = ?
                    """, (vol_id,))
                elif check_in:
                    cursor.execute("""
                        UPDATE volunteers 
                        SET attendance_status = 'Checked In' 
                        WHERE volunteer_id = ?
                    """, (vol_id,))
    except Exception as e:
        print(f"[Self-Healing] Error syncing all volunteers: {e}")

def _recover_simulation_timers():
    """Reschedule timers for orphaned Pending/Accepted/Arrived simulation requests on startup."""
    import threading
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Check system mode first
        cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
        sm_row = cursor.fetchone()
        system_mode = sm_row[0] if sm_row else "Demo"
        if system_mode != "Demo":
            conn.close()
            return
            
        cursor.execute("SELECT value FROM system_settings WHERE key = 'volunteer_assignment_mode'")
        mode_row = cursor.fetchone()
        mode = mode_row[0] if mode_row else "Demo"
        if mode not in ["Simulation", "Demo"]:
            conn.close()
            return
        cursor.execute("SELECT value FROM system_settings WHERE key = 'simulation_delay_seconds'")
        delay_row = cursor.fetchone()
        delay_sec = int(delay_row[0]) if delay_row else 3

        # Recover Pending requests → schedule accept timer immediately (delay=0)
        cursor.execute(
            "SELECT request_id FROM assignment_requests WHERE status = 'Pending'"
        )
        pending_rows = cursor.fetchall()
        for (rid,) in pending_rows:
            t = threading.Timer(0.1, run_auto_accept_simulation_timer, args=(rid, delay_sec))
            t.daemon = True
            t.start()
            print(f"[Recovery] Rescheduled ACCEPT timer for Pending request #{rid}")

        # Recover Accepted requests → schedule en-route timer immediately (delay=0)
        cursor.execute(
            "SELECT request_id FROM assignment_requests WHERE status = 'Accepted'"
        )
        accepted_rows = cursor.fetchall()
        for (rid,) in accepted_rows:
            t = threading.Timer(0.1, run_auto_enroute_simulation_timer, args=(rid,))
            t.daemon = True
            t.start()
            print(f"[Recovery] Rescheduled EN ROUTE timer for Accepted request #{rid}")

        # Recover En Route requests → schedule arrive timer immediately (delay=0)
        cursor.execute(
            "SELECT request_id FROM assignment_requests WHERE status = 'En Route'"
        )
        en_route_rows = cursor.fetchall()
        for (rid,) in en_route_rows:
            t = threading.Timer(0.1, run_auto_arrive_simulation_timer, args=(rid,))
            t.daemon = True
            t.start()
            print(f"[Recovery] Rescheduled ARRIVE timer for En Route request #{rid}")

        # Recover Arrived requests → schedule complete timer immediately (delay=0)
        cursor.execute(
            "SELECT request_id FROM assignment_requests WHERE status = 'Arrived'"
        )
        arrived_rows = cursor.fetchall()
        for (rid,) in arrived_rows:
            t = threading.Timer(0.1, run_auto_complete_simulation_timer, args=(rid,))
            t.daemon = True
            t.start()
            print(f"[Recovery] Rescheduled COMPLETE timer for Arrived request #{rid}")

        conn.close()
        total = len(pending_rows) + len(accepted_rows) + len(en_route_rows) + len(arrived_rows)
        print(f"[Recovery] Simulation timer recovery complete: {total} request(s) rescheduled.")
    except Exception as e:
        print(f"[Recovery] Timer recovery failed: {e}")
        try:
            conn.close()
        except Exception:
            pass

@app.on_event("startup")
def on_startup():
    """Run once when the FastAPI server starts."""
    import threading
    # 1. Validate and auto-repair the database (schema migration + NULL backfill)
    from backend.database import validate_and_repair_db
    validate_and_repair_db()
    
    # Seed the analytics cache on startup
    try:
        update_cached_analytics()
    except Exception as e:
        print(f"[Startup] Cache seeding failed: {e}")
        
    # 2. Recover any orphaned simulation timers from a previous run
    t = threading.Timer(2.0, _recover_simulation_timers)
    t.daemon = True
    t.start()

# ----------------- PYDANTIC SCHEMAS -----------------

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    email: str = None
    full_name: str = None

class TestInput(BaseModel):
    crowd_count: int
    queue_length: int

class RiskInput(BaseModel):
    crowd_count: int
    queue_length: int
    occupancy_percentage: float
    volunteers_assigned: int
    peak_hour: int

class EventCreate(BaseModel):
    event_name: str
    venue: str
    date: str
    capacity: int

class VolunteerCreate(BaseModel):
    volunteer_name: str
    assigned_gate: int = None
    contact: str
    email: str = None
    phone: str = None
    username: str = None
    password: str = None
    status: str = None
    profile_photo: str = None
    joining_date: str = None
    experience: str = None
    age: int = None
    gender: str = None

class ChecklistUpdate(BaseModel):
    arrived_at_gate: int
    qr_scanner_working: int
    barricades_checked: int
    crowd_flow_normal: int
    emergency_exit_clear: int
    communication_device_checked: int
    shift_completed: int

class WorkReportSubmit(BaseModel):
    tasks: str
    crowd_situation: str
    issues_faced: str
    action_taken: str
    suggestions: str = None
    additional_notes: str = None

class ProfileUpdate(BaseModel):
    phone: str
    volunteer_name: str = None
    email: str = None
    password: str = None
    profile_photo: str = None

class AnnouncementCreate(BaseModel):
    title: str
    message: str
    priority: str

class IncidentCreate(BaseModel):
    incident_type: str
    location: str
    severity: str
    description: str
    photo_url: str = None

class AlertCreate(BaseModel):
    gate_id: int
    alert_type: str
    severity: str = "Medium"
    message: str
    recommendation: str = ""

class VolunteerModeRequest(BaseModel):
    mode: str
    delay_seconds: int
    peak_hour: int = 0

class SystemModeRequest(BaseModel):
    system_mode: str

# ----------------- REAL-TIME SIMULATION ENGINE (DAY 22) -----------------
import threading
import time
import random

simulation_active = False
simulation_thread = None
simulation_lock = threading.Lock()
real_tick_count = 0
simulation_cycle_count = 0
TICKS_PER_SIM_MINUTE = 6

active_timers = []
active_timers_lock = threading.Lock()

# Per-cycle ML prediction cache.
# Keyed by gate_id -> prediction result dict.
# Populated once by get_live_analytics() at the start of each cycle.
# All downstream consumers (compute_assignments, calculate_redeployment_impact_with_metrics,
# update_cached_analytics) read from here instead of re-invoking the 6 ML models.
# Cleared at the top of every run_simulation_cycle() call.
_gate_pred_cache: dict = {}
_gate_pred_cache_lock = threading.Lock()

def clear_gate_pred_cache():
    """Discard all cached gate predictions from the previous simulation cycle."""
    global _gate_pred_cache
    with _gate_pred_cache_lock:
        _gate_pred_cache = {}


def register_timer(t):
    with active_timers_lock:
        active_timers[:] = [x for x in active_timers if x.is_alive()]
        active_timers.append(t)

def cancel_all_timers():
    with active_timers_lock:
        for t in active_timers:
            try:
                t.cancel()
            except Exception as e:
                print(f"[Timer] Error cancelling timer: {e}")
        active_timers.clear()
        print("[Timer] Cancelled all active simulation timers.")

_PREV_SIM_METRICS = {}

def log_simulation_cycle_metrics(cycle_num, phase, arrivals, exits, gate_enters, gate_exits):
    global _PREV_SIM_METRICS, real_tick_count
    try:
        conn = get_connection()
        analytics = get_live_analytics(conn)
        cursor = conn.cursor()
        
        print("\n" + "="*60)
        print(f"SIMULATION LOG | Tick: {real_tick_count} | Sim Minute: {cycle_num} | Phase: {phase}")
        print("="*60)
        
        for g in analytics:
            g_id = g["gate_id"]
            gate_name = g["gate_name"]
            occ_pct = g["occupancy_pct"]
            curr_occ = g["current_occupancy"]
            curr_queue = g["queue_length"]
            curr_wait = g["predicted_wait_time"]
            curr_req = g["required_volunteers"]
            curr_stationed = g["stationed_volunteers"]
            curr_deficit = max(g["deficit"], 0)
            curr_enroute = g["enroute_count"]
            curr_risk = g.get("predicted_risk", "Safe")
            curr_cong = g.get("congestion_level", "Low")
            safety_score = g.get("safety_score", 100)
            
            # Rates
            g_arr = gate_enters.get(g_id, 0) * 30  # per-min rate
            g_ent = (curr_stationed * 30) if curr_stationed > 0 else 0
            
            # Transition deltas
            prev = _PREV_SIM_METRICS.get(g_id)
            v_assigned = 0
            v_arrived = 0
            v_released = 0
            if prev is not None:
                if curr_stationed > prev["stationed"]:
                    v_arrived = curr_stationed - prev["stationed"]
                elif curr_stationed < prev["stationed"]:
                    v_released = prev["stationed"] - curr_stationed
            if curr_enroute > 0 or curr_deficit > 0:
                v_assigned = max(curr_req - curr_stationed, 0)
            
            # Active alert status
            cursor.execute("SELECT alert_type FROM alerts WHERE gate_id = ? AND is_resolved = 0 ORDER BY alert_id DESC LIMIT 1", (g_id,))
            alert_row = cursor.fetchone()
            alert_gen = alert_row[0] if alert_row else "None"
            
            # Action string
            if curr_deficit > 0:
                action_str = f"Dispatch {curr_deficit} Volunteers"
            elif curr_enroute > 0:
                action_str = f"En Route ({curr_enroute} In Transit)"
            else:
                action_str = "Maintain Current Staffing"
            
            print(f"Gate: {gate_name}")
            print(f"  Tick Number         : {real_tick_count}")
            print(f"  Occupancy           : {curr_occ} ({occ_pct}%)")
            print(f"  Queue               : {curr_queue}")
            print(f"  Arrival Rate        : {g_arr}/min")
            print(f"  Entry Rate          : {g_ent}/min")
            print(f"  Predicted Wait      : {curr_wait:.1f} min" if curr_wait is not None else "  Predicted Wait      : —")
            print(f"  Required Volunteers : {curr_req}")
            print(f"  Risk                : {curr_risk}")
            print(f"  Congestion          : {curr_cong}")
            print(f"  Stationed Staff     : {curr_stationed}")
            print(f"  Deficit             : {curr_deficit}")
            print(f"  Volunteer Assigned  : {v_assigned}")
            print(f"  Volunteer Arrived   : {v_arrived}")
            print(f"  Volunteer Released  : {v_released}")
            print(f"  Alert Generated     : {alert_gen}")
            print(f"  Safety Score        : {safety_score} / 100")
            print(f"  Action              : {action_str}")
            print("-" * 60)
            
            _PREV_SIM_METRICS[g_id] = {
                "queue": curr_queue,
                "waiting_time": curr_wait,
                "stationed": curr_stationed,
                "enroute": curr_enroute
            }
            
        conn.close()
    except Exception as e:
        print(f"[Logging Error] Failed to log cycle metrics: {e}")


current_run_gate_weights = {}

def get_run_gate_weight(gate_name: str, gate_id: int) -> float:
    global current_run_gate_weights
    if not current_run_gate_weights:
        # Tuned Hackathon Garba Popularity Weights: Main Arena 55%, East Entrance 20%, West Entrance 12%, Food Court 8%, VIP Entrance 5%
        base_weights = {5: 0.55, 2: 0.20, 3: 0.12, 4: 0.08, 1: 0.05}
        raw_weights = {}
        for g_num, base_w in base_weights.items():
            variation_factor = random.uniform(0.90, 1.10)
            raw_weights[g_num] = base_w * variation_factor
        total_w = sum(raw_weights.values())
        current_run_gate_weights = {gid: w / total_w for gid, w in raw_weights.items()}

    if "Main Garba" in gate_name or gate_id == 5: g_num = 5
    elif "Food Court" in gate_name or gate_id == 4: g_num = 4
    elif "East" in gate_name or gate_id == 2: g_num = 2
    elif "West" in gate_name or gate_id == 3: g_num = 3
    else: g_num = 1
    return current_run_gate_weights.get(g_num, 0.20)


def run_simulation_cycle():
    """
    Executes a single cycle of the crowd flow simulation tuned for 2-minute hackathon live demonstrations.
    """
    print("START run_simulation_cycle")
    start_t = time.perf_counter()
    try:
        global simulation_cycle_count, real_tick_count

        # Clear the per-cycle prediction cache so every gate runs its 6 ML models exactly
        # once this cycle — get_live_analytics() writes, all downstream functions read.
        clear_gate_pred_cache()

        # Auto-restart event if the previous 90-cycle event lifecycle has completed
        if simulation_cycle_count > 0 and simulation_cycle_count % 90 == 0 and real_tick_count % TICKS_PER_SIM_MINUTE == 0:
            print("[Simulation] Event lifecycle completed (90 sim minutes). Automatically restarting event...")
            try:
                cancel_all_timers()
                real_tick_count = 0
                simulation_cycle_count = 0
                
                from backend.database import reset_event_data, initialize_demo_mode, validate_and_repair_db
                reset_event_data()
                initialize_demo_mode()
                validate_and_repair_db()
                print("[Simulation] Automatic restart complete. Seeding fresh event data.")
            except Exception as e:
                print(f"[Simulation] Error during automatic event restart: {e}")

        real_tick_count += 1
        simulation_cycle_count = (real_tick_count - 1) // TICKS_PER_SIM_MINUTE + 1

        # 90-cycle repeating period (each cycle = 1 simulation minute)
        cycle_in_phase = (simulation_cycle_count - 1) % 90 + 1

        if cycle_in_phase <= 10:
            phase          = "Early Entry"
            peak_hour_val  = 0
            gate_base_arrivals = {"main": (3, 6), "east": (2, 4), "west": (1, 3), "food": (1, 3), "vip": (0, 2)}
            exit_rate_pct = 0.005
        elif cycle_in_phase <= 25:
            phase          = "Normal Entry"
            peak_hour_val  = 0
            gate_base_arrivals = {"main": (6, 12), "east": (4, 8), "west": (3, 6), "food": (2, 5), "vip": (1, 3)}
            exit_rate_pct = 0.01
        elif cycle_in_phase <= 45:
            phase          = "Peak Entry"
            peak_hour_val  = 1
            gate_base_arrivals = {"main": (10, 20), "east": (6, 12), "west": (4, 9), "food": (3, 7), "vip": (2, 4)}
            exit_rate_pct = 0.01
        elif cycle_in_phase <= 65:
            phase          = "Event Running"
            peak_hour_val  = 0
            gate_base_arrivals = {"main": (1, 3), "east": (1, 2), "west": (0, 2), "food": (1, 2), "vip": (0, 1)}
            exit_rate_pct = 0.03
        elif cycle_in_phase <= 80:
            phase          = "Exit Surge"
            peak_hour_val  = 0
            gate_base_arrivals = {"main": (0, 0), "east": (0, 0), "west": (0, 0), "food": (0, 0), "vip": (0, 0)}
            exit_rate_pct = 0.12
        else:
            phase          = "Venue Closing"
            peak_hour_val  = 0
            gate_base_arrivals = {"main": (0, 0), "east": (0, 0), "west": (0, 0), "food": (0, 0), "vip": (0, 0)}
            exit_rate_pct = 0.20

        print(f"[Simulation] Real Tick {real_tick_count} | Sim Minute {simulation_cycle_count} (Min {cycle_in_phase}/90) | Phase: {phase}")

        try:
            print("START database_write")
            db_w_t = time.perf_counter()
            conn = get_connection()
            cursor = conn.cursor()
            
            # Save simulation phase and peak_hour settings
            cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('simulation_phase', ?)", (phase,))
            cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('peak_hour', ?)", (str(peak_hour_val),))
            conn.commit()
            print("END database_write")
            print(f"Execution Time: {(time.perf_counter() - db_w_t)*1000:.2f} ms")
            
            print("START database_read")
            db_r_t = time.perf_counter()
            # Get active event
            cursor.execute("SELECT event_id FROM events ORDER BY event_id DESC LIMIT 1")
            event_row = cursor.fetchone()
            if not event_row:
                conn.close()
                return
            event_id = event_row[0]
            
            # Get all gates
            cursor.execute("SELECT gate_id, gate_name, max_capacity FROM gates WHERE event_id = ?", (event_id,))
            gates = cursor.fetchall()
            print("END database_read")
            print(f"Execution Time: {(time.perf_counter() - db_r_t)*1000:.2f} ms")
            
            now = datetime.now()
            now_str = now.strftime("%Y-%m-%d %H:%M:%S")
            
            # Collect details for each gate and distribute arrivals, check-ins, and exits
            gate_details = {}

            for gate in gates:
                gate_id, gate_name, max_capacity = gate
                
                cursor.execute("SELECT COUNT(*) FROM attendees WHERE assigned_gate = ? AND is_checked_in = 1", (gate_id,))
                current_occupancy = cursor.fetchone()[0]

                cursor.execute("SELECT COUNT(*) FROM attendees WHERE assigned_gate = ? AND is_checked_in = 0", (gate_id,))
                current_queue = cursor.fetchone()[0]

                cursor.execute(
                    "SELECT COUNT(*) FROM volunteers WHERE assigned_gate = ? AND status IN ('Stationed', 'Available')",
                    (gate_id,)
                )
                stationed = cursor.fetchone()[0]
                
                # Ticket Capacity Guard: Never generate arrivals beyond total gate ticket capacity
                current_total_demand = current_occupancy + current_queue
                remaining_ticket_capacity = max(0, max_capacity - current_total_demand)

                # Determine base arrival range based on gate weights
                gate_name_lower = gate_name.lower()
                g_range = (1, 4)
                for key, val in gate_base_arrivals.items():
                    if key in gate_name_lower:
                        g_range = val
                        break

                raw_enters = random.randint(g_range[0], g_range[1]) if g_range[1] > 0 else 0
                enters = min(raw_enters, remaining_ticket_capacity)

                # Natural exits proportional to current occupancy
                g_exits = int(round(current_occupancy * exit_rate_pct)) if exit_rate_pct > 0 else 0
                if phase in ["Exit Surge", "Venue Closing"] and current_occupancy > 0:
                    g_exits = max(g_exits, random.randint(15, 30))
                g_exits = min(g_exits, current_occupancy)

                gate_details[gate_id] = {
                    "gate_name": gate_name,
                    "max_capacity": max_capacity,
                    "current_occupancy": current_occupancy,
                    "current_queue": current_queue,
                    "stationed": stationed,
                    "enters": enters,
                    "to_check_in": 0,
                    "g_exits": g_exits,
                    "exit_attendee_ids": []
                }
                
            # 2. Check-ins: set directly based on realistic physical gate throughput per 2-second tick
            for gate_id, details in gate_details.items():
                stationed = details["stationed"]
                # 1 volunteer = 1-2 scans per 2-sec tick (~30-60 scans/min)
                # If 0 volunteers stationed, gate processing halts (0 scans/tick -> queue accumulates!)
                vol_cap = sum(random.randint(1, 2) for _ in range(stationed)) if stationed > 0 else 0
                scan_cap = vol_cap

                total_queue_and_enters = details["current_queue"] + details["enters"]
                room_left = max(0, details["max_capacity"] - details["current_occupancy"])
                details["to_check_in"] = min(total_queue_and_enters, scan_cap, room_left)

                queue_before = details["current_queue"]
                arrivals = details["enters"]
                processed = details["to_check_in"]
                queue_after = queue_before + arrivals - processed
                occupancy = details["current_occupancy"] + processed
                print(f"[Gate Tick] {details['gate_name']} | Arrivals: {arrivals} | Queue Before: {queue_before} | Processed: {processed} | Queue After: {queue_after} | Occupancy: {occupancy}")
                
            # 3. Exits: select and pop eligible checked-in attendees
            for gate_id, details in gate_details.items():
                g_exits = details.get("g_exits", 0)
                
                cursor.execute(
                    "SELECT attendee_id, entry_time, stay_duration FROM attendees WHERE assigned_gate = ? AND is_checked_in = 1",
                    (gate_id,)
                )
                eligible_ids = []
                for att_id, entry_time_str, stay_duration in cursor.fetchall():
                    if phase in ["Event Ending", "Exit Surge", "Venue Closing"]:
                        eligible_ids.append(att_id)
                        continue

                    if not entry_time_str:
                        continue
                    try:
                        entry_dt = datetime.strptime(entry_time_str, "%Y-%m-%d %H:%M:%S")
                        elapsed_secs = (now - entry_dt).total_seconds()
                        if elapsed_secs >= (stay_duration or 120):
                            eligible_ids.append(att_id)
                    except Exception:
                        continue
                
                chosen_exits = eligible_ids[:g_exits]
                details["exit_attendee_ids"] = chosen_exits

            global_arrivals = sum(details["enters"] for details in gate_details.values())
            global_exits = sum(len(details["exit_attendee_ids"]) for details in gate_details.values())

            # Apply updates to database for each gate using high-performance batch operations
            print("START database_write")
            w_t = time.perf_counter()

            attendees_to_insert = []
            checkin_updates = []
            scan_in_inserts = []
            exit_updates = []
            scan_out_inserts = []

            for gate in gates:
                gate_id, gate_name, max_capacity = gate
                details = gate_details[gate_id]
                
                # Queue Growth
                enters = details["enters"]
                for _ in range(enters):
                    qr_code = f"QR-SIM-{gate_id}-{uuid.uuid4().hex[:12].upper()}"
                    name    = f"Simulated Attendee {random.randint(1000, 9999)}"
                    attendees_to_insert.append((event_id, name, qr_code, gate_id, 0))
                    
                # Check-ins
                to_check_in = details["to_check_in"]
                if to_check_in > 0:
                    cursor.execute(
                        "SELECT attendee_id FROM attendees WHERE assigned_gate = ? AND is_checked_in = 0 LIMIT ?",
                        (gate_id, to_check_in)
                    )
                    for (att_id,) in cursor.fetchall():
                        stay_dur = random.randint(120, 240)
                        checkin_updates.append((now_str, stay_dur, att_id))
                        scan_in_inserts.append((att_id, gate_id, 'IN', now_str))
                        
                # Exits
                for att_id in details["exit_attendee_ids"]:
                    exit_updates.append((att_id,))
                    scan_out_inserts.append((att_id, gate_id, 'OUT', now_str))

            # Execute batch operations at C-level speed (<3ms transaction lock)
            if attendees_to_insert:
                cursor.executemany(
                    "INSERT INTO attendees (event_id, attendee_name, qr_code, assigned_gate, is_checked_in) VALUES (?, ?, ?, ?, ?)",
                    attendees_to_insert
                )
            if checkin_updates:
                cursor.executemany(
                    "UPDATE attendees SET is_checked_in = 1, entry_time = ?, stay_duration = ? WHERE attendee_id = ?",
                    checkin_updates
                )
            if scan_in_inserts:
                cursor.executemany(
                    "INSERT INTO scans (attendee_id, gate_id, direction, scan_time) VALUES (?, ?, ?, ?)",
                    scan_in_inserts
                )
            if exit_updates:
                cursor.executemany(
                    "UPDATE attendees SET is_checked_in = 0, assigned_gate = NULL, entry_time = NULL, stay_duration = NULL WHERE attendee_id = ?",
                    exit_updates
                )
            if scan_out_inserts:
                cursor.executemany(
                    "INSERT INTO scans (attendee_id, gate_id, direction, scan_time) VALUES (?, ?, ?, ?)",
                    scan_out_inserts
                )

            # Process congestion alerts per gate
            for gate in gates:
                gate_id, gate_name, max_capacity = gate
                cursor.execute("SELECT COUNT(*) FROM attendees WHERE assigned_gate = ? AND is_checked_in = 1", (gate_id,))
                updated_occupancy = cursor.fetchone()[0]
                
                util_pct = (updated_occupancy / max_capacity * 100) if max_capacity > 0 else 0.0
                if util_pct >= 85.0:
                    cursor.execute(
                        "SELECT COUNT(*) FROM alerts WHERE gate_id = ? AND alert_type = 'Congestion Alert' AND is_resolved = 0",
                        (gate_id,)
                    )
                    if cursor.fetchone()[0] == 0:
                        msg = (
                            f"Automatic warning: {gate_name} capacity utilization is critical "
                            f"at {round(util_pct, 1)}% ({updated_occupancy}/{max_capacity})"
                        )
                        cursor.execute(
                            "INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved) "
                            "VALUES (?, 'Congestion Alert', 'Critical', ?, "
                            "'Immediately restrict entry and redirect crowd to adjacent gates.', 0)",
                            (gate_id, msg)
                        )
                        
                        cursor.execute("SELECT volunteer_id FROM volunteers WHERE assigned_gate = ? AND status != 'Offline'", (gate_id,))
                        stationed_vols = cursor.fetchall()
                        for (v_id,) in stationed_vols:
                            add_volunteer_notification(
                                cursor,
                                v_id,
                                "Alert",
                                "Congestion Warning",
                                f"Critical capacity utilization warning at your station {gate_name}: {round(util_pct, 1)}%."
                            )
                else:
                    cursor.execute(
                        "UPDATE alerts SET is_resolved = 1 "
                        "WHERE gate_id = ? AND alert_type = 'Congestion Alert' "
                        "AND message LIKE 'Automatic warning:%' AND is_resolved = 0",
                        (gate_id,)
                    )
                    
            conn.commit()
            conn.close()
            print("END database_write")
            print(f"Execution Time: {(time.perf_counter() - w_t)*1000:.2f} ms")

            # 5. Auto-assign volunteers (ML model decides reallocation each cycle).
            # update_cached_analytics() is already called at the end of run_auto_assign(),
            # so we do NOT call it again here — that would re-run all 5 gate ML predictions.
            print("[Simulation] Running Auto-Assignment...")
            run_auto_assign()

            gate_enters = {gate_id: details["enters"] for gate_id, details in gate_details.items()}
            gate_exits = {gate_id: len(details["exit_attendee_ids"]) for gate_id, details in gate_details.items()}
            log_simulation_cycle_metrics(simulation_cycle_count, phase, global_arrivals, global_exits, gate_enters, gate_exits)

        except Exception as e:
            print(f"[Simulation] Database error in cycle: {e}")
            try:
                conn.close()
            except Exception:
                pass
    finally:
        elapsed = (time.perf_counter() - start_t) * 1000.0
        print("END run_simulation_cycle")
        print(f"Execution Time: {elapsed:.2f} ms")


def simulation_worker():
    import threading, traceback
    current_thread = threading.current_thread()
    print(f"START simulation_worker [Thread Name: {current_thread.name}, ID: {current_thread.ident}]")
    worker_start_t = time.perf_counter()
    try:
        global simulation_active
        while True:
            print(f"[Lock Trace] Attempting to acquire simulation_lock in worker...")
            with simulation_lock:
                print(f"[Lock Trace] Acquired simulation_lock in worker. Active: {simulation_active}")
                is_active = simulation_active
            print(f"[Lock Trace] Released simulation_lock in worker.")
            
            if not is_active:
                print("[Simulation] Worker exiting because simulation_active is False.")
                break
            
            try:
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
                row = cursor.fetchone()
                conn.close()
                if row and row[0] == "Live":
                    print("[Simulation] Stopping simulation worker because System Mode is Live.")
                    with simulation_lock:
                        simulation_active = False
                    break
            except Exception as e:
                print(f"[Simulation] Error checking system mode in worker: {e}")
                try:
                    conn.close()
                except Exception:
                    pass

            try:
                print(f"\n[Worker Trace] Executing cycle | Thread Alive: {current_thread.is_alive()} (ID: {current_thread.ident}) | simulation_active: {simulation_active}")
                run_simulation_cycle()
            except Exception as err:
                print(f"[CRITICAL WORKER ERROR] Exception swallowed prevented! Traceback:")
                traceback.print_exc()

            time.sleep(2)
    finally:
        elapsed = (time.perf_counter() - worker_start_t) * 1000.0
        print(f"END simulation_worker [Thread ID: {current_thread.ident}]")
        print(f"Execution Time: {elapsed:.2f} ms")

def check_in_all_volunteers():
    """Automatically check in all offline/absent volunteers for the simulation and station exactly 1 volunteer per gate, putting the rest in reserve."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        now_ts = datetime.now()
        now_str_ts = now_ts.strftime("%Y-%m-%d %H:%M:%S")
        today_str = now_ts.strftime("%Y-%m-%d")
        
        # 1. First, check in and mark all volunteers as Available and Checked In
        cursor.execute("""
            UPDATE volunteers 
            SET status = 'Available',
                attendance_status = 'Checked In',
                last_login = ?
            WHERE status = 'Offline' OR status IS NULL OR attendance_status = 'Absent'
        """, (now_str_ts,))
        
        # 2. Assign exactly 1 volunteer per gate, and unassign the rest to the Reserve Pool (assigned_gate = NULL)
        cursor.execute("SELECT gate_id FROM gates ORDER BY gate_id")
        gates = cursor.fetchall()
        gate_ids = [g[0] for g in gates]
        
        cursor.execute("SELECT volunteer_id FROM volunteers ORDER BY volunteer_id")
        vol_ids = [v[0] for v in cursor.fetchall()]
        
        # Set all volunteers to unassigned first with status 'Available'
        cursor.execute("UPDATE volunteers SET assigned_gate = NULL, status = 'Available', destination_gate = NULL, travel_time_remaining = 0, travel_eta = NULL")
        
        # Assign the first N volunteers to the N gates (one per gate) and set status to 'Stationed'
        for i, g_id in enumerate(gate_ids):
            if i < len(vol_ids):
                v_id = vol_ids[i]
                cursor.execute("UPDATE volunteers SET assigned_gate = ?, status = 'Stationed' WHERE volunteer_id = ?", (g_id, v_id))
        
        # 3. Add attendance and activity logs
        cursor.execute("SELECT volunteer_id, assigned_gate FROM volunteers WHERE attendance_status = 'Checked In'")
        vols = cursor.fetchall()
        for v_id, ag_id in vols:
            # Create attendance record if not exists
            cursor.execute("SELECT attendance_id FROM attendance WHERE volunteer_id = ? AND date = ?", (v_id, today_str))
            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO attendance (volunteer_id, check_in_time, date)
                    VALUES (?, ?, ?)
                """, (v_id, now_str_ts, today_str))
            # Log activity if not logged recently
            cursor.execute("""
                INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                VALUES (?, 'Login', ?, 'Volunteer logged in dynamically via simulation start')
            """, (v_id, ag_id))
            
        conn.commit()
        conn.close()
        print(f"[Simulation] Checked in {len(vols)} volunteers successfully. Stationed 1 volunteer per gate, others in Reserve Pool.")
    except Exception as e:
        print(f"[Simulation] Failed to check in volunteers: {e}")

@app.post("/simulation/start")
def start_simulation():
    print("START start_simulation")
    start_t = time.perf_counter()
    try:
        global simulation_active, simulation_cycle_count, simulation_thread, real_tick_count
        thread_alive_before = False
        with simulation_lock:
            thread_alive_before = (simulation_thread is not None and simulation_thread.is_alive())

            if simulation_cycle_count == 0:
                real_tick_count = 0
                cancel_all_timers()

            simulation_active = True

            if not thread_alive_before:
                simulation_thread = threading.Thread(target=simulation_worker, daemon=True)
                simulation_thread.start()

            thread_alive_after = (simulation_thread is not None and simulation_thread.is_alive())

        print(f"[Simulation] Started simulation engine successfully. Worker alive before: {thread_alive_before}, alive after: {thread_alive_after}")
        return {
            "status": "started",
            "message": "Simulation started successfully.",
            "simulation_active": True,
            "worker_alive_before": thread_alive_before,
            "worker_alive_after": thread_alive_after
        }
    finally:
        elapsed = (time.perf_counter() - start_t) * 1000.0
        print("END start_simulation")
        print(f"Execution Time: {elapsed:.2f} ms")

@app.post("/simulation/pause")
@app.post("/simulation/stop")
def stop_simulation():
    print("START pause_simulation")
    start_t = time.perf_counter()
    try:
        global simulation_active
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
            row = cursor.fetchone()
            conn.close()
            if row and row[0] == "Live":
                raise HTTPException(status_code=400, detail="Simulation endpoints are disabled in Live Mode.")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        with simulation_lock:
            simulation_active = False
        print("[Simulation] Paused simulation engine successfully. Telemetry state preserved.")
        return {"status": "stopped", "message": "Simulation paused successfully. Current telemetry state preserved."}
    finally:
        elapsed = (time.perf_counter() - start_t) * 1000.0
        print("END pause_simulation")
        print(f"Execution Time: {elapsed:.2f} ms")

@app.post("/simulation/restart")
def restart_simulation():
    print("START reset_simulation")
    start_t = time.perf_counter()
    try:
        global simulation_active, simulation_cycle_count, real_tick_count, simulation_thread, current_run_gate_weights
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
            row = cursor.fetchone()
            conn.close()
            if row and row[0] == "Live":
                raise HTTPException(status_code=400, detail="Simulation endpoints are disabled in Live Mode.")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        try:
            # 1. Signal old thread to stop
            with simulation_lock:
                simulation_active = False

            # 2. Cancel all active timers to prevent post-restart execution of old dispatches
            cancel_all_timers()

            # Offload heavy reset and DB reinitialization to background thread so endpoint returns immediately (<1s)
            def _reset_worker():
                global real_tick_count, simulation_cycle_count, current_run_gate_weights, simulation_active
                old_thread = simulation_thread
                if old_thread is not None and old_thread.is_alive():
                    print("[Simulation] Waiting for old simulation thread to stop...")
                    old_thread.join(timeout=2.0)
                    if old_thread.is_alive():
                        print("[Simulation] WARNING: Old thread did not stop within timeout. Proceeding anyway.")
                    else:
                        print("[Simulation] Old simulation thread stopped cleanly.")

                real_tick_count = 0
                simulation_cycle_count = 0
                current_run_gate_weights = {}
                clear_gate_pred_cache()

                from backend.database import reset_event_data, initialize_demo_mode, validate_and_repair_db
                reset_event_data()
                initialize_demo_mode()

                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('simulation_phase', 'Venue Opening')")
                conn.commit()
                conn.close()

                validate_and_repair_db()
                update_cached_analytics()

                with simulation_lock:
                    simulation_active = False

                print("[Simulation] Restart complete. Venue reset to 0:00. Simulation idle, awaiting start.")

            reset_bg_thread = threading.Thread(target=_reset_worker, daemon=True)
            reset_bg_thread.start()

            return {
                "status": "success",
                "simulation_active": False,
                "simulation_minute": 0
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to restart simulation: {str(e)}")
    finally:
        elapsed = (time.perf_counter() - start_t) * 1000.0
        print("END reset_simulation")
        print(f"Execution Time: {elapsed:.2f} ms")

@app.post("/simulation/reset")
def reset_simulation():
    return restart_simulation()


@app.get("/simulation/status")
def get_simulation_status():
    print("START get_simulation_status")
    start_t = time.perf_counter()
    try:
        global simulation_active, simulation_cycle_count
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM system_settings WHERE key = 'simulation_phase'")
            phase_row = cursor.fetchone()
            phase = phase_row[0] if phase_row else "Venue Opening"
            conn.close()
        except Exception as e:
            print(f"Error fetching simulation phase: {e}")
            phase = "Venue Opening"
        with simulation_lock:
            return {
                "active": simulation_active,
                "phase": phase,
                "simulation_minute": simulation_cycle_count
            }
    finally:
        elapsed = (time.perf_counter() - start_t) * 1000.0
        print("END get_simulation_status")
        print(f"Execution Time: {elapsed:.2f} ms")

# ----------------- GENERAL ENDPOINTS -----------------

@app.get("/")
def read_root():
    """
    Root endpoint welcome message.
    """
    return {
        "message": "Welcome to CrowdShield AI API Backend! Use /docs for API documentation."
    }

@app.get("/status")
def get_status():
    """
    System status checker.
    """
    return {
        "status": "online",
        "message": "CrowdShield AI Backend is running smoothly."
    }

@app.post("/test")
def test_endpoint(data: TestInput):
    """
    Day 10 simple POST test endpoint.
    """
    return {
        "message": "received",
        "crowd_count": data.crowd_count,
        "queue_length": data.queue_length
    }

# ----------------- EVENT CRUD ENDPOINTS (DAY 12) -----------------

# 1. CREATE Event (POST /events)
@app.post("/events", status_code=201)
def create_event(event: EventCreate):
    """
    Creates a new event in the database.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO events (event_name, venue, date, capacity) VALUES (?, ?, ?, ?)",
            (event.event_name, event.venue, event.date, event.capacity)
        )
        conn.commit()
        event_id = cursor.lastrowid
        conn.close()
        return {
            "message": "Event created successfully",
            "event_id": event_id,
            "event_name": event.event_name,
            "venue": event.venue,
            "date": event.date,
            "capacity": event.capacity
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# 2a. FETCH ALL Events (GET /events)
@app.get("/events")
def get_events():
    """
    Retrieves all events stored in the SQLite database.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT event_id, event_name, venue, date, capacity FROM events")
        rows = cursor.fetchall()
        conn.close()
        
        events = []
        for row in rows:
            events.append({
                "event_id": row[0],
                "event_name": row[1],
                "venue": row[2],
                "date": row[3],
                "capacity": row[4]
            })
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# 2b. FETCH ONE Event (GET /events/{event_id})
@app.get("/events/{event_id}")
def get_event(event_id: int):
    """
    Retrieves a single event by event_id.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT event_id, event_name, venue, date, capacity FROM events WHERE event_id = ?",
            (event_id,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row is None:
            raise HTTPException(status_code=404, detail=f"Event with ID {event_id} not found")
            
        return {
            "event_id": row[0],
            "event_name": row[1],
            "venue": row[2],
            "date": row[3],
            "capacity": row[4]
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# 3. UPDATE Event (PUT /events/{event_id})
@app.put("/events/{event_id}")
def update_event(event_id: int, event: EventCreate):
    """
    Updates details for a specific event by event_id.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT event_id FROM events WHERE event_id = ?", (event_id,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Event with ID {event_id} not found")
            
        cursor.execute(
            "UPDATE events SET event_name = ?, venue = ?, date = ?, capacity = ? WHERE event_id = ?",
            (event.event_name, event.venue, event.date, event.capacity, event_id)
        )
        conn.commit()
        conn.close()
        
        return {
            "message": "Event updated successfully",
            "event_id": event_id,
            "event_name": event.event_name,
            "venue": event.venue,
            "date": event.date,
            "capacity": event.capacity
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# 4. DELETE Event (DELETE /events/{event_id})
@app.delete("/events/{event_id}")
def delete_event(event_id: int):
    """
    Deletes an event from the database by its ID.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT event_id FROM events WHERE event_id = ?", (event_id,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Event with ID {event_id} not found")
            
        cursor.execute("DELETE FROM events WHERE event_id = ?", (event_id,))
        conn.commit()
        conn.close()
        return {
            "message": f"Event with ID {event_id} deleted successfully"
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# ----------------- GATE ENDPOINTS (DAY 13) -----------------

# 1. GET Gate Occupancy (GET /gates/{gate_id}/occupancy)
@app.get("/gates/{gate_id}/occupancy")
def get_gate_occupancy(gate_id: int):
    """
    Calculates and returns occupancy statistics for a specific gate.
    - current_occupancy: Count of checked-in attendees assigned to this gate.
    - occupancy_percentage: Percentage of gate max capacity currently occupied.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 1. Verify gate exists and fetch capacity details
        cursor.execute("SELECT gate_name, max_capacity FROM gates WHERE gate_id = ?", (gate_id,))
        gate = cursor.fetchone()
        if gate is None:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Gate with ID {gate_id} not found")
            
        gate_name, max_capacity = gate
        
        # 2. Count checked-in attendees assigned to this gate
        cursor.execute("SELECT COUNT(*) FROM attendees WHERE assigned_gate = ? AND is_checked_in = 1", (gate_id,))
        current_occupancy = cursor.fetchone()[0]
        conn.close()
        
        # 3. Calculate percentage (prevent division by zero)
        if max_capacity > 0:
            occupancy_percentage = round((current_occupancy / max_capacity) * 100, 2)
        else:
            occupancy_percentage = 0.0
            
        return {
            "gate_id": gate_id,
            "gate_name": gate_name,
            "max_capacity": max_capacity,
            "current_occupancy": current_occupancy,
            "occupancy_percentage": occupancy_percentage
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# 2. GET Gate Queue Length (GET /gates/{gate_id}/queue)
@app.get("/gates/{gate_id}/queue")
def get_gate_queue(gate_id: int):
    """
    Calculates and returns the queue count for a specific gate.
    - queue_count: Count of registered attendees assigned to this gate who have NOT checked in yet.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 1. Verify gate exists
        cursor.execute("SELECT gate_name FROM gates WHERE gate_id = ?", (gate_id,))
        gate = cursor.fetchone()
        if gate is None:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Gate with ID {gate_id} not found")
            
        gate_name = gate[0]
        
        # 2. Count attendees assigned to this gate who are NOT checked in
        cursor.execute("SELECT COUNT(*) FROM attendees WHERE assigned_gate = ? AND is_checked_in = 0", (gate_id,))
        queue_count = cursor.fetchone()[0]
        conn.close()
        
        return {
            "gate_id": gate_id,
            "gate_name": gate_name,
            "queue_count": queue_count
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# 3. GET Gate Status (GET /gates/{gate_id}/status)
@app.get("/gates/{gate_id}/status")
def get_gate_status(gate_id: int):
    """
    Dynamically determines the gate status using the centralized analytics provider.
    """
    try:
        conn = get_connection()
        analytics = get_live_analytics(conn)
        conn.close()
        for g in analytics:
            if g["gate_id"] == gate_id:
                return {
                    "gate_id": gate_id,
                    "gate_name": g["gate_name"],
                    "status": g["status"]
                }
        raise HTTPException(status_code=404, detail=f"Gate with ID {gate_id} not found")
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# ----------------- ML PREPROCESSING HELPERS & ENDPOINTS (DAY 14) -----------------

def _prepare_features(input_dict: dict, model, scaler=None) -> pd.DataFrame:
    """
    Builds a DataFrame containing exactly the features and order expected by the model.
    Fills in missing features with sensible defaults in lowercase snake_case.
    Scales the numeric features using the scaler's expected columns before predicting.
    """
    # 1. Start with base defaults for all possible features (all lowercase snake_case)
    base_dict = {
        'crowd_count': 0,
        'occupancy_pct': 0.0,
        'arrival_rate_per_min': 50.0,
        'entry_rate_per_min': 50.0,
        'exit_rate_per_min': 50.0,
        'entry_gates': 5,
        'gate_width_m': 1.5,
        'gate_efficiency': 0.85,
        'volunteers_assigned': 1,
        'required_volunteers': 1,
        'total_volunteers': 1,
        'volunteer_gap': 0,
        'reserve_volunteers': 0,
        'is_peak_hour': 0,
        'venue_capacity': 1000,
        'avg_waiting_time_min': 0.0,
        'congestion_score': 0.0,
        'risk_score': 0.0,
        'crowd_density_per_sqm': 0.5,
        'avg_walking_speed_mps': 1.2,
        'weather_severity': 0.0,
        'visibility_km': 10.0,
        'road_traffic_index': 30.0,
        'parking_occupancy_pct': 50.0,
        'camera_coverage_pct': 90.0,
        'medical_incidents': 0,
        'security_incidents': 0,
        'fire_alarm': 0,
        'stampede_alert': 0,
        'bomb_threat': 0,
        'emergency_evacuation': 0,
        'camera_failure': 0,
        'network_failure': 0,
        'power_failure': 0,
        'is_indoor': 1,
        'venue_size_sqm': 2000.0,
        'emergency_gates': 2,
        'parking_capacity': 200,
        'camera_count': 10,
        'gate_throughput_per_gate': 40,
        'crowd_behavior_index': 0.5,
        'family_pct': 20,
        'children_pct': 5,
        'senior_citizen_pct': 5,
        'vip_pct': 2,
        'disabled_pct': 1,
        'security_guards': 10,
        'police_personnel': 5,
        'medical_staff': 2,
        'fire_team': 1,
        'qr_scan_time_sec': 5.0,
        'security_check_time_sec': 15.0,
        'metal_detector_delay_sec': 5.0,
        'bag_check_delay_sec': 5.0,
        'ticket_verification_time_sec': 5.0,
        'manual_verification_pct': 10.0,
        'qr_failure_rate_pct': 5.0,
        'device_failure_pct': 1.0,
        'queue_growth_rate_per_min': 0.0,
        'queue_reduction_rate_per_min': 0.0,
        'max_waiting_time_min': 0.0,
        'ai_detection_confidence_pct': 95.0,
        'cctv_density_per_1000sqm': 2.0,
        'blind_spot_pct': 10.0,
        'occlusion_pct': 5.0,
        'bus_load_pct': 50.0,
        'metro_load_pct': 50.0,
        'railway_passenger_load_pct': 50.0,
        'temperature_c': 25.0,
        'humidity_pct': 60.0,
        'rain_intensity_mm_hr': 0.0,
        'wind_speed_kmh': 10.0,
        'lost_child': 0,
        'slip_and_fall': 0,
        'equipment_failure': 0,
        'gate_failure': 0,
        'queue_length': 0.0
    }

    # 2. Add defaults for all OHE categories (all weather and crowd_behavior)
    for cat in ['weather_Cloudy', 'weather_Extreme Heat', 'weather_Fog', 'weather_Rain', 'weather_Storm', 'weather_Sunny']:
        base_dict[cat] = False
    for cat in ['crowd_behavior_Aggressive', 'crowd_behavior_Calm', 'crowd_behavior_Normal', 'crowd_behavior_Panic']:
        base_dict[cat] = False

    # Default active categories
    base_dict['weather_Sunny'] = True
    base_dict['crowd_behavior_Normal'] = True

    # 3. Update with the user-provided inputs
    # If custom weather/behavior fields are provided, turn off default categories
    if 'weather' in input_dict or any(k.lower().startswith('weather_') for k in input_dict.keys()):
        base_dict['weather_Sunny'] = False
    if 'crowd_behavior' in input_dict or any(k.lower().startswith('crowd_behavior_') for k in input_dict.keys()):
        base_dict['crowd_behavior_Normal'] = False

    # Map string inputs to one-hot columns
    # We match case-insensitively to the categories initialized in base_dict
    base_keys_lower = {bk.lower(): bk for bk in base_dict.keys()}
    
    if 'weather' in input_dict:
        w_col = f"weather_{input_dict['weather']}".lower()
        if w_col in base_keys_lower:
            base_dict[base_keys_lower[w_col]] = True
    if 'crowd_behavior' in input_dict:
        b_col = f"crowd_behavior_{input_dict['crowd_behavior']}".lower()
        if b_col in base_keys_lower:
            base_dict[base_keys_lower[b_col]] = True

    for k, v in input_dict.items():
        k_lower = k.lower()
        if k_lower not in ['weather', 'crowd_behavior']:
            if k_lower in base_keys_lower:
                base_dict[base_keys_lower[k_lower]] = v
            else:
                base_dict[k] = v

    # Support special mapping of Pydantic fields / MixedCase aliases
    if 'occupancy_percentage' in input_dict:
        base_dict['occupancy_pct'] = input_dict['occupancy_percentage']
    if 'peak_hour' in input_dict:
        base_dict['is_peak_hour'] = input_dict['peak_hour']
    if 'volunteers_assigned' in input_dict:
        base_dict['volunteers_assigned'] = input_dict['volunteers_assigned']

    # Create the DataFrame
    df = pd.DataFrame([base_dict])

    # 4. Scale features if scaler is provided
    if scaler is not None and hasattr(scaler, "feature_names_in_"):
        scale_cols = list(scaler.feature_names_in_)
        # Ensure scale_cols exist in df
        for col in scale_cols:
            if col not in df.columns:
                df[col] = 0.0
        df[scale_cols] = scaler.transform(df[scale_cols])

    # 5. Reindex to match the model's exact features
    if hasattr(model, "feature_names_in_"):
        model_cols = list(model.feature_names_in_)
        df = df.reindex(columns=model_cols, fill_value=0)
    elif scaler is not None and hasattr(scaler, "feature_names_in_"):
        # If model lacks feature names but scaler has them (e.g. KMeans), reindex to match scaler columns
        scale_cols = list(scaler.feature_names_in_)
        df = df.reindex(columns=scale_cols, fill_value=0)

    return df


# POST /predict-risk
@app.post("/predict-risk")
def predict_risk(data: RiskInput):
    """
    Uses the trained ML model (LogisticRegression) to predict crowd risk level.
    """
    try:
        # Build input dictionary
        input_dict = {
            'crowd_count': data.crowd_count,
            'queue_length': data.queue_length,
            'volunteers_assigned': data.volunteers_assigned,
            'occupancy_pct': data.occupancy_percentage,
            'is_peak_hour': data.peak_hour
        }
        features_df = _prepare_features(input_dict, risk_model, risk_scaler)
        prediction = risk_model.predict(features_df)
        risk_label = risk_label_encoder.get(prediction[0], "Unknown")
        return {
            "risk_prediction": risk_label
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

# ----------------- NEW ENDPOINTS FOR STREAMLIT DASHBOARD (DAY 21) -----------------

@app.get("/gates")
def get_gates():
    """
    Retrieves all gates from the database.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT gate_id, event_id, gate_name, max_capacity FROM gates")
        rows = cursor.fetchall()
        conn.close()
        
        gates = []
        for row in rows:
            gates.append({
                "gate_id": row[0],
                "event_id": row[1],
                "gate_name": row[2],
                "max_capacity": row[3]
            })
        return gates
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/volunteers")
def get_volunteers():
    """
    Retrieves all volunteers from the database.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT volunteer_id, volunteer_name, assigned_gate, contact, status, email, phone 
            FROM volunteers
        """)
        rows = cursor.fetchall()
        conn.close()
        
        volunteers = []
        for row in rows:
            volunteers.append({
                "volunteer_id": row[0],
                "volunteer_name": row[1],
                "assigned_gate": row[2],
                "contact": row[3],
                "status": row[4],
                "email": row[5],
                "phone": row[6]
            })
        return volunteers
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/alerts")
def get_alerts():
    """
    Retrieves ALL alerts (both resolved and active) enriched with gate name and live status.
    """
    try:
        try:
            gate_metrics = get_gates_metrics()
            gate_status_map = {g["gate_id"]: g["predicted_risk"] for g in gate_metrics}
        except Exception as e:
            print(f"Error fetching gate metrics for alerts: {e}")
            gate_status_map = {}

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.alert_id, a.gate_id, g.gate_name, a.alert_type,
                   a.severity, a.message, a.recommendation,
                   a.is_resolved, a.alert_time
            FROM alerts a
            LEFT JOIN gates g ON a.gate_id = g.gate_id
            ORDER BY a.alert_time DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        result = []
        for row in rows:
            gate_id = row[1]
            result.append({
                "alert_id":      row[0],
                "gate_id":       gate_id,
                "gate_name":     row[2] or f"Gate #{gate_id}",
                "alert_type":    row[3],
                "severity":      row[4] or "Medium",
                "message":       row[5],
                "recommendation": row[6] or "",
                "is_resolved":   row[7] or 0,
                "alert_time":    row[8],
                "gate_status":   gate_status_map.get(gate_id, "Open")
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/alerts/staff-feed")
def get_staff_notification_feed(limit: int = 15):
    """
    Fast cache-first endpoint: returns the last `limit` Staff Notification alerts.
    Reads from pre-computed system_settings cache written by simulation thread.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_settings WHERE key = 'latest_staff_feed'")
        row = cursor.fetchone()
        conn.close()
        feed = json.loads(row[0]) if row and row[0] else []
        return feed[:limit]
    except Exception as e:
        logger.warning(f"[GET /alerts/staff-feed] Cache read fallback: {e}")
        return []


# ----------------- JWT & SECURITY HELPERS -----------------

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token or missing authorization header")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise HTTPException(status_code=401, detail="Token payload invalid")
        return {"username": username, "role": role}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired")


def calculate_gate_status(max_capacity: int, occ_pct: float, queue_count: int, pred: dict) -> str:
    """
    Centralized status engine for all gates.
    Proposed statuses:
    - Closed (max_capacity == 0)
    - Critical (occ_pct >= 85.0 or pred["risk"] == "Dangerous" or queue_count >= 50)
    - Busy (pred["congestion"] == "High" or pred["waiting_time"] >= 5.0 or queue_count >= 30)
    - Warning (occ_pct >= 60.0 or pred["risk"] == "Warning" or queue_count >= 10)
    - Open (default)
    """
    if max_capacity == 0:
        return "Closed"
    wait_time = pred.get("waiting_time") if pred.get("waiting_time") is not None else 0.0
    risk = pred.get("risk") or "Safe"
    congestion = pred.get("congestion") or "Low"
    
    if occ_pct >= 85.0 or risk in ["Dangerous", "Critical"] or queue_count >= 50:
        return "Critical"
    elif congestion in ["High", "Critical"] or wait_time >= 5.0 or queue_count >= 30:
        return "Busy"
    elif occ_pct >= 60.0 or risk == "Warning" or queue_count >= 10:
        return "Warning"
    else:
        return "Open"


# ----------------- DYNAMIC ML GATE METRIC PREDICTIONS -----------------

def predict_all_gate_metrics(curr_occ, queue, stationed_volunteers, max_cap, total_active_staff, peak_val=0, arrival_rate=None, entry_rate=None, gate_id=None):
    # --- Per-cycle cache lookup ---
    # get_live_analytics() always calls first (cache miss → runs ML → stores result).
    # All subsequent callers with same gate_id get an instant cache hit (no ML inference).
    if gate_id is not None:
        with _gate_pred_cache_lock:
            cached = _gate_pred_cache.get(gate_id)
        if cached is not None:
            print(f"[PredCache] CACHE HIT gate_id={gate_id} — skipping 6 ML models")
            return cached

    print("START ml_prediction")
    ml_start_t = time.perf_counter()
    try:
        # Calculate total crowd demand at the gate (inside venue + queue waiting at gate)
        total_gate_demand = curr_occ + queue
        occ_pct = (total_gate_demand / max_cap * 100) if max_cap > 0 else 0.0
        
        # Calculate arrival_rate and entry_rate dynamically if not supplied
        if entry_rate is None:
            entry_rate = (1 + stationed_volunteers) * 12
        if arrival_rate is None:
            if peak_val == 1:
                arrival_rate = entry_rate + (queue * 3.0)
            else:
                arrival_rate = max((queue * 1.5), 10.0)

        q_growth = max(arrival_rate - entry_rate, 0.0)
        q_reduction = float(entry_rate)

        # Base input dict in lowercase snake_case
        input_dict = {
            'crowd_count': total_gate_demand,
            'occupancy_pct': occ_pct,
            'queue_length': queue,
            'volunteers_assigned': stationed_volunteers,
            'venue_capacity': max_cap if max_cap > 0 else 1000,
            'total_volunteers': total_active_staff,
            'is_peak_hour': peak_val,
            'arrival_rate_per_min': arrival_rate,
            'entry_rate_per_min': entry_rate,
            'queue_growth_rate_per_min': q_growth,
            'queue_reduction_rate_per_min': q_reduction
        }

        # Model 1: Predict Waiting Time
        try:
            features_df = _prepare_features(input_dict, waiting_time_model, waiting_time_scaler)
            wait_time = max(waiting_time_model.predict(features_df)[0], 0.0)
        except Exception as e:
            logger.exception("Waiting time prediction failed")
            raise e

        # Feed predicted wait_time to downstream models
        input_dict['avg_waiting_time_min'] = wait_time

        # Model 2: Pure ML Model Prediction for Required Volunteers
        try:
            features_df = _prepare_features(input_dict, volunteer_model, volunteer_scaler)
            raw_ml_pred = volunteer_model.predict(features_df)[0]
            req_volunteers = max(0, int(round(raw_ml_pred)))
        except Exception as e:
            logger.exception("Volunteer prediction failed")
            raise e

        # Feed volunteer_gap to downstream Congestion and Risk models
        input_dict['volunteer_gap'] = max(req_volunteers - stationed_volunteers, 0)

        # Model 3: Predict Congestion Level
        try:
            features_df = _prepare_features(input_dict, congestion_model, congestion_scaler)
            congestion_lvl_num = congestion_model.predict(features_df)[0]
            congestion_lvl = congestion_label_encoder.inverse_transform([congestion_lvl_num])[0]
        except Exception as e:
            logger.exception("Congestion level prediction failed")
            raise e
            
        # Model 4: Predict Safety Risk Level
        try:
            features_df = _prepare_features(input_dict, risk_model, risk_scaler)
            pred = risk_model.predict(features_df)[0]
            if isinstance(risk_label_encoder, dict):
                risk_level = risk_label_encoder.get(pred, "Safe")
            else:
                risk_level = risk_label_encoder.inverse_transform([pred])[0]
        except Exception as e:
            logger.exception("Risk level prediction failed")
            raise e
            
        # Model 5: Predict Congestion Score (Random Forest Regressor)
        congestion_score = 0.0
        try:
            features_df = _prepare_features(input_dict, congestion_score_model, congestion_score_scaler)
            congestion_score = max(min(congestion_score_model.predict(features_df)[0], 100.0), 0.0)
        except Exception as e:
            logger.exception("Congestion score prediction failed")
            raise e
            
        # Model 6: Predict Crowd Cluster (KMeans)
        crowd_cluster = "Low Crowd"
        # Estimate a numeric risk_score from the predicted risk_level category
        risk_score_est = 20.0
        if risk_level == "Warning":
            risk_score_est = 55.0
        elif risk_level == "High":
            risk_score_est = 75.0
        elif risk_level in ["Dangerous", "Critical"]:
            risk_score_est = 95.0
            
        # Update input_dict with congestion_score, risk_score, and volunteer_gap for clustering
        input_dict['congestion_score'] = congestion_score
        input_dict['risk_score'] = risk_score_est
        input_dict['crowd_density_per_sqm'] = 0.5 # Sensible default
        input_dict['volunteer_gap'] = max(req_volunteers - stationed_volunteers, 0)
        
        if cluster_model is not None and cluster_scaler is not None:
            print("START kmeans_prediction")
            km_start_t = time.perf_counter()
            try:
                features_df = _prepare_features(input_dict, cluster_model, cluster_scaler)
                cluster_idx = cluster_model.predict(features_df)[0]
                cluster_map = {
                    0: "Medium Crowd",
                    1: "Low Crowd",
                    2: "High Crowd",
                    3: "Critical Crowd"
                }
                crowd_cluster = cluster_map.get(cluster_idx, "Low Crowd")
            except Exception as e:
                logger.exception("Crowd cluster prediction failed")
                raise e
            finally:
                km_elapsed = (time.perf_counter() - km_start_t) * 1000.0
                print("END kmeans_prediction")
                print(f"Execution Time: {km_elapsed:.2f} ms")
                
        result = {
            "risk": risk_level,
            "congestion": congestion_lvl,
            "waiting_time": round(wait_time, 1),
            "req_volunteers": req_volunteers,
            "deficit": max(req_volunteers - stationed_volunteers, 0),
            "crowd_cluster": crowd_cluster,
            "congestion_score": round(congestion_score, 1)
        }
        # --- Store in per-cycle cache ---
        if gate_id is not None:
            with _gate_pred_cache_lock:
                _gate_pred_cache[gate_id] = result
        return result
    finally:
        ml_elapsed = (time.perf_counter() - ml_start_t) * 1000.0
        print("END ml_prediction")
        print(f"Execution Time: {ml_elapsed:.2f} ms")


# ----------------- NEW AUTHENTICATION ENDPOINTS -----------------

@app.post("/auth/login")
def login(data: LoginRequest):
    import time
    start_time = time.perf_counter()
    print(f"[TIMING] [POST /auth/login] Request received")
    try:
        db_start = time.perf_counter()
        conn = get_connection()
        db_opened = time.perf_counter()
        cursor = conn.cursor()
        
        # 1. Search in users (admin/others)
        sql_start = time.perf_counter()
        cursor.execute("SELECT user_id, username, password_hash, role, email, full_name FROM users WHERE username = ?", (data.username,))
        row = cursor.fetchone()
        
        is_volunteer = False
        volunteer_id = None
        
        if row is None:
            # 2. Search in volunteers
            cursor.execute("""
                SELECT volunteer_id, username, password_hash, email, volunteer_name, assigned_gate 
                FROM volunteers WHERE username = ?
            """, (data.username,))
            vol_row = cursor.fetchone()
            if vol_row is None:
                conn.close()
                raise HTTPException(status_code=401, detail="Invalid username or password")
            
            volunteer_id, username, password_hash, email, full_name, assigned_gate = vol_row
            role = "volunteer"
            user_id = volunteer_id # Use volunteer_id as user_id for token mapping
            is_volunteer = True
        else:
            user_id, username, password_hash, role, email, full_name = row
            assigned_gate = None
            
        sql_end = time.perf_counter()
        # Verify password
        bcrypt_start = time.perf_counter()
        pw_ok = bcrypt.checkpw(data.password.encode('utf-8'), password_hash.encode('utf-8'))
        bcrypt_end = time.perf_counter()
        
        print(f"[TIMING] [POST /auth/login] DB open: {(db_opened-db_start)*1000:.2f}ms, SQL: {(sql_end-sql_start)*1000:.2f}ms, Bcrypt check: {(bcrypt_end-bcrypt_start)*1000:.2f}ms")
        
        if not pw_ok:
            conn.close()
            raise HTTPException(status_code=401, detail="Invalid username or password")
            
        # If volunteer, record login event details, update status and attendance
        if is_volunteer:
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            today_str = datetime.now().strftime("%Y-%m-%d")
            
            # Update volunteer table
            cursor.execute(
                """
                UPDATE volunteers 
                SET last_login = ?, status = 'Available', attendance_status = 'Checked In', gate_duty_start_time = ? 
                WHERE volunteer_id = ?
                """,
                (now_str, now_str, volunteer_id)
            )
            
            # Log activity
            cursor.execute(
                """
                INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                VALUES (?, 'Login', ?, 'Volunteer logged in successfully')
                """,
                (volunteer_id, assigned_gate)
            )
            
            # Create a check-in record in attendance if not already present
            cursor.execute(
                "SELECT attendance_id FROM attendance WHERE volunteer_id = ? AND date = ?", 
                (volunteer_id, today_str)
            )
            att_row = cursor.fetchone()
            if not att_row:
                cursor.execute(
                    "INSERT INTO attendance (volunteer_id, check_in_time, date) VALUES (?, ?, ?)",
                    (volunteer_id, now_str, today_str)
                )
            
            conn.commit()
            
        conn.close()
        
        # Create token
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        payload = {
            "sub": username,
            "role": role,
            "exp": expire
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        
        duration = (time.perf_counter() - start_time) * 1000
        print(f"[TIMING] [POST /auth/login] Completed in {duration:.2f}ms")
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "user_id": user_id,
                "username": username,
                "role": role,
                "email": email,
                "full_name": full_name
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")


@app.post("/auth/logout")
def logout(current_user: dict = Depends(get_current_user)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        if current_user["role"] == "volunteer":
            # Find volunteer record
            cursor.execute(
                "SELECT volunteer_id, last_login, assigned_gate FROM volunteers WHERE username = ?", 
                (current_user["username"],)
            )
            vol_row = cursor.fetchone()
            if vol_row:
                volunteer_id, last_login_str, assigned_gate = vol_row
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                today_str = datetime.now().strftime("%Y-%m-%d")
                
                # Compute session duration
                session_dur = 0
                if last_login_str:
                    try:
                        login_t = datetime.strptime(last_login_str, "%Y-%m-%d %H:%M:%S")
                        logout_t = datetime.strptime(now_str, "%Y-%m-%d %H:%M:%S")
                        session_dur = int((logout_t - login_t).total_seconds())
                    except:
                        pass
                
                # Calculate time spent at current gate upon logout
                cursor.execute("SELECT gate_duty_start_time, assigned_gate FROM volunteers WHERE volunteer_id=?", (volunteer_id,))
                duty_row = cursor.fetchone()
                duty_dur = 0
                if duty_row and duty_row[0]:
                    duty_start_str = duty_row[0]
                    assigned_gate_id = duty_row[1]
                    try:
                        duty_start_t = datetime.strptime(duty_start_str, "%Y-%m-%d %H:%M:%S")
                        logout_t = datetime.strptime(now_str, "%Y-%m-%d %H:%M:%S")
                        duty_dur = int((logout_t - duty_start_t).total_seconds())
                        
                        # Get gate name
                        gate_name = "Reserve Pool"
                        if assigned_gate_id:
                            cursor.execute("SELECT gate_name FROM gates WHERE gate_id=?", (assigned_gate_id,))
                            gn_row = cursor.fetchone()
                            if gn_row:
                                gate_name = gn_row[0]
                        
                        cursor.execute("""
                            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                            VALUES (?, 'Gate Duty Duration', ?, ?)
                        """, (volunteer_id, assigned_gate_id, f"Spent {duty_dur // 60}m {duty_dur % 60}s at {gate_name}"))
                    except Exception as ex:
                        print(f"Error logging duty duration on logout: {ex}")

                # Cancel any active Pending, Accepted, En Route, or Arrived assignment requests for the volunteer
                cursor.execute("""
                    UPDATE assignment_requests
                    SET status = 'Cancelled', updated_at = ?
                    WHERE volunteer_id = ? AND status IN ('Pending', 'Accepted', 'En Route', 'Arrived')
                """, (now_str, volunteer_id))

                # Update volunteers table
                cursor.execute(
                    """
                    UPDATE volunteers 
                    SET last_logout = ?, status = 'Offline', attendance_status = 'Absent', session_duration = ?, gate_duty_start_time = NULL 
                    WHERE volunteer_id = ?
                    """,
                    (now_str, session_dur, volunteer_id)
                )
                
                # Log activity
                cursor.execute(
                    """
                    INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                    VALUES (?, 'Logout', ?, ?)
                    """,
                    (volunteer_id, assigned_gate, f"Volunteer logged out. Duration: {session_dur} seconds")
                )
                
                # Update attendance record
                cursor.execute(
                    "UPDATE attendance SET check_out_time = ? WHERE volunteer_id = ? AND date = ?",
                    (now_str, volunteer_id, today_str)
                )
                
                conn.commit()
                
        conn.close()
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Logout error: {str(e)}")


@app.get("/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        if current_user["role"] == "volunteer":
            cursor.execute("""
                SELECT volunteer_id, username, email, volunteer_name 
                FROM volunteers WHERE username = ?
            """, (current_user["username"],))
            row = cursor.fetchone()
            conn.close()
            
            if row is None:
                raise HTTPException(status_code=404, detail="Volunteer profile not found")
                
            volunteer_id, username, email, full_name = row
            return {
                "user_id": volunteer_id,
                "username": username,
                "role": "volunteer",
                "email": email,
                "full_name": full_name
            }
        else:
            cursor.execute("SELECT user_id, username, role, email, full_name FROM users WHERE username = ?", (current_user["username"],))
            row = cursor.fetchone()
            conn.close()
            
            if row is None:
                raise HTTPException(status_code=404, detail="User not found")
                
            user_id, username, role, email, full_name = row
            return {
                "user_id": user_id,
                "username": username,
                "role": role,
                "email": email,
                "full_name": full_name
            }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ----------------- NEW METRICS & PREDICTIONS ENDPOINTS -----------------

@app.get("/gates/metrics")
def get_gates_metrics(peak: int = None):
    """
    Returns per-gate ML predictions and occupancy metrics.

    Architecture: Cache-first, never compute ML on the request path.

    The simulation thread is the ONLY writer of ML predictions.
    It writes the results to system_settings['latest_gate_metrics'] after every
    cycle via update_cached_analytics(). This endpoint simply reads that
    pre-computed cache — no ML, no blocking, no race conditions.

    During simulation reset:
    - Returns stale cache data if available (last known good state).
    - Returns an empty list with a clear status message if cache is missing.
    - Never returns HTTP 500 due to a DB race condition with _reset_worker.

    Performance target: < 100ms normal, < 150ms post-reset.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT value FROM system_settings WHERE key = 'latest_gate_metrics'"
        )
        row = cursor.fetchone()
        conn.close()

        if row and row[0]:
            gate_metrics = json.loads(row[0])
            return gate_metrics

        # Cache is empty (first start or mid-reset): return clean empty state
        # instead of crashing or triggering a live ML computation
        return []

    except Exception as e:
        # Never propagate a 500 to the client — return empty list so the
        # frontend degrades gracefully instead of showing an error banner
        logger.warning(f"[GET /gates/metrics] Cache read failed: {e} — returning empty list")
        return []




@app.get("/analytics/historical")
def get_analytics_historical(limit: int = 100):
    """
    Reads historical data from notebooks/crowd_dataset.csv and returns a slice of records
    useful for rendering trends in the frontend.
    """
    try:
        csv_path = os.path.abspath(os.path.join(MODEL_DIR, "crowd_dataset.csv"))
        if not os.path.exists(csv_path):
            raise HTTPException(status_code=404, detail="Historical crowd dataset not found")
            
        df = pd.read_csv(csv_path)
        
        # Determine column aliases for backward compatibility
        q_col = "queue_length" if "queue_length" in df.columns else ("Queue_Length" if "Queue_Length" in df.columns else df.columns[0])
        occ_col = "occupancy_pct" if "occupancy_pct" in df.columns else ("Occupancy_Percentage" if "Occupancy_Percentage" in df.columns else df.columns[0])
        vol_col = "volunteers_assigned" if "volunteers_assigned" in df.columns else ("Volunteers_Assigned" if "Volunteers_Assigned" in df.columns else df.columns[0])
        
        # Add Congestion_Score if missing
        if "congestion_score" in df.columns:
            df["Congestion_Score"] = df["congestion_score"]
        else:
            df["Congestion_Score"] = (df[q_col] * 0.4) + (df[occ_col] * 0.6)
            
        # Guarantee both camelCase and snake_case aliases for frontend consumption
        df["Queue_Length"] = df[q_col]
        df["Occupancy_Percentage"] = df[occ_col]
        df["Volunteers_Assigned"] = df[vol_col]
        df["queue_length"] = df[q_col]
        df["occupancy_pct"] = df[occ_col]
        df["volunteers_assigned"] = df[vol_col]
        
        df = df.fillna(0)
        subset = df.head(limit).to_dict(orient="records")
        print(f"[Analytics] Served {len(subset)} historical crowd records successfully.")
        return subset
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read historical dataset: {str(e)}")


# ----------------- NEW VOLUNTEER CRUD ENDPOINTS -----------------

@app.post("/volunteers", status_code=201)
def create_volunteer(vol: VolunteerCreate):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verify gate exists if assigned_gate is provided
        if vol.assigned_gate is not None:
            cursor.execute("SELECT gate_id FROM gates WHERE gate_id = ?", (vol.assigned_gate,))
            if cursor.fetchone() is None:
                conn.close()
                raise HTTPException(status_code=404, detail=f"Gate with ID {vol.assigned_gate} not found")
                
        # Check if username is already registered
        if vol.username:
            cursor.execute("SELECT volunteer_id FROM volunteers WHERE username = ?", (vol.username,))
            if cursor.fetchone() is not None:
                conn.close()
                raise HTTPException(status_code=400, detail=f"Username '{vol.username}' is already registered.")

        # Hash password if provided
        pass_hash = None
        if vol.password:
            pass_hash = bcrypt.hashpw(vol.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        cursor.execute(
            """
            INSERT INTO volunteers (
                volunteer_name, assigned_gate, contact, email, phone, status, username, password_hash, attendance_status, profile_photo, joining_date, experience, age, gender
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                vol.volunteer_name, 
                vol.assigned_gate, 
                vol.contact, 
                vol.email or vol.contact,
                vol.phone or vol.contact,
                'Offline', 
                vol.username, 
                pass_hash, 
                'Absent',
                vol.profile_photo,
                vol.joining_date,
                vol.experience,
                vol.age,
                vol.gender
            )
        )
        conn.commit()
        vol_id = cursor.lastrowid
        conn.close()
        
        return {
            "message": "Volunteer registered successfully",
            "volunteer_id": vol_id,
            "volunteer_name": vol.volunteer_name,
            "assigned_gate": vol.assigned_gate,
            "contact": vol.contact,
            "email": vol.email,
            "phone": vol.phone,
            "username": vol.username,
            "status": "Offline",
            "attendance_status": "Absent"
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")





@app.delete("/volunteers/{volunteer_id}")
def delete_volunteer(volunteer_id: int):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verify volunteer exists
        cursor.execute("SELECT volunteer_id FROM volunteers WHERE volunteer_id = ?", (volunteer_id,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Volunteer with ID {volunteer_id} not found")
            
        cursor.execute("DELETE FROM volunteers WHERE volunteer_id = ?", (volunteer_id,))
        conn.commit()
        conn.close()
        
        return {
            "message": f"Volunteer with ID {volunteer_id} deleted successfully"
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/admin/volunteers/{volunteer_id}")
def get_admin_volunteer_details(volunteer_id: int, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Admin role required")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 1. Fetch main volunteer profile record
        cursor.execute("""
            SELECT volunteer_name, email, phone, contact, joining_date, experience, profile_photo,
                   assigned_gate, status, attendance_status, username, last_login, last_logout, age, gender
            FROM volunteers WHERE volunteer_id = ?
        """, (volunteer_id,))
        vol_row = cursor.fetchone()
        
        if not vol_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Volunteer not found")
            
        name, email, phone, contact, joining_date, experience, profile_photo, gate_id, status, att_status, username_val, last_login_val, last_logout_val, age_val, gender_val = vol_row
        
        # Get gate name
        gate_name = "Reserve Pool"
        if gate_id is not None:
            cursor.execute("SELECT gate_name FROM gates WHERE gate_id = ?", (gate_id,))
            g_row = cursor.fetchone()
            if g_row:
                gate_name = g_row[0]
                
        # 2. Fetch stats
        cursor.execute("SELECT COUNT(*) FROM volunteer_checklists WHERE volunteer_id = ?", (volunteer_id,))
        checklists_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE volunteer_id = ?", (volunteer_id,))
        incidents_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM assignment_requests WHERE volunteer_id = ? AND status = 'Completed'", (volunteer_id,))
        assignments_count = cursor.fetchone()[0]
        
        # Count distinct days present (only rows where check_in exists)
        cursor.execute("""
            SELECT COUNT(DISTINCT date) FROM attendance
            WHERE volunteer_id = ? AND check_in_time IS NOT NULL
        """, (volunteer_id,))
        total_days_present = cursor.fetchone()[0]
        
        # Current shift status — is the volunteer currently checked in?
        cursor.execute("""
            SELECT check_in_time, check_out_time FROM attendance
            WHERE volunteer_id = ?
            ORDER BY check_in_time DESC LIMIT 1
        """, (volunteer_id,))
        latest_att = cursor.fetchone()
        current_shift_status = "Not checked in"
        if latest_att:
            check_in_t, check_out_t = latest_att
            if check_in_t and not check_out_t:
                current_shift_status = f"Checked in since {check_in_t}"
            elif check_in_t and check_out_t:
                current_shift_status = f"Checked out at {check_out_t}"
        
        # 3. Attendance history
        cursor.execute("""
            SELECT attendance_id, check_in_time, check_out_time, date 
            FROM attendance 
            WHERE volunteer_id = ? 
            ORDER BY date DESC, check_in_time DESC
        """, (volunteer_id,))
        att_rows = cursor.fetchall()
        
        attendance_history = []
        total_hours = 0.0
        for att_id, check_in, check_out, dt in att_rows:
            duration = 0.0
            if check_in and check_out:
                try:
                    dt_in = datetime.strptime(check_in, "%Y-%m-%d %H:%M:%S")
                    dt_out = datetime.strptime(check_out, "%Y-%m-%d %H:%M:%S")
                    duration = round((dt_out - dt_in).total_seconds() / 3600.0, 2)
                    total_hours += duration
                except:
                    pass
            attendance_history.append({
                "attendance_id": att_id,
                "check_in_time": check_in,
                "check_out_time": check_out,
                "date": dt,
                "duration_hours": duration
            })
            
        # 4. Checklist History
        cursor.execute("""
            SELECT arrived_at_gate, qr_scanner_working, barricades_checked, crowd_flow_normal, emergency_exit_clear, communication_device_checked, shift_completed, submitted_at, date
            FROM volunteer_checklists
            WHERE volunteer_id = ?
            ORDER BY date DESC
        """, (volunteer_id,))
        checklist_rows = cursor.fetchall()
        checklists = []
        for r in checklist_rows:
            checklists.append({
                "arrived_at_gate": r[0],
                "qr_scanner_working": r[1],
                "barricades_checked": r[2],
                "crowd_flow_normal": r[3],
                "emergency_exit_clear": r[4],
                "communication_device_checked": r[5],
                "shift_completed": r[6],
                "submitted_at": r[7],
                "date": r[8]
            })
            
        # 5. Work Reports
        cursor.execute("""
            SELECT report_id, date, tasks, crowd_situation, issues_faced, action_taken, suggestions, additional_notes, submitted_at
            FROM daily_work_reports
            WHERE volunteer_id = ?
            ORDER BY date DESC
        """, (volunteer_id,))
        report_rows = cursor.fetchall()
        reports = []
        for r in report_rows:
            reports.append({
                "report_id": r[0],
                "date": r[1],
                "tasks": r[2],
                "crowd_situation": r[3],
                "issues_faced": r[4],
                "action_taken": r[5],
                "suggestions": r[6],
                "additional_notes": r[7],
                "submitted_at": r[8]
            })
            
        # 6. Timeline logs
        cursor.execute("""
            SELECT activity_type, timestamp, details 
            FROM volunteer_activity_logs 
            WHERE volunteer_id = ? 
            ORDER BY timestamp DESC LIMIT 20
        """, (volunteer_id,))
        timeline = [{"activity_type": r[0], "timestamp": r[1], "details": r[2]} for r in cursor.fetchall()]
        
        # 7. Active Notifications audit trail
        cursor.execute("""
            SELECT notification_id, notification_type, title, message, status, created_at
            FROM volunteer_notifications
            WHERE volunteer_id = ?
            ORDER BY created_at DESC
        """, (volunteer_id,))
        notifications = []
        for r in cursor.fetchall():
            notifications.append({
                "notification_id": r[0],
                "notification_type": r[1],
                "title": r[2],
                "message": r[3],
                "status": r[4],
                "created_at": r[5]
            })
            
        # 8. Incident reports filed
        cursor.execute("""
            SELECT incident_id, incident_type, location, severity, description, photo_url, created_at, is_resolved
            FROM incidents
            WHERE volunteer_id = ?
            ORDER BY created_at DESC
        """, (volunteer_id,))
        inc_rows = cursor.fetchall()
        incidents_filed = []
        for r in inc_rows:
            incidents_filed.append({
                "incident_id": r[0],
                "incident_type": r[1],
                "location": r[2],
                "severity": r[3],
                "description": r[4],
                "photo_url": r[5],
                "created_at": r[6],
                "is_resolved": bool(r[7])
            })
            
        # 9. Assignments
        cursor.execute("""
            SELECT request_id, from_gate_id, to_gate_id, reason, priority, status, created_at
            FROM assignment_requests
            WHERE volunteer_id = ?
            ORDER BY created_at DESC
        """, (volunteer_id,))
        asg_rows = cursor.fetchall()
        assignments = []
        for r in asg_rows:
            assignments.append({
                "request_id": r[0],
                "from_gate_id": r[1],
                "to_gate_id": r[2],
                "reason": r[3],
                "priority": r[4],
                "status": r[5],
                "created_at": r[6]
            })
        # Get current active assignment request
        cursor.execute("""
            SELECT r.status, tg.gate_name, r.reason 
            FROM assignment_requests r 
            LEFT JOIN gates tg ON r.to_gate_id = tg.gate_id 
            WHERE r.volunteer_id = ? AND r.status IN ('Pending', 'Accepted', 'En Route', 'Arrived') 
            ORDER BY r.created_at DESC LIMIT 1
        """, (volunteer_id,))
        asg_row = cursor.fetchone()
        current_assignment = {
            "status": asg_row[0],
            "to_gate_name": asg_row[1],
            "reason": asg_row[2]
        } if asg_row else None
        
        conn.close()
        
        operator_score = min(100, 80 + (checklists_count * 3) + (assignments_count * 5))
        
        return {
            "volunteer_id": volunteer_id,
            "volunteer_name": name,
            "role": "volunteer",
            "username": username_val or "",
            "email": email or "",
            "phone": phone or "",
            "emergency_contact": contact,
            "joining_date": joining_date or "2026-06-01",
            "experience": experience or "Entry Level",
            "profile_photo": profile_photo or "",
            "age": age_val,
            "gender": gender_val or "",
            "assigned_gate": gate_id,
            "gate_name": gate_name,
            "status": status,
            "attendance_status": att_status,
            "last_login": last_login_val or "",
            "last_logout": last_logout_val or "",
            "current_shift_status": current_shift_status,
            "current_assignment": current_assignment,
            "stats": {
                "checklists_submitted": checklists_count,
                "incidents_reported": incidents_count,
                "assignments_completed": assignments_count,
                "total_hours": round(total_hours, 2),
                "total_days_present": total_days_present,
                "operator_score": operator_score
            },
            "attendance_history": attendance_history,
            "checklists": checklists,
            "work_reports": reports,
            "timeline": timeline,
            "notifications": notifications,
            "incidents": incidents_filed,
            "assignments": assignments
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ----------------- DAY 25: VOLUNTEER AUTO-ASSIGNMENT ENGINE -----------------

# Virtual zone coordinates for nearest-volunteer search.
# Indexed by gate position (0-based); wraps modularly for any number of gates.
_GATE_ZONE_COORDS = [
    (0.0, 0.0),   # Gate 0 → NW corner  (VIP / Main Entrance)
    (4.0, 0.0),   # Gate 1 → NE corner  (East Entrance)
    (0.0, 4.0),   # Gate 2 → SW corner  (West Entrance)
    (4.0, 4.0),   # Gate 3 → SE corner  (Food Court)
    (2.0, 2.0),   # Gate 4 → Centre     (Main Arena)
]

# Overload thresholds (mirrors alert thresholds for consistency)
_OVERLOAD_OCC_PCT  = 85.0
_OVERLOAD_QUEUE    = 20

def _zone_distance(c1: tuple, c2: tuple) -> float:
    return ((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2) ** 0.5


def calculate_volunteer_suitability(
    vol_coords: tuple,
    target_coords: tuple,
    incident_type: str = "General",
    vol_skills: str = "general,crowd_control",
    dispatches_today: int = 0,
    fatigue_score: int = 0,
    is_reserve: bool = False
) -> dict:
    """
    Computes a multi-factor Responder Suitability Score (0 - 100)
    combining density-weighted travel time, skill match, workload balance, and fatigue.
    """
    dist = _zone_distance(vol_coords, target_coords)
    est_travel_seconds = max(int(dist * 5.0), 5)
    travel_score = max(100.0 - (est_travel_seconds * 0.5), 0.0)

    skills_list = [s.strip().lower() for s in (vol_skills or "").split(",") if s.strip()]
    inc_lower = (incident_type or "General").lower()
    
    if "medical" in inc_lower:
        skill_score = 100.0 if "medical" in skills_list else 40.0
    elif "security" in inc_lower or "overload" in inc_lower or "crowd" in inc_lower or "surge" in inc_lower:
        skill_score = 100.0 if ("security" in skills_list or "crowd_control" in skills_list) else 60.0
    else:
        skill_score = 90.0 if "general" in skills_list or len(skills_list) > 0 else 70.0

    workload_score = max(100.0 - (dispatches_today * 15.0), 20.0)
    fatigue_subscore = max(100.0 - (fatigue_score * 1.0), 0.0)

    total_score = (
        (0.35 * travel_score) +
        (0.30 * skill_score) +
        (0.20 * workload_score) +
        (0.15 * fatigue_subscore)
    )

    if is_reserve:
        total_score = min(total_score + 5.0, 100.0)

    return {
        "suitability_score": round(total_score, 1),
        "est_travel_seconds": est_travel_seconds,
        "travel_score": round(travel_score, 1),
        "skill_score": round(skill_score, 1),
        "workload_score": round(workload_score, 1),
        "fatigue_score": round(fatigue_subscore, 1)
    }


def get_live_analytics(conn=None) -> list:
    """
    Centralized analytics engine that calculates occupancy, queue, and runs 
    ML prediction models to determine wait times, risk, required volunteers, 
    deficit, and status for all gates.
    """
    close_here = conn is None
    if conn is None:
        conn = get_connection()
    cursor = conn.cursor()
    try:
        # Get peak_hour from system_settings
        cursor.execute("SELECT value FROM system_settings WHERE key = 'peak_hour'")
        peak_row = cursor.fetchone()
        peak_val = int(peak_row[0]) if peak_row else 0

        cursor.execute("SELECT gate_id, event_id, gate_name, max_capacity FROM gates ORDER BY gate_id")
        gates = cursor.fetchall()

        # Fetch active volunteers to calculate stationed counts
        # Exclude Offline/Inactive volunteers
        cursor.execute(
            "SELECT volunteer_id, volunteer_name, assigned_gate, contact, status FROM volunteers "
            "WHERE status NOT IN ('Offline', 'Inactive') ORDER BY volunteer_id"
        )
        vols = cursor.fetchall()

        # Group volunteers by assigned gate, excluding those currently en-route/moving/arriving
        vol_by_gate = {}
        for vid, vname, ag, contact, status in vols:
            if ag is not None and status not in ['Pending', 'Accepted', 'En Route', 'Arrived']:
                vol_by_gate.setdefault(ag, []).append((vid, vname, contact))

        # ONE SOURCE OF TRUTH: per-status transit counts per gate
        # Split by individual status so dispatch_status can reflect the most-advanced state
        cursor.execute("""
            SELECT to_gate_id, status, COUNT(*)
            FROM assignment_requests
            WHERE status IN ('Pending', 'Accepted', 'En Route', 'Arrived')
            GROUP BY to_gate_id, status
        """)
        transit_by_gate = {}
        for _gid, _st, _cnt in cursor.fetchall():
            if _gid not in transit_by_gate:
                transit_by_gate[_gid] = {'Pending': 0, 'Accepted': 0, 'En Route': 0, 'Arrived': 0}
            transit_by_gate[_gid][_st] = _cnt

        # Fetch active unresolved incidents per gate
        cursor.execute("SELECT location, COUNT(*) FROM incidents WHERE is_resolved = 0 GROUP BY location")
        incidents_by_loc = {row[0]: row[1] for row in cursor.fetchall() if row[0]}

        # Batch query all checked-in occupants and queues per gate in ONE single query
        cursor.execute("""
            SELECT assigned_gate, is_checked_in, COUNT(*)
            FROM attendees
            WHERE assigned_gate IS NOT NULL
            GROUP BY assigned_gate, is_checked_in
        """)
        attendee_counts_by_gate = {}
        for _gid, _is_in, _cnt in cursor.fetchall():
            if _gid not in attendee_counts_by_gate:
                attendee_counts_by_gate[_gid] = {0: 0, 1: 0}
            attendee_counts_by_gate[_gid][_is_in] = _cnt

        analytics_list = []
        for idx, (gate_id, event_id, gate_name, max_capacity) in enumerate(gates):
            g_counts = attendee_counts_by_gate.get(gate_id, {0: 0, 1: 0})
            current_occupancy = g_counts.get(1, 0)
            queue_length = g_counts.get(0, 0)

            stationed = len(vol_by_gate.get(gate_id, []))

            # Run dynamic ML predictions ONLY when simulation is active (simulation_active == True)
            # When simulation_active == False, return idle state ("Waiting for Simulation") without fake predictions
            if not simulation_active:
                pred = {
                    "waiting_time": None,
                    "req_volunteers": 0,
                    "congestion": "—",
                    "risk": "Waiting for Simulation",
                    "cluster": 0
                }
            else:
                total_active_staff = len(vols)
                pred = predict_all_gate_metrics(current_occupancy, queue_length, stationed, max_capacity, total_active_staff, peak_val, gate_id=gate_id)
            
            # --- ONE SOURCE OF TRUTH: authoritative staffing object ---
            tc             = transit_by_gate.get(gate_id, {})
            pending_count  = tc.get('Pending', 0)
            accepted_count = tc.get('Accepted', 0)
            enroute_count  = tc.get('En Route', 0)
            arrived_count  = tc.get('Arrived', 0)
            in_transit     = pending_count + accepted_count + enroute_count + arrived_count

            raw_deficit       = max(pred["req_volunteers"] - stationed, 0)
            effective_staff   = stationed + in_transit
            remaining_deficit = max(pred["req_volunteers"] - effective_staff, 0)

            pred["deficit"] = raw_deficit

            # dispatch_status derived from AGGREGATE counts (highest-progress status wins)
            if arrived_count > 0:
                dispatch_status = "arrived"
            elif enroute_count > 0:
                dispatch_status = "en_route"
            elif accepted_count > 0:
                dispatch_status = "accepted"
            elif pending_count > 0:
                dispatch_status = "dispatching"
            elif remaining_deficit > 0:
                dispatch_status = "need_volunteers"
            else:
                dispatch_status = "monitoring"

            occ_pct = round((current_occupancy / max_capacity * 100), 2) if max_capacity > 0 else 0.0

            # Calculate status
            status = calculate_gate_status(max_capacity, occ_pct, queue_length, pred)

            if status == "Critical":
                priority = "Critical"
                overload = True
            elif status == "Busy":
                priority = "High"
                overload = True
            elif status == "Warning":
                priority = "Medium"
                overload = False
            else:
                priority = "Low"
                overload = False

            # Calculate a multi-factor operational urgency score using all metrics
            risk_score = 50 if pred["risk"] == "Dangerous" else (20 if pred["risk"] == "Warning" else 0)
            congestion_score = 30 if pred["congestion"] == "High" else (10 if pred["congestion"] == "Medium" else 0)
            wait_val = pred["waiting_time"] if pred.get("waiting_time") is not None else 0.0
            urgency_score = (
                risk_score +
                congestion_score +
                occ_pct +
                (queue_length * 2.0) +
                (wait_val * 5.0) +
                (pred["req_volunteers"] * 3.0) +
                (pred["deficit"] * 10.0) +
                (current_occupancy * 0.05)
            )

            # Determine Escalation Status (Priority 5) - FIXED: evaluate remaining_deficit
            if pred["risk"] == "Dangerous" or pred["congestion"] == "High" or queue_length >= 30:
                escalation_status = "Escalation Required"
            elif remaining_deficit == 0:
                escalation_status = "Situation Resolved"
            else:
                escalation_status = "Additional Volunteers Required"

            coords = _GATE_ZONE_COORDS[idx % len(_GATE_ZONE_COORDS)]

            analytics_list.append({
                "gate_id":              gate_id,
                "event_id":             event_id,
                "gate_name":            gate_name,
                "max_capacity":         max_capacity,
                "current_occupancy":    current_occupancy,
                "occupancy_percentage": occ_pct,
                "occupancy_pct":        round(occ_pct, 1),
                "queue_length":         queue_length,
                "stationed_volunteers": stationed,
                "predicted_wait_time":  pred["waiting_time"],
                "predicted_risk":       pred["risk"],
                "required_volunteers":  pred["req_volunteers"],
                "deficit":              raw_deficit,           # raw: required - stationed
                "surplus":              max(stationed - pred["req_volunteers"], 0),
                # Per-status transit counts (split — authoritative source)
                "pending_count":        pending_count,
                "accepted_count":       accepted_count,
                "enroute_count":        enroute_count,
                "arrived_count":        arrived_count,
                "in_transit_count":     in_transit,
                # Derived staffing metrics
                "effective_staff":      effective_staff,
                "remaining_deficit":    remaining_deficit,     # true unmet need
                "effective_deficit":    remaining_deficit,     # backward-compat alias
                "dispatch_status":      dispatch_status,
                "status":               status,

                "congestion_level":     pred["congestion"],
                "priority":             priority,
                "overload":             overload,
                "risk":                 pred["risk"],
                "congestion":           pred["congestion"],
                "waiting_time":         pred["waiting_time"],
                "urgency_score":        round(urgency_score, 1),
                "escalation_status":    escalation_status,
                "volunteers":           [{"volunteer_id": v[0], "volunteer_name": v[1], "contact": v[2]} for v in vol_by_gate.get(gate_id, [])],
                "_coords":              coords,
                "_vols":                vol_by_gate.get(gate_id, []),
            })

        # Calculate global safety score based on active alerts and risk classifications
        cursor.execute("SELECT COUNT(*) FROM alerts WHERE is_resolved = 0")
        active_alerts_count = cursor.fetchone()[0]

        dangerous_count = sum(1 for g in analytics_list if g["predicted_risk"] == "Dangerous")
        warning_count = sum(1 for g in analytics_list if g["predicted_risk"] == "Warning")

        risk_index_penalty = (dangerous_count * 3) + (warning_count * 1)
        safety_score = max(100 - (risk_index_penalty * 15) - (active_alerts_count * 8), 0)

        if safety_score <= 40:
            safety_label = 'CRITICAL'
            safety_color = 'text-danger'
        elif safety_score <= 80:
            safety_label = 'CAUTION'
            safety_color = 'text-warning'
        else:
            safety_label = 'OPTIMAL'
            safety_color = 'text-success'

        for g in analytics_list:
            g["safety_score"] = safety_score
            g["safety_label"] = safety_label
            g["safety_color"] = safety_color

        # Sort gates by backend operational urgency score descending
        analytics_list.sort(key=lambda x: x["urgency_score"], reverse=True)

        return analytics_list
    except Exception as e:
        print(f"Error in get_live_analytics: {e}")
        raise e
    finally:
        if close_here:
            conn.close()


def compute_assignments(conn=None, strip_helpers=True) -> list:
    """
    Intelligent Volunteer Allocation Engine.
    Consumes from get_live_analytics() to avoid duplicate calculations.
    Incorporate Responder Suitability Scoring, Gate Priority Scoring (GPS), Safety Buffer Guards, and Explainable AI.
    """
    close_here = conn is None
    if conn is None:
        conn = get_connection()
    cursor = conn.cursor()

    # Call get_live_analytics to retrieve unified gate data
    gate_data = get_live_analytics(conn)

    # Fetch volunteer IDs with active dispatches to prevent duplicate recommendations
    cursor.execute(
        "SELECT volunteer_id FROM assignment_requests WHERE status IN ('Pending', 'Accepted', 'En Route', 'Arrived')"
    )
    moving_vids = {row[0] for row in cursor.fetchall()}

    # Fetch unassigned volunteers with skills and workload metrics
    cursor.execute(
        "SELECT volunteer_id, volunteer_name, contact, skills, dispatches_today, fatigue_score FROM volunteers "
        "WHERE assigned_gate IS NULL AND status NOT IN ('Offline', 'Inactive') ORDER BY volunteer_id"
    )
    unassigned_rows = cursor.fetchall()
    unassigned_pool = [
        (row[0], row[1], row[2], row[3] or "general,crowd_control", row[4] or 0, row[5] or 0) 
        for row in unassigned_rows 
        if row[0] not in moving_vids
    ]

    # Fetch configurable reserve pool size and safety buffer from system settings
    cursor.execute("SELECT value FROM system_settings WHERE key = 'reserve_pool_size'")
    res_row = cursor.fetchone()
    reserve_pool_size = int(res_row[0]) if res_row else 2

    cursor.execute("SELECT value FROM system_settings WHERE key = 'safety_buffer_size'")
    sb_row = cursor.fetchone()
    safety_buffer = int(sb_row[0]) if sb_row else 1

    # Bypass reserve pool during Peak Hour to deploy every available volunteer
    cursor.execute("SELECT value FROM system_settings WHERE key = 'peak_hour'")
    peak_row = cursor.fetchone()
    peak_val = int(peak_row[0]) if peak_row else 0
    if peak_val == 1:
        reserve_pool_size = 0

    # Build surplus volunteer pool enforcing Safety Buffer Guards
    surplus_pool: list[dict] = []
    for g in gate_data:
        # Enforce Safety Buffer: do not release if gate is Dangerous/Critical or if releasing breaks (Required + Buffer)
        stationed_cnt = g["stationed_volunteers"]
        req_cnt = g["required_volunteers"]
        risk = g.get("predicted_risk", "Safe")
        
        releasable_count = max(stationed_cnt - req_cnt, 0)
        if risk in ["Dangerous", "Critical"]:
            releasable_count = 0

        if releasable_count > 0:
            for vid, vname, contact in g["_vols"][:releasable_count]:
                if vid not in moving_vids:
                    # Fetch extra volunteer details
                    cursor.execute("SELECT skills, dispatches_today, fatigue_score FROM volunteers WHERE volunteer_id=?", (vid,))
                    v_meta = cursor.fetchone()
                    v_skills = v_meta[0] if v_meta and v_meta[0] else "general,crowd_control"
                    v_disp = v_meta[1] if v_meta and v_meta[1] else 0
                    v_fat = v_meta[2] if v_meta and v_meta[2] else 0

                    surplus_pool.append({
                        "volunteer_id":   vid,
                        "volunteer_name": vname,
                        "contact":        contact,
                        "from_gate_id":   g["gate_id"],
                        "from_gate":      g["gate_name"],
                        "from_coords":    g["_coords"],
                        "skills":         v_skills,
                        "dispatches_today": v_disp,
                        "fatigue_score":  v_fat,
                        "is_reserve":     False,
                    })

    standby_vols = []
    for vid, vname, contact, vskills, vdisp, vfat in unassigned_pool:
        standby_vols.append({
            "volunteer_id":   vid,
            "volunteer_name": vname,
            "contact":        contact,
            "from_gate_id":   None,
            "from_gate":      "Reserve Pool (Unassigned)",
            "from_coords":    (2.0, 2.0),
            "skills":         vskills,
            "dispatches_today": vdisp,
            "fatigue_score":  vfat,
            "is_reserve":     True,
        })

    # Keep reserve_pool_size volunteers in standby, allow deployment of the rest
    allowed_standby_count = max(len(standby_vols) - reserve_pool_size, 0)
    for v in standby_vols[:allowed_standby_count]:
        surplus_pool.append(v)

    # Sort deficit gates by urgency score and deficit descending
    deficit_gates = sorted(
        [g for g in gate_data if g["effective_deficit"] > 0],
        key=lambda x: (x.get("effective_deficit", 0), x.get("urgency_score", 0)),
        reverse=True
    )

    used: set[int] = set()
    for g in gate_data:
        g["suggested_moves"] = []

    gate_rank = 1
    for g in deficit_gates:
        target_c = g["_coords"]
        avail = [v for v in surplus_pool if v["volunteer_id"] not in used]

        # Calculate Suitability Score for each available volunteer candidate
        avail_with_score = []
        for vol in avail:
            suit = calculate_volunteer_suitability(
                vol_coords=vol["from_coords"],
                target_coords=target_c,
                incident_type=g.get("status", "General"),
                vol_skills=vol.get("skills", "general"),
                dispatches_today=vol.get("dispatches_today", 0),
                fatigue_score=vol.get("fatigue_score", 0),
                is_reserve=vol.get("is_reserve", False)
            )
            vol_entry = dict(vol)
            vol_entry["suitability"] = suit
            avail_with_score.append(vol_entry)

        # Sort candidate pool by Suitability Score descending
        avail_sorted = sorted(
            avail_with_score,
            key=lambda v: v["suitability"]["suitability_score"],
            reverse=True
        )

        for vol in avail_sorted[:g["effective_deficit"]]:
            suit = vol["suitability"]
            rationale_text = (
                f"Suitability Score: {suit['suitability_score']}/100 | "
                f"Est. Travel: {suit['est_travel_seconds']}s | "
                f"Skill Match: {'High' if suit['skill_score'] > 80 else 'General'} | "
                f"Gate Priority Rank: #{gate_rank}"
            )

            g["suggested_moves"].append({
                "volunteer_id":       vol["volunteer_id"],
                "volunteer_name":     vol["volunteer_name"],
                "contact":            vol["contact"],
                "from_gate":          vol["from_gate"],
                "from_gate_id":       vol["from_gate_id"],
                "distance_score":     round(_zone_distance(vol["from_coords"], target_c), 2),
                "suitability_score":  suit["suitability_score"],
                "est_travel_seconds": suit["est_travel_seconds"],
                "explainable_reason": rationale_text
            })
            used.add(vol["volunteer_id"])

        gate_rank += 1

    if strip_helpers:
        for g in gate_data:
            if "_coords" in g:
                del g["_coords"]
            if "_vols" in g:
                del g["_vols"]

    if close_here:
        conn.close()
    return gate_data


# ---- Assignment Endpoints ----

@app.get("/volunteers/deficits")
def get_volunteer_deficits():
    """
    Returns per-gate ML deficit analysis, smart redeployment suggestions,
    active dispatches, and before/after impact.

    The simulation thread is the ONLY place that runs ML, computes allocations,
    and computes redeployment impact. It writes the results to system_settings
    after every cycle via update_cached_analytics(). This endpoint simply reads
    that pre-computed data — no ML, no compute, no blocking.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Read all pre-computed allocation data from simulation-thread-written cache in 1 query
        cursor.execute("SELECT key, value FROM system_settings WHERE key IN ('latest_volunteer_deficits', 'latest_reallocation_impact', 'latest_active_dispatches')")
        cache_map = {row[0]: json.loads(row[1]) for row in cursor.fetchall() if row[1]}
        conn.close()

        return {
            "gates":            cache_map.get("latest_volunteer_deficits", []),
            "active_dispatches": cache_map.get("latest_active_dispatches", []),
            "impact":           cache_map.get("latest_reallocation_impact", {
                "before": {"total_deficit": 0, "avg_wait_time": 0.0, "critical_gates": 0},
                "after":  {"total_deficit": 0, "avg_wait_time": 0.0, "critical_gates": 0}
            })
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assignment engine error: {str(e)}")





@app.get("/analytics/operational-kpis")
def get_operational_kpis():
    """
    Returns venue-wide Real-Time Command Center KPIs.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 1. Total & Deployed Active Volunteers
        cursor.execute("SELECT COUNT(*), SUM(CASE WHEN status IN ('Stationed', 'En Route', 'Accepted', 'Pending') THEN 1 ELSE 0 END) FROM volunteers WHERE status NOT IN ('Offline', 'Inactive')")
        row_v = cursor.fetchone()
        total_active_vols = (row_v[0] if row_v and row_v[0] else 0)
        deployed_vols = (row_v[1] if row_v and row_v[1] else 0)
        utilization_pct = round((deployed_vols / total_active_vols * 100), 1) if total_active_vols > 0 else 0.0

        # 2. Avg Response Time & Travel Time
        cursor.execute("""
            SELECT 
                AVG(strftime('%s', accepted_at) - strftime('%s', created_at)),
                AVG(strftime('%s', arrived_at) - strftime('%s', en_route_at))
            FROM assignment_requests
            WHERE status IN ('Completed', 'Arrived', 'En Route', 'Accepted')
        """)
        row_times = cursor.fetchone()
        avg_resp_sec = round(row_times[0], 1) if row_times and row_times[0] else 14.2
        avg_travel_sec = round(row_times[1], 1) if row_times and row_times[1] else 38.5

        # 3. Allocation Efficiency & Venue Priority Score (Read from pre-computed cache)
        cursor.execute("SELECT value FROM system_settings WHERE key = 'latest_gate_metrics'")
        cache_row = cursor.fetchone()
        analytics = json.loads(cache_row[0]) if cache_row and cache_row[0] else []
        
        total_req = sum(g.get("required_volunteers", 0) for g in analytics)
        total_eff = sum(g.get("effective_staff", 0) for g in analytics)
        eff_pct = round(min((total_eff / total_req * 100), 100.0), 1) if total_req > 0 else 100.0

        # Venue Hazard Score derived from average occupancy and risk level
        avg_hazard = round(sum((g.get("occupancy_pct", 0.0) * 0.5) + (50.0 if g.get("predicted_risk") in ["Critical", "Dangerous"] else 0.0) for g in analytics) / len(analytics), 1) if analytics else 0.0

        conn.close()
        return {
            "volunteer_utilization_pct": utilization_pct,
            "deployed_volunteers": deployed_vols,
            "total_active_volunteers": total_active_vols,
            "avg_response_time_seconds": avg_resp_sec,
            "avg_travel_time_seconds": avg_travel_sec,
            "allocation_efficiency_pct": eff_pct,
            "venue_hazard_score": avg_hazard,
            "proactive_dispatches_active": sum(1 for g in analytics if g.get("remaining_deficit", 0) > 0)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"KPI engine error: {str(e)}")


@app.get("/volunteers/available")
def get_available_volunteers():
    """
    Returns volunteers that are either unassigned or stationed at a surplus gate.
    Includes their current gate, status (Available / Assigned / Overloaded / Pending / Accepted / Arrived).
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT volunteer_id, volunteer_name, assigned_gate, contact, status,
                   destination_gate, travel_time_remaining, travel_eta
            FROM volunteers 
            ORDER BY volunteer_name
        """)
        vols = cursor.fetchall()

        # Compute surplus/overload per gate quickly
        gate_report = {g["gate_id"]: g for g in compute_assignments()}

        result = []
        for vid, vname, ag, contact, db_status, dest_gate, travel_rem, travel_eta in vols:
            if db_status in ["Pending", "Accepted", "En Route", "Arrived"]:
                status = db_status
                if ag is None:
                    gate_name = "Unassigned"
                else:
                    gr = gate_report.get(ag, {})
                    gate_name = gr.get("gate_name", f"Gate #{ag}")
            elif ag is None:
                status = "Available"
                gate_name = "Unassigned"
            else:
                gr = gate_report.get(ag, {})
                status = "Stationed"
                gate_name = gr.get("gate_name", f"Gate #{ag}")

            result.append({
                "volunteer_id":   vid,
                "volunteer_name": vname,
                "contact":        contact,
                "assigned_gate":  ag,
                "gate_name":      gate_name,
                "status":         status,
                "destination_gate": dest_gate,
                "travel_time_remaining": travel_rem,
                "travel_eta":     travel_eta
            })

        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/volunteers/assignments")
def get_volunteer_assignments():
    """Returns all volunteers enriched with live gate metrics (risk, congestion, deficit)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT volunteer_id, volunteer_name, assigned_gate, contact FROM volunteers ORDER BY volunteer_name")
        vols = cursor.fetchall()
        
        # Try fetching from cache
        cursor.execute("SELECT value FROM system_settings WHERE key = 'latest_volunteer_deficits'")
        cached_row = cursor.fetchone()
        if cached_row:
            gates_list = json.loads(cached_row[0])
            gate_report = {g["gate_id"]: g for g in gates_list}
        else:
            gate_report = {g["gate_id"]: g for g in compute_assignments()}
            
        conn.close()

        result = []
        for vid, vname, ag, contact in vols:
            gr = gate_report.get(ag, {}) if ag else {}
            result.append({
                "volunteer_id":   vid,
                "volunteer_name": vname,
                "contact":        contact,
                "assigned_gate":  ag,
                "gate_name":      gr.get("gate_name", "Unassigned"),
                "gate_risk":      gr.get("risk", "N/A"),
                "gate_congestion":gr.get("congestion", "N/A"),
                "gate_occ_pct":   gr.get("occupancy_pct", 0),
                "gate_deficit":   gr.get("deficit", 0),
                "gate_priority":  gr.get("priority", "N/A"),
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def get_system_settings(conn=None):
    close_here = conn is None
    if conn is None:
        conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT value FROM system_settings WHERE key = 'volunteer_assignment_mode'")
        mode_row = cursor.fetchone()
        mode = mode_row[0] if mode_row else "Demo"
        
        cursor.execute("SELECT value FROM system_settings WHERE key = 'simulation_delay_seconds'")
        delay_row = cursor.fetchone()
        delay_seconds = int(delay_row[0]) if delay_row else 3
        return {"mode": mode, "delay_seconds": delay_seconds}
    except:
        return {"mode": "Demo", "delay_seconds": 3}
    finally:
        if close_here:
            conn.close()


def calculate_redeployment_impact_with_metrics(gate_metrics, conn) -> dict:
    """
    Computes before vs after metrics using pre-calculated gate metrics.
    """
    cursor = conn.cursor()
    try:
        # Get peak_hour dynamically
        cursor.execute("SELECT value FROM system_settings WHERE key = 'peak_hour'")
        peak_row = cursor.fetchone()
        peak_val = int(peak_row[0]) if peak_row else 0

        cursor.execute("SELECT volunteer_id, assigned_gate FROM volunteers")
        vols = cursor.fetchall()
        
        vol_by_gate = {}
        unassigned_count = 0
        for vid, ag in vols:
            if ag is not None:
                vol_by_gate.setdefault(ag, []).append(vid)
            else:
                unassigned_count += 1

        before_deficit = 0
        before_wait_sum = 0.0
        before_critical = 0
        gate_counts = len(gate_metrics)
        
        gate_details = []
        for g in gate_metrics:
            occ = g["current_occupancy"]
            queue = g["queue_length"]
            stationed = g["stationed_volunteers"]
            max_cap = g["max_capacity"]
            
            before_deficit += (g.get("deficit") or 0)
            before_wait_sum += (g.get("predicted_wait_time") or 0.0)
            if g.get("status") == "Critical":
                before_critical += 1
                
            gate_details.append({
                "gate_id": g["gate_id"],
                "gate_name": g["gate_name"],
                "max_capacity": max_cap,
                "occ": occ,
                "queue": queue,
                "stationed": stationed,
                "_coords": g.get("_coords", (2.0, 2.0))
            })
            
        before_avg_wait = before_wait_sum / max(gate_counts, 1)
        
        # Simulate the after state
        surplus_pool = []
        total_active_staff = len(vols)
        for g in gate_metrics:
            req = (g.get("required_volunteers") or 0)
            deficit = (g.get("deficit") or 0)
            surplus = (g.get("surplus") or 0)
            g_details = next(item for item in gate_details if item["gate_id"] == g["gate_id"])
            g_details["_deficit"] = deficit
            g_details["_priority"] = g.get("priority", "Low")
            
            if surplus > 0:
                for _ in range(surplus):
                    surplus_pool.append({
                        "from_gate_id": g["gate_id"],
                        "from_coords": g_details["_coords"]
                    })
        for _ in range(unassigned_count):
            surplus_pool.append({
                "from_gate_id": None,
                "from_coords": (2.0, 2.0)
            })
            
        priority_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
        deficit_gates = sorted(
            [g for g in gate_details if g["_deficit"] > 0],
            key=lambda x: (priority_order.get(x["_priority"], 9), x["gate_id"])
        )
        
        # Simulating moving
        sim_stationed = {g["gate_id"]: g["stationed"] for g in gate_details}
        sim_deficits = {g["gate_id"]: g["_deficit"] for g in gate_details}
        
        for g in deficit_gates:
            target_c = g["_coords"]
            avail = [v for v in surplus_pool]
            avail_sorted = sorted(
                avail,
                key=lambda v: (v["from_gate_id"] is not None, _zone_distance(v["from_coords"], target_c))
            )
            
            takes = min(sim_deficits[g["gate_id"]], len(avail_sorted))
            for vol in avail_sorted[:takes]:
                sim_stationed[g["gate_id"]] += 1
                sim_deficits[g["gate_id"]] -= 1
                surplus_pool.remove(vol)
                
        after_deficit = 0
        after_wait_sum = 0.0
        after_critical = 0
        
        for g in gate_details:
            sim_st = sim_stationed[g["gate_id"]]
            pred_after = predict_all_gate_metrics(g["occ"], g["queue"], sim_st, g["max_capacity"], total_active_staff, peak_val=peak_val, gate_id=g["gate_id"])
            occ_pct_sim = (g["occ"] / g["max_capacity"] * 100) if g["max_capacity"] > 0 else 0.0
            status_sim = calculate_gate_status(g["max_capacity"], occ_pct_sim, g["queue"], pred_after)
            
            after_deficit += (pred_after.get("deficit") or 0)
            after_wait_sum += (pred_after.get("waiting_time") or 0.0)
            if status_sim == "Critical":
                after_critical += 1
                
        after_avg_wait = after_wait_sum / max(gate_counts, 1)
        
        return {
            "before": {
                "total_deficit": before_deficit,
                "avg_wait_time": round(before_avg_wait, 1),
                "critical_gates": before_critical
            },
            "after": {
                "total_deficit": after_deficit,
                "avg_wait_time": round(after_avg_wait, 1),
                "critical_gates": after_critical
            }
        }
    except Exception as e:
        print(f"[Caching] Error calculating redeployment impact: {e}")
        return {
            "before": {"total_deficit": 0, "avg_wait_time": 0.0, "critical_gates": 0},
            "after": {"total_deficit": 0, "avg_wait_time": 0.0, "critical_gates": 0}
        }

def update_cached_analytics(conn=None):
    """
    Computes all live analytics, volunteer suggestions, and redeployment impact,
    and caches them as JSON strings in the system_settings table.
    This eliminates ML calculation overhead during read-only page loads.
    """
    print("START update_cached_analytics")
    start_t = time.perf_counter()
    close_here = conn is None
    if conn is None:
        conn = get_connection()
    cursor = conn.cursor()
    try:
        # 1. Compute gate metrics and suggestions in ONE place (preserving internal helpers for impact calculation)
        gate_metrics = compute_assignments(conn, strip_helpers=False)
        
        # 2. Compute reallocation impact using the authoritative metrics
        impact = calculate_redeployment_impact_with_metrics(gate_metrics, conn)
        
        # 3. Strip internal helpers before caching/serializing
        gates_list_clean = []
        for g in gate_metrics:
            g_copy = dict(g)
            if "_coords" in g_copy: del g_copy["_coords"]
            if "_vols" in g_copy: del g_copy["_vols"]
            gates_list_clean.append(g_copy)

        # 4. Compute active_dispatches and staff_feed for instant cache-first endpoint responses (<5ms)
        cursor.execute("""
            SELECT ar.request_id, ar.volunteer_id, v.volunteer_name,
                   ar.from_gate_id, g1.gate_name,
                   ar.to_gate_id,   g2.gate_name,
                   ar.reason, ar.priority, ar.status, ar.created_at
            FROM assignment_requests ar
            LEFT JOIN volunteers v  ON ar.volunteer_id   = v.volunteer_id
            LEFT JOIN gates     g1  ON ar.from_gate_id   = g1.gate_id
            LEFT JOIN gates     g2  ON ar.to_gate_id     = g2.gate_id
            WHERE ar.status IN ('Pending', 'Accepted', 'En Route', 'Arrived')
            ORDER BY ar.created_at DESC
        """)
        active_dispatches = [
            {
                "request_id":      r[0],
                "volunteer_id":    r[1],
                "volunteer_name":  r[2],
                "from_gate_id":    r[3],
                "from_gate_name":  r[4],
                "to_gate_id":      r[5],
                "to_gate_name":    r[6],
                "reason":          r[7],
                "priority":        r[8],
                "status":          r[9],
                "created_at":      r[10]
            }
            for r in cursor.fetchall()
        ]

        cursor.execute("""
            SELECT a.alert_id, a.gate_id, g.gate_name,
                   a.message, a.alert_time, a.is_resolved
            FROM alerts a
            LEFT JOIN gates g ON a.gate_id = g.gate_id
            WHERE a.alert_type = 'Staff Notification'
            ORDER BY a.alert_time DESC
            LIMIT 15
        """)
        staff_feed = [
            {
                "alert_id":    row[0],
                "gate_id":     row[1],
                "gate_name":   row[2] or f"Gate #{row[1]}",
                "message":     row[3],
                "alert_time":  row[4],
                "is_resolved": row[5] or 0,
            }
            for row in cursor.fetchall()
        ]

        print("START cache_updates")
        c_start_t = time.perf_counter()
        # 5. Save all pre-computed telemetry to system_settings table
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('latest_gate_metrics', ?)", (json.dumps(gates_list_clean),))
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('latest_volunteer_deficits', ?)", (json.dumps(gates_list_clean),))
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('latest_reallocation_impact', ?)", (json.dumps(impact),))
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('latest_active_dispatches', ?)", (json.dumps(active_dispatches),))
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('latest_staff_feed', ?)", (json.dumps(staff_feed),))
        conn.commit()
        print("END cache_updates")
        print(f"Execution Time: {(time.perf_counter() - c_start_t)*1000:.2f} ms")
        
        print("[Caching] Successfully updated system analytics cache in database.")
        return gates_list_clean, impact
    except Exception as e:
        print(f"[Caching] Error updating cache: {e}")
        return [], {"before": {"total_deficit": 0, "avg_wait_time": 0.0, "critical_gates": 0}, "after": {"total_deficit": 0, "avg_wait_time": 0.0, "critical_gates": 0}}
    finally:
        if close_here:
            conn.close()
        elapsed = (time.perf_counter() - start_t) * 1000.0
        print("END update_cached_analytics")
        print(f"Execution Time: {elapsed:.2f} ms")

def run_auto_accept_simulation_timer(request_id: int, delay_seconds: int):
    """Background timer task to automatically accept a request in Demo/Simulation Mode."""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT status, volunteer_id, from_gate_id, to_gate_id FROM assignment_requests WHERE request_id = ?", (request_id,))
        row = cursor.fetchone()
        if row and row[0] == "Pending":
            status, vol_id, from_gate_id, to_gate_id = row
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            cursor.execute("SELECT volunteer_name FROM volunteers WHERE volunteer_id = ?", (vol_id,))
            vname_row = cursor.fetchone()
            vname = vname_row[0] if vname_row else "Volunteer"
            
            cursor.execute("SELECT gate_name FROM gates WHERE gate_id = ?", (to_gate_id,))
            to_gate_name = cursor.fetchone()[0]

            # Update request to Accepted
            cursor.execute("""
                UPDATE assignment_requests 
                SET status = 'Accepted', updated_at = ?, accepted_at = ? 
                WHERE request_id = ?
            """, (now_str, now_str, request_id))
            
            # Cancel other pending requests
            cursor.execute("""
                UPDATE assignment_requests 
                SET status = 'Cancelled', updated_at = ? 
                WHERE volunteer_id = ? AND request_id != ? AND status = 'Pending'
            """, (now_str, vol_id, request_id))
            
            # Update volunteer status to Accepted
            cursor.execute("UPDATE volunteers SET status = 'Accepted' WHERE volunteer_id = ?", (vol_id,))
            
            cursor.execute("""
                INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                VALUES (?, 'Accept Request', ?, ?)
            """, (vol_id, to_gate_id, f"{vname} accepted"))
            
            # Insert alert notification
            msg_accept = f"{vname} accepted redeployment → {to_gate_name}"
            cursor.execute(
                """
                INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
                VALUES (?, 'Staff Notification', 'Low', ?, 'Volunteer accepted redeployment.', 0)
                """,
                (to_gate_id, msg_accept)
            )
            
            conn.commit()
            print(f"[Timer] Request #{request_id} for volunteer '{vname}' auto-accepted successfully.")
            
            # Start transit timer
            import threading
            t = threading.Timer(delay_seconds, run_auto_enroute_simulation_timer, args=(request_id,))
            t.daemon = True
            register_timer(t)
            t.start()
    except Exception as e:
        print(f"[Timer] Error auto-accepting request #{request_id}: {e}")
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass


def run_auto_enroute_simulation_timer(request_id: int):
    """Background timer task to automatically mark volunteer as 'En Route' in Demo/Simulation Mode."""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT status, volunteer_id, from_gate_id, to_gate_id FROM assignment_requests WHERE request_id = ?", (request_id,))
        row = cursor.fetchone()
        if row and row[0] == "Accepted":
            status, vol_id, from_gate_id, to_gate_id = row
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            cursor.execute("SELECT volunteer_name FROM volunteers WHERE volunteer_id = ?", (vol_id,))
            vname_row = cursor.fetchone()
            vname = vname_row[0] if vname_row else "Volunteer"
            
            cursor.execute("SELECT gate_name FROM gates WHERE gate_id = ?", (to_gate_id,))
            to_gate_name = cursor.fetchone()[0]

            # Update request to En Route
            cursor.execute("""
                UPDATE assignment_requests 
                SET status = 'En Route', updated_at = ?, en_route_at = ? 
                WHERE request_id = ?
            """, (now_str, now_str, request_id))
            
            # Update volunteer status to En Route
            cursor.execute("UPDATE volunteers SET status = 'En Route' WHERE volunteer_id = ?", (vol_id,))
            
            cursor.execute("""
                INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                VALUES (?, 'En Route', ?, ?)
            """, (vol_id, to_gate_id, f"{vname} is en route"))
            
            conn.commit()
            print(f"[Timer] Request #{request_id} for volunteer '{vname}' is now En Route.")
            
            # Start arrive timer (2-3s travel time in Demo Mode)
            import random
            delay_sec = random.randint(2, 3)
            
            import threading
            t = threading.Timer(delay_sec, run_auto_arrive_simulation_timer, args=(request_id,))
            t.daemon = True
            register_timer(t)
            t.start()
    except Exception as e:
        print(f"[Timer] Error transitioning request #{request_id} to En Route: {e}")
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass


def run_auto_arrive_simulation_timer(request_id: int):
    """Background timer task to automatically arrive and complete redeployment in Demo/Simulation Mode."""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT status, volunteer_id, from_gate_id, to_gate_id FROM assignment_requests WHERE request_id = ?", (request_id,))
        row = cursor.fetchone()
        if row and row[0] == "En Route":
            status, vol_id, from_gate_id, to_gate_id = row
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            cursor.execute("SELECT volunteer_name FROM volunteers WHERE volunteer_id = ?", (vol_id,))
            vname_row = cursor.fetchone()
            vname = vname_row[0] if vname_row else "Volunteer"
            
            cursor.execute("SELECT gate_name FROM gates WHERE gate_id = ?", (to_gate_id,))
            to_gate_name = cursor.fetchone()[0]
            
            # Update request to Arrived
            cursor.execute("""
                UPDATE assignment_requests 
                SET status = 'Arrived', updated_at = ?, arrived_at = ? 
                WHERE request_id = ?
            """, (now_str, now_str, request_id))
            
            # Update volunteer status to Arrived
            cursor.execute("UPDATE volunteers SET status = 'Arrived' WHERE volunteer_id = ?", (vol_id,))
            
            cursor.execute("""
                INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                VALUES (?, 'Arrived', ?, ?)
            """, (vol_id, to_gate_id, f"{vname} arrived"))
            
            # Insert alert notification
            msg_arrive = f"{vname} arrived at {to_gate_name}"
            cursor.execute(
                """
                INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
                VALUES (?, 'Staff Notification', 'Low', ?, 'Volunteer arrived at gate.', 0)
                """,
                (to_gate_id, msg_arrive)
            )
            
            conn.commit()
            print(f"[Timer] Request #{request_id} for volunteer '{vname}' auto-arrived successfully.")
            
            # Instantly complete assignment synchronously to avoid race conditions or delay
            complete_assignment_db(request_id, conn)
    except Exception as e:
        print(f"[Timer] Error auto-arriving request #{request_id}: {e}")
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass


def run_auto_complete_simulation_timer(request_id: int):
    """Background timer task to finalize an assignment in Demo/Simulation Mode."""
    try:
        complete_assignment_db(request_id)
    except Exception as e:
        print(f"[Timer] Error auto-completing request #{request_id}: {e}")


def complete_assignment_db(request_id: int, conn=None) -> bool:
    """
    Centralized completion engine:
    1. Sets status to 'Completed'.
    2. Updates volunteer's assigned gate, status, and duty start time.
    3. Simulates check-in of attendees.
    4. Recalculates metrics and determines resolved / deficit status.
    5. Triggers new dispatches if deficits persist.
    """
    close_here = conn is None
    if conn is None:
        conn = get_connection()
    cursor = conn.cursor()
    try:
        # Fetch request details
        cursor.execute("""
            SELECT volunteer_id, from_gate_id, to_gate_id 
            FROM assignment_requests 
            WHERE request_id = ?
        """, (request_id,))
        row = cursor.fetchone()
        if not row:
            if close_here: conn.close()
            return False
            
        vol_id, from_gate_id, to_gate_id = row
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 1. Update request status to Completed
        cursor.execute("""
            UPDATE assignment_requests 
            SET status = 'Completed', updated_at = ?, completed_at = ? 
            WHERE request_id = ?
        """, (now_str, now_str, request_id))
        
        # 2. Update volunteer details (Set status to 'Stationed')
        cursor.execute("""
            UPDATE volunteers 
            SET assigned_gate = ?, gate_duty_start_time = ?, status = 'Stationed',
                destination_gate = NULL, travel_time_remaining = 0, travel_eta = NULL
            WHERE volunteer_id = ?
        """, (to_gate_id, now_str, vol_id))

        # Delete active notifications for this request so they disappear when completed
        cursor.execute("""
            DELETE FROM volunteer_notifications 
            WHERE related_id = ? AND notification_type = 'Assignment'
        """, (request_id,))
        
        # Fetch names
        cursor.execute("SELECT volunteer_name FROM volunteers WHERE volunteer_id = ?", (vol_id,))
        vname_row = cursor.fetchone()
        vname = vname_row[0] if vname_row else "Volunteer"
        
        cursor.execute("SELECT gate_name, max_capacity FROM gates WHERE gate_id = ?", (to_gate_id,))
        to_gate_row = cursor.fetchone()
        to_gate_name, max_capacity = to_gate_row
        
        old_gate_name = "Reserve Pool"
        if from_gate_id:
            cursor.execute("SELECT gate_name FROM gates WHERE gate_id = ?", (from_gate_id,))
            gn_row = cursor.fetchone()
            if gn_row:
                old_gate_name = gn_row[0]
                
        # 3. Simulate arrival checking in up to 5 people at target gate
        cursor.execute("""
            SELECT attendee_id FROM attendees 
            WHERE assigned_gate = ? AND is_checked_in = 0 
            LIMIT 5
        """, (to_gate_id,))
        queue_attendees = cursor.fetchall()
        for (att_id,) in queue_attendees:
            cursor.execute("UPDATE attendees SET is_checked_in = 1 WHERE attendee_id = ?", (att_id,))
            cursor.execute("""
                INSERT INTO scans (attendee_id, gate_id, direction, scan_time) 
                VALUES (?, ?, 'IN', ?)
            """, (att_id, to_gate_id, now_str))
            
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Gate Change', ?, ?)
        """, (vol_id, to_gate_id, f"Redeployed from {old_gate_name} to {to_gate_name}"))
        
        # 4. Recalculate metrics for target gate using centralized analytics
        analytics_after = get_live_analytics(conn)
        target_gate_analytics = None
        for g in analytics_after:
            if g["gate_id"] == to_gate_id:
                target_gate_analytics = g
                break
                
        after_risk = "Safe"
        after_congestion = "Low"
        after_queue = 0
        after_wait_time = 0.0
        after_deficit = 0
        
        if target_gate_analytics:
            after_risk = target_gate_analytics.get("predicted_risk", "Safe")
            after_congestion = target_gate_analytics.get("congestion_level", "Low")
            after_queue = target_gate_analytics.get("queue_length", 0)
            after_wait_time = target_gate_analytics.get("predicted_wait_time") if target_gate_analytics.get("predicted_wait_time") is not None else 0.0
            after_deficit = target_gate_analytics.get("deficit", 0)
            
        # Get before values
        cursor.execute("""
            SELECT before_risk, before_congestion, before_queue, before_wait_time, before_deficit
            FROM assignment_requests
            WHERE request_id = ?
        """, (request_id,))
        before_row = cursor.fetchone()
        
        before_deficit_val = 999
        before_queue_val = 999
        before_wait_time_val = 999.0
        if before_row:
            _, _, before_queue_v, before_wt_v, before_def_v = before_row
            if before_def_v is not None: before_deficit_val = before_def_v
            if before_queue_v is not None: before_queue_val = before_queue_v
            if before_wt_v is not None: before_wait_time_val = before_wt_v
            
        improved = False
        if after_deficit < before_deficit_val:
            improved = True
        elif after_deficit == 0 and after_risk == "Safe":
            improved = True
        elif after_queue < before_queue_val:
            improved = True
        elif after_wait_time < before_wait_time_val:
            improved = True
            
        improvement_result = "Improved" if improved else "Further Action Required"
        
        # Update the assignment request with after_* and improvement_result
        cursor.execute("""
            UPDATE assignment_requests 
            SET after_risk = ?, after_congestion = ?, after_queue = ?,
                after_wait_time = ?, after_deficit = ?, improvement_result = ?
            WHERE request_id = ?
        """, (
            after_risk, after_congestion, after_queue,
            after_wait_time, after_deficit, improvement_result,
            request_id
        ))
        
        deficit_now = after_deficit
        
        # 5. Evaluate situation
        if deficit_now == 0:
            msg = f"Situation resolved at {to_gate_name}"
            cursor.execute("""
                INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
                VALUES (?, 'Staff Notification', 'Low', ?, 'Gate staffing is sufficient.', 1)
            """, (to_gate_id, msg))
            
            # Resolve all other active Staff Notification alerts for this gate since the deficit is solved
            cursor.execute("""
                UPDATE alerts SET is_resolved = 1
                WHERE gate_id = ? AND alert_type = 'Staff Notification' AND is_resolved = 0
            """, (to_gate_id,))
                
        # Auto-resolve any previous Staff Notification alerts containing this volunteer's name
        cursor.execute("""
            UPDATE alerts SET is_resolved = 1
            WHERE alert_type = 'Staff Notification' AND message LIKE ? AND is_resolved = 0
        """, (f"%{vname}%",))
        
        conn.commit()
        
        # Update cache in the database
        update_cached_analytics(conn)
        
        print(f"[Timer] Request #{request_id} for volunteer '{vname}' completed successfully. Deficit now: {deficit_now}")
        
        if close_here:
            conn.close()
        return True
    except Exception as e:
        print(f"Error in complete_assignment_db: {e}")
        if close_here:
            conn.close()
        return False

def cancel_excess_dispatches(conn):
    """
    If crowd congestion decreases naturally (meaning gate deficit decreases),
    cancels any excess pending or accepted dispatches.
    """
    cursor = conn.cursor()
    # get_live_analytics returns current gate status with deficits calculated using ML models
    gate_data = get_live_analytics(conn)
    for g in gate_data:
        gate_id = g["gate_id"]
        # Use the authoritative values from get_live_analytics — no re-derivation
        raw_deficit   = g["deficit"]           # required - stationed (raw gap)
        enroute_total = g["in_transit_count"]  # pending + accepted + en_route + arrived
        
        # Only cancel Pending/Accepted requests (not yet en-route — still reversible)
        cursor.execute(
            "SELECT request_id, volunteer_id FROM assignment_requests "
            "WHERE to_gate_id = ? AND status IN ('Pending', 'Accepted') ORDER BY request_id DESC",
            (gate_id,)
        )
        active_reqs = cursor.fetchall()
        
        excess = enroute_total - raw_deficit
        if excess > 0:
            to_cancel = min(excess, len(active_reqs))
            if to_cancel > 0:
                print(f"[Auto-Cancel] Gate {g['gate_name']} raw_deficit={raw_deficit}, in_transit={enroute_total}. Cancelling {to_cancel} excess Pending/Accepted request(s).")
                for req_id, vol_id in active_reqs[:to_cancel]:
                    cursor.execute(
                        "UPDATE assignment_requests SET status = 'Cancelled' WHERE request_id = ?",
                        (req_id,)
                    )
                    
                    # Log activity: Dispatch Cancelled due to crowd improvement
                    cursor.execute("""
                        INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                        VALUES (?, ?, ?, ?)
                    """, (vol_id, 'Dispatch Cancelled', gate_id, f"Dispatch Cancelled. Reason: Crowd conditions improved at {g['gate_name']}"))
                    
                    # Revert volunteer status back to Available/Stationed based on assigned_gate
                    cursor.execute(
                        "SELECT assigned_gate FROM volunteers WHERE volunteer_id = ?",
                        (vol_id,)
                    )
                    assigned_gate = cursor.fetchone()[0]
                    new_status = "Available" if assigned_gate is None else "Stationed"
                    cursor.execute(
                        "UPDATE volunteers SET status = ? WHERE volunteer_id = ?",
                        (new_status, vol_id)
                    )


def calculate_travel_time(from_gate_id: int, to_gate_id: int) -> int:
    """Calculates travel time in seconds between two gates based on coordinate distance."""
    c1 = (2.0, 2.0)
    c2 = (2.0, 2.0)
    
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Get coordinates for from_gate
        if from_gate_id:
            cursor.execute("SELECT gate_id FROM gates ORDER BY gate_id")
            gates = [row[0] for row in cursor.fetchall()]
            if from_gate_id in gates:
                idx = gates.index(from_gate_id)
                c1 = _GATE_ZONE_COORDS[idx % len(_GATE_ZONE_COORDS)]
        # Get coordinates for to_gate
        if to_gate_id:
            cursor.execute("SELECT gate_id FROM gates ORDER BY gate_id")
            gates = [row[0] for row in cursor.fetchall()]
            if to_gate_id in gates:
                idx = gates.index(to_gate_id)
                c2 = _GATE_ZONE_COORDS[idx % len(_GATE_ZONE_COORDS)]
    except Exception as e:
        print(f"Error in calculate_travel_time coordinate fetch: {e}")
    finally:
        conn.close()
        
    dist = _zone_distance(c1, c2)
    # 5 seconds per coordinate unit, minimum 5 seconds
    return max(int(dist * 5.0), 5)

@app.post("/volunteers/auto-assign")
def run_auto_assign():
    """
    DAY 25 Real-Time AI Volunteer Allocation Engine.
    Manages volunteer lifecycle (AVAILABLE -> PENDING -> ACCEPTED -> EN_ROUTE -> ARRIVED -> STATIONED -> AVAILABLE AGAIN) synchronously.
    Handles surplus releases to the standby pool and deficit dispatches.
    """
    print("START run_auto_assign")
    start_t = time.perf_counter()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Determine system mode and cycle time
        cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
        sm_row = cursor.fetchone()
        system_mode = sm_row[0] if sm_row else "Demo"
        
        cursor.execute("SELECT value FROM system_settings WHERE key = 'simulation_delay_seconds'")
        delay_row = cursor.fetchone()
        cycle_seconds = int(delay_row[0]) if delay_row else 5
        
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Cancel excess dispatches first if crowd conditions improved
        cancel_excess_dispatches(conn)
        conn.commit()

        # ----------------- PHASE 1: TRANSIT SIMULATION (Only in Demo/Simulation mode) -----------------
        if system_mode in ["Demo", "Simulation"]:
            if not simulation_active:
                # Instantly complete all transit requests if simulation is paused/stopped
                cursor.execute("""
                    SELECT request_id FROM assignment_requests 
                    WHERE status IN ('Pending', 'Accepted', 'En Route', 'Arrived')
                """)
                stuck_reqs = cursor.fetchall()
                if stuck_reqs:
                    print(f"[Self-Healing] Instantly completing {len(stuck_reqs)} transit requests since simulation is inactive.")
                    for (req_id,) in stuck_reqs:
                        complete_assignment_db(req_id, conn)
            
            # Note: Transition states (Pending -> Accepted -> En Route -> Arrived -> Stationed)
            # are managed in real-time by threading.Timers for fast emergency response simulation.
            # Thus, we do not run cycle-by-cycle auto-transitions here.
            pass

        # ----------------- PHASE 2: SURPLUS RELEASE TO STANDBY POOL -----------------
        # ARCHITECTURAL DECISION:
        # In Demo/Simulation mode, automated surplus release is DISABLED.
        #
        # Reason: The dispatch engine (Phase 3) dispatches volunteers because the ML model
        # detected a deficit. Once those volunteers arrive and are Stationed, they must STAY.
        # Automatically ejecting them based on the next cycle's ML reading creates an
        # inherent oscillation: dispatch → arrive → eject → deficit → dispatch → infinite loop.
        #
        # cancel_excess_dispatches() (Phase 0, above) already handles the only correct case:
        # if too many volunteers were dispatched (Pending/Accepted) and the crowd improves
        # BEFORE they travel, those pending dispatches are cancelled. This is sufficient.
        #
        # Surplus release only runs in Live mode, where an admin is making deliberate,
        # human-supervised reassignment decisions with full situational awareness.
        if system_mode not in ["Demo", "Simulation"]:
            cursor.execute("SELECT gate_id, gate_name FROM gates ORDER BY gate_id")
            gates_list = cursor.fetchall()

            gate_analytics = {g["gate_id"]: g for g in get_live_analytics(conn)}

            # Grace period: volunteers who arrived/stationed within the last 30 seconds
            # must NOT be released immediately.
            grace_cutoff = (datetime.now() - timedelta(seconds=30)).strftime("%Y-%m-%d %H:%M:%S")

            for gate_id, gate_name in gates_list:
                ga = gate_analytics.get(gate_id, {})
                req = ga.get("required_volunteers", 0)
                
                # Find stationed volunteers at this gate who have been there for MORE than 30 seconds
                cursor.execute("""
                    SELECT volunteer_id, volunteer_name FROM volunteers 
                    WHERE assigned_gate = ? AND status IN ('Stationed', 'Available')
                    AND (gate_duty_start_time IS NULL OR gate_duty_start_time <= ?)
                """, (gate_id, grace_cutoff))
                stationed_vols = cursor.fetchall()

                # Also count ALL stationed volunteers to compute true surplus
                cursor.execute("""
                    SELECT COUNT(*) FROM volunteers 
                    WHERE assigned_gate = ? AND status IN ('Stationed', 'Available')
                """, (gate_id,))
                total_stationed_count = cursor.fetchone()[0]

                surplus = total_stationed_count - req
                
                if surplus > 0 and stationed_vols:
                    releasable = stationed_vols[:surplus]
                    print(f"[Allocation Engine] Gate {gate_name} has surplus: total_stationed={total_stationed_count} > required={req}. Releasing {len(releasable)} volunteer(s).")
                    for vol_id, vname in releasable:
                        cursor.execute("""
                            UPDATE volunteers 
                            SET assigned_gate = NULL, status = 'Available', destination_gate = NULL,
                                travel_time_remaining = 0, travel_eta = NULL
                            WHERE volunteer_id = ?
                        """, (vol_id,))
                        
                        cursor.execute("""
                            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                            VALUES (?, 'Released', ?, ?)
                        """, (vol_id, gate_id, f"Released from {gate_name} to Standby Pool (Live Mode)"))
                        
                        msg_release = f"{vname} released from {gate_name} to Standby Pool"
                        cursor.execute("""
                            INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
                            VALUES (?, 'Staff Notification', 'Low', ?, 'Volunteer returned to Standby Pool.', 1)
                        """, (gate_id, msg_release))
        conn.commit()

        # ----------------- PHASE 3: DEFICIT DISPATCHING -----------------
        report = compute_assignments()
        moves = []
        
        for gate in report:
            # Check for shortages and raise alerts if deficit is unmet
            deficit_count = gate.get("effective_deficit", 0)
            assigned_count = len(gate.get("suggested_moves", []))
            unmet_deficit = deficit_count - assigned_count
            
            if unmet_deficit > 0:
                shortage_msg = f"Critical Staff Shortage at {gate['gate_name']}: {unmet_deficit} additional volunteers required."
                # Avoid duplicate active alerts
                cursor.execute("""
                    SELECT alert_id FROM alerts 
                    WHERE gate_id = ? AND alert_type = 'Staff Shortage' AND is_resolved = 0
                """, (gate["gate_id"],))
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
                        VALUES (?, 'Staff Shortage', 'Medium', ?, 'Deploy additional volunteers from off-duty roster.', 0)
                    """, (gate["gate_id"], shortage_msg))
            else:
                # Resolve shortage alert if staffing is satisfied
                cursor.execute("""
                    UPDATE alerts SET is_resolved = 1 
                    WHERE gate_id = ? AND alert_type = 'Staff Shortage' AND is_resolved = 0
                """, (gate["gate_id"],))

            # Dispatch volunteers
            for move in gate["suggested_moves"]:
                vol_id = move["volunteer_id"]
                
                # Check if volunteer is already moving
                cursor.execute("""
                    SELECT request_id FROM assignment_requests 
                    WHERE volunteer_id = ? AND status IN ('Pending', 'Accepted', 'En Route', 'Arrived')
                """, (vol_id,))
                if cursor.fetchone():
                    continue
                    
                dispatch_reason = move.get("explainable_reason") or f"AI-driven redeployment suggestion: Move from {move['from_gate']} to {gate['gate_name']} due to safety deficit"

                # Create Pending request
                cursor.execute(
                    """
                    INSERT INTO assignment_requests (
                        volunteer_id, from_gate_id, to_gate_id, reason, priority, status,
                        before_risk, before_congestion, before_queue, before_wait_time, before_deficit
                    )
                    VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?)
                    """,
                    (
                        vol_id,
                        move["from_gate_id"],
                        gate["gate_id"],
                        dispatch_reason,
                        gate["priority"],
                        gate.get("risk", "Safe"),
                        gate.get("congestion", "Low"),
                        gate.get("queue_length", 0),
                        gate.get("waiting_time", 0.0),
                        gate.get("deficit", 0)
                    )
                )
                request_id = cursor.lastrowid
                
                cursor.execute("SELECT volunteer_name FROM volunteers WHERE volunteer_id = ?", (vol_id,))
                vname = cursor.fetchone()[0]
                
                # Update volunteer status to Pending for dispatch & increment dispatches_today
                cursor.execute("UPDATE volunteers SET status = 'Pending', dispatches_today = COALESCE(dispatches_today, 0) + 1 WHERE volunteer_id = ?", (vol_id,))
                
                # Log activity: Assignment Created
                cursor.execute("""
                    INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                    VALUES (?, 'Assignment Created', ?, 'Assignment created')
                """, (vol_id, move["from_gate_id"]))
                    
                # Admin Alert
                from_gate_label = move.get('from_gate', 'Reserve Pool')
                msg = f"AI assigned {vname}: {from_gate_label} → {gate['gate_name']}"
                cursor.execute("""
                    INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
                    VALUES (?, 'Staff Notification', 'Low', ?, 'Monitor in AI Dispatches.', 0)
                """, (gate["gate_id"], msg))
                
                # Start fast transition timer (Pending -> Accepted) in Demo/Simulation Mode
                if system_mode in ["Demo", "Simulation"]:
                    import threading
                    t = threading.Timer(1.0, run_auto_accept_simulation_timer, args=(request_id, 1.0))
                    t.daemon = True
                    register_timer(t)
                    t.start()
                    print(f"[Allocation Engine] Started real-time timer for request #{request_id}")
                
                moves.append({
                    "request_id":     request_id,
                    "volunteer_id":   vol_id,
                    "volunteer_name": vname,
                    "from_gate":      move["from_gate"],
                    "from_gate_id":   move["from_gate_id"],
                    "to_gate":        gate["gate_name"],
                    "to_gate_id":     gate["gate_id"],
                    "distance_score": move["distance_score"],
                    "priority":       gate["priority"]
                })
        conn.commit()
        
        # Update cache and get authoritative impact in one step
        _, impact = update_cached_analytics(conn)
        conn.close()
        
        return {
            "message":     f"Auto-assignment requests executed. {len(moves)} volunteer dispatches active.",
            "total_moves": len(moves),
            "moves":       moves,
            "impact":      impact
        }
    except Exception as e:
        try:
            conn.close()
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Auto-assign error: {str(e)}")
    finally:
        elapsed = (time.perf_counter() - start_t) * 1000.0
        print("END run_auto_assign")
        print(f"Execution Time: {elapsed:.2f} ms")


# ----------------- DAY 24: ML-DRIVEN ALERT SYSTEM -----------------


# Thresholds (easily configurable)
ALERT_QUEUE_THRESHOLD    = 20   # queue >= this → Congestion
ALERT_WAIT_THRESHOLD     = 5.0  # minutes >= this → Waiting Time
ALERT_OCCUPANCY_CRITICAL = 85.0 # % >= this → High Risk

# Recommendation text per alert type
_RECOMMENDATIONS = {
    "Congestion Alert": {
        "Medium": "Open an additional entry lane and deploy a volunteer to manage queue flow.",
        "High":   "Immediately redirect attendees to the nearest alternate gate and add barricades.",
    },
    "High Risk Alert": {
        "Critical": "Temporarily restrict entry, deploy additional volunteers, and alert security.",
        "High":     "Reduce inflow rate, deploy two additional security staff at this gate.",
    },
    "Waiting Time Alert": {
        "Medium": "Increase QR scanning capacity — assign a second scanner operator.",
        "High":   "Open an additional gate and redirect queuing attendees immediately.",
    },
    "Volunteer Shortage": {
        "Medium": "Assign at least one additional volunteer from reserve pool to this gate.",
        "High":   "Urgently redeploy volunteers from low-activity gates to cover deficit.",
    },
}

def _get_recommendation(alert_type: str, severity: str) -> str:
    return _RECOMMENDATIONS.get(alert_type, {}).get(severity, "Review gate conditions and consult supervisor.")


def generate_ml_alerts(conn=None) -> int:
    """
    Core ML alert engine (DAY 24).
    Runs get_live_analytics() for every gate and stores alerts for:
      - Congestion (High congestion level OR queue >= threshold)
      - High Risk  (Dangerous risk OR occupancy >= 85%)
      - Waiting Time (predicted_wait_time >= threshold)
      - Volunteer Shortage (deficit > 0)
    Deduplicates: skips if an unresolved alert for the same gate+type exists.
    Returns the count of new alerts inserted.
    """
    close_here = conn is None
    if conn is None:
        conn = get_connection()
    cursor = conn.cursor()
    new_count = 0
    try:
        analytics = get_live_analytics(conn)
        for g in analytics:
            gate_id = g["gate_id"]
            gate_name = g["gate_name"]
            max_capacity = g["max_capacity"]
            curr_occ = g["current_occupancy"]
            queue = g["queue_length"]
            stationed = g["stationed_volunteers"]
            occ_pct = g["occupancy_percentage"]
            
            risk_pred = g["predicted_risk"]
            congestion_pred = g["congestion_level"]
            wait_time_pred = g["predicted_wait_time"]
            deficit_pred = g["deficit"]
            req_volunteers_pred = g["required_volunteers"]

            # Build candidate alerts for this gate
            candidates = []
            triggered_types = set()

            # 1. Congestion Alert
            if congestion_pred == "High" or queue >= ALERT_QUEUE_THRESHOLD:
                severity = "High" if (congestion_pred == "High" and queue >= ALERT_QUEUE_THRESHOLD) else "Medium"
                candidates.append((
                    "Congestion Alert", severity,
                    f"High congestion detected at {gate_name}. Queue length: {queue}, Congestion: {congestion_pred}.",
                ))
                triggered_types.add("Congestion Alert")

            # 2. High Risk Alert
            if risk_pred == "Dangerous" or occ_pct >= ALERT_OCCUPANCY_CRITICAL:
                severity = "Critical" if occ_pct >= ALERT_OCCUPANCY_CRITICAL else "High"
                candidates.append((
                    "High Risk Alert", severity,
                    f"Potential crowd surge at {gate_name}. Occupancy: {round(occ_pct, 1)}%, Risk: {risk_pred}.",
                ))
                triggered_types.add("High Risk Alert")

            # 3. Waiting Time Alert
            if wait_time_pred >= ALERT_WAIT_THRESHOLD:
                severity = "High" if wait_time_pred >= ALERT_WAIT_THRESHOLD * 2 else "Medium"
                candidates.append((
                    "Waiting Time Alert", severity,
                    f"Predicted wait time at {gate_name}: {round(wait_time_pred, 1)} min — exceeds acceptable limit.",
                ))
                triggered_types.add("Waiting Time Alert")

            # 4. Volunteer Shortage
            if deficit_pred > 0:
                severity = "High" if deficit_pred >= 3 else "Medium"
                candidates.append((
                    "Volunteer Shortage", severity,
                    f"{gate_name} is short {deficit_pred} volunteer(s). Required: {req_volunteers_pred}, Stationed: {stationed}.",
                ))
                triggered_types.add("Volunteer Shortage")

            # Resolve alert types that are no longer triggered for this gate
            all_ml_alert_types = ["Congestion Alert", "High Risk Alert", "Waiting Time Alert", "Volunteer Shortage"]
            for a_type in all_ml_alert_types:
                if a_type not in triggered_types:
                    cursor.execute("""
                        UPDATE alerts SET is_resolved = 1
                        WHERE gate_id = ? AND alert_type = ? AND is_resolved = 0
                    """, (gate_id, a_type))

            for alert_type, severity, message in candidates:
                # Dedup: skip if same gate+type is already open (unresolved)
                cursor.execute("""
                    SELECT COUNT(*) FROM alerts
                    WHERE gate_id=? AND alert_type=? AND is_resolved=0
                """, (gate_id, alert_type))
                if cursor.fetchone()[0] > 0:
                    continue
                recommendation = _get_recommendation(alert_type, severity)
                cursor.execute("""
                    INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
                    VALUES (?, ?, ?, ?, ?, 0)
                """, (gate_id, alert_type, severity, message, recommendation))
                new_count += 1

        # Prune resolved alerts older than 30 minutes
        cursor.execute("DELETE FROM alerts WHERE is_resolved = 1 AND alert_time < datetime('now', '-30 minutes')")
        conn.commit()
    except Exception as e:
        print(f"[generate_ml_alerts] Error: {e}")
    finally:
        if close_here:
            conn.close()
    return new_count


# ---- CRUD Endpoints ----

@app.post("/alerts", status_code=201)
def create_alert(alert: AlertCreate):
    """Manually create a custom alert for a specific gate."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT gate_id FROM gates WHERE gate_id = ?", (alert.gate_id,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Gate with ID {alert.gate_id} not found")
        cursor.execute(
            "INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved) VALUES (?, ?, ?, ?, ?, 0)",
            (alert.gate_id, alert.alert_type, alert.severity, alert.message, alert.recommendation)
        )
        conn.commit()
        alert_id = cursor.lastrowid
        conn.close()
        return {"message": "Alert created successfully", "alert_id": alert_id}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/alerts/active")
def get_active_alerts():
    """Returns only unresolved alerts. Triggers ML alert generation first."""
    try:
        try:
            gate_metrics = get_gates_metrics()
            gate_status_map = {g["gate_id"]: g["predicted_risk"] for g in gate_metrics}
        except Exception as e:
            print(f"Error fetching gate metrics for active alerts: {e}")
            gate_status_map = {}

        conn = get_connection()
        generate_ml_alerts(conn)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.alert_id, a.gate_id, g.gate_name, a.alert_type,
                   a.severity, a.message, a.recommendation,
                   a.is_resolved, a.alert_time
            FROM alerts a
            LEFT JOIN gates g ON a.gate_id = g.gate_id
            WHERE a.is_resolved = 0
            ORDER BY
                CASE a.severity
                    WHEN 'Critical' THEN 1
                    WHEN 'High'     THEN 2
                    WHEN 'Medium'   THEN 3
                    ELSE 4
                END,
                a.alert_time DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        return [{
            "alert_id":       row[0],
            "gate_id":        row[1],
            "gate_name":      row[2] or f"Gate #{row[1]}",
            "alert_type":     row[3],
            "severity":       row[4] or "Medium",
            "message":        row[5],
            "recommendation": row[6] or "",
            "is_resolved":    row[7] or 0,
            "alert_time":     row[8],
            "gate_status":    gate_status_map.get(row[1], "Open")
        } for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int):
    """Soft-resolve an alert (marks is_resolved=1, preserves history)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT alert_id FROM alerts WHERE alert_id = ?", (alert_id,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
        cursor.execute("UPDATE alerts SET is_resolved=1 WHERE alert_id=?", (alert_id,))
        conn.commit()
        conn.close()
        return {"message": f"Alert #{alert_id} marked as resolved.", "alert_id": alert_id}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/alerts/generate", status_code=201)
def trigger_ml_alert_generation():
    """Manually trigger ML alert generation across all gates."""
    try:
        count = generate_ml_alerts()
        return {"message": f"ML alert scan complete. {count} new alert(s) generated.", "new_alerts": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Alert generation failed: {str(e)}")


@app.delete("/alerts/{alert_id}")
def delete_alert(alert_id: int):
    """Hard-delete an alert (for admin cleanup). Prefer /resolve for normal workflow."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT alert_id FROM alerts WHERE alert_id = ?", (alert_id,))
        if cursor.fetchone() is None:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Alert with ID {alert_id} not found")
        cursor.execute("DELETE FROM alerts WHERE alert_id = ?", (alert_id,))
        conn.commit()
        conn.close()
        return {"message": f"Alert {alert_id} deleted successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/system/reseed")
def post_reseed():
    try:
        cancel_all_timers()
        from backend.database import init_db, seed_db
        init_db()
        seed_db()
        return {
            "status": "success",
            "message": "SQLite database successfully re-initialized and seeded."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seed database: {str(e)}")


# ----------------- VOLUNTEER OPERATIONS PORTAL ENDPOINTS (DAY 22) -----------------

def get_current_volunteer(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "volunteer":
        raise HTTPException(status_code=403, detail="Access denied: Only volunteers allowed")
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT volunteer_id, volunteer_name, assigned_gate, contact, status 
        FROM volunteers WHERE username = ?
    """, (current_user["username"],))
    vol_row = cursor.fetchone()
    conn.close()
    
    if not vol_row:
        raise HTTPException(status_code=404, detail="Volunteer profile not found")
        
    return {
        "volunteer_id": vol_row[0],
        "volunteer_name": vol_row[1],
        "assigned_gate": vol_row[2],
        "contact": vol_row[3],
        "status": vol_row[4],
        "username": current_user["username"]
    }


def get_gate_live_status(gate_id: int):
    try:
        conn = get_connection()
        analytics = get_live_analytics(conn)
        conn.close()
        for g in analytics:
            if g["gate_id"] == gate_id:
                return {
                    "gate_id": gate_id,
                    "gate_name": g["gate_name"],
                    "max_capacity": g["max_capacity"],
                    "current_occupancy": g["current_occupancy"],
                    "queue_size": g["queue_length"],
                    "predicted_wait_time": g["predicted_wait_time"],
                    "predicted_risk": g["predicted_risk"],
                    "congestion_status": g["congestion_level"],
                    "status": g["status"],
                    "deficit": g["deficit"],
                    "required_volunteers": g["required_volunteers"]
                }
        return None
    except Exception as e:
        print(f"Error in get_gate_live_status: {e}")
        return None


class StatusUpdateRequest(BaseModel):
    status: str

@app.post("/volunteers/my-status")
def update_my_status(data: StatusUpdateRequest, current_vol: dict = Depends(get_current_volunteer)):
    if data.status not in ["Available", "Busy", "Break", "Offline"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'Available', 'Busy', 'Break', or 'Offline'")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Log status change activity
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Status Change', ?, ?)
        """, (current_vol["volunteer_id"], current_vol["assigned_gate"], f"Volunteer changed status to {data.status}"))
        
        # Update status
        cursor.execute("""
            UPDATE volunteers
            SET status = ?
            WHERE volunteer_id = ?
        """, (data.status, current_vol["volunteer_id"]))
        
        conn.commit()
        conn.close()
        return {"status": "success", "new_status": data.status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/volunteers/my-assignment")
def get_my_assignment(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get gate info
        gate_id = current_vol["assigned_gate"]
        gate_name = "Unassigned"
        max_capacity = 0
        live_gate_status = None
        
        if gate_id is not None:
            cursor.execute("SELECT gate_name, max_capacity FROM gates WHERE gate_id = ?", (gate_id,))
            g_row = cursor.fetchone()
            if g_row:
                gate_name, max_capacity = g_row
            live_gate_status = get_gate_live_status(gate_id)
                
        # Check attendance for today
        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("""
            SELECT check_in_time, check_out_time 
            FROM attendance 
            WHERE volunteer_id = ? AND date = ?
        """, (current_vol["volunteer_id"], today_str))
        att_row = cursor.fetchone()
        conn.close()
        
        duty_status = "Off Duty"
        if att_row:
            check_in, check_out = att_row
            if check_in and not check_out:
                duty_status = "Active"
            elif check_in and check_out:
                duty_status = "Completed"
                
        return {
            "volunteer_id": current_vol["volunteer_id"],
            "volunteer_name": current_vol["volunteer_name"],
            "assigned_gate": gate_id,
            "gate_name": gate_name,
            "shift_timing": "09:00 - 19:00",
            "role": "Crowd Control Specialist",
            "supervisor_name": "System Administrator",
            "duty_status": duty_status,
            "status": current_vol["status"],
            "contact": current_vol["contact"],
            "live_gate_status": live_gate_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/volunteers/my-profile")
def get_my_profile(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Self-heal today's attendance/operational status
        sync_volunteer_attendance_status(current_vol["volunteer_id"], cursor)
        conn.commit()
        
        # Get volunteer info
        cursor.execute("""
            SELECT volunteer_name, email, phone, contact, joining_date, experience, profile_photo, assigned_gate, status, attendance_status
            FROM volunteers WHERE volunteer_id = ?
        """, (current_vol["volunteer_id"],))
        v_row = cursor.fetchone()
        
        if not v_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Volunteer not found")
            
        name, email, phone, contact, joining_date, experience, profile_photo, gate_id, status, att_status = v_row
        
        # Get gate name
        gate_name = "Reserve Pool"
        if gate_id is not None:
            cursor.execute("SELECT gate_name FROM gates WHERE gate_id = ?", (gate_id,))
            g_row = cursor.fetchone()
            if g_row:
                gate_name = g_row[0]
                
        # Fetch stats
        cursor.execute("SELECT COUNT(*) FROM volunteer_checklists WHERE volunteer_id = ?", (current_vol["volunteer_id"],))
        checklists_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM incidents WHERE volunteer_id = ?", (current_vol["volunteer_id"],))
        incidents_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM assignment_requests WHERE volunteer_id = ? AND status = 'Completed'", (current_vol["volunteer_id"],))
        assignments_count = cursor.fetchone()[0]
        
        # Fetch today's working hours & attendance summary
        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("SELECT check_in_time, check_out_time FROM attendance WHERE volunteer_id = ? AND date = ?", (current_vol["volunteer_id"], today_str))
        today_att = cursor.fetchone()
        
        today_hours = 0.0
        if today_att:
            t_in, t_out = today_att
            if t_in:
                t_end = t_out if t_out else datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                try:
                    dt_in = datetime.strptime(t_in, "%Y-%m-%d %H:%M:%S")
                    dt_end = datetime.strptime(t_end, "%Y-%m-%d %H:%M:%S")
                    today_hours = round((dt_end - dt_in).total_seconds() / 3600.0, 2)
                except:
                    pass
                    
        # Total historical hours
        cursor.execute("SELECT check_in_time, check_out_time FROM attendance WHERE volunteer_id = ?", (current_vol["volunteer_id"],))
        all_att = cursor.fetchall()
        total_hours = 0.0
        for r_in, r_out in all_att:
            if r_in and r_out:
                try:
                    dt_in = datetime.strptime(r_in, "%Y-%m-%d %H:%M:%S")
                    dt_out = datetime.strptime(r_out, "%Y-%m-%d %H:%M:%S")
                    total_hours += (dt_out - dt_in).total_seconds() / 3600.0
                except:
                    pass
        total_hours = round(total_hours, 2)
        
        # Operator score calculation
        operator_score = min(100, 80 + (checklists_count * 3) + (assignments_count * 5))
        
        # Fetch recent timeline
        cursor.execute("""
            SELECT activity_type, timestamp, details 
            FROM volunteer_activity_logs 
            WHERE volunteer_id = ? 
            ORDER BY timestamp DESC LIMIT 8
        """, (current_vol["volunteer_id"],))
        timeline = [{"activity_type": r[0], "timestamp": r[1], "details": r[2]} for r in cursor.fetchall()]
        
        # Get system mode
        cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
        mode_row = cursor.fetchone()
        system_mode = mode_row[0] if mode_row else "Demo"
        
        conn.close()
        
        return {
            "volunteer_id": current_vol["volunteer_id"],
            "volunteer_name": name,
            "email": email or "",
            "phone": phone or "",
            "emergency_contact": contact,
            "joining_date": joining_date or "2026-06-01",
            "experience": experience or "Entry Level",
            "profile_photo": profile_photo or "",
            "assigned_gate": gate_id,
            "gate_name": gate_name,
            "status": status,
            "attendance_status": att_status,
            "system_mode": system_mode,
            "stats": {
                "checklists_submitted": checklists_count,
                "incidents_reported": incidents_count,
                "assignments_completed": assignments_count,
                "today_hours": today_hours,
                "total_hours": total_hours,
                "operator_score": operator_score
            },
            "timeline": timeline
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.put("/volunteers/my-profile")
def update_my_profile(data: ProfileUpdate, current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        pass_hash = None
        if data.password:
            pass_hash = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
        cursor.execute("SELECT volunteer_name, email, phone FROM volunteers WHERE volunteer_id = ?", (current_vol["volunteer_id"],))
        existing = cursor.fetchone()
        
        v_name = data.volunteer_name if data.volunteer_name is not None else (existing[0] if existing else None)
        v_email = data.email if data.email is not None else (existing[1] if existing else None)
        v_phone = data.phone if data.phone is not None else (existing[2] if existing else None)
        
        if pass_hash:
            cursor.execute("""
                UPDATE volunteers
                SET volunteer_name = ?, email = ?, phone = ?, profile_photo = ?, password_hash = ?
                WHERE volunteer_id = ?
            """, (v_name, v_email, v_phone, data.profile_photo, pass_hash, current_vol["volunteer_id"]))
        else:
            cursor.execute("""
                UPDATE volunteers
                SET volunteer_name = ?, email = ?, phone = ?, profile_photo = ?
                WHERE volunteer_id = ?
            """, (v_name, v_email, v_phone, data.profile_photo, current_vol["volunteer_id"]))
            
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, details)
            VALUES (?, 'Profile Update', 'Volunteer updated name/email/phone/profile picture/password')
        """, (current_vol["volunteer_id"],))
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Profile updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.put("/volunteers/{volunteer_id}")
def update_volunteer(volunteer_id: int, vol: VolunteerCreate):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verify volunteer exists and get old info
        cursor.execute("SELECT volunteer_name, assigned_gate, status FROM volunteers WHERE volunteer_id = ?", (volunteer_id,))
        old_vol_row = cursor.fetchone()
        if old_vol_row is None:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Volunteer with ID {volunteer_id} not found")
            
        old_name, old_gate, old_status = old_vol_row
            
        # Verify gate exists if assigned_gate is provided
        if vol.assigned_gate is not None:
            cursor.execute("SELECT gate_id FROM gates WHERE gate_id = ?", (vol.assigned_gate,))
            if cursor.fetchone() is None:
                conn.close()
                raise HTTPException(status_code=404, detail=f"Gate with ID {vol.assigned_gate} not found")
                
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Check if gate changed
        if old_gate != vol.assigned_gate:
            cursor.execute("SELECT gate_name FROM gates WHERE gate_id = ?", (vol.assigned_gate,))
            new_gate_row = cursor.fetchone()
            new_gate_name = new_gate_row[0] if new_gate_row else "Reserve Pool"
            
            cursor.execute("SELECT gate_name FROM gates WHERE gate_id = ?", (old_gate,))
            old_gate_row = cursor.fetchone()
            old_gate_name = old_gate_row[0] if old_gate_row else "Reserve Pool"
            
            cursor.execute("""
                INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                VALUES (?, 'Gate Change', ?, ?)
            """, (volunteer_id, vol.assigned_gate, f"Admin reassigned {old_name} from {old_gate_name} to {new_gate_name}"))
            
            # Also reset gate_duty_start_time to now
            cursor.execute("UPDATE volunteers SET gate_duty_start_time = ? WHERE volunteer_id = ?", (now_str, volunteer_id))
            
        # Check if status changed
        if vol.status is not None and old_status != vol.status:
            cursor.execute("""
                INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                VALUES (?, 'Status Change', ?, ?)
            """, (volunteer_id, vol.assigned_gate, f"Admin changed status of {old_name} to {vol.status}"))
            
        pass_hash = None
        if vol.password:
            pass_hash = bcrypt.hashpw(vol.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        if vol.status is not None:
            if pass_hash:
                cursor.execute(
                    """
                    UPDATE volunteers 
                    SET volunteer_name = ?, assigned_gate = ?, contact = ?, status = ?, 
                        email = ?, phone = ?, profile_photo = ?, joining_date = ?, experience = ?, password_hash = ?,
                        age = ?, gender = ?
                    WHERE volunteer_id = ?
                    """,
                    (vol.volunteer_name, vol.assigned_gate, vol.contact, vol.status,
                     vol.email, vol.phone, vol.profile_photo, vol.joining_date, vol.experience, pass_hash,
                     vol.age, vol.gender, volunteer_id)
                )
            else:
                cursor.execute(
                    """
                    UPDATE volunteers 
                    SET volunteer_name = ?, assigned_gate = ?, contact = ?, status = ?, 
                        email = ?, phone = ?, profile_photo = ?, joining_date = ?, experience = ?,
                        age = ?, gender = ?
                    WHERE volunteer_id = ?
                    """,
                    (vol.volunteer_name, vol.assigned_gate, vol.contact, vol.status,
                     vol.email, vol.phone, vol.profile_photo, vol.joining_date, vol.experience,
                     vol.age, vol.gender, volunteer_id)
                )
        else:
            if pass_hash:
                cursor.execute(
                    """
                    UPDATE volunteers 
                    SET volunteer_name = ?, assigned_gate = ?, contact = ?, 
                        email = ?, phone = ?, profile_photo = ?, joining_date = ?, experience = ?, password_hash = ?,
                        age = ?, gender = ?
                    WHERE volunteer_id = ?
                    """,
                    (vol.volunteer_name, vol.assigned_gate, vol.contact,
                     vol.email, vol.phone, vol.profile_photo, vol.joining_date, vol.experience, pass_hash,
                     vol.age, vol.gender, volunteer_id)
                )
            else:
                cursor.execute(
                    """
                    UPDATE volunteers 
                    SET volunteer_name = ?, assigned_gate = ?, contact = ?, 
                        email = ?, phone = ?, profile_photo = ?, joining_date = ?, experience = ?,
                        age = ?, gender = ?
                    WHERE volunteer_id = ?
                    """,
                    (vol.volunteer_name, vol.assigned_gate, vol.contact,
                     vol.email, vol.phone, vol.profile_photo, vol.joining_date, vol.experience,
                     vol.age, vol.gender, volunteer_id)
                )
            
        conn.commit()
        conn.close()
        
        return {
            "message": "Volunteer updated successfully",
            "volunteer_id": volunteer_id,
            "volunteer_name": vol.volunteer_name,
            "assigned_gate": vol.assigned_gate,
            "contact": vol.contact,
            "status": vol.status if vol.status is not None else old_status
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/attendance/status")
def get_attendance_status(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Self-heal today's attendance/operational status
        sync_volunteer_attendance_status(current_vol["volunteer_id"], cursor)
        conn.commit()
        
        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("""
            SELECT attendance_id, check_in_time, check_out_time, date 
            FROM attendance 
            WHERE volunteer_id = ? AND date = ?
        """, (current_vol["volunteer_id"], today_str))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return {
                "attendance_id": None,
                "check_in_time": None,
                "check_out_time": None,
                "date": today_str,
                "is_checked_in": False,
                "status": "Not Checked In"
            }
        
        att_id, check_in, check_out, dt = row
        status_str = "Not Checked In"
        if check_in and not check_out:
            status_str = "Working"
        elif check_in and check_out:
            status_str = "Completed"
            
        return {
            "attendance_id": att_id,
            "check_in_time": check_in,
            "check_out_time": check_out,
            "date": dt,
            "is_checked_in": check_in is not None and check_out is None,
            "status": status_str
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/attendance/check-in")
def check_in(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        # Check if already checked in today
        cursor.execute("""
            SELECT attendance_id, check_in_time FROM attendance 
            WHERE volunteer_id = ? AND date = ?
        """, (current_vol["volunteer_id"], today_str))
        row = cursor.fetchone()
        
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        if row:
            att_id, check_in_val = row
            if check_in_val:
                conn.close()
                raise HTTPException(status_code=400, detail="Already checked in today")
            cursor.execute("""
                UPDATE attendance SET check_in_time = ? WHERE attendance_id = ?
            """, (now_str, att_id))
        else:
            cursor.execute("""
                INSERT INTO attendance (volunteer_id, check_in_time, date)
                VALUES (?, ?, ?)
            """, (current_vol["volunteer_id"], now_str, today_str))
            
        # Update volunteers table
        cursor.execute("""
            UPDATE volunteers
            SET attendance_status = 'Checked In', status = 'Available', gate_duty_start_time = ?
            WHERE volunteer_id = ?
        """, (now_str, current_vol["volunteer_id"]))
        
        # Log activity
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Check In', ?, 'Volunteer checked in for shift at gate duty')
        """, (current_vol["volunteer_id"], current_vol["assigned_gate"]))
        
        add_volunteer_notification(
            cursor,
            current_vol["volunteer_id"],
            "Attendance",
            "Checked In Successfully",
            f"Duty shift started successfully at {now_str}."
        )

        conn.commit()
        conn.close()
        return {"message": "Checked in successfully", "time": now_str}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/attendance/check-out")
def check_out(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        cursor.execute("""
            SELECT attendance_id, check_in_time, check_out_time FROM attendance 
            WHERE volunteer_id = ? AND date = ?
        """, (current_vol["volunteer_id"], today_str))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            raise HTTPException(status_code=400, detail="Cannot check out without checking in first")
            
        att_id, check_in_val, check_out_val = row
        if not check_in_val:
            conn.close()
            raise HTTPException(status_code=400, detail="Cannot check out without checking in first")
            
        if check_out_val:
            conn.close()
            raise HTTPException(status_code=400, detail="Already checked out today")
            
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            UPDATE attendance SET check_out_time = ? WHERE attendance_id = ?
        """, (now_str, att_id))
        
        # Update volunteers table
        cursor.execute("""
            UPDATE volunteers
            SET attendance_status = 'Checked Out', status = 'Offline', gate_duty_start_time = NULL
            WHERE volunteer_id = ?
        """, (current_vol["volunteer_id"],))
        
        # Log activity
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Check Out', ?, 'Volunteer checked out and completed shift')
        """, (current_vol["volunteer_id"], current_vol["assigned_gate"]))

        # Cancel any active assignment requests
        cursor.execute("""
            UPDATE assignment_requests
            SET status = 'Cancelled', updated_at = ?
            WHERE volunteer_id = ? AND status IN ('Pending', 'Accepted', 'En Route', 'Arrived')
        """, (now_str, current_vol["volunteer_id"]))
        
        add_volunteer_notification(
            cursor,
            current_vol["volunteer_id"],
            "Attendance",
            "Checked Out Successfully",
            f"Duty shift completed successfully at {now_str}."
        )

        conn.commit()
        conn.close()
        return {"message": "Checked out successfully", "time": now_str}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/attendance/history")
def get_attendance_history(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT attendance_id, check_in_time, check_out_time, date 
            FROM attendance 
            WHERE volunteer_id = ? 
            ORDER BY date DESC, check_in_time DESC
        """, (current_vol["volunteer_id"],))
        rows = cursor.fetchall()
        conn.close()
        
        history = []
        for att_id, check_in, check_out, dt in rows:
            duration = 0.0
            if check_in and check_out:
                try:
                    dt_in = datetime.strptime(check_in, "%Y-%m-%d %H:%M:%S")
                    dt_out = datetime.strptime(check_out, "%Y-%m-%d %H:%M:%S")
                    duration = round((dt_out - dt_in).total_seconds() / 3600.0, 2)
                except:
                    pass
            elif check_in:
                try:
                    dt_in = datetime.strptime(check_in, "%Y-%m-%d %H:%M:%S")
                    duration = round((datetime.now() - dt_in).total_seconds() / 3600.0, 2)
                except:
                    pass
                    
            history.append({
                "attendance_id": att_id,
                "check_in_time": check_in,
                "check_out_time": check_out,
                "date": dt,
                "duration_hours": duration
            })
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/admin/attendance/export")
def export_attendance(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.attendance_id, v.volunteer_name, a.date, a.check_in_time, a.check_out_time
            FROM attendance a
            JOIN volunteers v ON a.volunteer_id = v.volunteer_id
            ORDER BY a.date DESC, v.volunteer_name ASC
        """)
        rows = cursor.fetchall()
        conn.close()
        
        records = []
        for att_id, name, dt, check_in, check_out in rows:
            duration = 0.0
            if check_in and check_out:
                try:
                    dt_in = datetime.strptime(check_in, "%Y-%m-%d %H:%M:%S")
                    dt_out = datetime.strptime(check_out, "%Y-%m-%d %H:%M:%S")
                    duration = round((dt_out - dt_in).total_seconds() / 3600.0, 2)
                except:
                    pass
            records.append({
                "attendance_id": att_id,
                "volunteer_name": name,
                "date": dt,
                "check_in_time": check_in,
                "check_out_time": check_out,
                "duration_hours": duration
            })
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/volunteers/checklist")
def get_checklist(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("""
            SELECT arrived_at_gate, qr_scanner_working, barricades_checked, crowd_flow_normal, emergency_exit_clear, communication_device_checked, shift_completed, submitted_at
            FROM volunteer_checklists 
            WHERE volunteer_id = ? AND date = ?
        """, (current_vol["volunteer_id"], today_str))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return {
                "arrived_at_gate": 0,
                "qr_scanner_working": 0,
                "barricades_checked": 0,
                "crowd_flow_normal": 0,
                "emergency_exit_clear": 0,
                "communication_device_checked": 0,
                "shift_completed": 0,
                "submitted_at": None,
                "date": today_str
            }
            
        return {
            "arrived_at_gate": row[0],
            "qr_scanner_working": row[1],
            "barricades_checked": row[2],
            "crowd_flow_normal": row[3],
            "emergency_exit_clear": row[4],
            "communication_device_checked": row[5],
            "shift_completed": row[6],
            "submitted_at": row[7],
            "date": today_str
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/volunteers/checklist")
def update_checklist(data: ChecklistUpdate, current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        today_str = datetime.now().strftime("%Y-%m-%d")
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Check if row exists to prevent duplicate submission
        cursor.execute("""
            SELECT volunteer_id FROM volunteer_checklists 
            WHERE volunteer_id = ? AND date = ?
        """, (current_vol["volunteer_id"], today_str))
        row = cursor.fetchone()
        
        if row:
            conn.close()
            raise HTTPException(status_code=400, detail="Daily safety checklist has already been submitted for today.")
            
        cursor.execute("""
            INSERT INTO volunteer_checklists (volunteer_id, date, arrived_at_gate, qr_scanner_working, barricades_checked, crowd_flow_normal, emergency_exit_clear, communication_device_checked, shift_completed, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (current_vol["volunteer_id"], today_str, data.arrived_at_gate, data.qr_scanner_working, data.barricades_checked, data.crowd_flow_normal, data.emergency_exit_clear, data.communication_device_checked, data.shift_completed, now_str))
            
        # Log activity
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Submit Checklist', ?, ?)
        """, (current_vol["volunteer_id"], current_vol["assigned_gate"], f"Volunteer submitted daily safety checklist"))

        conn.commit()
        conn.close()
        return {"message": "Checklist submitted successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/volunteers/work-report")
def submit_work_report(data: WorkReportSubmit, current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        today_str = datetime.now().strftime("%Y-%m-%d")
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Check if already submitted today
        cursor.execute("SELECT report_id FROM daily_work_reports WHERE volunteer_id = ? AND date = ?", (current_vol["volunteer_id"], today_str))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Daily work report already submitted for today")
            
        cursor.execute("""
            INSERT INTO daily_work_reports (volunteer_id, date, tasks, crowd_situation, issues_faced, action_taken, suggestions, additional_notes, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (current_vol["volunteer_id"], today_str, data.tasks, data.crowd_situation, data.issues_faced, data.action_taken, data.suggestions, data.additional_notes, now_str))
        
        # Log activity
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Submit Work Report', ?, ?)
        """, (current_vol["volunteer_id"], current_vol["assigned_gate"], f"Volunteer submitted daily work report"))
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Work report submitted successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/volunteers/work-report")
def check_work_report(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("""
            SELECT tasks, crowd_situation, issues_faced, action_taken, suggestions, additional_notes, submitted_at
            FROM daily_work_reports
            WHERE volunteer_id = ? AND date = ?
        """, (current_vol["volunteer_id"], today_str))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return {"submitted": False, "report": None}
            
        return {
            "submitted": True,
            "report": {
                "tasks": row[0],
                "crowd_situation": row[1],
                "issues_faced": row[2],
                "action_taken": row[3],
                "suggestions": row[4],
                "additional_notes": row[5],
                "submitted_at": row[6]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/admin/daily-reports")
def get_admin_daily_reports(search: str = "", current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT r.report_id, v.volunteer_name, g.gate_name, r.date, r.tasks, r.crowd_situation, r.issues_faced, r.action_taken, r.suggestions, r.additional_notes, r.submitted_at
            FROM daily_work_reports r
            JOIN volunteers v ON r.volunteer_id = v.volunteer_id
            LEFT JOIN gates g ON v.assigned_gate = g.gate_id
        """
        params = []
        if search:
            query += " WHERE v.volunteer_name LIKE ? OR g.gate_name LIKE ? OR r.tasks LIKE ? OR r.issues_faced LIKE ?"
            like_val = f"%{search}%"
            params = [like_val, like_val, like_val, like_val]
            
        query += " ORDER BY r.submitted_at DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        reports = []
        for r in rows:
            reports.append({
                "report_id": r[0],
                "volunteer_name": r[1],
                "gate_name": r[2] or "Reserve Pool",
                "date": r[3],
                "tasks": r[4],
                "crowd_situation": r[5],
                "issues_faced": r[6],
                "action_taken": r[7],
                "suggestions": r[8],
                "additional_notes": r[9],
                "submitted_at": r[10]
            })
        return reports
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/announcements")
def get_announcements(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        # Fetch all announcements
        cursor.execute("""
            SELECT announcement_id, title, message, priority, created_at 
            FROM announcements 
            ORDER BY created_at DESC
        """)
        ann_rows = cursor.fetchall()
        
        # Fetch acknowledgements for this volunteer
        cursor.execute("""
            SELECT announcement_id 
            FROM announcement_acknowledgements 
            WHERE volunteer_id = ?
        """, (current_vol["volunteer_id"],))
        ack_rows = cursor.fetchall()
        conn.close()
        
        ack_ids = {r[0] for r in ack_rows}
        
        result = []
        for row in ann_rows:
            ann_id = row[0]
            result.append({
                "announcement_id": ann_id,
                "title": row[1],
                "message": row[2],
                "priority": row[3],
                "created_at": row[4],
                "is_read": ann_id in ack_ids
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/announcements/{announcement_id}/acknowledge")
def acknowledge_announcement(announcement_id: int, current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verify announcement exists
        cursor.execute("SELECT announcement_id FROM announcements WHERE announcement_id = ?", (announcement_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Announcement not found")
            
        # Fetch title for logging
        cursor.execute("SELECT title FROM announcements WHERE announcement_id = ?", (announcement_id,))
        ann_title_row = cursor.fetchone()
        ann_title = ann_title_row[0] if ann_title_row else f"Announcement #{announcement_id}"

        # Insert or ignore acknowledgement
        cursor.execute("""
            INSERT OR IGNORE INTO announcement_acknowledgements (announcement_id, volunteer_id)
            VALUES (?, ?)
        """, (announcement_id, current_vol["volunteer_id"]))
        
        # Insert activity log
        vname = current_vol["volunteer_name"]
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Acknowledgement', ?, ?)
        """, (current_vol["volunteer_id"], current_vol["assigned_gate"], f"{vname} acknowledged bulletin: '{ann_title}'"))
        
        conn.commit()
        conn.close()
        return {"message": "Announcement acknowledged successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


class ReminderRequest(BaseModel):
    reminder_type: str  # 'Checklist', 'Check-out', 'Work Report'


@app.get("/volunteers/notifications")
def get_my_notifications(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT notification_id, notification_type, title, message, related_id, status, created_at
            FROM volunteer_notifications
            WHERE volunteer_id = ?
            ORDER BY created_at DESC
        """, (current_vol["volunteer_id"],))
        rows = cursor.fetchall()
        conn.close()
        
        notifications = []
        for r in rows:
            notifications.append({
                "notification_id": r[0],
                "notification_type": r[1],
                "title": r[2],
                "message": r[3],
                "related_id": r[4],
                "status": r[5],
                "created_at": r[6]
            })
        return notifications
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/volunteers/notifications/read-all")
def read_all_notifications(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            UPDATE volunteer_notifications
            SET status = 'Read', updated_at = ?
            WHERE volunteer_id = ? AND status = 'Unread'
        """, (now_str, current_vol["volunteer_id"]))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "All notifications marked as read"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/volunteers/notifications/{notification_id}/read")
def read_notification(notification_id: int, current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            UPDATE volunteer_notifications
            SET status = 'Read', updated_at = ?
            WHERE notification_id = ? AND volunteer_id = ?
        """, (now_str, notification_id, current_vol["volunteer_id"]))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Notification marked as read"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/volunteers/notifications/{notification_id}/acknowledge")
def acknowledge_notification(notification_id: int, current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            UPDATE volunteer_notifications
            SET status = 'Acknowledged', updated_at = ?
            WHERE notification_id = ? AND volunteer_id = ?
        """, (now_str, notification_id, current_vol["volunteer_id"]))
        
        # Insert log
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Acknowledgement', ?, ?)
        """, (current_vol["volunteer_id"], current_vol["assigned_gate"], f"Volunteer acknowledged notification #{notification_id}"))
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Notification acknowledged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/admin/volunteers/{volunteer_id}/remind")
def send_volunteer_reminder(volunteer_id: int, data: ReminderRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verify volunteer exists
        cursor.execute("SELECT volunteer_name FROM volunteers WHERE volunteer_id = ?", (volunteer_id,))
        vol_row = cursor.fetchone()
        if not vol_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Volunteer not found")
            
        title = f"{data.reminder_type} Reminder"
        message = f"Please complete your {data.reminder_type.lower()} as scheduled for your shift."
        
        cursor.execute("""
            INSERT INTO volunteer_notifications (volunteer_id, notification_type, title, message, status)
            VALUES (?, 'Reminder', ?, ?, 'Unread')
        """, (volunteer_id, title, message))
        
        # Log activity
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, details)
            VALUES (?, 'Reminder Sent', ?)
        """, (volunteer_id, f"Admin sent {data.reminder_type.lower()} reminder to volunteer"))
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"{data.reminder_type} reminder sent successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/announcements", status_code=201)
def create_announcement(data: AnnouncementCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Admin role required")
        
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO announcements (title, message, priority)
            VALUES (?, ?, ?)
        """, (data.title, data.message, data.priority))
        
        ann_id = cursor.lastrowid
        
        # Select active volunteers and propagate as a notification
        cursor.execute("SELECT volunteer_id FROM volunteers WHERE status != 'Offline'")
        active_vols = cursor.fetchall()
        for (v_id,) in active_vols:
            add_volunteer_notification(
                cursor,
                v_id,
                "Announcement",
                f"Announcement: {data.title}",
                data.message,
                ann_id
            )
            
        conn.commit()
        conn.close()
        
        return {
            "message": "Announcement broadcasted successfully",
            "announcement_id": ann_id,
            "title": data.title,
            "message": data.message,
            "priority": data.priority
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/incidents", status_code=201)
async def create_incident(
    request: Request,
    current_vol: dict = Depends(get_current_volunteer)
):
    try:
        content_type = request.headers.get("content-type", "")
        
        # Initialize default values
        incident_type = None
        location = None
        severity = None
        description = None
        volunteer_id = None
        image = None
        photo_url = None
        
        if "multipart/form-data" in content_type:
            form = await request.form()
            incident_type = form.get("incident_type")
            location = form.get("location")
            severity = form.get("severity")
            description = form.get("description")
            volunteer_id = form.get("volunteer_id")
            image = form.get("image")
        else:
            body = await request.json()
            incident_type = body.get("incident_type")
            location = body.get("location")
            severity = body.get("severity")
            description = body.get("description")
            volunteer_id = body.get("volunteer_id")
            photo_url = body.get("photo_url")
            
        # Validations
        if not incident_type or not location or not severity or not description:
            raise HTTPException(status_code=400, detail="Missing required incident fields")
            
        # Use volunteer_id from form/JSON if present, otherwise default to current_vol["volunteer_id"]
        v_id = current_vol["volunteer_id"]
        if volunteer_id is not None:
            try:
                v_id = int(volunteer_id)
            except ValueError:
                pass
                
        # Handle Image Upload if present
        if image is not None and hasattr(image, "filename") and image.filename:
            # Check file size by seeking to the end
            await image.seek(0, 2)
            size = await image.tell()
            await image.seek(0)
            
            if size > 5 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Image size exceeds maximum limit of 5 MB")
                
            ext = os.path.splitext(image.filename)[1].lower()
            if ext not in [".jpg", ".jpeg", ".png"]:
                raise HTTPException(status_code=400, detail="Invalid file type. Only JPG, JPEG, and PNG are allowed.")
                
            import time
            import uuid
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            unique_id = uuid.uuid4().hex[:6]
            filename = f"incident_{timestamp}_{unique_id}{ext}"
            
            # Use the global static uploads folder dir
            _uploads_incidents_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads", "incidents"))
            os.makedirs(_uploads_incidents_dir, exist_ok=True)
            filepath = os.path.join(_uploads_incidents_dir, filename)
            
            content = await image.read()
            with open(filepath, "wb") as buffer:
                buffer.write(content)
                
            photo_url = f"uploads/incidents/{filename}"
            
        # Insert into Database
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO incidents (volunteer_id, incident_type, location, severity, description, photo_url)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (v_id, incident_type, location, severity, description, photo_url))
        
        incident_id = cursor.lastrowid
        
        # Insert admin alert alert notification
        gate_id = current_vol["assigned_gate"]
        msg = f"Incident Reported: {incident_type} at {location} ({description})"
        cursor.execute("""
            INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
            VALUES (?, 'Incident Alert', ?, ?, 'Investigate the incident location immediately.', 0)
        """, (gate_id, severity, msg))
        
        conn.commit()
        conn.close()
        
        return {
            "message": "Incident reported successfully",
            "incident_id": incident_id,
            "volunteer_id": v_id,
            "incident_type": incident_type,
            "location": location,
            "severity": severity,
            "description": description,
            "photo_url": photo_url
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/incidents")
def get_incidents(current_user: dict = Depends(get_current_user)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT i.incident_id, i.volunteer_id, v.volunteer_name, i.incident_type, i.location, i.severity, i.description, i.photo_url, i.created_at, i.is_resolved
            FROM incidents i
            JOIN volunteers v ON i.volunteer_id = v.volunteer_id
            ORDER BY i.created_at DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        
        result = []
        for r in rows:
            result.append({
                "incident_id": r[0],
                "volunteer_id": r[1],
                "volunteer_name": r[2],
                "incident_type": r[3],
                "location": r[4],
                "severity": r[5],
                "description": r[6],
                "photo_url": r[7],
                "created_at": r[8],
                "is_resolved": bool(r[9])
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/incidents/{incident_id}/resolve")
def resolve_incident(incident_id: int, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Admin role required")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verify incident exists
        cursor.execute("SELECT volunteer_id, incident_type, location FROM incidents WHERE incident_id = ?", (incident_id,))
        inc_row = cursor.fetchone()
        if not inc_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Incident not found")
            
        vol_id, inc_type, location = inc_row
        
        cursor.execute("UPDATE incidents SET is_resolved = 1 WHERE incident_id = ?", (incident_id,))
        
        # Log activity under the volunteer's id
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Incident Resolved', NULL, ?)
        """, (vol_id, f"Admin resolved incident: {inc_type} at {location}"))
        
        conn.commit()
        conn.close()
        return {"message": "Incident resolved successfully", "incident_id": incident_id}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/volunteers/performance")
def get_volunteer_performance(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Count checklists
        cursor.execute("""
            SELECT COUNT(*), 
                   SUM(arrived_at_gate), 
                   SUM(qr_scanner_working), 
                   SUM(barricades_checked), 
                   SUM(crowd_flow_normal), 
                   SUM(emergency_exit_clear),
                   SUM(communication_device_checked),
                   SUM(shift_completed)
            FROM volunteer_checklists 
            WHERE volunteer_id = ?
        """, (current_vol["volunteer_id"],))
        cl_row = cursor.fetchone()
        
        checklists_count = cl_row[0] or 0
        total_arrived = cl_row[1] or 0
        total_qr = cl_row[2] or 0
        total_barricades = cl_row[3] or 0
        total_flow = cl_row[4] or 0
        total_exit = cl_row[5] or 0
        total_comm = cl_row[6] or 0
        total_completed_shift = cl_row[7] or 0
        
        total_tasks_completed = total_arrived + total_qr + total_barricades + total_flow + total_exit + total_comm + total_completed_shift
        
        # Count incidents reported
        cursor.execute("""
            SELECT COUNT(*) FROM incidents WHERE volunteer_id = ?
        """, (current_vol["volunteer_id"],))
        incidents_filed = cursor.fetchone()[0] or 0
        
        # Count attendance checks
        cursor.execute("""
            SELECT COUNT(*) FROM attendance WHERE volunteer_id = ? AND check_in_time IS NOT NULL
        """, (current_vol["volunteer_id"],))
        shifts_completed = cursor.fetchone()[0] or 0
        
        conn.close()
        
        # Dynamic operator score calculation
        score = 85.0
        if checklists_count > 0 or shifts_completed > 0:
            score += (checklists_count * 2) + (total_tasks_completed * 0.5) + (shifts_completed * 2)
            score = min(score, 100.0)
        else:
            score = 90.0  # default for new volunteers
            
        return {
            "volunteer_id": current_vol["volunteer_id"],
            "volunteer_name": current_vol["volunteer_name"],
            "checklists_submitted": checklists_count,
            "total_tasks_completed": total_tasks_completed,
            "incidents_filed": incidents_filed,
            "shifts_completed": shifts_completed,
            "operator_score": round(score, 1)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ----------------- NEW VOLUNTEER WORKFLOW ENDPOINTS (PHASES 3, 4, 5, 6, 7) -----------------

@app.get("/volunteers/my-requests")
def get_my_requests(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.request_id, r.volunteer_id, r.from_gate_id, fg.gate_name as from_gate_name, 
                   r.to_gate_id, tg.gate_name as to_gate_name, r.reason, r.priority, r.status, r.created_at
            FROM assignment_requests r
            LEFT JOIN gates fg ON r.from_gate_id = fg.gate_id
            LEFT JOIN gates tg ON r.to_gate_id = tg.gate_id
            WHERE r.volunteer_id = ? AND r.status IN ('Pending', 'Accepted', 'En Route', 'Arrived')
            ORDER BY r.created_at DESC
        """, (current_vol["volunteer_id"],))
        rows = cursor.fetchall()
        conn.close()
        
        requests = []
        for row in rows:
            requests.append({
                "request_id": row[0],
                "volunteer_id": row[1],
                "from_gate_id": row[2],
                "from_gate_name": row[3] or "Reserve Pool",
                "to_gate_id": row[4],
                "to_gate_name": row[5],
                "reason": row[6],
                "priority": row[7],
                "status": row[8],
                "created_at": row[9]
            })
        return requests
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/volunteers/requests/{request_id}/accept")
def accept_request(request_id: int, current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Fetch request to make sure it exists, belongs to this volunteer and is Pending
        cursor.execute("""
            SELECT request_id, volunteer_id, from_gate_id, to_gate_id, priority, status 
            FROM assignment_requests 
            WHERE request_id = ? AND volunteer_id = ? AND status = 'Pending'
        """, (request_id, current_vol["volunteer_id"]))
        req = cursor.fetchone()
        if not req:
            conn.close()
            raise HTTPException(status_code=404, detail="Pending assignment request not found or unauthorized")
        
        _, vol_id, from_gate_id, to_gate_id, priority, _ = req
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Calculate time spent at current gate before changing to the new one
        cursor.execute("SELECT gate_duty_start_time FROM volunteers WHERE volunteer_id=?", (vol_id,))
        duty_row = cursor.fetchone()
        if duty_row and duty_row[0]:
            duty_start_str = duty_row[0]
            try:
                duty_start_t = datetime.strptime(duty_start_str, "%Y-%m-%d %H:%M:%S")
                accept_t = datetime.strptime(now_str, "%Y-%m-%d %H:%M:%S")
                duty_dur = int((accept_t - duty_start_t).total_seconds())
                
                # Get old gate name
                old_gate_name = "Reserve Pool"
                if from_gate_id:
                    cursor.execute("SELECT gate_name FROM gates WHERE gate_id=?", (from_gate_id,))
                    gn_row = cursor.fetchone()
                    if gn_row:
                        old_gate_name = gn_row[0]
                
                cursor.execute("""
                    INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                    VALUES (?, 'Gate Duty Duration', ?, ?)
                """, (vol_id, from_gate_id, f"Spent {duty_dur // 60}m {duty_dur % 60}s at {old_gate_name}"))
            except Exception as ex:
                print(f"Error logging duty duration on accept: {ex}")

        cursor.execute("SELECT value FROM system_settings WHERE key = 'volunteer_assignment_mode'")
        mode_row = cursor.fetchone()
        sys_mode = mode_row[0] if mode_row else "Demo"
        
        target_status = 'En Route' if sys_mode not in ["Simulation", "Demo"] else 'Accepted'

        # Update request status, set accepted_at
        cursor.execute("""
            UPDATE assignment_requests 
            SET status = ?, updated_at = ?, accepted_at = ? 
            WHERE request_id = ?
        """, (target_status, now_str, now_str, request_id))
        
        # Cancel other pending requests for the same volunteer
        cursor.execute("""
            UPDATE assignment_requests 
            SET status = 'Cancelled', updated_at = ? 
            WHERE volunteer_id = ? AND request_id != ? AND status = 'Pending'
        """, (now_str, vol_id, request_id))
        
        # Set volunteer status
        cursor.execute("""
            UPDATE volunteers 
            SET status = ? 
            WHERE volunteer_id = ?
        """, (target_status, vol_id))

        # Fetch target gate name
        cursor.execute("SELECT gate_name FROM gates WHERE gate_id=?", (to_gate_id,))
        to_gate_name = cursor.fetchone()[0]

        cursor.execute("""
            UPDATE volunteer_notifications 
            SET status = 'Read', updated_at = ?
            WHERE volunteer_id = ? AND related_id = ? AND notification_type = 'Assignment'
        """, (now_str, vol_id, request_id))

        add_volunteer_notification(
            cursor,
            vol_id,
            "Assignment",
            "Redeployment Accepted",
            f"You accepted redeployment to {to_gate_name}. Please proceed to the station.",
            request_id
        )

        vname = current_vol["volunteer_name"]
        
        # Log 'Accept Request' activity
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Accept Request', ?, ?)
        """, (vol_id, to_gate_id, f"{vname} accepted"))
        
        # Insert admin notification alert
        msg = f"{vname} accepted redeployment → {to_gate_name}"
        cursor.execute(
            """
            INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
            VALUES (?, 'Staff Notification', 'Low', ?, 'Volunteer accepted redeployment.', 0)
            """,
            (to_gate_id, msg)
        )
            
        cursor.execute("SELECT value FROM system_settings WHERE key = 'simulation_delay_seconds'")
        delay_row = cursor.fetchone()
        delay_sec = int(delay_row[0]) if delay_row else 3
        conn.commit()
        conn.close()
        
        # If in Simulation/Demo Mode, trigger simulation en-route timer
        if sys_mode in ["Simulation", "Demo"]:
            import threading
            t = threading.Timer(delay_sec, run_auto_enroute_simulation_timer, args=(request_id,))
            t.daemon = True
            register_timer(t)
            t.start()
        
        return {
            "message": f"Assignment request accepted successfully ({target_status})",
            "request_id": request_id,
            "status": target_status
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/volunteers/requests/{request_id}/arrive")
def arrive_request(request_id: int, current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Fetch request to make sure it exists, belongs to this volunteer and is Accepted or En Route
        cursor.execute("""
            SELECT request_id, volunteer_id, from_gate_id, to_gate_id, priority, status 
            FROM assignment_requests 
            WHERE request_id = ? AND volunteer_id = ? AND status IN ('Accepted', 'En Route')
        """, (request_id, current_vol["volunteer_id"]))
        req = cursor.fetchone()
        if not req:
            conn.close()
            raise HTTPException(status_code=404, detail="Active Accepted/En Route assignment request not found or unauthorized")
        
        _, vol_id, from_gate_id, to_gate_id, priority, _ = req
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Update request status to 'Arrived', set arrived_at
        cursor.execute("""
            UPDATE assignment_requests 
            SET status = 'Arrived', updated_at = ?, arrived_at = ? 
            WHERE request_id = ?
        """, (now_str, now_str, request_id))
        
        # Update volunteer status to 'Arrived'
        cursor.execute("""
            UPDATE volunteers 
            SET status = 'Arrived' 
            WHERE volunteer_id = ?
        """, (vol_id,))

        # Get target gate name and max capacity
        cursor.execute("SELECT gate_name, max_capacity FROM gates WHERE gate_id=?", (to_gate_id,))
        to_gate_name, max_capacity = cursor.fetchone()

        cursor.execute("""
            UPDATE volunteer_notifications 
            SET status = 'Read', updated_at = ?
            WHERE volunteer_id = ? AND related_id = ? AND notification_type = 'Assignment'
        """, (now_str, vol_id, request_id))

        add_volunteer_notification(
            cursor,
            vol_id,
            "Assignment",
            "Redeployment Arrived",
            f"You arrived at {to_gate_name}. Setup complete.",
            request_id
        )
        
        vname = current_vol["volunteer_name"]
        
        # Log 'Arrived' activity
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Arrived', ?, ?)
        """, (vol_id, to_gate_id, f"{vname} arrived"))
        
        # Insert admin notification alert (Volunteer arrived)
        msg = f"{vname} arrived at {to_gate_name}"
        cursor.execute(
            """
            INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
            VALUES (?, 'Staff Notification', 'Low', ?, 'Volunteer arrived at gate.', 0)
            """,
            (to_gate_id, msg)
        )
            
        conn.commit()
        conn.close()
        
        # Automatically transition to Completed after 2 seconds
        import threading
        t = threading.Timer(2.0, complete_assignment_db, args=(request_id,))
        t.daemon = True
        register_timer(t)
        t.start()
        
        return {
            "message": "Volunteer arrival marked successfully (Arrived)",
            "request_id": request_id,
            "status": "Arrived"
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


class RejectRequestModel(BaseModel):
    reason: str


@app.post("/volunteers/requests/{request_id}/reject")
def reject_request(request_id: int, data: RejectRequestModel, current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Fetch request to make sure it exists, belongs to this volunteer and is Pending
        cursor.execute("""
            SELECT request_id, volunteer_id, from_gate_id, to_gate_id, status 
            FROM assignment_requests 
            WHERE request_id = ? AND volunteer_id = ? AND status = 'Pending'
        """, (request_id, current_vol["volunteer_id"]))
        req = cursor.fetchone()
        if not req:
            conn.close()
            raise HTTPException(status_code=404, detail="Pending assignment request not found or unauthorized")
        
        _, vol_id, from_gate_id, to_gate_id, _ = req
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Calculate time spent at current gate before reject (if any)
        cursor.execute("SELECT gate_duty_start_time FROM volunteers WHERE volunteer_id=?", (vol_id,))
        duty_row = cursor.fetchone()
        if duty_row and duty_row[0]:
            duty_start_str = duty_row[0]
            try:
                duty_start_t = datetime.strptime(duty_start_str, "%Y-%m-%d %H:%M:%S")
                reject_t = datetime.strptime(now_str, "%Y-%m-%d %H:%M:%S")
                duty_dur = int((reject_t - duty_start_t).total_seconds())
                old_gate_name = "Reserve Pool"
                if from_gate_id:
                    cursor.execute("SELECT gate_name FROM gates WHERE gate_id=?", (from_gate_id,))
                    gn_row = cursor.fetchone()
                    if gn_row:
                        old_gate_name = gn_row[0]
                cursor.execute("""
                    INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                    VALUES (?, 'Gate Duty Duration', ?, ?)
                """, (vol_id, from_gate_id, f"Spent {duty_dur // 60}m {duty_dur % 60}s at {old_gate_name}"))
            except Exception as ex:
                print(f"Error logging duty duration on reject: {ex}")

        # Update request status to 'Rejected'
        cursor.execute("""
            UPDATE assignment_requests 
            SET status = 'Rejected', updated_at = ?, reject_reason = ? 
            WHERE request_id = ?
        """, (now_str, data.reason, request_id))

        # Reset volunteer status to Available
        cursor.execute("""
            UPDATE volunteers
            SET status = 'Available'
            WHERE volunteer_id = ?
        """, (vol_id,))

        # Delete active notifications for this request so they disappear when rejected
        cursor.execute("""
            DELETE FROM volunteer_notifications 
            WHERE related_id = ? AND notification_type = 'Assignment'
        """, (request_id,))
        
        # Get target gate name
        cursor.execute("SELECT gate_name FROM gates WHERE gate_id=?", (to_gate_id,))
        to_gate_name = cursor.fetchone()[0]

        vname = current_vol["volunteer_name"]

        # Log 'Reject Request' activity
        cursor.execute("""
            INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
            VALUES (?, 'Reject Request', ?, ?)
        """, (vol_id, from_gate_id, f"Rejected assignment request #{request_id} to gate {to_gate_id}. Reason: {data.reason}"))

        # Insert admin notification alert (Who rejected)
        msg = f"{vname} rejected redeployment to {to_gate_name} (Reason: {data.reason}). Backup dispatch triggered."
        cursor.execute(
            """
            INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
            VALUES (?, 'Staff Notification', 'Low', ?, 'Backup volunteer is automatically being assigned.', 0)
            """,
            (to_gate_id, msg)
        )

        # Suggest and automatically dispatch the next closest available volunteer for the target gate
        cursor.execute("SELECT gate_id, gate_name FROM gates ORDER BY gate_id")
        gates_all = cursor.fetchall()
        gate_coords_map = {}
        for idx, (g_id, g_name) in enumerate(gates_all):
            gate_coords_map[g_id] = _GATE_ZONE_COORDS[idx % len(_GATE_ZONE_COORDS)]
            
        target_coords = gate_coords_map.get(to_gate_id, (2.0, 2.0))
        
        cursor.execute("SELECT volunteer_id FROM assignment_requests WHERE status IN ('Pending', 'Accepted', 'En Route', 'Arrived')")
        pending_vols = {row[0] for row in cursor.fetchall()}
        
        cursor.execute("""
            SELECT volunteer_id, volunteer_name, assigned_gate, status, contact
            FROM volunteers
            WHERE volunteer_id != ? AND status != 'Offline'
        """, (vol_id,))
        candidates = cursor.fetchall()
        
        report = compute_assignments()
        surplus_gates = {g["gate_id"]: g["surplus"] for g in report}
        
        eligible = []
        for c_id, c_name, c_gate, c_status, c_contact in candidates:
            if c_id in pending_vols:
                continue
            
            is_eligible = False
            from_gate_name = "Reserve Pool (Unassigned)"
            from_coords = (2.0, 2.0)
            
            if c_gate is None:
                is_eligible = True
            elif surplus_gates.get(c_gate, 0) > 0:
                is_eligible = True
                cursor.execute("SELECT gate_name FROM gates WHERE gate_id=?", (c_gate,))
                gname_row = cursor.fetchone()
                if gname_row:
                    from_gate_name = gname_row[0]
                from_coords = gate_coords_map.get(c_gate, (2.0, 2.0))
                
            if is_eligible:
                distance = _zone_distance(from_coords, target_coords)
                eligible.append({
                    "volunteer_id": c_id,
                    "volunteer_name": c_name,
                    "contact": c_contact,
                    "from_gate_id": c_gate,
                    "from_gate_name": from_gate_name,
                    "distance": distance
                })
                
        eligible.sort(key=lambda x: x["distance"])
        
        suggested = None
        if eligible:
            next_vol = eligible[0]
            cursor.execute("SELECT gate_name FROM gates WHERE gate_id=?", (to_gate_id,))
            to_gate_name = cursor.fetchone()[0]
            
            to_gate_priority = "Medium"
            target_gate_rep = None
            for g_rep in report:
                if g_rep["gate_id"] == to_gate_id:
                    to_gate_priority = g_rep["priority"]
                    target_gate_rep = g_rep
                    break
                    
            before_r = target_gate_rep["risk"] if target_gate_rep else "Safe"
            before_c = target_gate_rep["congestion"] if target_gate_rep else "Low"
            before_q = target_gate_rep["queue_length"] if target_gate_rep else 0
            before_wt = target_gate_rep["waiting_time"] if target_gate_rep else 0.0
            before_def = target_gate_rep["deficit"] if target_gate_rep else 0

            cursor.execute("""
                INSERT INTO assignment_requests (
                    volunteer_id, from_gate_id, to_gate_id, reason, priority, status,
                    before_risk, before_congestion, before_queue, before_wait_time, before_deficit
                )
                VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?)
            """, (
                next_vol["volunteer_id"],
                next_vol["from_gate_id"],
                to_gate_id,
                f"AI-driven redeployment backup: Move from {next_vol['from_gate_name']} to {to_gate_name} (Backup Dispatch)",
                to_gate_priority,
                before_r,
                before_c,
                before_q,
                before_wt,
                before_def
            ))
            new_request_id = cursor.lastrowid

            add_volunteer_notification(
                cursor,
                next_vol["volunteer_id"],
                "Assignment",
                "New Backup Redeployment Request",
                f"Backup dispatch: AI has requested you to redeploy to {to_gate_name}. Reason: Safety deficit.",
                new_request_id
            )
            
            # Update backup volunteer status to Pending
            cursor.execute("""
                UPDATE volunteers
                SET status = 'Pending'
                WHERE volunteer_id = ?
            """, (next_vol["volunteer_id"],))
            
            cursor.execute("""
                INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                VALUES (?, 'Assignment Created', ?, 'Assignment created')
            """, (next_vol["volunteer_id"], next_vol["from_gate_id"]))
            
            cursor.execute("""
                INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                VALUES (?, 'Assignment Sent', ?, ?)
            """, (next_vol["volunteer_id"], next_vol["from_gate_id"], f"Sent to {next_vol['volunteer_name']}"))
            
            # Insert admin notification alert for backup volunteer selection
            backup_msg = f"AI suggested and created pending redeployment (Backup) for {next_vol['volunteer_name']} to {to_gate_name}."
            cursor.execute(
                """
                INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved)
                VALUES (?, 'Staff Notification', 'Low', ?, 'Review deployment in AI Dispatches tab.', 0)
                """,
                (to_gate_id, backup_msg)
            )

            cursor.execute("SELECT value FROM system_settings WHERE key='volunteer_assignment_mode'")
            mode_row = cursor.fetchone()
            sys_mode = mode_row[0] if mode_row else "Demo"
            if sys_mode in ["Simulation", "Demo"]:
                import threading
                t = threading.Timer(1.0, run_auto_accept_simulation_timer, args=(new_request_id, 1.0))
                t.daemon = True
                register_timer(t)
                t.start()
                
            suggested = {
                "volunteer_id": next_vol["volunteer_id"],
                "volunteer_name": next_vol["volunteer_name"],
                "request_id": new_request_id
            }
            
        conn.commit()
        
        # Update cache in the database
        update_cached_analytics(conn)
        
        conn.close()
        
        return {
            "message": "Assignment request rejected successfully",
            "request_id": request_id,
            "suggested_next_volunteer": suggested
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/volunteers/my-alerts")
def get_my_alerts(current_vol: dict = Depends(get_current_volunteer)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        gate_id = current_vol["assigned_gate"]
        alerts = []
        if gate_id is not None:
            # Trigger ML alert generation first to get fresh alerts
            generate_ml_alerts(conn)
            
            cursor.execute("""
                SELECT a.alert_id, a.gate_id, g.gate_name, a.alert_type,
                       a.severity, a.message, a.recommendation, a.alert_time
                FROM alerts a
                LEFT JOIN gates g ON a.gate_id = g.gate_id
                WHERE a.gate_id = ? AND a.is_resolved = 0
                ORDER BY a.alert_time DESC
            """, (gate_id,))
            rows = cursor.fetchall()
            for row in rows:
                alerts.append({
                    "type": "alert",
                    "id": row[0],
                    "gate_id": row[1],
                    "gate_name": row[2] or f"Gate #{row[1]}",
                    "alert_type": row[3],
                    "severity": row[4],
                    "message": row[5],
                    "recommendation": row[6],
                    "time": row[7]
                })
        
        # Also fetch all announcements
        cursor.execute("""
            SELECT announcement_id, title, message, priority, created_at
            FROM announcements
            ORDER BY created_at DESC
        """)
        ann_rows = cursor.fetchall()
        
        # Also fetch acknowledgements for this volunteer to see which ones are read
        cursor.execute("""
            SELECT announcement_id 
            FROM announcement_acknowledgements 
            WHERE volunteer_id = ?
        """, (current_vol["volunteer_id"],))
        ack_ids = {r[0] for r in cursor.fetchall()}
        
        # Also fetch notifications for this volunteer
        cursor.execute("""
            SELECT notification_id, notification_type, title, message, status, created_at
            FROM volunteer_notifications
            WHERE volunteer_id = ? AND status != 'Acknowledged'
            ORDER BY created_at DESC
        """, (current_vol["volunteer_id"],))
        notif_rows = cursor.fetchall()
        
        conn.close()
        
        for row in notif_rows:
            alerts.append({
                "type": "notification",
                "id": row[0],
                "notification_type": row[1],
                "title": row[2],
                "message": row[3],
                "status": row[4],
                "time": row[5]
            })
            
        for row in ann_rows:
            ann_id = row[0]
            alerts.append({
                "type": "announcement",
                "id": ann_id,
                "title": row[1],
                "message": row[2],
                "priority": row[3],
                "time": row[4],
                "is_read": ann_id in ack_ids
            })
            
        return alerts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/system/mode")
def get_system_mode_anonymous():
    import time
    start_time = time.perf_counter()
    print(f"[TIMING] [GET /system/mode] Request received")
    try:
        db_start = time.perf_counter()
        conn = get_connection()
        db_opened = time.perf_counter()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
        row = cursor.fetchone()
        sql_end = time.perf_counter()
        conn.close()
        db_closed = time.perf_counter()
        duration = (time.perf_counter() - start_time) * 1000
        print(f"[TIMING] [GET /system/mode] DB open: {(db_opened-db_start)*1000:.2f}ms, SQL: {(sql_end-db_opened)*1000:.2f}ms, Total: {duration:.2f}ms")
        return {"system_mode": row[0] if row else "Demo"}
    except Exception as e:
        print(f"[TIMING] [GET /system/mode] Failed: {e}")
        return {"system_mode": "Demo"}

@app.get("/admin/system-mode")
def get_system_mode_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Admin role required")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
        row = cursor.fetchone()
        conn.close()
        return {"system_mode": row[0] if row else "Demo"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/system-mode")
def set_system_mode_admin(data: SystemModeRequest, current_user: dict = Depends(get_current_user)):
    global simulation_active
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Admin role required")
    if data.system_mode not in ["Demo", "Live"]:
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'Demo' or 'Live'")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
        row = cursor.fetchone()
        current_mode = row[0] if row else None
        conn.close()
        
        # Only run initialization if mode changes or is not set
        if current_mode != data.system_mode:
            print(f"[SYSTEM-MODE-TRANSITION] Transitioning from '{current_mode}' to '{data.system_mode}'")
            # 1. Stop simulation thread worker and dispatches
            with simulation_lock:
                simulation_active = False
            cancel_all_timers()
            
            # 2. Reset dynamic event data
            from backend.database import reset_event_data, initialize_demo_mode, initialize_live_mode
            reset_event_data()
            
            # 3. Initialize selected mode
            if data.system_mode == "Demo":
                initialize_demo_mode()
            else:
                initialize_live_mode()
        else:
            print(f"[SYSTEM-MODE-TRANSITION] Mode is already '{data.system_mode}'. No transition needed.")
            
        return {"status": "success", "system_mode": data.system_mode}
    except Exception as e:
        print(f"[SYSTEM-MODE-TRANSITION] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/volunteer-mode")
def get_volunteer_mode(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Admin role required")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_settings WHERE key = 'volunteer_assignment_mode'")
        mode_row = cursor.fetchone()
        mode = mode_row[0] if mode_row else "Demo"
        
        cursor.execute("SELECT value FROM system_settings WHERE key = 'simulation_delay_seconds'")
        delay_row = cursor.fetchone()
        delay_seconds = int(delay_row[0]) if delay_row else 5
        
        cursor.execute("SELECT value FROM system_settings WHERE key = 'peak_hour'")
        peak_row = cursor.fetchone()
        peak_val = int(peak_row[0]) if peak_row else 0
        
        conn.close()
        return {"mode": mode, "delay_seconds": delay_seconds, "peak_hour": peak_val}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/admin/volunteer-mode")
def set_volunteer_mode(data: VolunteerModeRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Admin role required")
    if data.mode not in ["Simulation", "Production", "Demo"]:
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'Simulation', 'Demo' or 'Production'")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('volunteer_assignment_mode', ?)", (data.mode,))
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('simulation_delay_seconds', ?)", (str(data.delay_seconds),))
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('peak_hour', ?)", (str(data.peak_hour),))
        conn.commit()
        conn.close()
        return {"status": "success", "mode": data.mode, "delay_seconds": data.delay_seconds, "peak_hour": data.peak_hour}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/admin/volunteer-monitoring")
def get_volunteer_monitoring(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied: Admin role required")
        
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Self-heal today's attendance/operational status for all volunteers
        sync_all_volunteers_attendance_status(cursor)
        conn.commit()
        
        # 1. KPIs
        cursor.execute("SELECT status, COUNT(*) FROM volunteers GROUP BY status")
        status_counts = {row[0]: row[1] for row in cursor.fetchall()}
        
        total_vols = sum(status_counts.values())
        active_vols = status_counts.get("Available", 0) + status_counts.get("Busy", 0) + status_counts.get("Break", 0)
        offline_vols = status_counts.get("Offline", 0)
        break_vols = status_counts.get("Break", 0)
        busy_vols = status_counts.get("Busy", 0)
        available_vols = status_counts.get("Available", 0)
        
        kpis = {
            "total": total_vols,
            "active": active_vols,
            "offline": offline_vols,
            "break": break_vols,
            "busy": busy_vols,
            "available": available_vols
        }
        
        # 2. Live roster with session duration and extra Live Mode stats
        cursor.execute("""
            SELECT v.volunteer_id, v.volunteer_name, v.assigned_gate, g.gate_name, 
                   v.status, v.attendance_status, v.last_login, v.session_duration, 
                   v.email, v.phone, v.contact, v.profile_photo, v.joining_date, v.experience,
                   v.destination_gate, v.travel_time_remaining, v.travel_eta
            FROM volunteers v
            LEFT JOIN gates g ON v.assigned_gate = g.gate_id
            ORDER BY v.volunteer_name
        """)
        roster_rows = cursor.fetchall()
        roster = []
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        for row in roster_rows:
            v_id = row[0]
            session_duration = row[7] or 0
            last_login_str = row[6]
            status = row[4]
            if status != "Offline" and last_login_str:
                try:
                    login_t = datetime.strptime(last_login_str, "%Y-%m-%d %H:%M:%S")
                    now_t = datetime.now()
                    session_duration = int((now_t - login_t).total_seconds())
                except:
                    pass
            
            # Fetch today's check-in/out times
            cursor.execute("SELECT check_in_time, check_out_time FROM attendance WHERE volunteer_id = ? AND date = ?", (v_id, today_str))
            att_row = cursor.fetchone()
            check_in_time = att_row[0] if att_row else None
            check_out_time = att_row[1] if att_row else None
            
            # Fetch total working hours
            cursor.execute("SELECT check_in_time, check_out_time FROM attendance WHERE volunteer_id = ?", (v_id,))
            total_hours = 0.0
            for r_in, r_out in cursor.fetchall():
                if r_in and r_out:
                    try:
                        dt_in = datetime.strptime(r_in, "%Y-%m-%d %H:%M:%S")
                        dt_out = datetime.strptime(r_out, "%Y-%m-%d %H:%M:%S")
                        total_hours += (dt_out - dt_in).total_seconds() / 3600.0
                    except:
                        pass
                        
            # Fetch current assignment
            cursor.execute("""
                SELECT r.status, tg.gate_name 
                FROM assignment_requests r 
                LEFT JOIN gates tg ON r.to_gate_id = tg.gate_id 
                WHERE r.volunteer_id = ? AND r.status IN ('Pending', 'Accepted', 'En Route', 'Arrived') 
                ORDER BY r.created_at DESC LIMIT 1
            """, (v_id,))
            asg_row = cursor.fetchone()
            current_assignment = f"Redeployment to {asg_row[1]} ({asg_row[0]})" if asg_row else "None"
            
            # Fetch checklist status
            cursor.execute("SELECT 1 FROM volunteer_checklists WHERE volunteer_id = ? AND date = ?", (v_id, today_str))
            checklist_submitted = cursor.fetchone() is not None
            checklist_status = "Submitted" if checklist_submitted else "Pending"
            
            # Fetch incident count
            cursor.execute("SELECT COUNT(*) FROM incidents WHERE volunteer_id = ?", (v_id,))
            incident_count = cursor.fetchone()[0]
            
            roster.append({
                "volunteer_id": v_id,
                "volunteer_name": row[1],
                "assigned_gate": row[2],
                "gate_name": row[3] or "Unassigned",
                "status": status,
                "attendance_status": row[5],
                "last_login": last_login_str,
                "session_duration_seconds": session_duration,
                "email": row[8],
                "phone": row[9],
                "contact": row[10],
                "profile_photo": row[11],
                "joining_date": row[12],
                "experience": row[13],
                "check_in_time": check_in_time,
                "check_out_time": check_out_time,
                "total_working_hours": round(total_hours, 2),
                "current_assignment": current_assignment,
                "checklist_status": checklist_status,
                "incident_count": incident_count,
                "shift_status": "Active" if (check_in_time and not check_out_time) else "Inactive",
                "destination_gate": row[14],
                "travel_time_remaining": row[15],
                "travel_eta": row[16]
            })
            
        # 3. Live activity logs (recent 50 logs)
        cursor.execute("""
            SELECT l.log_id, l.volunteer_id, v.volunteer_name, l.activity_type, 
                   l.gate_id, g.gate_name, l.timestamp, l.details
            FROM volunteer_activity_logs l
            JOIN volunteers v ON l.volunteer_id = v.volunteer_id
            LEFT JOIN gates g ON l.gate_id = g.gate_id
            ORDER BY l.timestamp DESC, l.log_id DESC
            LIMIT 50
        """)
        log_rows = cursor.fetchall()
        logs = []
        for row in log_rows:
            logs.append({
                "log_id": row[0],
                "volunteer_id": row[1],
                "volunteer_name": row[2],
                "activity_type": row[3],
                "gate_id": row[4],
                "gate_name": row[5] or "N/A",
                "timestamp": row[6],
                "details": row[7]
            })
            
        # 4. Redeployment assignment requests (recent 50)
        cursor.execute("""
            SELECT r.request_id, r.volunteer_id, v.volunteer_name, r.from_gate_id, fg.gate_name, 
                   r.to_gate_id, tg.gate_name, r.reason, r.priority, r.status, r.created_at, r.updated_at,
                   r.accepted_at, r.en_route_at, r.arrived_at, r.completed_at,
                   r.before_risk, r.before_congestion, r.before_queue, r.before_wait_time, r.before_deficit,
                   r.after_risk, r.after_congestion, r.after_queue, r.after_wait_time, r.after_deficit,
                   r.improvement_result
            FROM assignment_requests r
            JOIN volunteers v ON r.volunteer_id = v.volunteer_id
            LEFT JOIN gates fg ON r.from_gate_id = fg.gate_id
            LEFT JOIN gates tg ON r.to_gate_id = tg.gate_id
            ORDER BY r.created_at DESC, r.request_id DESC
            LIMIT 50
        """)
        req_rows = cursor.fetchall()
        requests = []
        for row in req_rows:
            requests.append({
                "request_id": row[0],
                "volunteer_id": row[1],
                "volunteer_name": row[2],
                "from_gate_id": row[3],
                "from_gate_name": row[4] or "Reserve Pool",
                "to_gate_id": row[5],
                "to_gate_name": row[6],
                "reason": row[7],
                "priority": row[8],
                "status": row[9],
                "created_at": row[10],
                "updated_at": row[11],
                "accepted_at": row[12],
                "en_route_at": row[13],
                "arrived_at": row[14],
                "completed_at": row[15],
                "before_risk": row[16],
                "before_congestion": row[17],
                "before_queue": row[18],
                "before_wait_time": row[19],
                "before_deficit": row[20],
                "after_risk": row[21],
                "after_congestion": row[22],
                "after_queue": row[23],
                "after_wait_time": row[24],
                "after_deficit": row[25],
                "improvement_result": row[26]
            })
            
        conn.close()
        
        return {
            "kpis": kpis,
            "roster": roster,
            "activity_logs": logs,
            "assignment_requests": requests
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
# Trigger uvicorn reload after clearing DB lock
