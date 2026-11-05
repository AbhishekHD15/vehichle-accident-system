import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FileText, ArrowLeft, ChevronRight } from 'lucide-react'
import LocationMap from '../components/LocationMap'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import Loading, { Empty, ErrorBox } from '../components/Loading'
import { claimService } from '../services/claimService'
import { errMsg } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { useRealtime } from '../hooks/useRealtime'
import { useAuth } from '../hooks/useAuth'

const NEXT = {
  SUBMITTED: ['IN_PROGRESS', 'APPROVED', 'REJECTED'],
  IN_PROGRESS: ['APPROVED', 'REJECTED'],
  APPROVED: ['SETTLED'],
  REJECTED: ['IN_PROGRESS'],
  SETTLED: [],
}

function ClaimDetail({ claimId }) {
  const { user } = useAuth()
  const c = useFetch(() => claimService.get(claimId), [claimId])
  const h = useFetch(() => claimService.history(claimId), [claimId])
  useRealtime(() => {
    c.reload()
    h.reload()
  })
  const [form, setForm] = useState({ claim_status: '', remarks: '', rejection_reason: '' })
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState(null)

  if (c.loading) return <Loading />
  if (c.error) return <ErrorBox message={c.error} onRetry={c.refresh} />
  const x = c.data
  const canReview = ['INSURANCE', 'ADMIN'].includes(user.role) && NEXT[x.claim_status]?.length > 0

  const go = async () => {
    setConfirm(false)
    setMsg(null)
    try {
      await claimService.updateStatus(claimId, {
        claim_status: form.claim_status,
        remarks: form.remarks || null,
        rejection_reason: form.claim_status === 'REJECTED' ? form.rejection_reason : null,
      })
      setForm({ claim_status: '', remarks: '', rejection_reason: '' })
      setMsg({ ok: true, t: 'Claim status updated.' })
      c.reload()
      h.reload()
    } catch (e) {
      setMsg({ ok: false, t: errMsg(e) })
    }
  }

  const row = (k, v) => (
    <div className="flex justify-between items-center gap-4 border-b border-app-border py-2.5 text-sm">
      <span className="text-app-muted text-xs font-medium">{k}</span>
      <span className="text-right font-medium text-app-text">{v ?? '—'}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <Link to="/claims" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mb-1">
          <ArrowLeft size={14} /> Back to all claims
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-app-text">Claim {x.claim_id}</h1>
          <StatusBadge status={x.claim_status} />
        </div>
      </div>

      {msg && (
        <div
          role="status"
          className={`rounded-xl border p-4 text-sm shadow-soft ${
            msg.ok
              ? 'border-emerald-200 bg-emerald-50 text-semantic-success'
              : 'border-red-200 bg-red-50 text-semantic-danger'
          }`}
        >
          {msg.t}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold text-app-text">Claim &amp; policy</h2>
          {row(
            'Accident',
            <Link className="font-semibold text-primary hover:underline" to={`/accidents/${x.accident_id}`}>
              {x.accident_id}
            </Link>
          )}
          {row('Vehicle', x.vehicle_number)}
          {row('Owner', x.owner_name)}
          {row('Policy number', x.policy_number)}
          {row('Insurer', x.insurance_company)}
          {row('Claim amount', x.claim_amount != null ? `₹${x.claim_amount.toLocaleString()}` : null)}
          {row('Description', x.claim_description)}
          {row('Submitted', x.submitted_at && new Date(x.submitted_at).toLocaleString())}
          {row('Reviewed by', x.reviewed_by)}
          {row('Reviewed at', x.reviewed_at && new Date(x.reviewed_at).toLocaleString())}
          {row('Remarks', x.review_remarks)}
          {x.rejection_reason && row('Rejection reason', x.rejection_reason)}
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold text-app-text">Accident location</h2>
          <div className="overflow-hidden rounded-xl border border-app-border">
            <LocationMap
              accident={{
                gps_valid: x.latitude != null,
                latitude: x.latitude,
                longitude: x.longitude,
                accident_id: x.accident_id,
                vehicle_number: x.vehicle_number,
                accident_date: x.accident_date,
                google_maps_url:
                  x.latitude != null ? `https://www.google.com/maps?q=${x.latitude},${x.longitude}` : null,
              }}
              height={240}
            />
          </div>
        </div>
      </div>

      {canReview && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-app-text">Review and update status</h2>
          <select
            className="input max-w-xs"
            value={form.claim_status}
            onChange={(e) => setForm({ ...form, claim_status: e.target.value })}
            aria-label="New status"
          >
            <option value="">Select new status…</option>
            {NEXT[x.claim_status].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <textarea
            className="input"
            rows={2}
            placeholder="Remarks (approval / review notes)"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
          />
          {form.claim_status === 'REJECTED' && (
            <textarea
              className="input"
              rows={2}
              required
              placeholder="Reason for rejection (required)"
              value={form.rejection_reason}
              onChange={(e) => setForm({ ...form, rejection_reason: e.target.value })}
            />
          )}
          <button
            className="btn-primary"
            disabled={
              !form.claim_status ||
              (form.claim_status === 'REJECTED' && !form.rejection_reason.trim())
            }
            onClick={() => setConfirm(true)}
          >
            Update status
          </button>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 font-semibold text-app-text">Claim audit history</h2>
        {h.loading ? (
          <Loading />
        ) : !h.data?.length ? (
          <Empty icon={FileText} title="No audit history">No state transitions recorded yet.</Empty>
        ) : (
          <ol className="space-y-3 text-sm">
            {h.data.map((e, i) => (
              <li key={i} className="border-l-2 border-primary/40 pl-3.5 py-0.5">
                <div className="font-semibold text-app-text">
                  {e.new?.claim_status || e.action}
                  {e.previous?.claim_status && (
                    <span className="font-normal text-app-muted"> (from {e.previous.claim_status})</span>
                  )}
                  <span className="font-normal text-xs text-app-muted">
                    {' '}
                    by {e.by || 'system'} · {new Date(e.at).toLocaleString()}
                  </span>
                </div>
                {(e.new?.remarks || e.new?.rejection_reason) && (
                  <div className="text-xs text-app-muted mt-1 bg-slate-50 p-2 rounded border border-app-border">
                    {e.new.rejection_reason || e.new.remarks}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        title="Update claim status?"
        message={`Change status to ${form.claim_status}. This will be logged in the tamper-evident audit record.`}
        danger={form.claim_status === 'REJECTED'}
        onConfirm={go}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}

export default function ClaimManagement() {
  const { claimId } = useParams()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload, refresh } = useFetch(
    () => (claimId ? Promise.resolve(null) : claimService.list({ status, page, page_size: 15 })),
    [claimId, status, page]
  )
  useRealtime(() => reload())

  if (claimId) return <ClaimDetail claimId={claimId} />

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-app-text">Claims</h1>
          <p className="text-xs text-app-muted mt-0.5">Track and adjudicate insurance claim submissions</p>
        </div>
        <select
          className="input w-auto text-xs"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          aria-label="Filter claims by status"
        >
          <option value="">All statuses</option>
          {['SUBMITTED', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'SETTLED'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="p-5">
            <ErrorBox message={error} onRetry={refresh} />
          </div>
        ) : !data.items.length ? (
          <Empty
            icon={FileText}
            title="No claims filed yet"
          >
            Claims are raised from an accident record once verified.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-app-border">
              <thead>
                <tr>
                  <th className="th">Claim ID</th>
                  <th className="th">Accident</th>
                  <th className="th">Vehicle</th>
                  <th className="th">Owner</th>
                  <th className="th">Submitted</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border bg-white">
                {data.items.map((c) => (
                  <tr key={c.claim_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="td font-mono text-xs font-semibold">{c.claim_id}</td>
                    <td className="td font-mono text-xs text-app-muted">{c.accident_id}</td>
                    <td className="td font-medium text-app-text">{c.vehicle_number}</td>
                    <td className="td text-app-muted">{c.owner_name}</td>
                    <td className="td text-xs text-app-muted">
                      {c.submitted_at && new Date(c.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="td">
                      <StatusBadge status={c.claim_status} />
                    </td>
                    <td className="td text-right">
                      <Link
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                        to={`/claims/${c.claim_id}`}
                      >
                        View details <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between p-4 text-xs text-app-muted border-t border-app-border">
              <span>{data.total} claim(s)</span>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary !px-2.5 !py-1 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span className="font-medium text-app-text">
                  Page {page} / {pages}
                </span>
                <button
                  className="btn-secondary !px-2.5 !py-1 text-xs"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
