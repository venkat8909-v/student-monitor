@echo off
echo ========================================
echo   ClassMonitor - Starting...
echo ========================================

:: Start backend
echo [1/2] Starting backend (FastAPI)...
start "Backend" cmd /k "cd backend && pip install -r requirements.txt && python main.py"

:: Wait a moment then start frontend
timeout /t 3 /nobreak >nul

echo [2/2] Starting frontend (React)...
start "Frontend" cmd /k "cd frontend && npm install && npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   READY!
echo.
echo   Students open:   http://YOUR_IP:3000
echo   Your dashboard:  http://localhost:3000/dashboard
echo.
echo   Find your IP: run   ipconfig   in another terminal
echo         look for: IPv4 Address
echo ========================================
pause
