import { AlertTriangle, Car, CheckCircle, Clock, FileText, XCircle, BadgeCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatCard from '../components/StatCard'
import AccidentTable from '../components/AccidentTable'
import Loading, { ErrorBox } from '../components/Loading'
import { accidentService } from '../services/accidentService'
import { dashboardService } from '../services/dashboardService'
import { useFetch } from '../hooks/useFetch'
import { useRealtime } from '../hooks/useRealtime'

export default function InsuranceDashboard() {
  const d = useFetch(() => dashboardService.get('INSURANCE'), [])
  const a = useFetch(() => accidentService.list({ page_size: 10 }), [])
  useRealtime(() => { d.reload(); a.reload() })
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox message={d.error} onRetry={d.refresh} />
  const s = d.data
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Insurance dashboard</h1><p className="text-sm text-slate-500">{s.organization}</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Car} label="Insured vehicles" value={s.total_vehicles} />
        <StatCard icon={AlertTriangle} tone="red" label="Accident events" value={s.total_accidents} />
        <StatCard icon={AlertTriangle} tone="amber" label="New accident alerts (7 days)" value={s.new_accident_notifications} />
        <StatCard icon={Clock} tone="amber" label="Pending claims" value={s.pending_claims} />
        <StatCard icon={CheckCircle} tone="green" label="Approved claims" value={s.approved_claims} />
        <StatCard icon={XCircle} tone="red" label="Rejected claims" value={s.rejected_claims} />
        <StatCard icon={BadgeCheck} tone="green" label="Settled claims" value={s.settled_claims} />
        <Link to="/claims" className="card flex items-center gap-3 hover:bg-slate-50"><FileText className="text-blue-600" /><span className="font-medium">Open claim management →</span></Link>
      </div>
      <div className="card"><h2 className="mb-3 font-semibold">Accident management</h2>
        {a.loading ? <Loading /> : a.error ? <ErrorBox message={a.error} /> : <AccidentTable items={a.data.items} showOwner />}
        <div className="mt-3 text-right"><Link to="/accidents" className="text-sm text-blue-600 hover:underline">View all accidents</Link></div>
      </div>
    </div>
  )
}
