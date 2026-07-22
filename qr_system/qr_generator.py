# qr_system/qr_generator.py
# CrowdShield AI — Secure QR Code Generator for Live Mode
#
# Generates one unique QR code per imported attendee.
# QR payload is structured JSON with a version field (v).
# Architecture is designed so v2 can introduce HMAC/JWT encryption
# without any database schema changes — only this module changes.
#
# QR Structure (v1 — plain JSON, suitable for validation):
# {
#   "v": 1,                          <- version tag for future upgrade
#   "attendee_id": <int>,
#   "ticket_id": "<str>",
#   "event_id": <int>,
#   "assigned_gate": <int>,
#   "ticket_type": "<str>",
#   "ticket_status": "<str>",
#   "issued_at": "<ISO timestamp>"
# }

import os
import json
import hmac
import hashlib
import qrcode
from qrcode.image.pil import PilImage
from datetime import datetime

# QR images are stored relative to the project root
QR_OUTPUT_ROOT = os.path.join(os.path.dirname(__file__), "generated")

# Secret key for HMAC signature generation and verification
QR_SECRET_KEY = os.environ.get(
    "CROWDSHIELD_QR_SECRET_KEY", 
    "CROWDSHIELD_AI_QR_HMAC_SECRET_KEY_FOR_SIGNATURE_VERIFICATION"
)


def generate_hmac_signature(payload: dict) -> str:
    """
    Generates an HMAC-SHA256 signature for the given payload.
    """
    # Exclude the signature field itself to guarantee signature idempotency
    payload_copy = {k: v for k, v in payload.items() if k != "sig"}
    # Serialize to compact JSON string with sorted keys to ensure deterministic output
    serialized = json.dumps(payload_copy, sort_keys=True, separators=(",", ":"))
    return hmac.new(
        QR_SECRET_KEY.encode("utf-8"),
        serialized.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()


def verify_hmac_signature(payload: dict) -> bool:
    """
    Constant-time signature verification to prevent timing attacks.
    """
    if "sig" not in payload:
        return False
    expected_sig = generate_hmac_signature(payload)
    return hmac.compare_digest(payload["sig"], expected_sig)


def build_qr_payload(
    attendee_id: int,
    ticket_id: str,
    event_id: int,
    assigned_gate: int,
    ticket_type: str = "General",
    ticket_status: str = "Active",
) -> dict:
    """
    Builds the QR token payload dictionary.
    Outputs Version 2 (HMAC signed) payload.
    """
    payload = {
        "v": 2,
        "attendee_id": attendee_id,
        "ticket_id": ticket_id,
        "event_id": event_id,
        "assigned_gate": assigned_gate,
        "ticket_type": ticket_type,
        "ticket_status": ticket_status,
        "issued_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
    }
    payload["sig"] = generate_hmac_signature(payload)
    return payload


def generate_qr_image(payload: dict, event_id: int, attendee_id: int) -> str:
    """
    Generates a QR code image from the payload dictionary.

    Saves the image at:
        qr_system/generated/{event_id}/{attendee_id}.png

    Returns the relative path (from project root) to the saved image.
    """
    # Create directory if it does not exist
    event_dir = os.path.join(QR_OUTPUT_ROOT, str(event_id))
    os.makedirs(event_dir, exist_ok=True)

    image_path = os.path.join(event_dir, f"{attendee_id}.png")

    # Encode payload as compact JSON string
    qr_data = json.dumps(payload, separators=(",", ":"))

    # Generate QR code with high error correction for physical printing resilience
    qr = qrcode.QRCode(
        version=None,               # auto-size based on data length
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # 30% damage tolerance
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)

    img: PilImage = qr.make_image(fill_color="black", back_color="white")
    img.save(image_path)

    # Return relative path from project root for storage in database
    rel_path = os.path.join("qr_system", "generated", str(event_id), f"{attendee_id}.png")
    return rel_path


def generate_attendee_qr(
    attendee_id: int,
    ticket_id: str,
    event_id: int,
    assigned_gate: int,
    ticket_type: str = "General",
    ticket_status: str = "Active",
) -> tuple[dict, str]:
    """
    Convenience wrapper: builds payload, generates image, returns both.

    Returns:
        (payload_dict, relative_image_path)
    """
    payload = build_qr_payload(
        attendee_id=attendee_id,
        ticket_id=ticket_id,
        event_id=event_id,
        assigned_gate=assigned_gate,
        ticket_type=ticket_type,
        ticket_status=ticket_status,
    )
    image_path = generate_qr_image(payload, event_id, attendee_id)
    return payload, image_path


def parse_qr_payload(qr_data: str) -> dict | None:
    """
    Parses a QR code string back into a payload dict.
    Returns None if:
      - The string is not valid JSON
      - Required fields are missing
      - The QR version is 2 and the signature is invalid/tampered
      - The QR version is unsupported
    """
    try:
        payload = json.loads(qr_data)
        required = {"v", "attendee_id", "ticket_id", "event_id", "assigned_gate"}
        if not required.issubset(payload.keys()):
            return None
            
        version = payload.get("v")
        
        # Version 1 backward compatibility (bypass signature check)
        if version == 1:
            return payload
            
        # Version 2 security verification
        elif version == 2:
            if "sig" not in payload:
                return None
            if not verify_hmac_signature(payload):
                return None
            return payload
            
        return None
    except (json.JSONDecodeError, TypeError):
        return None
