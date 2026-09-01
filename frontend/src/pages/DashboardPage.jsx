import React, { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = `wss://student-monitor-production.up.railway.app/ws/dashboard`
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const PAGE_SIZE = 15

export default function DashboardPage() {
  const [students, setStudents] = useState([])   // [{ roll_no, status }]
  const [streams, setStreams] = useState({})       // roll_no -> MediaStream
  const [page, setPage] = useState(0)
  const [wsReady, setWsReady] = useState(false)

  const wsRef = useRef(null)
  const peersRef = useRef({})   // roll_no -> RTCPeerConnection

  // ─── Connect dashboard WebSocket ──────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => setWsReady(true)

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data)

      if (msg.type === 'init' || msg.type === 'student_joined' || msg.type === 'student_left') {
        setStudents(msg.students || [])

        // Request offer from any new student we don't have yet
        if (msg.type === 'student_joined' || msg.type === 'init') {
          for (const s of (msg.students || [])) {
            if (!peersRef.current[s.roll_no]) {
              requestOffer(s.roll_no)
            }
          }
        }

        // Clean up peer for student who left
        if (msg.type === 'student_left') {
          const roll = msg.roll_no
          peersRef.current[roll]?.close()
          delete peersRef.current[roll]
          setStreams(prev => {
            const copy = { ...prev }
            delete copy[roll]
            return copy
          })
        }
      }

      // WebRTC signaling coming from student
      if (msg.type === 'offer') {
        await handleOffer(msg)
      }

      if (msg.type === 'ice') {
        const pc = peersRef.current[msg.from]
        if (pc && msg.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
        }
      }
    }

    ws.onclose = () => setWsReady(false)

    return () => ws.close()
  }, [])

  // ─── Ask student to send us their stream ──────────────────────────
  function requestOffer(roll) {
    wsRef.current?.send(JSON.stringify({ type: 'request_offer', to: roll }))
  }

  // ─── Handle incoming WebRTC offer from student ───────────────────
  async function handleOffer(msg) {
    const roll = msg.from
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    peersRef.current[roll] = pc

    pc.ontrack = (e) => {
      if (e.streams[0]) {
        setStreams(prev => ({ ...prev, [roll]: e.streams[0] }))
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        wsRef.current?.send(JSON.stringify({ type: 'ice', to: roll, candidate: e.candidate }))
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    wsRef.current?.send(JSON.stringify({ type: 'answer', to: roll, sdp: pc.localDescription }))
  }

  // ─── Maximize: open student in new tab ────────────────────────────
  function openStudentFull(roll) {
    window.open(`/student-view?roll=${roll}`, `student_${roll}`, 'width=1280,height=800')
  }

  // ─── Pagination ────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE))
  const pageStudents = students.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ─── Copy shareable URL ───────────────────────────────────────────
  function copyLink() {
    const url = `https://student-monitor-tau.vercel.app`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
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
              {students.length} student{students.length !== 1 ? 's' : ''} online
            </span>
          </div>
          <button style={s.copyBtn} onClick={copyLink}>
            {copied ? '✓ Copied' : '⎘ Share link'}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={s.gridWrap}>
        {pageStudents.length === 0 ? (
          <div style={s.empty}>
            <p style={s.emptyTitle}>Waiting for students</p>
            <p style={s.emptyHint}>Share <strong style={{ color: '#e6edf3' }}>https://student-monitor-tau.vercel.app</strong> with your students</p>
          </div>
        ) : (
          <div style={{
            ...s.grid,
            gridTemplateColumns: `repeat(${Math.min(pageStudents.length, 5)}, 1fr)`
          }}>
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
          <button
            style={{ ...s.pageBtn, opacity: page === 0 ? 0.3 : 1 }}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >◀</button>
          <span style={{ fontSize: 13, color: '#8b949e' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            style={{ ...s.pageBtn, opacity: page === totalPages - 1 ? 0.3 : 1 }}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
          >▶</button>
          <span style={{ fontSize: 12, color: '#8b949e', marginLeft: 8 }}>
            15 per page
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Individual student card ──────────────────────────────────────────
function StudentCard({ roll, stream, onMaximize }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
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
        <button style={sc.maxBtn} onClick={onMaximize} title="Open fullscreen">
          ⤢
        </button>
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

// ─── Styles ───────────────────────────────────────────────────────────
const s = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0d1117' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px', borderBottom: '1px solid #21262d',
    background: '#161b22', position: 'sticky', top: 0, zIndex: 10,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: '50%', background: '#2563eb', display: 'inline-block' },
  brand: { fontSize: 14, fontWeight: 600, color: '#8b949e' },
  dash: { color: '#30363d' },
  headerTitle: { fontSize: 14, fontWeight: 500, color: '#e6edf3' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  pill: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px solid #30363d', borderRadius: 20, background: '#21262d' },
  pillDot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block' },
  copyBtn: { padding: '6px 14px', background: '#2563eb', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' },
  gridWrap: { flex: 1, padding: '20px 20px 10px' },
  grid: { display: 'grid', gap: 12 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: 500, color: '#8b949e' },
  emptyHint: { fontSize: 14, color: '#8b949e' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid #21262d' },
  pageBtn: { background: '#21262d', border: '1px solid #30363d', color: '#e6edf3', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' },
}

const sc = {
  card: { background: '#161b22', border: '1px solid #21262d', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  videoWrap: { position: 'relative', background: '#000', aspectRatio: '16/9' },
  video: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
  placeholder: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#0d1117' },
  placeholderText: { fontSize: 12, color: '#8b949e' },
  spinner: { width: 20, height: 20, border: '2px solid #30363d', borderTop: '2px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  maxBtn: {
    position: 'absolute', top: 6, right: 6,
    background: 'rgba(0,0,0,0.6)', border: '1px solid #30363d',
    color: '#e6edf3', borderRadius: 5, width: 28, height: 28,
    fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px' },
  rollNo: { fontSize: 12, fontWeight: 600, color: '#e6edf3', fontFamily: 'monospace', letterSpacing: '0.04em' },
  badge: { fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 10, border: '1px solid' },
}
