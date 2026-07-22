# database.py
# This script handles the SQLite database initialization and seeding for CrowdShield AI.
# In Day 11, we design the relational database schema, create tables, and establish foreign key relationships.

import sqlite3
import os
import traceback
import threading
import datetime

# Define the database file path.
# We will save it in the backend folder.
DATABASE_PATH = os.path.join(os.path.dirname(__file__), "crowdshield.db")

class LoggingCursor:
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, sql, params=None):
        sql_upper = sql.upper()
        is_write = any(w in sql_upper for w in ["UPDATE", "INSERT", "DELETE"])
        is_target = any(table in sql_upper for table in ["VOLUNTEERS", "ASSIGNMENT_REQUESTS", "SYSTEM_SETTINGS"])
        
        thread_id = threading.get_ident()
        thread_name = threading.current_thread().name
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
        
        if is_target and is_write:
            print(f"\n[SQL WRITE] Timestamp: {timestamp} | Thread: {thread_name} ({thread_id})")
            print(f"  SQL: {sql.strip()}")
            if params:
                print(f"  Params: {params}")
                
            log_msg = f"\n=== SQL Cursor.execute TRACE ===\nTimestamp: {timestamp}\nThread: {thread_name} ({thread_id})\nSQL: {sql}\nParams: {params}\nStack Trace:\n" + "".join(traceback.format_stack()[:-1]) + "=======================\n"
            try:
                os.makedirs(os.path.dirname(r"d:\CrowdShieldAI\scratch\sql_trace.log"), exist_ok=True)
                with open(r"d:\CrowdShieldAI\scratch\sql_trace.log", "a", encoding="utf-8") as f:
                    f.write(log_msg)
            except Exception as e:
                pass

        # Capture volunteer state before executing query
        vol_ids = []
        prev_states = {}
        if "VOLUNTEERS" in sql_upper and is_write:
            if "WHERE VOLUNTEER_ID = ?" in sql_upper and params:
                vol_ids = [params[-1]]
            elif "WHERE VOLUNTEER_ID =" in sql_upper:
                import re
                m = re.search(r"WHERE VOLUNTEER_ID\s*=\s*(\d+)", sql_upper)
                if m:
                    vol_ids = [int(m.group(1))]

            if vol_ids:
                try:
                    temp_conn = sqlite3.connect(DATABASE_PATH)
                    temp_cursor = temp_conn.cursor()
                    for vid in vol_ids:
                        temp_cursor.execute("SELECT status, assigned_gate FROM volunteers WHERE volunteer_id = ?", (vid,))
                        row = temp_cursor.fetchone()
                        if row:
                            prev_states[vid] = {"status": row[0], "assigned_gate": row[1]}
                    temp_conn.close()
                except:
                    pass

        # Execute query
        if params is not None:
            res = self._cursor.execute(sql, params)
        else:
            res = self._cursor.execute(sql)

        # Print volunteer telemetry after query
        if vol_ids and prev_states:
            try:
                temp_conn = sqlite3.connect(DATABASE_PATH)
                temp_cursor = temp_conn.cursor()
                for vid in vol_ids:
                    temp_cursor.execute("SELECT status, assigned_gate FROM volunteers WHERE volunteer_id = ?", (vid,))
                    row = temp_cursor.fetchone()
                    if row:
                        prev = prev_states[vid]
                        new_status = row[0]
                        new_gate = row[1]
                        if prev["status"] != new_status or prev["assigned_gate"] != new_gate:
                            print(f"\n[VOLUNTEER TELEMETRY] Timestamp: {timestamp} | Thread: {thread_name} ({thread_id})")
                            print(f"  Volunteer ID:    {vid}")
                            print(f"  Previous Status: {prev['status']} | New Status: {new_status}")
                            print(f"  Previous Gate:   {prev['assigned_gate']} | New Gate: {new_gate}")
                            print(f"  Reason/Context:  SQL: {sql.strip()}")
                temp_conn.close()
            except Exception as e:
                pass
        return res

    def executemany(self, sql, seq_of_params):
        sql_upper = sql.upper()
        is_write = any(w in sql_upper for w in ["UPDATE", "INSERT", "DELETE"])
        is_target = any(table in sql_upper for table in ["VOLUNTEERS", "ASSIGNMENT_REQUESTS", "SYSTEM_SETTINGS"])
        
        thread_id = threading.get_ident()
        thread_name = threading.current_thread().name
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
        
        if is_target and is_write:
            print(f"\n[SQL WRITE] Timestamp: {timestamp} | Thread: {thread_name} ({thread_id})")
            print(f"  SQL (executemany): {sql.strip()}")
            if seq_of_params:
                print(f"  Params Count: {len(seq_of_params)}")
                
            log_msg = f"\n=== SQL Cursor.executemany TRACE ===\nTimestamp: {timestamp}\nThread: {thread_name} ({thread_id})\nSQL: {sql}\nStack Trace:\n" + "".join(traceback.format_stack()[:-1]) + "=======================\n"
            try:
                os.makedirs(os.path.dirname(r"d:\CrowdShieldAI\scratch\sql_trace.log"), exist_ok=True)
                with open(r"d:\CrowdShieldAI\scratch\sql_trace.log", "a", encoding="utf-8") as f:
                    f.write(log_msg)
            except Exception as e:
                pass
        return self._cursor.executemany(sql, seq_of_params)

    def __getattr__(self, name):
        return getattr(self._cursor, name)

    def __setattr__(self, name, value):
        if name == "_cursor":
            super().__setattr__(name, value)
        else:
            setattr(self._cursor, name, value)

