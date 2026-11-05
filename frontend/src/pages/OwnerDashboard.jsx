import { AlertTriangle, Car, FileText, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import LocationMap from '../components/LocationMap'
import Loading, { ErrorBox } from '../components/Loading'
import AccidentHistory from './AccidentHistory'
import { dashboardService } from '../services/dashboardService'
import { useFetch } from '../hooks/useFetch'
import { useRealtime } from '../hooks/useRealtime'

export default function OwnerDashboard() {
  const { data, loading, error, reload, refresh } = useFetch(() => dashboardService.get('OWNER'), [])
  useRealtime(() => reload())
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} onRetry={refresh} />
  const la = data.latest_accident
  const cc = data.claim_status_counts, nc = data.notification_status_counts
  const claimText = Object.keys(cc).length ? Object.entries(cc).map(([k, v]) => `${v} ${k.replace('_', ' ').toLowerCase()}`).join(', ') : 'No claims'
  const notifText = Object.keys(nc).length ? Object.entries(nc).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ') : 'No notifications'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-app-text">Owner dashboard</h1>
        <p className="text-xs text-app-muted mt-0.5">Overview of registered vehicles, telematics alerts, and active claims</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Car} tone="primary" label="Registered vehicles" value={data.total_vehicles} />
        <StatCard icon={AlertTriangle} tone="red" label="Accident events" value={data.total_accidents} />
        <StatCard icon={FileText} tone="amber" label="Insurance claims" value={claimText} />
        <StatCard icon={Mail} tone="green" label="Family / insurer SMS" value={notifText} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold text-app-text">Latest accident</h2>
          {la ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <Link className="font-mono font-semibold text-primary hover:underline" to={`/accidents/${la.accident_id}`}>
                  {la.accident_id}
                </Link>
                <StatusBadge status={la.accident_status} />
              </div>
              <p className="text-xs text-app-muted">
                {la.vehicle_number} · {new Date(la.accident_date).toLocaleString()} · claim: {la.claim_status.replace('_', ' ')}
              </p>
              <div className="overflow-hidden rounded-xl border border-app-border">
                <LocationMap accident={la} height={220} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-app-muted py-8 text-center">No accidents recorded. Your vehicles are safe and clear.</p>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold text-app-text">Accidents per month</h2>
          {data.accidents_by_month.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.accidents_by_month}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
                  }}
                />
                <Bar dataKey="count" fill="#0F766E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-app-muted py-8 text-center">No data recorded for the last six months.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-app-text">Your vehicles</h2>
          <Link to="/vehicles" className="text-xs font-semibold text-primary hover:underline">
            Manage &rarr;
          </Link>
        </div>
        {data.vehicles.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.vehicles.map((v) => (
              <Link
                key={v.id}
                to={`/vehicles/${v.id}`}
                className="rounded-xl border border-app-border p-3.5 hover:bg-slate-50/80 transition-all duration-150 shadow-soft"
              >
                <div className="font-semibold text-app-text">{v.vehicle_number}</div>
                <div className="text-xs text-app-muted mt-0.5">
                  {v.vehicle_model || 'Model not set'} · {v.insurance_company || 'No insurer'} · device {v.device_id || 'not linked'}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-app-muted">
            No vehicles yet.{' '}
            <Link className="font-medium text-primary underline" to="/vehicles">
              Register your first vehicle
            </Link>
            .
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold tracking-tight text-app-text">Accident history</h2>
        <AccidentHistory embedded />
      </div>
    </div>
  )
}
