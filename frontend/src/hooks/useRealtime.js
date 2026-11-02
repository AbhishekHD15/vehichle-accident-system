import { useEffect, useRef } from 'react'
import { tokenStore } from '../services/api'

const WS_URL = import.meta.env.VITE_WS_URL

/** Calls onEvent when the server pushes a hint over WebSocket; falls back to polling when the
 *  socket is unavailable. Handlers should simply re-fetch from the REST API. */
export function useRealtime(onEvent, pollMs = 20000) {
  const cb = useRef(onEvent)
  cb.current = onEvent
  useEffect(() => {
    let ws, poll, retry, closed = false, wsOk = false
    const startPolling = () => { if (!poll) poll = setInterval(() => cb.current({ type: 'poll' }), pollMs) }
    const stopPolling = () => { clearInterval(poll); poll = null }
    const connect = () => {
      if (!WS_URL || closed) return startPolling()
      try { ws = new WebSocket(WS_URL) } catch { return startPolling() }
      ws.onopen = () => ws.send(JSON.stringify({ token: tokenStore.access }))
      ws.onmessage = (m) => {
        const d = JSON.parse(m.data)
        if (d.type === 'ready') { wsOk = true; stopPolling() } else cb.current(d)
      }
      ws.onclose = () => { wsOk = false; if (!closed) { startPolling(); retry = setTimeout(connect, 15000) } }
      ws.onerror = () => ws.close()
    }
    connect()
    const ping = setInterval(() => { if (wsOk && ws.readyState === 1) ws.send('ping') }, 25000)
    return () => { closed = true; clearInterval(poll); clearInterval(ping); clearTimeout(retry); ws && ws.close() }
  }, [pollMs])
}