class LoggingConnection:
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return LoggingCursor(self._conn.cursor())

    def execute(self, sql, params=None):
        sql_upper = sql.upper()
        is_write = any(w in sql_upper for w in ["UPDATE", "INSERT", "DELETE"])
        is_target = any(table in sql_upper for table in ["VOLUNTEERS", "ASSIGNMENT_REQUESTS", "SYSTEM_SETTINGS"])
        
        thread_id = threading.get_ident()
        thread_name = threading.current_thread().name
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
        
        if is_target and is_write:
            print(f"\n[SQL WRITE] Timestamp: {timestamp} | Thread: {thread_name} ({thread_id})")
            print(f"  SQL: {sql.strip()}")
            if params:
                print(f"  Params: {params}")
                
            log_msg = f"\n=== SQL Connection.execute TRACE ===\nTimestamp: {timestamp}\nThread: {thread_name} ({thread_id})\nSQL: {sql}\nParams: {params}\nStack Trace:\n" + "".join(traceback.format_stack()[:-1]) + "=======================\n"
            try:
                os.makedirs(os.path.dirname(r"d:\CrowdShieldAI\scratch\sql_trace.log"), exist_ok=True)
                with open(r"d:\CrowdShieldAI\scratch\sql_trace.log", "a", encoding="utf-8") as f:
                    f.write(log_msg)
            except Exception as e:
                pass

        if params is not None:
            return self._conn.execute(sql, params)
        else:
            return self._conn.execute(sql)

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        return self._conn.close()

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def __setattr__(self, name, value):
        if name == "_conn":
            super().__setattr__(name, value)
        else:
            setattr(self._conn, name, value)

def get_connection():
    """
    Establishes a connection to the SQLite database.
    By default, SQLite does not enforce Foreign Key constraints.
    We must run "PRAGMA foreign_keys = ON;" to enable enforcement.
    """
    conn = sqlite3.connect(DATABASE_PATH, timeout=30.0)
    # Enable foreign key support
    conn.execute("PRAGMA foreign_keys = ON;")
    # Enable WAL mode for high concurrency
    conn.execute("PRAGMA journal_mode = WAL;")
    return LoggingConnection(conn)

