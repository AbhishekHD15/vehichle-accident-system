import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import LocationMap from '../components/LocationMap'
import StatusBadge from '../components/StatusBadge'
import NotificationPanel from '../components/NotificationPanel'
import Loading, { ErrorBox } from '../components/Loading'
import ConfirmDialog from '../components/ConfirmDialog'
import { accidentService } from '../services/accidentService'
import { notificationService } from '../services/notificationService'
import { claimService } from '../services/claimService'
import { errMsg } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { useRealtime } from '../hooks/useRealtime'
import { useAuth } from '../hooks/useAuth'

const Row = ({ k, v }) => (
  <div className="flex justify-between items-center gap-4 border-b border-app-border py-2.5 text-sm">
    <span className="text-app-muted text-xs font-medium">{k}</span>
    <span className="text-right font-medium text-app-text">{v ?? '—'}</span>
  </div>
)

export default function AccidentDetails() {
  const { accidentId } = useParams()
  const { user } = useAuth()
  const a = useFetch(() => accidentService.get(accidentId), [accidentId])
  const n = useFetch(() => notificationService.list({ accident_id: accidentId, page_size: 50 }), [accidentId])
  useRealtime((e) => {
    if (!e.accident_id || e.accident_id === accidentId) {
      a.reload()
      n.reload()
    }
  })
  const [claim, setClaim] = useState({ claim_amount: '', claim_description: '' })
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState(null)

  if (a.loading) return <Loading />
  if (a.error) return <ErrorBox message={a.error} onRetry={a.refresh} />
  const x = a.data
  const canClaim =
    ['OWNER', 'ADMIN'].includes(user.role) &&
    x.claim_status === 'NOT_INITIATED' &&
    !['CANCELLED', 'FALSE_ALARM'].includes(x.accident_status)

  const submitClaim = async () => {
    setConfirm(false)
    setMsg(null)
    try {
      await claimService.create({
        accident_id: x.accident_id,
        claim_amount: claim.claim_amount ? Number(claim.claim_amount) : null,
        claim_description: claim.claim_description || null,
      })
      setMsg({ ok: true, t: 'Claim submitted successfully.' })
      a.reload()
    } catch (e) {
      setMsg({ ok: false, t: errMsg(e) })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-app-text">Accident {x.accident_id}</h1>
          <p className="text-xs text-app-muted mt-0.5">
            Vehicle <b className="text-app-text">{x.vehicle_number}</b> · {new Date(x.accident_date).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={x.accident_status} />
          {x.claim_status && <StatusBadge status={x.claim_status} />}
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
          <h2 className="mb-3 font-semibold text-app-text">Location</h2>
          <div className="overflow-hidden rounded-xl border border-app-border">
            <LocationMap accident={x} />
          </div>
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold text-app-text">Details</h2>
          <Row k="Owner" v={x.owner_name} />
          <Row k="Accident status" v={<StatusBadge status={x.accident_status} />} />
          <Row k="Driver cancellation" v={x.cancellation_status} />
          <Row k="GPS fix" v={x.gps_valid ? 'Valid' : 'GPS location unavailable.'} />
          <Row k="Coordinates" v={x.gps_valid ? `${x.latitude}, ${x.longitude}` : null} />
          {x.acceleration_g !== undefined && (
            <Row
              k="Peak acceleration"
              v={x.acceleration_g != null ? `${x.acceleration_g.toFixed(2)} G` : null}
            />
          )}
          {x.claim_id && (
            <Row
              k="Claim"
              v={
                user.role === 'FAMILY' ? null : (
                  <Link className="text-primary font-semibold hover:underline" to={`/claims/${x.claim_id}`}>
                    {x.claim_id}
                  </Link>
                )
              }
            />
          )}
          <Row k="Description" v={x.description} />
          <p className="mt-4 text-xs text-app-muted">
            An accident detection is not an insurance claim. Claims are raised and reviewed separately.
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold text-app-text">SMS &amp; Call notifications</h2>
        {n.loading ? (
          <Loading />
        ) : n.error ? (
          <ErrorBox message={n.error} />
        ) : (
          <NotificationPanel
            items={n.data.items}
            canRetry={['OWNER', 'ADMIN'].includes(user.role)}
            onChanged={n.reload}
          />
        )}
      </div>

      {!x.claim_id && x.claim_status === 'REJECTED' && ['OWNER', 'ADMIN'].includes(user.role) && (
        <div className="card border-l-4 border-l-semantic-danger bg-red-50/70 p-4 text-sm text-semantic-danger shadow-soft">
          <b>Claim Expired / Rejected:</b> This accident occurred more than 1 week (7 days) ago without an initiated claim. Under insurance rules, claims must be filed within 7 days of the incident and are now expired.
        </div>
      )}

      {canClaim && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-app-text">Submit insurance claim</h2>
          <p className="text-xs text-app-muted">Note: Claims must be initiated within 7 days of the accident event.</p>
          <input
            type="number"
            min="0"
            className="input"
            placeholder="Estimated claim amount (optional)"
            value={claim.claim_amount}
            onChange={(e) => setClaim({ ...claim, claim_amount: e.target.value })}
          />
          <textarea
            className="input"
            rows={3}
            maxLength={2000}
            placeholder="Describe the damage / circumstances"
            value={claim.claim_description}
            onChange={(e) => setClaim({ ...claim, claim_description: e.target.value })}
          />
          <button className="btn-primary" onClick={() => setConfirm(true)}>
            Submit claim
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title="Submit claim?"
        message="This sends the claim to your insurance company for review."
        confirmLabel="Submit"
        onConfirm={submitClaim}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}
