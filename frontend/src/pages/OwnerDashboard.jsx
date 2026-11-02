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
      <h1 className="text-2xl font-bold">Owner dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Car} label="Registered vehicles" value={data.total_vehicles} />
        <StatCard icon={AlertTriangle} tone="red" label="Accident events" value={data.total_accidents} />
        <StatCard icon={FileText} tone="amber" label="Insurance claims" value={claimText} />
        <StatCard icon={Mail} tone="green" label="Family / insurer SMS" value={notifText} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Latest accident</h2>
          {la ? (<div className="space-y-3">
            <div className="flex items-center justify-between text-sm"><Link className="font-mono text-blue-600 underline" to={`/accidents/${la.accident_id}`}>{la.accident_id}</Link><StatusBadge status={la.accident_status} /></div>
            <p className="text-sm text-slate-500">{la.vehicle_number} · {new Date(la.accident_date).toLocaleString()} · claim: {la.claim_status.replace('_', ' ')}</p>
            <LocationMap accident={la} height={220} />
          </div>) : <p className="text-sm text-slate-500">No accidents recorded. Your vehicles are not reporting any events.</p>}
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Accidents per month</h2>
          {data.accidents_by_month.length ? (
            <ResponsiveContainer width="100%" height={260}><BarChart data={data.accidents_by_month}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#2563eb" /></BarChart></ResponsiveContainer>
          ) : <p className="text-sm text-slate-500">No data for the last six months.</p>}
        </div>
      </div>
      <div className="card">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Your vehicles</h2><Link to="/vehicles" className="text-sm text-blue-600 hover:underline">Manage</Link></div>
        {data.vehicles.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.vehicles.map((v) => (
            <Link key={v.id} to={`/vehicles/${v.id}`} className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <div className="font-semibold">{v.vehicle_number}</div>
              <div className="text-xs text-slate-500">{v.vehicle_model || 'Model not set'} · {v.insurance_company || 'No insurer'} · device {v.device_id || 'not linked'}</div>
            </Link>))}</div>
        ) : <p className="text-sm text-slate-500">No vehicles yet. <Link className="text-blue-600 underline" to="/vehicles">Register your first vehicle</Link>.</p>}
      </div>
      <div><h2 className="mb-3 text-lg font-semibold">Accident history</h2><AccidentHistory embedded /></div>
    </div>
  )
}