def init_db():
    """
    Creates all the tables for the CrowdShield AI system.
    If the tables already exist, it will handle it cleanly (CREATE TABLE IF NOT EXISTS).
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    print("Initializing Database tables...")
    
    # 0. Create Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        email TEXT,
        full_name TEXT
    );
    """)

    # 1. Create Events Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        venue TEXT NOT NULL,
        date TEXT NOT NULL,
        capacity INTEGER NOT NULL
    );
    """)
    
    # 2. Create Gates Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gates (
        gate_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        gate_name TEXT NOT NULL,
        max_capacity INTEGER NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE CASCADE
    );
    """)
    
    # 3. Create Attendees Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendees (
        attendee_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        attendee_name TEXT NOT NULL,
        qr_code TEXT UNIQUE NOT NULL,
        assigned_gate INTEGER,
        is_checked_in INTEGER DEFAULT 0,
        entry_time TEXT,
        stay_duration INTEGER,
        FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_gate) REFERENCES gates (gate_id) ON DELETE SET NULL
    );
    """)
    
    # 4. Create Scans Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scans (
        scan_id INTEGER PRIMARY KEY AUTOINCREMENT,
        attendee_id INTEGER NOT NULL,
        gate_id INTEGER NOT NULL,
        scan_time TEXT DEFAULT CURRENT_TIMESTAMP,
        direction TEXT NOT NULL DEFAULT 'IN',
        FOREIGN KEY (attendee_id) REFERENCES attendees (attendee_id) ON DELETE CASCADE,
        FOREIGN KEY (gate_id) REFERENCES gates (gate_id) ON DELETE CASCADE
    );
    """)
    
    # 5. Create Volunteers Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS volunteers (
        volunteer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        volunteer_name TEXT NOT NULL,
        assigned_gate INTEGER,
        contact TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        status TEXT DEFAULT 'Offline',
        username TEXT UNIQUE,
        password_hash TEXT,
        last_login TEXT,
        last_logout TEXT,
        session_duration INTEGER DEFAULT 0,
        attendance_status TEXT DEFAULT 'Absent',
        profile_photo TEXT,
        joining_date TEXT,
        experience TEXT,
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_gate) REFERENCES gates (gate_id) ON DELETE SET NULL
    );
    """)

    # Migration: add new columns to existing attendees table
    for col, definition in [
        ("entry_time",            "TEXT"),
        ("stay_duration",         "INTEGER"),
        # --- Live Mode QR columns (migration-safe, harmless in Demo Mode) ---
        ("email",                 "TEXT"),
        ("phone",                 "TEXT"),
        ("ticket_id",             "TEXT"),
        ("ticket_type",           "TEXT DEFAULT 'General'"),
        ("ticket_status",         "TEXT DEFAULT 'Active'"),
        ("external_attendee_id",  "TEXT"),
        ("qr_image_path",         "TEXT"),
        ("import_source",         "TEXT"),
        ("imported_at",           "TEXT"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE attendees ADD COLUMN {col} {definition};")
        except Exception:
            pass  # Column already exists — skip

    # --- Live Mode QR Scan Audit Log Table ---
    # Tracks all QR scan attempts (ALLOWED + rejected) in Live Mode.
    # The existing 'scans' table is still used for successful IN/OUT records
    # (shared with Demo Mode analytics). This table captures Live Mode specific
    # validation metadata that the scans table cannot store.
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS qr_scan_logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        attendee_id INTEGER,
        gate_id INTEGER NOT NULL,
        scanned_by_volunteer_id INTEGER,
        scan_time TEXT DEFAULT CURRENT_TIMESTAMP,
        scan_result TEXT NOT NULL,
        scan_source TEXT DEFAULT 'api',
        qr_token TEXT,
        notes TEXT,
        FOREIGN KEY (attendee_id) REFERENCES attendees (attendee_id) ON DELETE SET NULL,
        FOREIGN KEY (gate_id) REFERENCES gates (gate_id) ON DELETE CASCADE,
        FOREIGN KEY (scanned_by_volunteer_id) REFERENCES volunteers (volunteer_id) ON DELETE SET NULL
    );
    """)

    # Migration: add new columns to existing volunteers table (safe for re-runs)
    for col, definition in [
        ("email", "TEXT"),
        ("phone", "TEXT"),
        ("status", "TEXT DEFAULT 'Offline'"),
        ("username", "TEXT"),
        ("password_hash", "TEXT"),
        ("last_login", "TEXT"),
        ("last_logout", "TEXT"),
        ("session_duration", "INTEGER DEFAULT 0"),
        ("attendance_status", "TEXT DEFAULT 'Absent'"),
        ("gate_duty_start_time", "TEXT"),
        ("profile_photo", "TEXT"),
        ("joining_date", "TEXT"),
        ("experience", "TEXT"),
        ("age", "INTEGER"),
        ("gender", "TEXT"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE volunteers ADD COLUMN {col} {definition};")
        except Exception:
            pass  # Column already exists — skip
    
    # 6. Create Alerts Table (with full DAY 24 schema)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
        gate_id INTEGER NOT NULL,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'Medium',
        message TEXT NOT NULL,
        recommendation TEXT NOT NULL DEFAULT '',
        is_resolved INTEGER NOT NULL DEFAULT 0,
        alert_time TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (gate_id) REFERENCES gates (gate_id) ON DELETE CASCADE
    );
    """)

    # Migration: add new columns to existing alerts table (safe for re-runs)
    for col, definition in [
        ("severity",       "TEXT NOT NULL DEFAULT 'Medium'"),
        ("recommendation", "TEXT NOT NULL DEFAULT ''"),
        ("is_resolved",    "INTEGER NOT NULL DEFAULT 0"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE alerts ADD COLUMN {col} {definition};")
        except Exception:
            pass  # Column already exists — skip

    # 7. Create Volunteer Checklists Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS volunteer_checklists (
        volunteer_id INTEGER,
        date TEXT,
        arrived_at_gate INTEGER DEFAULT 0,
        qr_scanner_working INTEGER DEFAULT 0,
        barricades_checked INTEGER DEFAULT 0,
        crowd_flow_normal INTEGER DEFAULT 0,
        emergency_exit_clear INTEGER DEFAULT 0,
        communication_device_checked INTEGER DEFAULT 0,
        shift_completed INTEGER DEFAULT 0,
        submitted_at TEXT,
        FOREIGN KEY (volunteer_id) REFERENCES volunteers (volunteer_id) ON DELETE CASCADE,
        UNIQUE(volunteer_id, date)
    );
    """)

    # Migration: add new columns to existing volunteer_checklists table (safe for re-runs)
    for col, definition in [
        ("arrived_at_gate", "INTEGER DEFAULT 0"),
        ("qr_scanner_working", "INTEGER DEFAULT 0"),
        ("barricades_checked", "INTEGER DEFAULT 0"),
        ("crowd_flow_normal", "INTEGER DEFAULT 0"),
        ("emergency_exit_clear", "INTEGER DEFAULT 0"),
        ("communication_device_checked", "INTEGER DEFAULT 0"),
        ("shift_completed", "INTEGER DEFAULT 0"),
        ("submitted_at", "TEXT"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE volunteer_checklists ADD COLUMN {col} {definition};")
        except Exception:
            pass  # Column already exists — skip

    # Migration: enforce uniqueness of (volunteer_id, date) for existing databases
    try:
        # 1. Deduplicate existing entries first (keeping latest submission)
        cursor.execute("""
            DELETE FROM volunteer_checklists
            WHERE rowid NOT IN (
                SELECT MAX(rowid)
                FROM volunteer_checklists
                GROUP BY volunteer_id, date
            );
        """)
        # 2. Create unique index to enforce constraint
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS uidx_volunteer_checklists_vol_date ON volunteer_checklists (volunteer_id, date);")
    except Exception as e:
        print(f"[Migration] Warning: Could not enforce UNIQUE constraint on volunteer_checklists: {e}")

    # 8. Create Announcements Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS announcements (
        announcement_id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        priority TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 9. Create Announcement Acknowledgements Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS announcement_acknowledgements (
        announcement_id INTEGER,
        volunteer_id INTEGER,
        acknowledged_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (announcement_id, volunteer_id),
        FOREIGN KEY (announcement_id) REFERENCES announcements (announcement_id) ON DELETE CASCADE,
        FOREIGN KEY (volunteer_id) REFERENCES volunteers (volunteer_id) ON DELETE CASCADE
    );
    """)

    # 10. Create Incidents Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS incidents (
        incident_id INTEGER PRIMARY KEY AUTOINCREMENT,
        volunteer_id INTEGER,
        incident_type TEXT NOT NULL,
        location TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT NOT NULL,
        photo_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_resolved INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (volunteer_id) REFERENCES volunteers (volunteer_id) ON DELETE SET NULL
    );
    """)

    # Migration: add is_resolved column to existing incidents table (safe for re-runs)
    try:
        cursor.execute("ALTER TABLE incidents ADD COLUMN is_resolved INTEGER DEFAULT 0;")
    except Exception:
        pass

    # 11. Create Attendance Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance (
        attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
        volunteer_id INTEGER,
        check_in_time TEXT,
        check_out_time TEXT,
        date TEXT,
        FOREIGN KEY (volunteer_id) REFERENCES volunteers (volunteer_id) ON DELETE CASCADE
    );
    """)

    # 12. Create Assignment Requests Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assignment_requests (
        request_id INTEGER PRIMARY KEY AUTOINCREMENT,
        volunteer_id INTEGER NOT NULL,
        from_gate_id INTEGER,
        to_gate_id INTEGER,
        reason TEXT,
        priority TEXT,
        status TEXT DEFAULT 'Pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,
        FOREIGN KEY (volunteer_id) REFERENCES volunteers (volunteer_id) ON DELETE CASCADE
    );
    """)

    # Migration: add new columns to existing assignment_requests table (safe for re-runs)
    for col, definition in [
        ("accepted_at", "TEXT"),
        ("en_route_at", "TEXT"),
        ("arrived_at", "TEXT"),
        ("completed_at", "TEXT"),
        ("before_risk", "TEXT"),
        ("before_congestion", "TEXT"),
        ("before_queue", "INTEGER"),
        ("before_wait_time", "REAL"),
        ("before_deficit", "INTEGER"),
        ("after_risk", "TEXT"),
        ("after_congestion", "TEXT"),
        ("after_queue", "INTEGER"),
        ("after_wait_time", "REAL"),
        ("after_deficit", "INTEGER"),
        ("improvement_result", "TEXT"),
        ("reject_reason", "TEXT"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE assignment_requests ADD COLUMN {col} {definition};")
        except Exception:
            pass  # Column already exists — skip


    # 13. Create Volunteer Activity Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS volunteer_activity_logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        volunteer_id INTEGER NOT NULL,
        activity_type TEXT NOT NULL,
        gate_id INTEGER,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        details TEXT,
        FOREIGN KEY (volunteer_id) REFERENCES volunteers (volunteer_id) ON DELETE CASCADE
    );
    """)

    # 14. Create System Settings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)

    # 15. Create Daily Work Reports Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_work_reports (
        report_id INTEGER PRIMARY KEY AUTOINCREMENT,
        volunteer_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        tasks TEXT NOT NULL,
        crowd_situation TEXT NOT NULL,
        issues_faced TEXT NOT NULL,
        action_taken TEXT NOT NULL,
        suggestions TEXT,
        additional_notes TEXT,
        submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (volunteer_id) REFERENCES volunteers (volunteer_id) ON DELETE CASCADE
    );
    """)

    # 16. Create Volunteer Notifications Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS volunteer_notifications (
        notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
        volunteer_id INTEGER NOT NULL,
        notification_type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        related_id INTEGER,
        status TEXT NOT NULL DEFAULT 'Unread',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,
        FOREIGN KEY (volunteer_id) REFERENCES volunteers (volunteer_id) ON DELETE CASCADE
    );
    """)
    
    # 17. Create Performance Indexes (Migration-safe)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attendees_assigned_gate ON attendees (assigned_gate);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_scans_gate_id ON scans (gate_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_assignment_requests_volunteer_id ON assignment_requests (volunteer_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_gate_id ON qr_scan_logs (gate_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_volunteer_notifications_volunteer_id ON volunteer_notifications (volunteer_id);")
    
    conn.commit()
    conn.close()
    print("Database tables and performance indexes initialized successfully.")

def seed_db(empty_attendees=True):
    """
    Seeds the SQLite database with initial Demo data (event, gates, volunteers, settings).
    By default, empty_attendees=True so the simulation starts with 0 checked-in attendees and 0 queues.
    """
    import random
    from datetime import datetime, timedelta
    random.seed(42)  # Ensure deterministic realistic data generation

    conn = get_connection()
    cursor = conn.cursor()
    
    print("Seeding sample data for Navratri Garba Mahotsav...")
    
    # Clean up existing records first to avoid unique constraint violations on re-seeding
    cursor.execute("DELETE FROM announcement_acknowledgements")
    cursor.execute("DELETE FROM announcements")
    cursor.execute("DELETE FROM volunteer_checklists")
    cursor.execute("DELETE FROM incidents")
    cursor.execute("DELETE FROM attendance")
    cursor.execute("DELETE FROM alerts")
    cursor.execute("DELETE FROM volunteers")
    cursor.execute("DELETE FROM scans")
    cursor.execute("DELETE FROM attendees")
    cursor.execute("DELETE FROM gates")
    cursor.execute("DELETE FROM events")
    cursor.execute("DELETE FROM assignment_requests")
    cursor.execute("DELETE FROM volunteer_activity_logs")
    cursor.execute("DELETE FROM system_settings")
    
    # Seed default system settings
    cursor.execute("""
    INSERT INTO system_settings (key, value)
    VALUES ('volunteer_assignment_mode', 'Demo'),
           ('simulation_delay_seconds', '3'),
           ('system_mode', 'Demo');
    """)
    
    # Seed default users if they don't exist
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        print("Seeding default users...")
        cursor.execute("""
        INSERT INTO users (username, password_hash, role, email, full_name)
        VALUES ('admin', '$2b$12$ihAFuIpawOCdllJqBGZPi.uxkONz8CraBIMg67deWlezY7cnOWvAS', 'admin', 'admin@crowdshield.ai', 'System Administrator');
        """)
        cursor.execute("""
        INSERT INTO users (username, password_hash, role, email, full_name)
        VALUES ('volunteer', '$2b$12$pBVXHvMjPfRka3LgfTrdM.jgiuMCO5.Ppj8WNQ8Tddt6r3LtaD0tq', 'volunteer', 'volunteer@crowdshield.ai', 'Sneha Shah');
        """)

    # Seed Indian/Gujarati Event
    cursor.execute("""
    INSERT INTO events (event_name, venue, date, capacity)
    VALUES ('Navratri Garba Mahotsav 2026', 'GMDC Ground, Ahmedabad, Gujarat', '2026-10-20', 15000);
    """)
    event_id = cursor.lastrowid
    
    # Seed Gates with Indian names, capacities matching request
    gates_data = [
        ('Gate 1 – VIP Entrance', 400),
        ('Gate 2 – East Entrance', 600),
        ('Gate 3 – West Entrance', 500),
        ('Gate 4 – Food Court Entrance', 300),
        ('Gate 5 – Main Garba Arena', 1000)
    ]
    
    gate_ids = []
    for name, cap in gates_data:
        cursor.execute("""
        INSERT INTO gates (event_id, gate_name, max_capacity)
        VALUES (?, ?, ?);
        """, (event_id, name, cap))
        gate_ids.append(cursor.lastrowid)

    # Names lists for realistic Indian/Gujarati names
    first_names_male = [
        "Aarav", "Vihaan", "Kabir", "Ishaan", "Dhruv", "Arjun", "Rohan", "Devendra", "Gopal", "Karan", 
        "Sanjay", "Tushar", "Yash", "Hardik", "Rajesh", "Amit", "Jignesh", "Suresh", "Bhavesh", "Chirag", 
        "Deepak", "Hitesh", "Ketan", "Manoj", "Nilesh", "Pankaj", "Ramesh", "Samir", "Vijay", "Parth", 
        "Krunal", "Meet", "Dev", "Manan", "Kush", "Jay", "Harsh", "Naitik", "Pranav", "Rakesh", "Gaurav", 
        "Aniket", "Siddharth", "Rahul", "Aditya", "Vikram", "Abhishek", "Vivek", "Manish", "Sandeep"
    ]
    first_names_female = [
        "Ananya", "Diya", "Kiara", "Priya", "Jaya", "Hetal", "Bhavna", "Meera", "Vidya", "Sneha", 
        "Pooja", "Deepa", "Alka", "Binita", "Charu", "Daksha", "Ekta", "Falguni", "Gita", "Hansa", 
        "Indu", "Jyoti", "Kokila", "Lalita", "Mona", "Neha", "Priti", "Rekha", "Sangita", "Tanvi", 
        "Usha", "Varsha", "Heena", "Kinjal", "Mansi", "Nidhi", "Riddhi", "Siddhi", "Urvashi", "Vaishali", 
        "Payal", "Krutika", "Bijal", "Drashti", "Jahnvi", "Komal", "Priyanka", "Shruti", "Swati", "Kajal"
    ]
    last_names = [
        "Patel", "Shah", "Mehta", "Joshi", "Trivedi", "Vyas", "Desai", "Varma", "Iyer", "Parmar", 
        "Solanki", "Jadeja", "Vaghela", "Rathod", "Bhatt", "Pandya", "Mevani", "Sarabhai", "Gadhvi", "Sheth", 
        "Sanghavi", "Parikh", "Kothari", "Chokshi", "Doshi", "Gandhi", "Adani", "Ambani", "Modi", "Thakkar", 
        "Raval", "Dave", "Yagnik", "Oza", "Jani", "Pathak", "Shukla", "Dwivedi", "Chaudhary", "Gohil", 
        "Limbachiya", "Savaliya", "Gajjar", "Prajapati", "Soni", "Panchal", "Darji", "Mistry", "Vankar", "Chauhan"
    ]

    generated_names = set()
    def get_unique_name():
        while True:
            first = random.choice(first_names_male + first_names_female)
            last = random.choice(last_names)
            name = f"{first} {last}"
            if name not in generated_names:
                generated_names.add(name)
                return name

    # Seed Volunteers: 20-30 (We seed exactly 25)
    # Assign volunteers unevenly: e.g. Gate 1: 3, Gate 2: 6, Gate 3: 5, Gate 4: 4, Gate 5: 7
    volunteer_distribution = [3, 6, 5, 4, 7]
    volunteers_list = []
    
    # First volunteer is linked to user_id=2 (default volunteer account) and named 'Sneha Shah'
    cursor.execute("""
    INSERT INTO volunteers (user_id, volunteer_name, assigned_gate, contact, email, phone, status, username, password_hash, attendance_status)
    VALUES (2, 'Sneha Shah', ?, '+91-98765-43210', 'volunteer@crowdshield.ai', '+91-98765-43210', 'Available', 'volunteer', '$2b$12$pBVXHvMjPfRka3LgfTrdM.jgiuMCO5.Ppj8WNQ8Tddt6r3LtaD0tq', 'Checked In');
    """, (gate_ids[0],))
    volunteers_list.append(cursor.lastrowid)
    
    # Generate the remaining 24 volunteers
    vol_counter = 1
    for gate_idx, count in enumerate(volunteer_distribution):
        start_range = 1 if gate_idx == 0 else 0  # Skip the first slot since Sneha Shah is already assigned to gate 1
        for _ in range(start_range, count):
            name = get_unique_name()
            # Random phone number
            phone = f"+91-9{random.randint(7,9)}{random.randint(0,9)}{random.randint(0,9)}{random.randint(0,9)}-{random.randint(10000, 99999)}"
            username = f"volunteer{vol_counter}"
            email = f"volunteer{vol_counter}@crowdshield.ai"
            pass_hash = "$2b$12$pBVXHvMjPfRka3LgfTrdM.jgiuMCO5.Ppj8WNQ8Tddt6r3LtaD0tq"
            vol_counter += 1
            cursor.execute("""
            INSERT INTO volunteers (user_id, volunteer_name, assigned_gate, contact, email, phone, status, username, password_hash, attendance_status)
            VALUES (NULL, ?, ?, ?, ?, ?, 'Offline', ?, ?, 'Absent');
            """, (name, gate_ids[gate_idx], phone, email, phone, username, pass_hash))
            volunteers_list.append(cursor.lastrowid)

    # Seed Attendees (Proportionally scaled per gate to create realistic independent telemetry spectrum)
    # Gate 1 (VIP Entrance): 32 Checked-in, 0 Queue -> Low load (~8% occ)
    # Gate 2 (East Entrance): 180 Checked-in, 12 Queue -> Moderate load (~30% occ)
    # Gate 3 (West Entrance): 340 Checked-in, 45 Queue -> Med-High load (~68% occ)
    # Gate 4 (Food Court Entrance): 450 Checked-in, 95 Queue -> High load (~150% occ)
    # Gate 5 (Main Garba Arena): 980 Checked-in, 180 Queue -> Peak load (~98% occ)
    gate_attendee_targets = [
        (gate_ids[0], 32, 0),    # Gate 1
        (gate_ids[1], 180, 12),  # Gate 2
        (gate_ids[2], 340, 45),  # Gate 3
        (gate_ids[3], 450, 95),  # Gate 4
        (gate_ids[4], 980, 180)  # Gate 5
    ]

    if empty_attendees:
        gate_attendee_targets = [(g_id, 0, 0) for g_id, _, _ in gate_attendee_targets]

    # Demo Mode: entry_time = NOW so all seeded attendees are fresh.
    # stay_duration in SECONDS: 120-240s (2-4 min) aligned to demo lifecycle.
    # This ensures exits happen naturally during the Event Running/Ending phases,
    # not immediately when the simulation starts.
    seed_now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    attendee_counter = 1001
    for gate_id, occ_target, q_target in gate_attendee_targets:
        # Checked-In Attendees
        for _ in range(occ_target):
            name = get_unique_name()
            qr = f"QR-GARBA-2026-{attendee_counter}"
            attendee_counter += 1

            # entry_time = NOW (fresh start) | stay_duration in seconds for demo mode
            stay_dur_secs = random.randint(120, 240)  # 2 to 4 minutes in demo

            cursor.execute("""
            INSERT INTO attendees (event_id, attendee_name, qr_code, assigned_gate, is_checked_in, entry_time, stay_duration)
            VALUES (?, ?, ?, ?, 1, ?, ?);
            """, (event_id, name, qr, gate_id, seed_now_str, stay_dur_secs))
            attendee_id = cursor.lastrowid

            # Scan log uses the seed timestamp
            cursor.execute("""
            INSERT INTO scans (attendee_id, gate_id, direction, scan_time)
            VALUES (?, ?, 'IN', ?);
            """, (attendee_id, gate_id, seed_now_str))
            
        # In Queue Attendees (Not checked-in)
        for _ in range(q_target):
            name = get_unique_name()
            qr = f"QR-GARBA-2026-{attendee_counter}"
            attendee_counter += 1
            cursor.execute("""
            INSERT INTO attendees (event_id, attendee_name, qr_code, assigned_gate, is_checked_in)
            VALUES (?, ?, ?, ?, 0);
            """, (event_id, name, qr, gate_id))

    # Seed some realistic Alerts
    if not empty_attendees:
        cursor.execute("""
        INSERT INTO alerts (gate_id, alert_type, message)
        VALUES (?, 'Congestion', 'Gate 5 – Main Garba Arena experiencing high traffic. Queue length at 24.');
        """, (gate_ids[4],))
        
        cursor.execute("""
        INSERT INTO alerts (gate_id, alert_type, message)
        VALUES (?, 'Security', 'VIP Gate 1 scanning system temporarily laggy. Extra volunteers deployed.');
        """, (gate_ids[0],))

    # Seed Announcements
    cursor.execute("""
    INSERT INTO announcements (title, message, priority)
    VALUES ('Grand Aarti Commencing', 'The Aarti will begin at 8:30 PM. Ensure all entry paths are clear.', 'High');
    """)
    cursor.execute("""
    INSERT INTO announcements (title, message, priority)
    VALUES ('Traditional Attire & ID Check', 'Please verify pass status for VIP guests entering through Gate 1.', 'Medium');
    """)
    
    # Seed Incidents
    # Sneha Shah is volunteer_id = 1 (assigned to Gate 1)
    if not empty_attendees:
        cursor.execute("""
        INSERT INTO incidents (volunteer_id, incident_type, location, severity, description, photo_url)
        VALUES (?, 'Ticketing Issue', 'Gate 1 VIP Entry', 'Low', 'A few passes had duplicate scans. Checked with admin and resolved.', '');
        """, (volunteers_list[0],))
        
        cursor.execute("""
        INSERT INTO incidents (volunteer_id, incident_type, location, severity, description, photo_url)
        VALUES (?, 'First Aid', 'Main Arena Left Exit', 'Medium', 'An attendee fainted during Garba. First aid team attended and attendee is fine.', '');
        """, (volunteers_list[-1],)) # Assigned to Gate 5

    # Seed volunteer checklist for Sneha
    today_str = datetime.now().strftime("%Y-%m-%d")
    cursor.execute("""
    INSERT INTO volunteer_checklists (volunteer_id, date, scanner_inspected, barrier_inspected, emergency_exit_checked, queue_managed, density_verified)
    VALUES (?, ?, 1, 1, 1, 1, 1);
    """, (volunteers_list[0], today_str))

    # Seed attendance check-in for Sneha
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
    INSERT INTO attendance (volunteer_id, check_in_time, date)
    VALUES (?, ?, ?);
    """, (volunteers_list[0], now_str, today_str))

    conn.commit()
    conn.close()
    print("Database seeded with Navratri Garba Mahotsav 2026 data successfully.")


