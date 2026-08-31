# ClassMonitor — Live Student Screen Dashboard

See all your students' screens simultaneously in a live grid.

---

## Prerequisites

Install these once:

| Tool | Download |
|------|----------|
| Python 3.10+ | https://python.org |
| Node.js 18+ | https://nodejs.org |

---

## Step 1 — Add your students' roll numbers

Open `backend/main.py` and edit the `VALID_ROLL_NUMBERS` set:

```python
VALID_ROLL_NUMBERS = {
    "20A91A0481",
    "20A91A0482",
    # ... add all your students
}
```

---

## Step 2 — Run the app

**Windows:**
```
Double-click start.bat
```

**Mac / Linux:**
```bash
chmod +x start.sh
./start.sh
```

Two terminal windows will open (backend + frontend). Wait ~10 seconds for both to load.

---

## Step 3 — Find your local IP

**Windows:** Open a terminal and run:
```
ipconfig
```
Look for **IPv4 Address** under your WiFi adapter.
Example: `192.168.1.15`

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```

---

## Step 4 — Share with students

Share this URL in your WhatsApp/Telegram group:
```
http://YOUR_IP:3000
```
Example: `http://192.168.1.15:3000`

**Your dashboard (open this yourself):**
```
http://localhost:3000/dashboard
```

---

## How it works

```
Student flow:
  1. Open shared URL
  2. Enter roll number → validated
  3. Browser asks to share screen
  4. Student picks their screen/tab/window
  5. Stream goes live to your dashboard

Dashboard:
  - See all students in a grid (15 per page)
  - Click ⤢ on any card → opens full screen view in new tab
  - Pagination auto-adds when > 15 students
```

---

## Requirements

- Everyone must be on the **same WiFi network**
- Students need a laptop browser (Chrome/Edge recommended)
- Screen share permission must be allowed by student

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Student can't reach the URL | Check they're on same WiFi. Check your firewall allows port 3000 and 8000 |
| Screen shows "Connecting…" forever | Refresh the student's page |
| Roll number says invalid | Add it to `VALID_ROLL_NUMBERS` in `backend/main.py` |
| Port already in use | Change port in `backend/main.py` (8000) or `frontend/vite.config.js` (3000) |

---

## Tech stack

- **Backend:** FastAPI + WebSockets (Python)
- **Frontend:** React + Vite
- **Screen capture:** `getDisplayMedia()` browser API
- **Real-time:** WebRTC peer-to-peer streaming, WebSocket signaling
