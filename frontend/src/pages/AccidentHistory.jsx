import { useState } from 'react'
import AccidentTable from '../components/AccidentTable'
import Loading, { ErrorBox } from '../components/Loading'
import { accidentService } from '../services/accidentService'
import { useFetch } from '../hooks/useFetch'
import { useRealtime } from '../hooks/useRealtime'
import { useAuth } from '../hooks/useAuth'

const STATUSES = ['DETECTED', 'CANCELLED', 'EMERGENCY_DISPATCHED', 'RESOLVED', 'FALSE_ALARM']
const CLAIMS = ['NOT_INITIATED', 'SUBMITTED', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'SETTLED']

export default function AccidentHistory({ embedded = false }) {
  const { user } = useAuth()
  const [filters, setFilters] = useState({ vehicle_number: '', accident_id: '', date_from: '', date_to: '', status: '', claim_status: '' })
  const [applied, setApplied] = useState(filters)
  const [page, setPage] = useState(1)
  const { data, loading, error, reload, refresh } = useFetch(() => accidentService.list({
    ...applied, page, page_size: 15,
    date_from: applied.date_from ? new Date(applied.date_from).toISOString() : '',
    date_to: applied.date_to ? new Date(applied.date_to + 'T23:59:59').toISOString() : '',
  }), [applied, page])
  useRealtime(() => reload())
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div>
      {!embedded && <h1 className="mb-4 text-2xl font-bold">Accident history</h1>}
      <div className="card">
        <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(filters) }}>
          <input className="input" placeholder="Vehicle number" value={filters.vehicle_number} onChange={set('vehicle_number')} aria-label="Vehicle number" />
          <input className="input" placeholder="Accident ID" value={filters.accident_id} onChange={set('accident_id')} aria-label="Accident ID" />
          <input type="date" className="input" value={filters.date_from} onChange={set('date_from')} aria-label="From date" />
          <input type="date" className="input" value={filters.date_to} onChange={set('date_to')} aria-label="To date" />
          <select className="input" value={filters.status} onChange={set('status')} aria-label="Accident status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          {user.role !== 'FAMILY' && <select className="input" value={filters.claim_status} onChange={set('claim_status')} aria-label="Claim status"><option value="">All claim states</option>{CLAIMS.map((s) => <option key={s}>{s}</option>)}</select>}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
            <button className="btn-primary">Apply filters</button>
            <button type="button" className="btn-secondary" onClick={() => { const e = { vehicle_number: '', accident_id: '', date_from: '', date_to: '', status: '', claim_status: '' }; setFilters(e); setApplied(e); setPage(1) }}>Clear</button>
          </div>
        </form>
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={refresh} /> : (
          <>
            <AccidentTable items={data.items} showOwner={['ADMIN', 'INSURANCE'].includes(user.role)} showClaim={user.role !== 'FAMILY'} />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>{data.total} record(s)</span>
              <div className="flex items-center gap-2">
                <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                <span>Page {page} / {pages}</span>
                <button className="btn-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