def validate_and_repair_db():
    """
    Startup self-healing validator.
    1. Ensures entry_time and stay_duration columns exist (migrates if missing).
    2. Backfills NULL entry_time / stay_duration for all checked-in attendees.
    3. Prints a clear validation summary so the server log confirms readiness.
    """
    import time
    print("START validate_and_repair_db")
    start_t = time.perf_counter()
    try:
        import random
        from datetime import datetime

        conn = get_connection()
        cursor = conn.cursor()

        print("\n[DB Validation] ----------------------------------")

        # 1. Schema migration: ensure required columns exist
        for col, definition in [("entry_time", "TEXT"), ("stay_duration", "INTEGER")]:
            try:
                cursor.execute(f"ALTER TABLE attendees ADD COLUMN {col} {definition};")
                print(f"  [OK] Migrated missing column: {col}")
            except Exception:
                print(f"  [OK] {col} column present")

        # 1b. Schema migration for Volunteers Allocation Engine
        for col, definition in [
            ("destination_gate", "INTEGER"),
            ("travel_time_remaining", "INTEGER DEFAULT 0"),
            ("travel_eta", "TEXT"),
            ("skills", "TEXT DEFAULT 'general,crowd_control'"),
            ("dispatches_today", "INTEGER DEFAULT 0"),
            ("fatigue_score", "INTEGER DEFAULT 0"),
            ("duty_hours_today", "REAL DEFAULT 0.0")
        ]:
            try:
                cursor.execute(f"ALTER TABLE volunteers ADD COLUMN {col} {definition};")
                print(f"  [OK] Migrated missing volunteers column: {col}")
            except Exception:
                pass

        # 2. Count current state
        total_checked_in = cursor.execute(
            "SELECT COUNT(*) FROM attendees WHERE is_checked_in = 1"
        ).fetchone()[0]
        null_entry = cursor.execute(
            "SELECT COUNT(*) FROM attendees WHERE is_checked_in = 1 AND entry_time IS NULL"
        ).fetchone()[0]
        null_stay = cursor.execute(
            "SELECT COUNT(*) FROM attendees WHERE is_checked_in = 1 AND stay_duration IS NULL"
        ).fetchone()[0]

        print(f"  [OK] {total_checked_in} checked-in attendees found")

        # 3. Auto-backfill any NULL entry_time / stay_duration
        if null_entry > 0 or null_stay > 0:
            print(f"  [!!] {null_entry} attendees with NULL entry_time -- auto-repairing...")
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute(
                "SELECT attendee_id, entry_time, stay_duration FROM attendees WHERE is_checked_in = 1"
            )
            rows = cursor.fetchall()
            repaired = 0
            for att_id, et, sd in rows:
                new_et = et if et else now_str
                new_sd = sd if sd else random.randint(120, 240)  # Demo: 2-4 min in seconds
                if not et or not sd:
                    cursor.execute(
                        "UPDATE attendees SET entry_time = ?, stay_duration = ? WHERE attendee_id = ?",
                        (new_et, new_sd, att_id)
                    )
                    repaired += 1
            conn.commit()
            print(f"  [OK] Repaired {repaired} attendees with valid entry_time & stay_duration")
        else:
            print(f"  [OK] All {total_checked_in} attendees have valid entry_time")
            print(f"  [OK] All {total_checked_in} attendees have valid stay_duration")

        # 5. Ensure performance indexes exist on key simulation tables
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_type_time ON alerts(alert_type, alert_time DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_assignment_req_status ON assignment_requests(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_assign_req_status_created ON assignment_requests(status, created_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_volunteers_status ON volunteers(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_attendees_gate_checked ON attendees(assigned_gate, is_checked_in)")
        conn.commit()

        print("[DB Validation] ----------------------------------\n")
        conn.close()
    finally:
        elapsed = (time.perf_counter() - start_t) * 1000.0
        print("END validate_and_repair_db")
        print(f"Execution Time: {elapsed:.2f} ms")

def reset_event_data(conn=None):
    """
    Clears all dynamic event tables to completely purge simulation/live telemetry.
    Resets all volunteers to Offline status.
    """
    import time
    print("START reset_event_data")
    start_t = time.perf_counter()
    try:
        should_close = False
        if conn is None:
            conn = get_connection()
            should_close = True
        
        cursor = conn.cursor()
        print("[RESET] Purging all dynamic event data from database...")
        
        tables_to_clear = [
            "announcement_acknowledgements",
            "announcements",
            "volunteer_checklists",
            "incidents",
            "attendance",
            "alerts",
            "scans",
            "attendees",
            "assignment_requests",
            "volunteer_activity_logs"
        ]
        
        for table in tables_to_clear:
            cursor.execute(f"DELETE FROM {table}")
            
        # Reset all volunteers to Offline/Absent
        cursor.execute("""
            UPDATE volunteers 
            SET status = 'Offline',
                attendance_status = 'Absent',
                assigned_gate = NULL
        """)
        
        conn.commit()
        if should_close:
            conn.close()
        print("[RESET] Event data reset complete. Database is clean.")
    finally:
        elapsed = (time.perf_counter() - start_t) * 1000.0
        print("END reset_event_data")
        print(f"Execution Time: {elapsed:.2f} ms")


def initialize_demo_mode(conn=None):
    """
    Initializes Demo Mode: seeds the event structure (event, gates, volunteers, settings)
    with ZERO attendees so the Simulation Engine can build the crowd from scratch after
    the user clicks "Start Simulation". This allows a full end-to-end live demonstration.
    """
    import time
    print("START initialize_demo_mode")
    start_t = time.perf_counter()
    try:
        from datetime import datetime
        
        # 1. Seed event/gates/volunteers with 0 initial attendees so telemetry starts cleanly from 0
        seed_db(empty_attendees=True)
        
        # 2. Update mode configuration settings explicitly
        should_close = False
        if conn is None:
            conn = get_connection()
            should_close = True
        cursor = conn.cursor()
        
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('system_mode', 'Demo')")
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('volunteer_assignment_mode', 'Demo')")
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('simulation_phase', 'Normal')")
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('peak_hour', '0')")
        
        # 3. Check in volunteers and station 1 per gate
        now_str_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        cursor.execute("""
            UPDATE volunteers 
            SET status = 'Available',
                attendance_status = 'Checked In',
                last_login = ?
        """, (now_str_ts,))
        
        # Get active gates and volunteers to map them
        cursor.execute("SELECT gate_id FROM gates ORDER BY gate_id")
        gate_ids = [g[0] for g in cursor.fetchall()]
        
        cursor.execute("SELECT volunteer_id FROM volunteers ORDER BY volunteer_id")
        vol_ids = [v[0] for v in cursor.fetchall()]
        
        # Reset gate assignments first
        cursor.execute("UPDATE volunteers SET assigned_gate = NULL")
        
        # Assign the first N volunteers to the N gates (one per gate)
        for idx, g_id in enumerate(gate_ids):
            if idx < len(vol_ids):
                v_id = vol_ids[idx]
                cursor.execute("UPDATE volunteers SET assigned_gate = ?, status = 'Stationed' WHERE volunteer_id = ?", (g_id, v_id))
                
        # Insert attendance records and login logs
        for v_id in vol_ids:
            cursor.execute("SELECT assigned_gate FROM volunteers WHERE volunteer_id = ?", (v_id,))
            ag_id = cursor.fetchone()[0]
            
            cursor.execute("INSERT INTO attendance (volunteer_id, check_in_time, date) VALUES (?, ?, ?)", (v_id, now_str_ts, today_str))
            cursor.execute("""
                INSERT INTO volunteer_activity_logs (volunteer_id, activity_type, gate_id, details)
                VALUES (?, 'Login', ?, 'Volunteer logged in dynamically via simulation start')
            """, (v_id, ag_id))
            
        conn.commit()
        if should_close:
            conn.close()
        print("[DEMO-INIT] Demo Mode successfully initialized. Volunteers checked in and stationed.")
    finally:
        elapsed = (time.perf_counter() - start_t) * 1000.0
        print("END initialize_demo_mode")
        print(f"Execution Time: {elapsed:.2f} ms")


def initialize_live_mode(conn=None):
    """
    Initializes Live Mode: keeps database completely empty of event data,
    configures settings keys for Live/Production environment.
    """
    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True
    cursor = conn.cursor()
    
    cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('system_mode', 'Live')")
    cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('volunteer_assignment_mode', 'Production')")
    cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('simulation_phase', 'Normal')")
    cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('peak_hour', '0')")
    
    conn.commit()
    if should_close:
        conn.close()
    print("[LIVE-INIT] Live Mode successfully initialized. Settings configured for production operations.")


def verify_db():
    """
    Runs simple count queries on each table to verify everything works properly.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    print("\n--- Verifying Database Structure & Records ---")
    
    tables = ["events", "gates", "attendees", "scans", "volunteers", "alerts", "announcements", "incidents"]
    
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table};")
        count = cursor.fetchone()[0]
        print(f"Table '{table}': {count} record(s) found.")
        
    print("\nSample check details:")
    # Print the seeded event
    cursor.execute("SELECT event_name, venue, capacity FROM events;")
    event = cursor.fetchone()
    print(f"  Event: {event[0]} at {event[1]} (Capacity: {event[2]})")
    
    # Print the attendees status
    cursor.execute("SELECT attendee_name, is_checked_in FROM attendees LIMIT 5;")
    print("  Attendees checked in status (First 5):")
    for row in cursor.fetchall():
        status = "Checked-In" if row[1] == 1 else "Not Checked-In"
        print(f"    - {row[0]}: {status}")
        
    # Print scans direction
    cursor.execute("""
        SELECT a.attendee_name, g.gate_name, s.direction, s.scan_time 
        FROM scans s
        JOIN attendees a ON s.attendee_id = a.attendee_id
        JOIN gates g ON s.gate_id = g.gate_id
        LIMIT 5;
    """)
    print("  Scan Logs (First 5):")
    for row in cursor.fetchall():
        print(f"    - {row[0]} scanned {row[2]} at {row[1]} (Time: {row[3]})")
        
    conn.close()


if __name__ == "__main__":
    init_db()
    seed_db()
    verify_db()
