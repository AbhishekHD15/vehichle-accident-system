import { useState } from 'react'
import { Link } from 'react-router-dom'
import NotificationPanel from '../components/NotificationPanel'
import Loading, { ErrorBox } from '../components/Loading'
import { notificationService } from '../services/notificationService'
import { useFetch } from '../hooks/useFetch'
import { useRealtime } from '../hooks/useRealtime'
import { useAuth } from '../hooks/useAuth'

export default function Notifications() {
  const { user } = useAuth()
  const [status, setStatus] = useState('')
  const { data, loading, error, reload, refresh } = useFetch(
    () => notificationService.list({ status, page_size: 50 }),
    [status]
  )
  useRealtime(() => reload())

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-app-text">Notifications</h1>
          <p className="text-xs text-app-muted mt-0.5">
            Real-time SMS alerts and emergency dispatch delivery audit log
          </p>
        </div>
        <select
          className="input w-auto text-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by delivery status"
        >
          <option value="">All statuses</option>
          {['PENDING', 'SUBMITTED', 'DELIVERED', 'FAILED', 'UNKNOWN'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorBox message={error} onRetry={refresh} />
        ) : (
          <>
            <NotificationPanel
              items={data.items}
              canRetry={['OWNER', 'ADMIN'].includes(user.role)}
              onChanged={reload}
            />
            {data.items.length > 0 && (
              <p className="mt-4 text-xs text-app-muted border-t border-app-border pt-3">
                Open an incident in{' '}
                <Link className="font-semibold text-primary hover:underline" to="/accidents">
                  Accident history
                </Link>{' '}
                to see which event each notification belongs to.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
