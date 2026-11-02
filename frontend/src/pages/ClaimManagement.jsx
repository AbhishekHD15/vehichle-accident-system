import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import LocationMap from '../components/LocationMap'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import Loading, { Empty, ErrorBox } from '../components/Loading'
import { claimService } from '../services/claimService'
import { errMsg } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { useRealtime } from '../hooks/useRealtime'
import { useAuth } from '../hooks/useAuth'

const NEXT = { SUBMITTED: ['IN_PROGRESS', 'APPROVED', 'REJECTED'], IN_PROGRESS: ['APPROVED', 'REJECTED'], APPROVED: ['SETTLED'], REJECTED: ['IN_PROGRESS'], SETTLED: [] }

function ClaimDetail({ claimId }) {
  const { user } = useAuth()
  const c = useFetch(() => claimService.get(claimId), [claimId])
  const h = useFetch(() => claimService.history(claimId), [claimId])
  useRealtime(() => { c.reload(); h.reload() })
  const [form, setForm] = useState({ claim_status: '', remarks: '', rejection_reason: '' })
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState(null)
  if (c.loading) return <Loading />
  if (c.error) return <ErrorBox message={c.error} onRetry={c.refresh} />
  const x = c.data
  const canReview = ['INSURANCE', 'ADMIN'].includes(user.role) && NEXT[x.claim_status]?.length > 0
  const go = async () => {
    setConfirm(false); setMsg(null)
    try {
      await claimService.updateStatus(claimId, { claim_status: form.claim_status, remarks: form.remarks || null, rejection_reason: form.claim_status === 'REJECTED' ? form.rejection_reason : null })
      setForm({ claim_status: '', remarks: '', rejection_reason: '' }); setMsg({ ok: true, t: 'Claim updated.' }); c.reload(); h.reload()
    } catch (e) { setMsg({ ok: false, t: errMsg(e) }) }
  }
  const row = (k, v) => <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm"><span className="text-slate-500">{k}</span><span className="text-right font-medium">{v ?? '—'}</span></div>
  return (
    <div className="space-y-6">
      <div><Link to="/claims" className="text-sm text-blue-600 hover:underline">← All claims</Link>
        <div className="flex items-center gap-3"><h1 className="text-2xl font-bold">Claim {x.claim_id}</h1><StatusBadge status={x.claim_status} /></div></div>
      {msg && <div role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.t}</div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card"><h2 className="mb-2 font-semibold">Claim &amp; policy</h2>
          {row('Accident', <Link className="text-blue-600 underline" to={`/accidents/${x.accident_id}`}>{x.accident_id}</Link>)}
          {row('Vehicle', x.vehicle_number)}{row('Owner', x.owner_name)}{row('Policy number', x.policy_number)}{row('Insurer', x.insurance_company)}
          {row('Claim amount', x.claim_amount != null ? x.claim_amount.toLocaleString() : null)}{row('Description', x.claim_description)}
          {row('Submitted', x.submitted_at && new Date(x.submitted_at).toLocaleString())}
          {row('Reviewed by', x.reviewed_by)}{row('Reviewed at', x.reviewed_at && new Date(x.reviewed_at).toLocaleString())}
          {row('Remarks', x.review_remarks)}{x.rejection_reason && row('Rejection reason', x.rejection_reason)}</div>
        <div className="card"><h2 className="mb-2 font-semibold">Accident location</h2>
          <LocationMap accident={{ gps_valid: x.latitude != null, latitude: x.latitude, longitude: x.longitude, accident_id: x.accident_id, vehicle_number: x.vehicle_number, accident_date: x.accident_date, google_maps_url: x.latitude != null ? `https://www.google.com/maps?q=${x.latitude},${x.longitude}` : null }} height={240} /></div>
      </div>
      {canReview && (
        <div className="card space-y-3"><h2 className="font-semibold">Update claim status</h2>
          <select className="input max-w-xs" value={form.claim_status} onChange={(e) => setForm({ ...form, claim_status: e.target.value })} aria-label="New status">
            <option value="">Select new status…</option>{NEXT[x.claim_status].map((s) => <option key={s}>{s}</option>)}</select>
          <textarea className="input" rows={2} placeholder="Remarks (approval / review notes)" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          {form.claim_status === 'REJECTED' && <textarea className="input" rows={2} required placeholder="Reason for rejection (required)" value={form.rejection_reason} onChange={(e) => setForm({ ...form, rejection_reason: e.target.value })} />}
          <button className="btn-primary" disabled={!form.claim_status || (form.claim_status === 'REJECTED' && !form.rejection_reason.trim())} onClick={() => setConfirm(true)}>Update status</button></div>)}
      <div className="card"><h2 className="mb-2 font-semibold">Claim history</h2>
        {h.loading ? <Loading /> : !h.data?.length ? <Empty>No history.</Empty> : (
          <ol className="space-y-2 text-sm">{h.data.map((e, i) => (
            <li key={i} className="border-l-2 border-blue-200 pl-3"><b>{e.new?.claim_status || e.action}</b>{e.previous?.claim_status && <> (from {e.previous.claim_status})</>} by {e.by || 'system'} · {new Date(e.at).toLocaleString()}
              {(e.new?.remarks || e.new?.rejection_reason) && <div className="text-slate-500">{e.new.rejection_reason || e.new.remarks}</div>}</li>))}</ol>)}</div>
      <ConfirmDialog open={confirm} title="Update claim status?" message={`Change status to ${form.claim_status}. This is recorded in the audit log.`} danger={form.claim_status === 'REJECTED'} onConfirm={go} onCancel={() => setConfirm(false)} />
    </div>
  )
}

export default function ClaimManagement() {
  const { claimId } = useParams()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload, refresh } = useFetch(() => (claimId ? Promise.resolve(null) : claimService.list({ status, page, page_size: 15 })), [claimId, status, page])
  useRealtime(() => reload())
  if (claimId) return <ClaimDetail claimId={claimId} />
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Claims</h1>
        <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Filter claims by status"><option value="">All statuses</option>{['SUBMITTED', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'SETTLED'].map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="card overflow-x-auto">
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={refresh} /> : !data.items.length ? <Empty>No claims yet. Claims are raised from an accident's detail page.</Empty> : (
          <>
            <table className="min-w-full divide-y divide-slate-200"><thead><tr><th className="th">Claim</th><th className="th">Accident</th><th className="th">Vehicle</th><th className="th">Owner</th><th className="th">Submitted</th><th className="th">Status</th><th className="th" /></tr></thead>
              <tbody className="divide-y divide-slate-100">{data.items.map((c) => (
                <tr key={c.claim_id} className="hover:bg-slate-50"><td className="td font-mono text-xs">{c.claim_id}</td><td className="td font-mono text-xs">{c.accident_id}</td><td className="td">{c.vehicle_number}</td><td className="td">{c.owner_name}</td>
                  <td className="td">{c.submitted_at && new Date(c.submitted_at).toLocaleDateString()}</td><td className="td"><StatusBadge status={c.claim_status} /></td>
                  <td className="td"><Link className="font-medium text-blue-600 hover:underline" to={`/claims/${c.claim_id}`}>View details</Link></td></tr>))}</tbody></table>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600"><span>{data.total} claim(s)</span>
              <div className="flex items-center gap-2"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} / {pages}</span><button className="btn-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>
          </>)}
      </div>
    </div>
  )
}
