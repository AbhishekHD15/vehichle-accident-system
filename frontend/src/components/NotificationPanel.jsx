import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { Empty } from './Loading'
import { notificationService } from '../services/notificationService'
import { errMsg } from '../services/api'

export default function NotificationPanel({ items, canRetry, onChanged }) {
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')
  if (!items?.length) return <Empty>No notifications recorded for this event.</Empty>
  const retry = async (id) => {
    setBusy(id); setErr('')
    try { await notificationService.retry(id); onChanged?.() } catch (e) { setErr(errMsg(e)) } finally { setBusy(null) }
  }
  return (
    <div>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <ul className="divide-y divide-slate-100">
        {items.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <div className="text-sm font-medium">{n.recipient_type} · {n.notification_type} · {n.recipient_phone}</div>
              <div className="text-xs text-slate-500">
                {n.sent_at ? `Sent ${new Date(n.sent_at).toLocaleString()}` : 'Not sent yet'} · attempts: {n.retry_count}
                {n.retry_requested && ' · retry requested (vehicle will retry when online)'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={n.delivery_status} />
              {canRetry && n.delivery_status !== 'DELIVERED' && !n.retry_requested && (
                <button className="btn-secondary !px-2 !py-1" disabled={busy === n.id} onClick={() => retry(n.id)}>
                  <RefreshCw size={14} /> Retry
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
