import React, { useState, useRef, useEffect } from 'react'

// Change to (deployed)
const WS_URL = `wss://student-monitor-production.up.railway.app/ws/student`
const API_URL = `https://student-monitor-production.up.railway.app`

// ─── ICE servers (STUN only — works on local network) ──────────────────
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

export default function StudentPage() {
  const [step, setStep] = useState('login')   // login | sharing | error
  const [rollNo, setRollNo] = useState('')
  const [inputVal, setInputVal] = useState('')
  const [error, setError] = useState('')
  const [stream, setStream] = useState(null)

  const wsRef = useRef(null)
  const peersRef = useRef({})   // dashboardId -> RTCPeerConnection
  const videoRef = useRef(null)

  // ─── Validate roll number ──────────────────────────────────────────
  async function handleLogin() {
    const val = inputVal.trim().toUpperCase()
    if (!val) { setError('Please enter your roll number.'); return }
    setError('')

    try {
      const res = await fetch(`${API_URL}/validate/${val}`)
      const data = await res.json()
      if (!data.valid) {
        setError('Invalid roll number. Please check and try again.')
        return
      }
      setRollNo(val)
      startScreenShare(val)
    } catch {
      setError('Cannot reach server. Make sure you are on the class WiFi.')
    }
  }

  // ─── Screen share ──────────────────────────────────────────────────
  async function startScreenShare(roll) {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15, cursor: 'always' },
        audio: false,
      })

      setStream(mediaStream)
      if (videoRef.current) videoRef.current.srcObject = mediaStream

      // Connect to signaling server
      const ws = new WebSocket(`${WS_URL}/${roll}`)
      wsRef.current = ws

      ws.onopen = () => setStep('sharing')

      ws.onmessage = async (e) => {
        const msg = JSON.parse(e.data)
        await handleSignal(msg, mediaStream)
      }

      ws.onclose = () => {
        if (step === 'sharing') setStep('error')
      }

      // When user stops sharing from browser's own button
      mediaStream.getVideoTracks()[0].onended = () => {
        setStep('stopped')
        ws.close()
      }

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Screen share permission denied. Please allow screen sharing.')
      } else {
        setError('Could not start screen share: ' + err.message)
      }
    }
  }

  // ─── WebRTC signaling ──────────────────────────────────────────────
  async function handleSignal(msg, mediaStream) {
    const { type, from: dashId } = msg

    if (type === 'request_offer') {
      // Dashboard wants to view this student — create peer + offer
      const pc = createPeer(dashId, mediaStream)
      peersRef.current[dashId] = pc

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      wsRef.current.send(JSON.stringify({ type: 'offer', to: dashId, sdp: pc.localDescription }))
    }

    if (type === 'answer') {
      const pc = peersRef.current[dashId]
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
    }

    if (type === 'ice') {
      const pc = peersRef.current[dashId]
      if (pc && msg.candidate) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
    }
  }

  function createPeer(dashId, mediaStream) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    mediaStream.getTracks().forEach(track => pc.addTrack(track, mediaStream))

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        wsRef.current?.send(JSON.stringify({ type: 'ice', to: dashId, candidate: e.candidate }))
      }
    }

    return pc
  }

  // ─── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      wsRef.current?.close()
      stream?.getTracks().forEach(t => t.stop())
      Object.values(peersRef.current).forEach(pc => pc.close())
    }
  }, [])

  // ─── UI ───────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.dot} />
          <span style={styles.brand}>ClassMonitor</span>
        </div>

        {step === 'login' && (
          <>
            <h1 style={styles.title}>Join Session</h1>
            <p style={styles.subtitle}>Enter your roll number to begin. You will be asked to share your screen.</p>
            <input
              style={{ ...styles.input, borderColor: error ? '#da3633' : '#30363d' }}
              placeholder="e.g. 20A91A0481"
              value={inputVal}
              onChange={e => { setInputVal(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btn} onClick={handleLogin}>
              Continue →
            </button>
            <p style={styles.hint}>Your screen will be visible to your instructor only.</p>
          </>
        )}

        {step === 'sharing' && (
          <>
            <div style={styles.liveRow}>
              <span style={styles.liveDot} />
              <span style={styles.liveText}>Live</span>
            </div>
            <h1 style={styles.title}>You're sharing</h1>
            <p style={styles.subtitle}>Roll no: <strong style={{ color: '#e6edf3' }}>{rollNo}</strong></p>
            <video
              ref={videoRef}
              autoPlay
              muted
              style={styles.preview}
            />
            <p style={styles.hint}>Your instructor can see your screen. Keep this tab open.</p>
            <button
              style={{ ...styles.btn, background: '#da3633' }}
              onClick={() => {
                stream?.getTracks().forEach(t => t.stop())
                wsRef.current?.close()
                setStep('stopped')
              }}
            >
              Stop sharing
            </button>
          </>
        )}

        {step === 'stopped' && (
          <>
            <h1 style={styles.title}>Sharing stopped</h1>
            <p style={styles.subtitle}>You have stopped sharing your screen.</p>
            <button style={styles.btn} onClick={() => window.location.reload()}>
              Share again
            </button>
          </>
        )}

        {step === 'error' && (
          <>
            <h1 style={styles.title}>Connection lost</h1>
            <p style={styles.subtitle}>Lost connection to server. Check your WiFi.</p>
            <button style={styles.btn} onClick={() => window.location.reload()}>
              Reconnect
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: '20px',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#2563eb',
    display: 'inline-block',
  },
  brand: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.02em',
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    color: 'var(--text)',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  input: {
    background: 'var(--bg)',
    border: '1px solid',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 15,
    color: 'var(--text)',
    fontFamily: 'var(--font)',
    outline: 'none',
    width: '100%',
    letterSpacing: '0.04em',
  },
  error: {
    fontSize: 13,
    color: '#f85149',
    marginTop: -8,
  },
  btn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 20px',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    width: '100%',
  },
  hint: {
    fontSize: 12,
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  liveRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#3fb950',
    display: 'inline-block',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  liveText: {
    fontSize: 12,
    fontWeight: 600,
    color: '#3fb950',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  preview: {
    width: '100%',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: '#000',
    aspectRatio: '16/9',
    objectFit: 'contain',
  },
}
