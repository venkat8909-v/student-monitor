import React, { useEffect, useRef, useState } from 'react'

const WS_URL = `wss://student-monitor-production.up.railway.app/ws/dashboard`
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

export default function StudentViewPage() {
  const [stream, setStream] = useState(null)
  const [status, setStatus] = useState('Connecting...')
  const videoRef = useRef(null)
  const wsRef = useRef(null)
  const pcRef = useRef(null)

  const roll = new URLSearchParams(window.location.search).get('roll')

  useEffect(() => {
    if (!roll) { setStatus('No roll number specified.'); return }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus(`Connecting to ${roll}...`)
      ws.send(JSON.stringify({ type: 'request_offer', to: roll }))
    }

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data)

      if (msg.type === 'offer' && msg.from === roll) {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        pcRef.current = pc

        pc.ontrack = (e) => {
          if (e.streams[0]) {
            setStream(e.streams[0])
            setStatus('Live')
            if (videoRef.current) videoRef.current.srcObject = e.streams[0]
          }
        }

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            ws.send(JSON.stringify({ type: 'ice', to: roll, candidate: e.candidate }))
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        ws.send(JSON.stringify({ type: 'answer', to: roll, sdp: pc.localDescription }))
      }

      if (msg.type === 'ice' && msg.from === roll) {
        const pc = pcRef.current
        if (pc && msg.candidate) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
      }

      if (msg.type === 'student_left' && msg.roll_no === roll) {
        setStatus('Student disconnected')
        setStream(null)
      }
    }

    ws.onclose = () => setStatus('Connection lost')

    return () => {
      ws.close()
      pcRef.current?.close()
    }
  }, [roll])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.dot} />
          <span style={s.brand}>ClassMonitor</span>
          <span style={s.sep}>—</span>
          <span style={s.roll}>{roll}</span>
        </div>
        <div style={s.statusPill}>
          <span style={{ ...s.statusDot, background: stream ? '#3fb950' : '#8b949e' }} />
          <span style={{ fontSize: 12, color: stream ? '#3fb950' : '#8b949e', fontWeight: 500 }}>
            {status}
          </span>
        </div>
      </div>

      <div style={s.videoWrap}>
        {stream ? (
          <video ref={videoRef} autoPlay muted style={s.video} />
        ) : (
          <div style={s.waiting}>
            <div style={s.spinner} />
            <p style={s.waitText}>{status}</p>
            <p style={s.waitSub}>Waiting for {roll} to share their screen</p>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#0d1117' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px', background: '#161b22', borderBottom: '1px solid #21262d',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: '50%', background: '#2563eb', display: 'inline-block' },
  brand: { fontSize: 13, fontWeight: 600, color: '#8b949e' },
  sep: { color: '#30363d' },
  roll: { fontSize: 13, fontWeight: 600, color: '#e6edf3', fontFamily: 'monospace', letterSpacing: '0.06em' },
  statusPill: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid #30363d', borderRadius: 20, background: '#21262d' },
  statusDot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block' },
  videoWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
  video: { width: '100%', height: '100%', objectFit: 'contain' },
  waiting: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  spinner: { width: 32, height: 32, border: '3px solid #30363d', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  waitText: { fontSize: 16, fontWeight: 500, color: '#e6edf3' },
  waitSub: { fontSize: 13, color: '#8b949e' },
}
