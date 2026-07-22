@echo off
echo ==========================================
echo Starting CrowdShield AI Application Suite
echo ==========================================

echo Starting FastAPI Backend...
start "CrowdShield Backend" cmd /c "run_backend.bat"

echo Starting Vite Frontend...
start "CrowdShield Frontend" cmd /c "cd frontend && npm run dev"

echo All servers starting in separate command windows.
echo You can close this window now.
pause
