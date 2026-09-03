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
    "24B11DS095",
    "24B11CS087",
    "24B11CS197",
    "24B11CS517",
    "24B11CS207",
    "24B11DS227",
    "24P31A42C4",
    "24P31A42J8",
    "24B11DS155",
    "24B11IT022",
    "24B11AI044",
    "24B11CS283",
    "24B11CS542",
    "24B11DS119",
    "24P31A42K2",
    "24B11AI325",
    "24B11CS082",
    "24B11CS329",
    "24B11CS504",
    "24B11DS004",
    "24B11DS008",
    "24B11DS084",
    "24B11AI262",
    "24B11AI304",
    "24B11AI475",
    "24B11CS187",
    "24B11CS432",
    "24B11CS505",
    "24B11AI134",
    "24B11AI223",
    "24B11CS513",
    "24B11DS056",
    "24B11DS124",
    "24B11DS125",
    "24B11DS163",
    "24B11DS183",
    "24B11AI070",
    "24B11AI151",
    "24B11AI242",
    "24B11DS233",
    "24B11CS413",
    "24B11DS180",
    "24B11CS320",
    "24B11DS022",
    "24B11DS086",
    "24P31A42D0",
    "25P35A4430",
    "24P31A4202",
    "24B11AI035",
    "24B11AI195",
    "24B11AI270",
    "24B11CS405",
    "24B11CS468",
    "24B11DS099",
    "24P31A05J1",
    "24P31A42I0",
    "24P31A4459",
    "24B11AI040",
    "24P31A42G4",
    "24P31A0510",
    "24P31A0522",
    "24B11CS212",
    "24B11DS221",
    "24B11DS226",
    "24P31A42B0",
    "24B11AI282",
    "24B11AI228",
    "24B11CS385",
    "24P31A4290",
    "24P31A4405",
    "24P31A4434",
    "24P31A4410",
    "24B11AI306",
    "24B11AI248",
    "24P31A42C8",
    "24B11AI062",
    "24B11AI154",
    "24B11AI016",
    "24P31A4272",
    "24B11DS057",
    "24P31A05K2",
    "24P31A4217",
    "24P31A4282",
    "24P31A42J6",
    "24P31A4447",
    "24P32A0561",
    "24P31A05E9",
    "24P31A42C5",
    "24P31A42G1",
    "24P31A42I6",
    "24P31A4236",
    "24P31A4270",
    "24P31A4255",
    "24P31A0428",
    "24P31A0556",
    "24P31A05F4",
    "24P31A05G1",
    "24P31A42C7",
    "24P31A4403",
    "24B11AI060",
    "24B11AI087",
    "24B11AI159",
    "25B21DS012",
    "24P31A4492",
    "24B11AI113",
    "24P31A4430",
    "24P31A4242",
    "24P32A4289",
    "24B11AI085",
    "24B11CS004",
    "24B11CS122",
    "24P31A42K4",
    "24P31A4453",
    "24P32A4290",
    "24B11CS118",
    "24P31A0539",
    "25P35A0540",
    "24B11AI305",
    "24B11AI335",
    "24B11DS129",
    "24P31A0531",
    "24B11CS491",
    "24B11AI133",
    "24B11AI216",
    "24P31A42G2",
    "24B11CS490",
    "24B11AI109",
    "24B11AI120",
    "24B11AI091",
    "24P31A4493",
    "24B11AI446",
    "24B11DS172",
    "24B11DS230",
    "24P31A0586",
    "24P31A4476",
    "24B11AI139",
    "24B11DS220",
    "24B11CS167",
    "24B11CS174",
    "24P31A42G8"
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
