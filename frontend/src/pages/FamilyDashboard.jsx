import { PhoneCall, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import LocationMap from '../components/LocationMap'
import StatusBadge from '../components/StatusBadge'
import Loading, { ErrorBox } from '../components/Loading'
import { dashboardService } from '../services/dashboardService'
import { useFetch } from '../hooks/useFetch'
import { useRealtime } from '../hooks/useRealtime'

export default function FamilyDashboard() {
  const { data, loading, error, reload, refresh } = useFetch(() => dashboardService.get('FAMILY'), [])
  useRealtime(() => reload(), 10000)

  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} onRetry={refresh} />

  const e = data.latest_accident
  const alert = e && e.accident_status === 'EMERGENCY_DISPATCHED'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-app-text">Emergency monitor</h1>
        <p className="text-xs text-app-muted mt-0.5">Real-time emergency tracking for family-shared vehicles</p>
      </div>

      {alert ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 shadow-soft">
          <ShieldAlert className="mt-0.5 text-semantic-danger flex-shrink-0" size={22} />
          <div>
            <div className="text-base font-bold text-semantic-danger">Possible accident detected</div>
            <p className="text-sm text-red-700 mt-1">
              Vehicle <b>{e.vehicle_number}</b> · {new Date(e.accident_date).toLocaleString()}. Contact the driver and call emergency services if help is needed.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm font-medium text-semantic-success shadow-soft">
          ✓ No active emergency on vehicles shared with you.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold text-app-text">Latest event</h2>
          {e ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-mono font-semibold text-app-text">{e.accident_id}</span>
                <StatusBadge status={e.accident_status} />
              </div>
              <p className="text-xs text-app-muted">
                Vehicle <b className="text-app-text">{e.vehicle_number}</b> · {new Date(e.accident_date).toLocaleString()}
              </p>
              <div className="overflow-hidden rounded-xl border border-app-border">
                <LocationMap accident={e} height={240} />
              </div>
              <div className="pt-1">
                <Link className="text-xs font-semibold text-primary hover:underline" to={`/accidents/${e.accident_id}`}>
                  Event details &amp; SMS status &rarr;
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-app-muted py-8 text-center">No events have been reported.</p>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold text-app-text">Shared vehicles &amp; emergency contact</h2>
          {data.vehicles.length ? (
            <ul className="divide-y divide-app-border">
              {data.vehicles.map((v) => (
                <li key={v.id} className="py-3 text-sm">
                  <div className="font-semibold text-app-text">
                    {v.vehicle_number} <span className="font-normal text-app-muted text-xs">({v.vehicle_model})</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-app-muted">
                    <PhoneCall size={14} className="text-primary" />
                    <span>{v.owner_name}</span>
                    {v.owner_phone ? (
                      <a className="font-medium text-primary hover:underline" href={`tel:${v.owner_phone}`}>
                        {v.owner_phone}
                      </a>
                    ) : (
                      ' (no phone on file)'
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-app-muted py-8 text-center">
              No vehicles have been shared with you yet. Ask the owner to share a vehicle using your account email.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
