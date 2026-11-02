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
      <h1 className="text-2xl font-bold">Emergency monitor</h1>
      {alert ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border-2 border-red-300 bg-red-50 p-5">
          <ShieldAlert className="mt-1 text-red-600" />
          <div><div className="text-lg font-bold text-red-800">Possible accident detected</div>
            <p className="text-sm text-red-700">{e.vehicle_number} · {new Date(e.accident_date).toLocaleString()}. Contact the driver and call emergency services if help is needed.</p></div>
        </div>
      ) : <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">No active emergency on vehicles shared with you.</div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Latest event</h2>
          {e ? (<div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="font-mono">{e.accident_id}</span><StatusBadge status={e.accident_status} /></div>
            <p className="text-sm">Vehicle <b>{e.vehicle_number}</b><br />{new Date(e.accident_date).toLocaleString()}</p>
            <LocationMap accident={e} height={240} />
            <Link className="text-sm text-blue-600 underline" to={`/accidents/${e.accident_id}`}>Event details &amp; SMS status</Link>
          </div>) : <p className="text-sm text-slate-500">No events have been reported.</p>}
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Shared vehicles &amp; emergency contact</h2>
          {data.vehicles.length ? <ul className="divide-y divide-slate-100">{data.vehicles.map((v) => (
            <li key={v.id} className="py-3 text-sm">
              <div className="font-semibold">{v.vehicle_number} <span className="font-normal text-slate-500">{v.vehicle_model}</span></div>
              <div className="mt-1 flex items-center gap-2 text-slate-600"><PhoneCall size={14} /> {v.owner_name}{v.owner_phone ? <a className="text-blue-600 underline" href={`tel:${v.owner_phone}`}>{v.owner_phone}</a> : ' (no phone on file)'}</div>
            </li>))}</ul>
          : <p className="text-sm text-slate-500">No vehicles have been shared with you yet. Ask the owner to share a vehicle using your account email.</p>}
        </div>
      </div>
    </div>
  )
}
