from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
import json
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Valid roll numbers ────────────────────────────────────────────────
# Edit this list to match your actual students
VALID_ROLL_NUMBERS = {
    "20A91A0481", "20A91A0482", "20A91A0483", "20A91A0484", "20A91A0485",
    "20A91A0486", "20A91A0487", "20A91A0488", "20A91A0489", "20A91A0490",
    "20A91A0491", "20A91A0492", "20A91A0493", "20A91A0494", "20A91A0495",
    "21A91A0496", "21A91A0497", "21A91A0403", "21A91A0404", "21A91A0405"
    # Add all your students here
}

# ─── Connection stores ─────────────────────────────────────────────────
# student_id -> WebSocket
students: Dict[str, WebSocket] = {}

# dashboard viewers list
dashboards: list[WebSocket] = []

# track which students are active (for dashboard)
active_students: Dict[str, dict] = {}


@app.get("/validate/{roll_no}")
async def validate_roll(roll_no: str):
    roll_no = roll_no.strip().upper()
    if roll_no in VALID_ROLL_NUMBERS:
        return {"valid": True, "roll_no": roll_no}
    return {"valid": False, "roll_no": roll_no}


@app.get("/students")
async def get_students():
    return {"students": list(active_students.values())}


# ─── Student WebSocket ─────────────────────────────────────────────────
# Each student connects here after roll no. validation.
# Messages are WebRTC signaling (offer / answer / ICE candidates).
@app.websocket("/ws/student/{roll_no}")
async def student_ws(websocket: WebSocket, roll_no: str):
    roll_no = roll_no.strip().upper()
    if roll_no not in VALID_ROLL_NUMBERS:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    students[roll_no] = websocket
    active_students[roll_no] = {"roll_no": roll_no, "status": "connected"}

    # Notify all dashboards that a new student joined
    await broadcast_dashboard({
        "type": "student_joined",
        "roll_no": roll_no,
        "students": list(active_students.values())
    })

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg["from"] = roll_no

            # Forward WebRTC signals to the dashboard
            await broadcast_dashboard(msg)

    except WebSocketDisconnect:
        students.pop(roll_no, None)
        active_students.pop(roll_no, None)
        await broadcast_dashboard({
            "type": "student_left",
            "roll_no": roll_no,
            "students": list(active_students.values())
        })


# ─── Dashboard WebSocket ───────────────────────────────────────────────
# The mentor's dashboard connects here.
# Receives student join/leave events and WebRTC signals.
@app.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket):
    await websocket.accept()
    dashboards.append(websocket)

    # Send current student list immediately on connect
    await websocket.send_text(json.dumps({
        "type": "init",
        "students": list(active_students.values())
    }))

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            # Forward WebRTC answer/ICE from dashboard back to specific student
            target = msg.get("to")
            if target and target in students:
                await students[target].send_text(json.dumps(msg))

    except WebSocketDisconnect:
        dashboards.remove(websocket)


async def broadcast_dashboard(msg: dict):
    dead = []
    for ws in dashboards:
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            dead.append(ws)
    for ws in dead:
        dashboards.remove(ws)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
