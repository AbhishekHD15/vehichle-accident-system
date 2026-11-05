import { useState } from 'react'
import { RefreshCw, Bell } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { Empty } from './Loading'
import { notificationService } from '../services/notificationService'
import { errMsg } from '../services/api'

export default function NotificationPanel({ items, canRetry, onChanged }) {
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')

  if (!items?.length) {
    return (
      <Empty icon={Bell} title="No notifications recorded">
        No notifications have been triggered for this event.
      </Empty>
    )
  }

  const retry = async (id) => {
    setBusy(id)
    setErr('')
    try {
      await notificationService.retry(id)
      onChanged?.()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      {err && (
        <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-semantic-danger">
          {err}
        </div>
      )}
      <ul className="divide-y divide-app-border">
        {items.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
            <div>
              <div className="text-sm font-semibold text-app-text">
                {n.recipient_type} · {n.notification_type} · <span className="font-mono text-xs">{n.recipient_phone}</span>
              </div>
              <div className="text-xs text-app-muted mt-0.5">
                {n.sent_at ? `Sent ${new Date(n.sent_at).toLocaleString()}` : 'Not sent yet'} · attempts: {n.retry_count}
                {n.retry_requested && ' · retry requested (vehicle will retry when online)'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={n.delivery_status} />
              {canRetry && n.delivery_status !== 'DELIVERED' && !n.retry_requested && (
                <button
                  className="btn-secondary !px-2.5 !py-1 text-xs"
                  disabled={busy === n.id}
                  onClick={() => retry(n.id)}
                >
                  <RefreshCw size={13} className={busy === n.id ? 'animate-spin' : ''} /> Retry
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
