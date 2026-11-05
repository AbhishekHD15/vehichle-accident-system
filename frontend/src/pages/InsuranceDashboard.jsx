import { AlertTriangle, Car, CheckCircle, Clock, FileText, XCircle, BadgeCheck, ChevronRight } from 'lucide-react'
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
  useRealtime(() => {
    d.reload()
    a.reload()
  })

  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox message={d.error} onRetry={d.refresh} />
  const s = d.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-app-text">Insurance dashboard</h1>
        <p className="text-xs text-app-muted mt-0.5">{s.organization || 'Insurance Partner Portal'}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Car} tone="primary" label="Insured vehicles" value={s.total_vehicles} />
        <StatCard icon={AlertTriangle} tone="red" label="Accident events" value={s.total_accidents} />
        <StatCard icon={AlertTriangle} tone="amber" label="New accident alerts (7 days)" value={s.new_accident_notifications} />
        <StatCard icon={Clock} tone="amber" label="Pending claims" value={s.pending_claims} />
        <StatCard icon={CheckCircle} tone="green" label="Approved claims" value={s.approved_claims} />
        <StatCard icon={XCircle} tone="red" label="Rejected claims" value={s.rejected_claims} />
        <StatCard icon={BadgeCheck} tone="green" label="Settled claims" value={s.settled_claims} />
        <Link
          to="/claims"
          className="card flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-all duration-150 border-primary/30 group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-primary border border-teal-100">
              <FileText size={20} />
            </div>
            <span className="font-semibold text-app-text group-hover:text-primary transition-colors text-sm">
              Open claims
            </span>
          </div>
          <ChevronRight size={18} className="text-app-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-app-text">Accident management</h2>
          <Link to="/accidents" className="text-xs font-semibold text-primary hover:underline">
            View all accidents &rarr;
          </Link>
        </div>
        {a.loading ? (
          <Loading />
        ) : a.error ? (
          <ErrorBox message={a.error} />
        ) : (
          <AccidentTable items={a.data.items} showOwner />
        )}
      </div>
    </div>
  )
}
