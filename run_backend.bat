@echo off
echo Starting CrowdShield AI FastAPI Backend...
.\venv\Scripts\python -u -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
pause
