# backend/live_import.py
# CrowdShield AI — Live Mode QR Import & Validation Router
#
# This module is a completely self-contained FastAPI APIRouter.
# It handles:
#   - CSV / Excel attendee import
#   - QR code generation per attendee
#   - QR validation (entry check)
#   - Post-scan pipeline (DB update → existing ML → volunteer assignment → alerts)
#   - Scan log retrieval
#
# IMPORTANT: Every endpoint in this router verifies system_mode == 'Live' before
# executing any logic. If the system is in Demo Mode, all endpoints return HTTP 400.
# This ensures Demo Mode is completely unaffected regardless of which routes are called.
#
# The following existing systems are REUSED (not duplicated):
#   - get_live_analytics()    → ML analytics engine
#   - run_auto_assign()       → volunteer redeployment
#   - scans table             → successful IN events are logged here (same as Demo)
#   - alerts system           → congestion alerts reuse existing logic
#   - JWT auth                → get_current_user() dependency reused

import io
import os
import json
from datetime import datetime
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header, Query
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from backend.database import get_connection

router = APIRouter(prefix="/live", tags=["Live Mode"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_system_mode() -> str:
    """Returns the current system_mode from the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_settings WHERE key = 'system_mode'")
        row = cursor.fetchone()
        conn.close()
        return row[0] if row else "Demo"
    except Exception:
        return "Demo"


def _require_live_mode():
    """
    Raises HTTP 400 if the system is not in Live Mode.
    Called at the top of every endpoint in this router.
    """
    mode = _get_system_mode()
    if mode != "Live":
        raise HTTPException(
            status_code=400,
            detail=(
                "This endpoint is only available in Live Mode. "
                "Current mode: Demo. Switch to Live Mode in Settings → System Operating Mode."
            ),
        )


def _get_current_user_from_header(authorization: Optional[str] = Header(None)) -> dict:
    """
    Lightweight JWT verification reusing the same SECRET_KEY as main.py.
    Returns the decoded user dict, or raises 401.
    """
    import jwt

    SECRET_KEY = "CROWDSHIELD_AI_SECRET_KEY_FOR_JWT_TOKEN_GENERATION"
    ALGORITHM = "HS256"

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header missing or invalid.")
    token = authorization[len("Bearer "):]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")


def _require_admin(authorization: Optional[str] = Header(None)) -> dict:
    """Requires the calling user to be an admin. Returns user payload."""
    user = _get_current_user_from_header(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user


def _require_volunteer_or_admin(authorization: Optional[str] = Header(None)) -> dict:
    """Requires the calling user to be a volunteer or an admin. Returns user payload."""
    user = _get_current_user_from_header(authorization)
    if user.get("role") not in ("admin", "volunteer"):
        raise HTTPException(status_code=403, detail="Access denied: Admin or Volunteer role required.")
    return user


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class QRValidateRequest(BaseModel):
    qr_token: str
    gate_id: int
    volunteer_id: Optional[int] = None
    scan_source: Optional[str] = "api"


# ---------------------------------------------------------------------------
# Internal: Post-Scan Pipeline
# ---------------------------------------------------------------------------

def _run_post_scan_pipeline(conn, gate_id: int):
    """
    Triggers the existing ML + volunteer assignment pipeline after a successful scan.
    This is the SAME pipeline used by the Demo simulation — we just call it directly.
    No code is duplicated.
    """
    try:
        # 1. Import the centralized analytics engine from main
        from backend.main import get_live_analytics, run_auto_assign

        # 2. Get current gate analytics (runs ML models)
        analytics = get_live_analytics(conn)

        # 3. Check for congestion at the scanned gate → create alert if needed
        cursor = conn.cursor()
        for gate in analytics:
            if gate["gate_id"] == gate_id:
                occ = gate["current_occupancy"]
                max_cap = gate["max_capacity"]
                gate_name = gate["gate_name"]
                util_pct = gate["occupancy_percentage"]

                if util_pct >= 85.0:
                    cursor.execute(
                        "SELECT COUNT(*) FROM alerts WHERE gate_id = ? AND alert_type = 'Congestion Alert' AND is_resolved = 0",
                        (gate_id,),
                    )
                    if cursor.fetchone()[0] == 0:
                        msg = (
                            f"[Live Mode] {gate_name} capacity at {round(util_pct, 1)}% "
                            f"({occ}/{max_cap}). Immediate action required."
                        )
                        cursor.execute(
                            "INSERT INTO alerts (gate_id, alert_type, severity, message, recommendation, is_resolved) "
                            "VALUES (?, 'Congestion Alert', 'Critical', ?, "
                            "'Restrict entry and redirect crowd to adjacent gates.', 0)",
                            (gate_id, msg),
                        )
                else:
                    # Auto-resolve existing congestion alert for this gate if crowd dropped below threshold
                    cursor.execute(
                        "UPDATE alerts SET is_resolved = 1 "
                        "WHERE gate_id = ? AND alert_type = 'Congestion Alert' "
                        "AND message LIKE '[Live Mode]%' AND is_resolved = 0",
                        (gate_id,),
                    )
                break

        conn.commit()

        # 4. Trigger volunteer auto-assignment (ML redeployment decision)
        # run_auto_assign() opens its own connection internally so we call it independently
        try:
            run_auto_assign()
        except Exception as e:
            print(f"[LiveMode] Auto-assign warning (non-fatal): {e}")

    except Exception as e:
        print(f"[LiveMode] Post-scan pipeline error (non-fatal): {e}")


# ---------------------------------------------------------------------------
# Internal: Import Pipeline
# ---------------------------------------------------------------------------

def _import_attendees_from_dataframe(df: pd.DataFrame, user: dict) -> dict:
    """
    Core import pipeline shared by both CSV and Excel endpoints.

    Expected columns (case-insensitive, extra columns are ignored):
        attendee_name (or full_name or name)
        email
        phone
        ticket_id
        ticket_type
        assigned_gate (or gate or gate_id)
        ticket_status  [optional, defaults to 'Active']
        external_attendee_id [optional]

    Returns: { imported, failed, errors, attendees }
    """
    from qr_system.qr_generator import generate_attendee_qr

    # Normalize column names to lowercase
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]

    # Column alias resolution
    def _find_col(df, *candidates):
        for c in candidates:
            if c in df.columns:
                return c
        return None

    name_col   = _find_col(df, "attendee_name", "full_name", "name", "attendee")
    email_col  = _find_col(df, "email", "email_address")
    phone_col  = _find_col(df, "phone", "phone_number", "mobile", "contact")
    ticket_col = _find_col(df, "ticket_id", "ticket", "booking_id", "order_id")
    type_col   = _find_col(df, "ticket_type", "type", "category", "pass_type")
    gate_col   = _find_col(df, "assigned_gate", "gate", "gate_id", "entry_gate")
    status_col = _find_col(df, "ticket_status", "status")
    ext_id_col = _find_col(df, "external_attendee_id", "attendee_id", "ref_id", "registration_id")

    if not name_col:
        raise HTTPException(
            status_code=422,
            detail=(
                "CSV/Excel must have a column for attendee name. "
                "Accepted names: attendee_name, full_name, name"
            ),
        )
    if not ticket_col:
        raise HTTPException(
            status_code=422,
            detail=(
                "CSV/Excel must have a column for ticket ID. "
                "Accepted names: ticket_id, booking_id, order_id"
            ),
        )
    if not gate_col:
        raise HTTPException(
            status_code=422,
            detail=(
                "CSV/Excel must have a column for gate assignment. "
                "Accepted names: assigned_gate, gate, gate_id, entry_gate"
            ),
        )

    conn = get_connection()
    cursor = conn.cursor()

    # Get active event
    cursor.execute("SELECT event_id FROM events ORDER BY event_id DESC LIMIT 1")
    event_row = cursor.fetchone()
    if not event_row:
        conn.close()
        raise HTTPException(status_code=404, detail="No active event found. Create an event first.")
    event_id = event_row[0]

    # Get valid gate IDs
    cursor.execute("SELECT gate_id, gate_name FROM gates WHERE event_id = ?", (event_id,))
    valid_gates = {row[0]: row[1] for row in cursor.fetchall()}

    imported = 0
    failed = 0
    errors = []
    imported_attendees = []
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for idx, row in df.iterrows():
        row_num = idx + 2  # 1-indexed, header is row 1
        try:
            # Extract & clean values
            attendee_name    = str(row.get(name_col, "")).strip()
            email            = str(row.get(email_col, "")).strip() if email_col else ""
            phone            = str(row.get(phone_col, "")).strip() if phone_col else ""
            ticket_id        = str(row.get(ticket_col, "")).strip()
            ticket_type      = str(row.get(type_col, "General")).strip() if type_col else "General"
            ticket_status    = str(row.get(status_col, "Active")).strip() if status_col else "Active"
            ext_att_id       = str(row.get(ext_id_col, "")).strip() if ext_id_col else ""

            # Gate resolution — accept both integer IDs and gate names
            gate_raw = str(row.get(gate_col, "")).strip()
            assigned_gate = None

            if gate_raw.isdigit() and int(gate_raw) in valid_gates:
                assigned_gate = int(gate_raw)
            else:
                # Try to match gate name (case-insensitive, partial match)
                for gid, gname in valid_gates.items():
                    if gate_raw.lower() in gname.lower() or gname.lower() in gate_raw.lower():
                        assigned_gate = gid
                        break

            # Validations
            if not attendee_name or attendee_name.lower() in ("nan", "none", ""):
                errors.append(f"Row {row_num}: Attendee name is empty — skipped.")
                failed += 1
                continue

            if not ticket_id or ticket_id.lower() in ("nan", "none", ""):
                errors.append(f"Row {row_num}: Ticket ID is empty — skipped.")
                failed += 1
                continue

            if assigned_gate is None:
                errors.append(f"Row {row_num}: Gate '{gate_raw}' not found in this event — skipped.")
                failed += 1
                continue

            if ticket_status not in ("Active", "Cancelled", "Expired"):
                ticket_status = "Active"  # default to Active for unrecognized values

            # Check for duplicate ticket_id
            cursor.execute("SELECT attendee_id FROM attendees WHERE ticket_id = ?", (ticket_id,))
            if cursor.fetchone():
                errors.append(f"Row {row_num}: Ticket ID '{ticket_id}' already exists — skipped.")
                failed += 1
                continue

            # Build a unique QR code string (used in the existing qr_code column)
            # Format: LIVE-{event_id}-{ticket_id} — unique and scannable
            qr_code_str = f"LIVE-{event_id}-{ticket_id}"

            # Insert attendee record
            cursor.execute(
                """
                INSERT INTO attendees (
                    event_id, attendee_name, qr_code, assigned_gate,
                    is_checked_in, email, phone, ticket_id, ticket_type,
                    ticket_status, external_attendee_id, import_source, imported_at
                ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id, attendee_name, qr_code_str, assigned_gate,
                    email or None, phone or None, ticket_id, ticket_type,
                    ticket_status, ext_att_id or None, "csv_import", now_str,
                ),
            )
            attendee_id = cursor.lastrowid
            conn.commit()

            # Generate QR image
            try:
                payload, image_path = generate_attendee_qr(
                    attendee_id=attendee_id,
                    ticket_id=ticket_id,
                    event_id=event_id,
                    assigned_gate=assigned_gate,
                    ticket_type=ticket_type,
                    ticket_status=ticket_status,
                )
                # Save image path back to the attendee record
                cursor.execute(
                    "UPDATE attendees SET qr_image_path = ? WHERE attendee_id = ?",
                    (image_path, attendee_id),
                )
                conn.commit()
            except Exception as qr_err:
                print(f"[LiveMode] QR generation failed for attendee {attendee_id}: {qr_err}")
                image_path = None

            imported += 1
            imported_attendees.append({
                "attendee_id": attendee_id,
                "attendee_name": attendee_name,
                "ticket_id": ticket_id,
                "ticket_type": ticket_type,
                "ticket_status": ticket_status,
                "assigned_gate": assigned_gate,
                "gate_name": valid_gates.get(assigned_gate, "Unknown"),
                "qr_code": qr_code_str,
                "qr_image_path": image_path,
                "email": email or None,
                "phone": phone or None,
            })

        except Exception as row_err:
            errors.append(f"Row {row_num}: Unexpected error — {str(row_err)}")
            failed += 1

    conn.close()

    return {
        "imported": imported,
        "failed": failed,
        "total_rows": len(df),
        "errors": errors,
        "event_id": event_id,
        "attendees": imported_attendees,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/import/template")
def download_csv_template(user: dict = Depends(_require_admin)):
    """
    Returns a CSV template file that operators can fill in with attendee data
    exported from BookMyShow, Eventbrite, Insider, or any other platform.
    """
    _require_live_mode()

    template_csv = (
        "attendee_name,email,phone,ticket_id,ticket_type,assigned_gate,ticket_status,external_attendee_id\n"
        "Aarav Patel,aarav.patel@email.com,+91-98765-43210,TKT-001,VIP,1,Active,EXT-001\n"
        "Priya Shah,priya.shah@email.com,+91-87654-32109,TKT-002,General,2,Active,EXT-002\n"
        "Rohan Mehta,rohan.mehta@email.com,+91-76543-21098,TKT-003,Student,3,Active,EXT-003\n"
    )

    return StreamingResponse(
        io.BytesIO(template_csv.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=crowdshield_import_template.csv"},
    )


@router.post("/import/csv")
async def import_attendees_csv(
    file: UploadFile = File(...),
    user: dict = Depends(_require_admin),
):
    """
    Imports attendees from a CSV file exported from any third-party ticket platform.
    For each attendee: inserts record → generates QR image → stores image path.
    """
    _require_live_mode()

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=422, detail="Only CSV files are accepted at this endpoint. Use /live/import/excel for Excel files.")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents), dtype=str, keep_default_na=False)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=422, detail="The uploaded CSV file is empty.")

    result = _import_attendees_from_dataframe(df, user)
    result["import_type"] = "csv"
    return result


