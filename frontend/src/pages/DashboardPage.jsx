import React, { useState, useEffect, useRef } from 'react'

const WS_URL = `wss://student-monitor-production.up.railway.app/ws/dashboard`
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const PAGE_SIZE = 15

// ─── Full roll number list — edit this to match your class ────────────
const ALL_ROLL_NUMBERS = [
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
]

export default function DashboardPage() {
  const [students, setStudents] = useState([])
  const [streams, setStreams] = useState({})
  const [page, setPage] = useState(0)
  const [wsReady, setWsReady] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const wsRef = useRef(null)
  const peersRef = useRef({})

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    ws.onopen = () => setWsReady(true)
    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'init' || msg.type === 'student_joined' || msg.type === 'student_left') {
        setStudents(msg.students || [])
        if (msg.type === 'student_joined' || msg.type === 'init') {
          for (const s of (msg.students || [])) {
            if (!peersRef.current[s.roll_no]) requestOffer(s.roll_no)
          }
        }
        if (msg.type === 'student_left') {
          const roll = msg.roll_no
          peersRef.current[roll]?.close()
          delete peersRef.current[roll]
          setStreams(prev => { const c = { ...prev }; delete c[roll]; return c })
        }
      }
      if (msg.type === 'offer') await handleOffer(msg)
      if (msg.type === 'ice') {
        const pc = peersRef.current[msg.from]
        if (pc && msg.candidate) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
      }
    }
    ws.onclose = () => setWsReady(false)
    return () => ws.close()
  }, [])

  function requestOffer(roll) {
    wsRef.current?.send(JSON.stringify({ type: 'request_offer', to: roll }))
  }

  async function handleOffer(msg) {
    const roll = msg.from
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    peersRef.current[roll] = pc
    pc.ontrack = (e) => {
      if (e.streams[0]) setStreams(prev => ({ ...prev, [roll]: e.streams[0] }))
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) wsRef.current?.send(JSON.stringify({ type: 'ice', to: roll, candidate: e.candidate }))
    }
    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    wsRef.current?.send(JSON.stringify({ type: 'answer', to: roll, sdp: pc.localDescription }))
  }

  function openStudentFull(roll) {
    window.open(`/student-view?roll=${roll}`, `student_${roll}`, 'width=1280,height=800')
  }

  function copyLink() {
    navigator.clipboard.writeText(`https://student-monitor-sigma.vercel.app`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── Inactive = in ALL_ROLL_NUMBERS but not in active students ────
  const activeRolls = new Set(students.map(s => s.roll_no))
  const inactiveStudents = ALL_ROLL_NUMBERS.filter(r => !activeRolls.has(r))

  const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE))
  const pageStudents = students.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.dot} />
          <span style={s.brand}>ClassMonitor</span>
          <span style={s.dash}>—</span>
          <span style={s.headerTitle}>Mentor Dashboard</span>
        </div>
        <div style={s.headerRight}>
          <div style={{ ...s.pill, background: wsReady ? '#1a3a1a' : '#3a1a1a', borderColor: wsReady ? '#238636' : '#da3633' }}>
            <span style={{ ...s.pillDot, background: wsReady ? '#3fb950' : '#f85149' }} />
            <span style={{ color: wsReady ? '#3fb950' : '#f85149', fontSize: 12, fontWeight: 500 }}>
              {wsReady ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div style={s.pill}>
            <span style={{ fontSize: 12, color: '#8b949e' }}>
              {students.length} active
            </span>
          </div>
          {/* Inactive button */}
          <button
            style={{
              ...s.inactiveBtn,
              background: showInactive ? '#3a1a1a' : '#21262d',
              borderColor: showInactive ? '#da3633' : '#30363d',
              color: showInactive ? '#f85149' : '#8b949e',
            }}
            onClick={() => setShowInactive(v => !v)}
          >
            ● {inactiveStudents.length} not joined
          </button>
          <button style={s.copyBtn} onClick={copyLink}>
            {copied ? '✓ Copied' : '⎘ Share link'}
          </button>
        </div>
      </div>

      {/* Inactive panel */}
      {showInactive && (
        <div style={s.inactivePanel}>
          <div style={s.inactivePanelHeader}>
            <span style={s.inactivePanelTitle}>
              Students who haven't joined yet ({inactiveStudents.length})
            </span>
            <button style={s.closeBtn} onClick={() => setShowInactive(false)}>✕</button>
          </div>
          {inactiveStudents.length === 0 ? (
            <p style={s.allJoined}>🎉 All students have joined!</p>
          ) : (
            <div style={s.inactiveGrid}>
              {inactiveStudents.map(roll => (
                <div key={roll} style={s.inactiveChip}>
                  <span style={s.inactiveDot} />
                  <span style={s.inactiveRoll}>{roll}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active grid */}
      <div style={s.gridWrap}>
        {pageStudents.length === 0 ? (
          <div style={s.empty}>
            <p style={s.emptyTitle}>Waiting for students</p>
            <p style={s.emptyHint}>Share <strong style={{ color: '#e6edf3' }}>https://student-monitor-sigma.vercel.app</strong> with your students</p>
          </div>
        ) : (
          <div style={{ ...s.grid, gridTemplateColumns: `repeat(${Math.min(pageStudents.length, 5)}, 1fr)` }}>
            {pageStudents.map(student => (
              <StudentCard
                key={student.roll_no}
                roll={student.roll_no}
                stream={streams[student.roll_no]}
                onMaximize={() => openStudentFull(student.roll_no)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          <button style={{ ...s.pageBtn, opacity: page === 0 ? 0.3 : 1 }} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>◀</button>
          <span style={{ fontSize: 13, color: '#8b949e' }}>Page {page + 1} of {totalPages}</span>
          <button style={{ ...s.pageBtn, opacity: page === totalPages - 1 ? 0.3 : 1 }} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>▶</button>
          <span style={{ fontSize: 12, color: '#8b949e', marginLeft: 8 }}>15 per page</span>
        </div>
      )}
    </div>
  )
}

function StudentCard({ roll, stream, onMaximize }) {
  const videoRef = useRef(null)
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream
  }, [stream])

  return (
    <div style={sc.card}>
      <div style={sc.videoWrap}>
        {stream ? (
          <video ref={videoRef} autoPlay muted style={sc.video} />
        ) : (
          <div style={sc.placeholder}>
            <div style={sc.spinner} />
            <span style={sc.placeholderText}>Connecting…</span>
          </div>
        )}
        <button style={sc.maxBtn} onClick={onMaximize} title="Open fullscreen">⤢</button>
      </div>
      <div style={sc.footer}>
        <span style={sc.rollNo}>{roll}</span>
        <span style={{ ...sc.badge, background: stream ? '#1a3a1a' : '#21262d', color: stream ? '#3fb950' : '#8b949e', borderColor: stream ? '#238636' : '#30363d' }}>
          {stream ? '● Live' : '○ Connecting'}
        </span>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0d1117' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #21262d', background: '#161b22', position: 'sticky', top: 0, zIndex: 10 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: '50%', background: '#2563eb', display: 'inline-block' },
  brand: { fontSize: 14, fontWeight: 600, color: '#8b949e' },
  dash: { color: '#30363d' },
  headerTitle: { fontSize: 14, fontWeight: 500, color: '#e6edf3' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  pill: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px solid #30363d', borderRadius: 20, background: '#21262d' },
  pillDot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block' },
  inactiveBtn: { padding: '5px 12px', border: '1px solid', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' },
  copyBtn: { padding: '6px 14px', background: '#2563eb', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  inactivePanel: { background: '#161b22', borderBottom: '1px solid #21262d', padding: '14px 24px' },
  inactivePanelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  inactivePanelTitle: { fontSize: 13, fontWeight: 500, color: '#f85149' },
  closeBtn: { background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' },
  allJoined: { fontSize: 13, color: '#3fb950' },
  inactiveGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  inactiveChip: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#21262d', border: '1px solid #30363d', borderRadius: 20 },
  inactiveDot: { width: 6, height: 6, borderRadius: '50%', background: '#8b949e', display: 'inline-block' },
  inactiveRoll: { fontSize: 12, fontWeight: 600, color: '#8b949e', fontFamily: 'monospace' },
  gridWrap: { flex: 1, padding: '20px 20px 10px' },
  grid: { display: 'grid', gap: 12 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: 500, color: '#8b949e' },
  emptyHint: { fontSize: 14, color: '#8b949e' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid #21262d' },
  pageBtn: { background: '#21262d', border: '1px solid #30363d', color: '#e6edf3', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
}

const sc = {
  card: { background: '#161b22', border: '1px solid #21262d', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  videoWrap: { position: 'relative', background: '#000', aspectRatio: '16/9' },
  video: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
  placeholder: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#0d1117' },
  placeholderText: { fontSize: 12, color: '#8b949e' },
  spinner: { width: 20, height: 20, border: '2px solid #30363d', borderTop: '2px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  maxBtn: { position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: '1px solid #30363d', color: '#e6edf3', borderRadius: 5, width: 28, height: 28, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', fontFamily: 'inherit' },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px' },
  rollNo: { fontSize: 12, fontWeight: 600, color: '#e6edf3', fontFamily: 'monospace', letterSpacing: '0.04em' },
  badge: { fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 10, border: '1px solid' },
}
