#!/bin/bash
echo "========================================"
echo "  ClassMonitor - Starting..."
echo "========================================"

# Start backend
echo "[1/2] Starting backend (FastAPI)..."
cd backend
pip install -r requirements.txt -q
python main.py &
BACKEND_PID=$!
cd ..

sleep 2

# Start frontend
echo "[2/2] Starting frontend (React)..."
cd frontend
npm install -q
npm run dev &
FRONTEND_PID=$!
cd ..

sleep 3

LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null)

echo ""
echo "========================================"
echo "  READY!"
echo ""
echo "  Students open:   http://$LOCAL_IP:3000"
echo "  Your dashboard:  http://localhost:3000/dashboard"
echo ""
echo "  Press Ctrl+C to stop everything"
echo "========================================"

# Wait and cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
