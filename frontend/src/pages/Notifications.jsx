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
  const { data, loading, error, reload, refresh } = useFetch(() => notificationService.list({ status, page_size: 50 }), [status])
  useRealtime(() => reload())
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by delivery status">
          <option value="">All statuses</option>{['PENDING', 'SUBMITTED', 'DELIVERED', 'FAILED', 'UNKNOWN'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <p className="mb-3 text-sm text-slate-500">“Submitted” means the modem accepted the SMS; “Delivered” is only shown when the network returned a delivery report. Status is reported by the vehicle device and cannot be edited here.</p>
      <div className="card">
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={refresh} /> : (
          <>
            <NotificationPanel items={data.items} canRetry={['OWNER', 'ADMIN'].includes(user.role)} onChanged={reload} />
            {data.items.length > 0 && <p className="mt-3 text-xs text-slate-500">Open an accident (<Link className="underline" to="/accidents">Accident history</Link>) to see which event each notification belongs to.</p>}
          </>
        )}
      </div>
    </div>
  )
}