@router.post("/import/excel")
async def import_attendees_excel(
    file: UploadFile = File(...),
    user: dict = Depends(_require_admin),
):
    """
    Imports attendees from an Excel (.xlsx or .xls) file.
    Same pipeline as CSV import.
    """
    _require_live_mode()

    if not (file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise HTTPException(status_code=422, detail="Only .xlsx or .xls files are accepted at this endpoint.")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents), dtype=str, keep_default_na=False)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse Excel file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=422, detail="The uploaded Excel file is empty.")

    result = _import_attendees_from_dataframe(df, user)
    result["import_type"] = "excel"
    return result


@router.get("/attendees")
def get_live_attendees(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    gate_id: Optional[int] = Query(None),
    ticket_status: Optional[str] = Query(None),
    checked_in: Optional[bool] = Query(None),
    user: dict = Depends(_require_admin),
):
    """
    Returns paginated list of imported attendees with QR and check-in status.
    Supports filtering by gate, status, check-in state, and text search.
    """
    _require_live_mode()

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Build dynamic WHERE clause
        conditions = ["a.imported_at IS NOT NULL"]
        params = []

        if search:
            conditions.append("(a.attendee_name LIKE ? OR a.ticket_id LIKE ? OR a.email LIKE ?)")
            like = f"%{search}%"
            params += [like, like, like]

        if gate_id:
            conditions.append("a.assigned_gate = ?")
            params.append(gate_id)

        if ticket_status:
            conditions.append("a.ticket_status = ?")
            params.append(ticket_status)

        if checked_in is not None:
            conditions.append("a.is_checked_in = ?")
            params.append(1 if checked_in else 0)

        where_clause = " AND ".join(conditions)
        offset = (page - 1) * page_size

        # Total count
        cursor.execute(
            f"SELECT COUNT(*) FROM attendees a WHERE {where_clause}",
            params,
        )
        total = cursor.fetchone()[0]

        # Paginated rows
        cursor.execute(
            f"""
            SELECT
                a.attendee_id, a.attendee_name, a.email, a.phone,
                a.ticket_id, a.ticket_type, a.ticket_status,
                a.assigned_gate, g.gate_name,
                a.is_checked_in, a.entry_time,
                a.qr_code, a.qr_image_path,
                a.import_source, a.imported_at,
                a.external_attendee_id
            FROM attendees a
            LEFT JOIN gates g ON a.assigned_gate = g.gate_id
            WHERE {where_clause}
            ORDER BY a.attendee_id DESC
            LIMIT ? OFFSET ?
            """,
            params + [page_size, offset],
        )
        rows = cursor.fetchall()
        conn.close()

        attendees = []
        for r in rows:
            attendees.append({
                "attendee_id":          r[0],
                "attendee_name":        r[1],
                "email":                r[2],
                "phone":                r[3],
                "ticket_id":            r[4],
                "ticket_type":          r[5],
                "ticket_status":        r[6],
                "assigned_gate":        r[7],
                "gate_name":            r[8] or "Unknown",
                "is_checked_in":        bool(r[9]),
                "entry_time":           r[10],
                "qr_code":              r[11],
                "qr_image_available":   r[12] is not None,
                "qr_image_path":        r[12],
                "import_source":        r[13],
                "imported_at":          r[14],
                "external_attendee_id": r[15],
            })

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "attendees": attendees,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/attendees/{attendee_id}/qr")
def download_attendee_qr(
    attendee_id: int,
    user: dict = Depends(_require_admin),
):
    """
    Downloads the generated QR image for a specific attendee.
    Returns the PNG file directly for download or display.
    """
    _require_live_mode()

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT attendee_name, qr_image_path, ticket_id FROM attendees WHERE attendee_id = ?",
            (attendee_id,),
        )
        row = cursor.fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail=f"Attendee {attendee_id} not found.")

        attendee_name, qr_image_path, ticket_id = row

        if not qr_image_path:
            raise HTTPException(status_code=404, detail="QR image has not been generated for this attendee.")

        # Resolve absolute path from project root
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        abs_path = os.path.join(project_root, qr_image_path)

        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail="QR image file not found on disk. Try re-importing this attendee.")

        safe_name = "".join(c for c in attendee_name if c.isalnum() or c in (" ", "-", "_")).strip().replace(" ", "_")
        filename = f"QR_{safe_name}_{ticket_id}.png"

        return FileResponse(
            path=abs_path,
            media_type="image/png",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving QR image: {str(e)}")


@router.post("/qr/validate")
def validate_qr(
    data: QRValidateRequest,
    user: dict = Depends(_require_volunteer_or_admin),
):
    """
    Core QR Validation endpoint. Called when a volunteer scans a ticket QR code.

    Validation chain (in order):
      1. Parse QR payload          → INVALID_QR
      2. Ticket Exists in DB       → INVALID_QR
      3. Correct Event             → INVALID_QR
      4. Ticket Active             → EXPIRED_TICKET
      5. Correct Gate              → WRONG_GATE
      6. Not Already Checked In   → ALREADY_SCANNED

    On ALLOWED:
      - Updates attendee: is_checked_in=1, entry_time=NOW
      - Inserts into scans table (reuses existing table, same as Demo Mode)
      - Inserts into qr_scan_logs (audit log with result code)
      - Triggers existing ML pipeline + volunteer auto-assignment
      - Triggers congestion alert check

    On any failure:
      - Only inserts into qr_scan_logs (no attendee/scans table changes)
    """
    _require_live_mode()

    from qr_system.qr_generator import parse_qr_payload

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    gate_id = data.gate_id
    volunteer_id = data.volunteer_id
    scan_source = data.scan_source or "api"

    # ── Step 1: Parse QR payload ─────────────────────────────────────────────
    payload = parse_qr_payload(data.qr_token)
    if payload is None:
        _log_scan(
            gate_id=gate_id,
            volunteer_id=volunteer_id,
            attendee_id=None,
            result="INVALID_QR",
            qr_token=data.qr_token[:500] if data.qr_token else None,
            scan_source=scan_source,
            notes="Could not parse QR payload — invalid JSON or missing required fields.",
        )
        return {
            "result": "INVALID_QR",
            "message": "QR code is invalid. The ticket could not be read.",
            "attendee": None,
        }

    qr_attendee_id = payload.get("attendee_id")
    qr_event_id    = payload.get("event_id")
    qr_gate        = payload.get("assigned_gate")
    qr_ticket_id   = payload.get("ticket_id")

    conn = get_connection()
    cursor = conn.cursor()

    # ── Step 2: Ticket Exists ────────────────────────────────────────────────
    cursor.execute(
        """
        SELECT attendee_id, attendee_name, event_id, assigned_gate,
               ticket_status, is_checked_in, ticket_id, ticket_type, email, phone
        FROM attendees WHERE attendee_id = ? AND ticket_id = ?
        """,
        (qr_attendee_id, qr_ticket_id),
    )
    row = cursor.fetchone()

    if not row:
        conn.close()
        _log_scan(
            gate_id=gate_id,
            volunteer_id=volunteer_id,
            attendee_id=qr_attendee_id,
            result="INVALID_QR",
            qr_token=data.qr_token[:500],
            scan_source=scan_source,
            notes=f"Attendee ID {qr_attendee_id} with ticket {qr_ticket_id} not found in database.",
        )
        return {
            "result": "INVALID_QR",
            "message": "Ticket not found in the system. This QR code is not registered.",
            "attendee": None,
        }

    (
        db_attendee_id, db_name, db_event_id, db_gate,
        db_ticket_status, db_checked_in, db_ticket_id, db_ticket_type,
        db_email, db_phone,
    ) = row

    attendee_info = {
        "attendee_id":   db_attendee_id,
        "attendee_name": db_name,
        "ticket_id":     db_ticket_id,
        "ticket_type":   db_ticket_type,
        "assigned_gate": db_gate,
        "email":         db_email,
        "phone":         db_phone,
    }

    # ── Step 3: Correct Event ────────────────────────────────────────────────
    cursor.execute("SELECT event_id FROM events ORDER BY event_id DESC LIMIT 1")
    active_event = cursor.fetchone()
    active_event_id = active_event[0] if active_event else None

    if db_event_id != active_event_id or qr_event_id != active_event_id:
        conn.close()
        _log_scan(
            gate_id=gate_id,
            volunteer_id=volunteer_id,
            attendee_id=db_attendee_id,
            result="INVALID_QR",
            qr_token=data.qr_token[:500],
            scan_source=scan_source,
            notes=f"Event mismatch. QR event: {qr_event_id}, DB event: {db_event_id}, Active: {active_event_id}.",
        )
        return {
            "result": "INVALID_QR",
            "message": "This ticket belongs to a different event.",
            "attendee": attendee_info,
        }

    # ── Step 4: Ticket Active ────────────────────────────────────────────────
    if db_ticket_status not in ("Active",):
        conn.close()
        _log_scan(
            gate_id=gate_id,
            volunteer_id=volunteer_id,
            attendee_id=db_attendee_id,
            result="EXPIRED_TICKET",
            qr_token=data.qr_token[:500],
            scan_source=scan_source,
            notes=f"Ticket status is '{db_ticket_status}'. Entry denied.",
        )
        return {
            "result": "EXPIRED_TICKET",
            "message": f"This ticket has been {db_ticket_status.lower()} and cannot be used for entry.",
            "attendee": attendee_info,
        }

    # ── Step 5: Correct Gate ─────────────────────────────────────────────────
    if db_gate != gate_id:
        cursor.execute("SELECT gate_name FROM gates WHERE gate_id = ?", (db_gate,))
        expected_gate_row = cursor.fetchone()
        expected_gate_name = expected_gate_row[0] if expected_gate_row else f"Gate #{db_gate}"
        conn.close()
        _log_scan(
            gate_id=gate_id,
            volunteer_id=volunteer_id,
            attendee_id=db_attendee_id,
            result="WRONG_GATE",
            qr_token=data.qr_token[:500],
            scan_source=scan_source,
            notes=f"Scanned at gate {gate_id}, but assigned to gate {db_gate} ({expected_gate_name}).",
        )
        return {
            "result": "WRONG_GATE",
            "message": f"This ticket is assigned to {expected_gate_name}. Please redirect the attendee.",
            "attendee": attendee_info,
            "expected_gate": expected_gate_name,
        }

    # ── Step 6: Not Already Used ─────────────────────────────────────────────
    if db_checked_in == 1:
        conn.close()
        _log_scan(
            gate_id=gate_id,
            volunteer_id=volunteer_id,
            attendee_id=db_attendee_id,
            result="ALREADY_SCANNED",
            qr_token=data.qr_token[:500],
            scan_source=scan_source,
            notes="Attendee is already checked in. Duplicate scan attempt.",
        )
        return {
            "result": "ALREADY_SCANNED",
            "message": "This ticket has already been used for entry. Duplicate scan detected.",
            "attendee": attendee_info,
        }

    # ── ALLOWED ── All checks passed ─────────────────────────────────────────
    # 1. Update attendee: check in
    cursor.execute(
        "UPDATE attendees SET is_checked_in = 1, entry_time = ? WHERE attendee_id = ?",
        (now_str, db_attendee_id),
    )

    # 2. Insert into the existing 'scans' table (same table used by Demo Mode analytics)
    cursor.execute(
        "INSERT INTO scans (attendee_id, gate_id, direction, scan_time) VALUES (?, ?, 'IN', ?)",
        (db_attendee_id, gate_id, now_str),
    )

    conn.commit()

    # 3. Insert audit log
    _log_scan(
        gate_id=gate_id,
        volunteer_id=volunteer_id,
        attendee_id=db_attendee_id,
        result="ALLOWED",
        qr_token=data.qr_token[:500],
        scan_source=scan_source,
        notes="Entry permitted. Attendee checked in successfully.",
    )

    attendee_info["is_checked_in"] = True
    attendee_info["entry_time"] = now_str

    # 4. Trigger existing ML pipeline + volunteer assignment + alerts (non-blocking)
    _run_post_scan_pipeline(conn, gate_id)

    conn.close()

    return {
        "result": "ALLOWED",
        "message": f"Entry permitted. Welcome, {db_name}!",
        "attendee": attendee_info,
    }


def _log_scan(
    gate_id: int,
    result: str,
    qr_token: Optional[str] = None,
    attendee_id: Optional[int] = None,
    volunteer_id: Optional[int] = None,
    scan_source: str = "api",
    notes: Optional[str] = None,
):
    """
    Inserts a record into qr_scan_logs for every scan attempt (success or failure).
    Runs in its own connection to avoid interfering with the caller's transaction.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute(
            """
            INSERT INTO qr_scan_logs (
                attendee_id, gate_id, scanned_by_volunteer_id,
                scan_time, scan_result, scan_source, qr_token, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (attendee_id, gate_id, volunteer_id, now_str, result, scan_source, qr_token, notes),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[LiveMode] Failed to write scan log: {e}")


@router.get("/scan-logs")
def get_scan_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    gate_id: Optional[int] = Query(None),
    result_filter: Optional[str] = Query(None, alias="result"),
    user: dict = Depends(_require_admin),
):
    """
    Returns paginated QR scan audit logs for Live Mode.
    Supports filtering by gate and scan result.
    """
    _require_live_mode()

    try:
        conn = get_connection()
        cursor = conn.cursor()

        conditions = []
        params = []

        if gate_id:
            conditions.append("l.gate_id = ?")
            params.append(gate_id)

        if result_filter:
            conditions.append("l.scan_result = ?")
            params.append(result_filter)

        where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        offset = (page - 1) * page_size

        cursor.execute(
            f"SELECT COUNT(*) FROM qr_scan_logs l {where_clause}", params
        )
        total = cursor.fetchone()[0]

        cursor.execute(
            f"""
            SELECT
                l.log_id, l.scan_time, l.scan_result, l.scan_source,
                l.attendee_id, a.attendee_name, a.ticket_id, a.ticket_type,
                l.gate_id, g.gate_name,
                l.scanned_by_volunteer_id, v.volunteer_name,
                l.notes
            FROM qr_scan_logs l
            LEFT JOIN attendees a ON l.attendee_id = a.attendee_id
            LEFT JOIN gates g ON l.gate_id = g.gate_id
            LEFT JOIN volunteers v ON l.scanned_by_volunteer_id = v.volunteer_id
            {where_clause}
            ORDER BY l.log_id DESC
            LIMIT ? OFFSET ?
            """,
            params + [page_size, offset],
        )
        rows = cursor.fetchall()
        conn.close()

        logs = []
        for r in rows:
            logs.append({
                "log_id":           r[0],
                "scan_time":        r[1],
                "scan_result":      r[2],
                "scan_source":      r[3],
                "attendee_id":      r[4],
                "attendee_name":    r[5] or "Unknown",
                "ticket_id":        r[6],
                "ticket_type":      r[7],
                "gate_id":          r[8],
                "gate_name":        r[9] or "Unknown",
                "volunteer_id":     r[10],
                "volunteer_name":   r[11] or "System",
                "notes":            r[12],
            })

        # Summary stats
        conn2 = get_connection()
        c2 = conn2.cursor()
        c2.execute(
            "SELECT scan_result, COUNT(*) FROM qr_scan_logs GROUP BY scan_result"
        )
        stats = {row[0]: row[1] for row in c2.fetchall()}
        conn2.close()

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "summary": stats,
            "logs": logs,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/stats")
def get_live_stats(user: dict = Depends(_require_admin)):
    """
    Returns a summary of Live Mode import and scan statistics.
    """
    _require_live_mode()

    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM attendees WHERE imported_at IS NOT NULL")
        total_imported = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM attendees WHERE imported_at IS NOT NULL AND is_checked_in = 1")
        total_checked_in = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM attendees WHERE imported_at IS NOT NULL AND ticket_status = 'Active' AND is_checked_in = 0")
        pending_entry = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM qr_scan_logs")
        total_scans = cursor.fetchone()[0]

        cursor.execute("SELECT scan_result, COUNT(*) FROM qr_scan_logs GROUP BY scan_result")
        scan_results = {r[0]: r[1] for r in cursor.fetchall()}

        cursor.execute(
            "SELECT COUNT(*) FROM qr_scan_logs WHERE scan_result = 'ALLOWED'"
        )
        allowed_count = cursor.fetchone()[0]

        success_rate = round((allowed_count / total_scans * 100), 1) if total_scans > 0 else 0.0

        conn.close()

        return {
            "total_imported": total_imported,
            "total_checked_in": total_checked_in,
            "pending_entry": pending_entry,
            "check_in_rate": round((total_checked_in / total_imported * 100), 1) if total_imported > 0 else 0.0,
            "total_scan_attempts": total_scans,
            "scan_results": scan_results,
            "scan_success_rate": success_rate,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
