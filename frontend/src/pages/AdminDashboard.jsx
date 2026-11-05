import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, Car, Cpu, FileText, Users, MapPin, KeyRound, UserCheck, ShieldCheck } from 'lucide-react'
import StatCard from '../components/StatCard'
import StatusBadge, { ConnectionDot } from '../components/StatusBadge'
import LocationMap from '../components/LocationMap'
import AccidentTable from '../components/AccidentTable'
import ConfirmDialog from '../components/ConfirmDialog'
import Loading, { Empty, ErrorBox } from '../components/Loading'
import { adminService } from '../services/adminService'
import { dashboardService } from '../services/dashboardService'
import { errMsg } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { useRealtime } from '../hooks/useRealtime'
import { useAuth } from '../hooks/useAuth'

function Users_() {
  const { user: me } = useAuth()
  const { data, loading, error, refresh } = useFetch(adminService.users, [])
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '', role: 'INSURANCE', organization: '' })
  const [msg, setMsg] = useState('')

  const create = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      await adminService.createUser({ ...f, phone: f.phone || null, organization: f.organization || null })
      setF({ ...f, full_name: '', email: '', password: '' })
      refresh()
    } catch (x) {
      setMsg(errMsg(x))
    }
  }

  const toggle = async (u) => {
    try {
      await adminService.updateUser(u.id, { is_active: !u.is_active })
      refresh()
    } catch (x) {
      setMsg(errMsg(x))
    }
  }

  const reset = async (u) => {
    const p = window.prompt(`New password for ${u.email} (10+ chars, letters & digits):`)
    if (p) {
      try {
        await adminService.resetPassword(u.id, p)
        setMsg('Password reset; user sessions revoked.')
      } catch (x) {
        setMsg(errMsg(x))
      }
    }
  }

  const s = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <div className="space-y-4">
      {msg && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-semantic-warning">
          {msg}
        </div>
      )}
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-3">
        <input required className="input" placeholder="Full name" value={f.full_name} onChange={s('full_name')} />
        <input required type="email" className="input" placeholder="Email" value={f.email} onChange={s('email')} />
        <input className="input" placeholder="Phone" value={f.phone} onChange={s('phone')} />
        <input required type="password" className="input" placeholder="Initial password" value={f.password} onChange={s('password')} />
        <select className="input" value={f.role} onChange={s('role')}>
          {['INSURANCE', 'ADMIN', 'OWNER', 'FAMILY'].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <input className="input" placeholder="Insurance company (must match vehicles)" value={f.organization} onChange={s('organization')} />
        <button className="btn-primary sm:col-span-3">Create user</button>
      </form>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-app-border bg-white shadow-soft">
          <table className="min-w-full divide-y divide-app-border">
            <thead>
              <tr>
                <th className="th">ID</th>
                <th className="th">Name</th>
                <th className="th">Email</th>
                <th className="th">Role</th>
                <th className="th">Organization</th>
                <th className="th">Active</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {data.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="td font-mono text-xs">{u.id}</td>
                  <td className="td font-medium text-app-text">{u.full_name}</td>
                  <td className="td text-app-muted">{u.email}</td>
                  <td className="td">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {u.role}
                    </span>
                  </td>
                  <td className="td text-app-muted">{u.organization || '—'}</td>
                  <td className="td">
                    <StatusBadge status={u.is_active ? 'ACTIVE' : 'DISABLED'} />
                  </td>
                  <td className="td whitespace-nowrap text-right">
                    {u.id !== me.id && (
                      <div className="flex items-center justify-end gap-3 text-xs font-medium">
                        <button
                          className={u.is_active ? 'text-semantic-danger hover:underline' : 'text-primary hover:underline'}
                          onClick={() => toggle(u)}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button className="text-primary hover:underline" onClick={() => reset(u)}>
                          Reset password
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Devices({ dashboardDevices, onChanged }) {
  const [f, setF] = useState({ device_id: '', vehicle_id: '' })
  const [key, setKey] = useState(null)
  const [msg, setMsg] = useState('')
  const [disable, setDisable] = useState(null)

  const create = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      const d = await adminService.createDevice({
        device_id: f.device_id.toUpperCase(),
        vehicle_id: f.vehicle_id ? Number(f.vehicle_id) : null,
      })
      setKey(d)
      setF({ device_id: '', vehicle_id: '' })
      onChanged()
    } catch (x) {
      setMsg(errMsg(x))
    }
  }

  const doDisable = async () => {
    try {
      await adminService.updateDevice(disable.device_id, { device_status: 'DISABLED' })
      onChanged()
    } catch (x) {
      setMsg(errMsg(x))
    }
    setDisable(null)
  }

  const act = async (d, body) => {
    try {
      await adminService.updateDevice(d.device_id, body)
      onChanged()
    } catch (x) {
      setMsg(errMsg(x))
    }
  }

  const rotate = async (d) => {
    try {
      setKey(await adminService.rotateKey(d.device_id))
    } catch (x) {
      setMsg(errMsg(x))
    }
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-semantic-danger">
          {msg}
        </div>
      )}
      {key && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-soft">
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound size={18} className="text-amber-700" />
            <span>Device Secret Key (shown once):</span>
          </div>
          <code className="mt-2 block rounded-lg bg-amber-100/70 p-2 font-mono text-xs text-amber-950 break-all border border-amber-200">
            {key.device_key}
          </code>
          <p className="mt-2 text-xs text-amber-800">
            Put it in <code>firmware/src/secrets.h</code> as <code>DEVICE_KEY</code>. Device ID: <b>{key.device_id}</b>.
            <button className="ml-3 font-semibold underline hover:no-underline" onClick={() => setKey(null)}>
              Dismiss
            </button>
          </p>
        </div>
      )}
      <form onSubmit={create} className="flex flex-wrap gap-3">
        <input
          required
          pattern="[A-Za-z0-9]{2,12}"
          className="input max-w-[200px]"
          placeholder="Device ID e.g. ESP01"
          value={f.device_id}
          onChange={(e) => setF({ ...f, device_id: e.target.value })}
        />
        <input
          type="number"
          className="input max-w-[200px]"
          placeholder="Vehicle ID (optional)"
          value={f.vehicle_id}
          onChange={(e) => setF({ ...f, vehicle_id: e.target.value })}
        />
        <button className="btn-primary">Register device</button>
      </form>

      {!dashboardDevices.length ? (
        <Empty icon={Cpu} title="No devices registered">
          Register an IoT hardware telemetry unit using the form above.
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-app-border bg-white shadow-soft">
          <table className="min-w-full divide-y divide-app-border">
            <thead>
              <tr>
                <th className="th">Device</th>
                <th className="th">Vehicle</th>
                <th className="th">Status</th>
                <th className="th">Connection</th>
                <th className="th">Last seen</th>
                <th className="th">Firmware</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {dashboardDevices.map((d) => (
                <tr key={d.device_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="td font-mono text-xs font-semibold">{d.device_id}</td>
                  <td className="td font-medium">{d.vehicle_number || 'unassigned'}</td>
                  <td className="td">
                    <StatusBadge status={d.device_status} />
                  </td>
                  <td className="td">
                    <ConnectionDot online={d.online} />
                  </td>
                  <td className="td whitespace-nowrap text-app-muted text-xs">
                    {d.last_seen ? new Date(d.last_seen).toLocaleString() : 'never'}
                  </td>
                  <td className="td font-mono text-xs text-app-muted">{d.firmware_version || '—'}</td>
                  <td className="td whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-3 text-xs font-medium">
                      {d.device_status === 'ACTIVE' ? (
                        <button className="text-semantic-danger hover:underline" onClick={() => setDisable(d)}>
                          Disable
                        </button>
                      ) : (
                        <button className="text-primary hover:underline" onClick={() => act(d, { device_status: 'ACTIVE' })}>
                          Enable
                        </button>
                      )}
                      <button className="text-primary hover:underline" onClick={() => rotate(d)}>
                        Rotate key
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={!!disable}
        danger
        title="Disable device?"
        message={`${disable?.device_id} will be rejected by the API until re-enabled. Use this for lost or compromised devices.`}
        confirmLabel="Disable"
        onConfirm={doDisable}
        onCancel={() => setDisable(null)}
      />
    </div>
  )
}

function Audit() {
  const [page, setPage] = useState(1)
  const { data, loading, error } = useFetch(() => adminService.auditLogs({ page, page_size: 25 }), [page])

  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} />

  if (!data?.items?.length) {
    return <Empty icon={ShieldCheck} title="No audit logs recorded">Audit logs will appear as administrative actions occur.</Empty>
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-app-border bg-white shadow-soft">
        <table className="min-w-full divide-y divide-app-border">
          <thead>
            <tr>
              <th className="th">When</th>
              <th className="th">Who</th>
              <th className="th">Action</th>
              <th className="th">Entity</th>
              <th className="th">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {data.items.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="td whitespace-nowrap text-xs text-app-muted">{new Date(a.created_at).toLocaleString()}</td>
                <td className="td font-medium text-xs">{a.user}</td>
                <td className="td text-xs">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">{a.action}</span>
                </td>
                <td className="td text-xs text-app-muted">
                  {a.entity_type} {a.entity_id}
                </td>
                <td className="td max-w-xs truncate font-mono text-xs text-app-muted" title={JSON.stringify(a.new)}>
                  {a.new ? JSON.stringify(a.new) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-app-muted pt-1">
        <span>Page {page}</span>
        <div className="flex items-center gap-2">
          <button className="btn-secondary !px-2.5 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <button className="btn-secondary !px-2.5 !py-1 text-xs" disabled={page * 25 >= data.total} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { data, loading, error, reload, refresh } = useFetch(() => dashboardService.get('ADMIN'), [])
  useRealtime(() => reload(), 10000)
  const [tab, setTab] = useState('devices')

  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} onRetry={refresh} />

  const tabs = [
    ['devices', 'Devices'],
    ['accidents', `Accidents (${data.total_accidents})`],
    ['users', 'Users & insurers'],
    ['audit', 'Audit log'],
  ]
  const la = data.latest_accident
  const mapUrl = la?.google_maps_url || (la?.latitude && la?.longitude ? `https://www.google.com/maps?q=${la.latitude},${la.longitude}` : null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-app-text">System administration</h1>
          <p className="text-xs text-app-muted mt-0.5">Real-time overview of devices, accidents, users, and safety events</p>
        </div>
      </div>

      {/* Admin Stat Cards with colored icon chips matching meaning */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Users} tone="info" label="Users" value={data.total_users} />
        <StatCard icon={Car} tone="primary" label="Vehicles" value={data.total_vehicles} />
        <StatCard
          icon={Cpu}
          tone="green"
          label="Devices (online / total)"
          value={`${data.online_devices} / ${data.total_devices}`}
        />
        <StatCard icon={AlertTriangle} tone="red" label="Accidents" value={data.total_accidents} />
        <StatCard icon={FileText} tone="amber" label="Claims" value={data.total_claims} />
        <StatCard
          icon={Bell}
          tone="warning"
          label="Pending / failed notifications"
          value={data.pending_notifications}
        />
      </div>

      {/* Latest Accident & Live Location Section */}
      {la ? (
        <div className="card border-l-4 border-l-semantic-danger bg-white shadow-soft">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-app-border pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-semantic-danger"></span>
              </span>
              <h2 className="text-base font-bold text-app-text">Latest Accident Alert &amp; Location</h2>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/accidents/${la.accident_id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                {la.accident_id}
              </Link>
              <StatusBadge status={la.accident_status} />
              {la.claim_status && <StatusBadge status={la.claim_status} />}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 items-center">
            <div className="space-y-3 text-sm">
              <div className="space-y-2 rounded-xl border border-app-border bg-slate-50/60 p-4">
                <div className="flex justify-between">
                  <span className="text-app-muted text-xs">Vehicle Number:</span>
                  <span className="font-semibold text-app-text">{la.vehicle_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-muted text-xs">Owner Name:</span>
                  <span className="font-medium text-app-text">{la.owner_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-muted text-xs">Date &amp; Time:</span>
                  <span className="font-medium text-app-text">{new Date(la.accident_date).toLocaleString()}</span>
                </div>
                {la.acceleration_g != null && (
                  <div className="flex justify-between">
                    <span className="text-app-muted text-xs">Impact Force:</span>
                    <span className="font-bold text-semantic-danger">{Number(la.acceleration_g).toFixed(2)} G</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-app-border pt-2">
                  <span className="text-app-muted text-xs">GPS Coordinates:</span>
                  {la.gps_valid && la.latitude != null ? (
                    <span className="font-mono text-xs font-semibold text-app-text">
                      {la.latitude.toFixed(6)}, {la.longitude.toFixed(6)}
                    </span>
                  ) : (
                    <span className="text-xs text-app-muted italic">GPS unavailable</span>
                  )}
                </div>
              </div>

              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary w-full py-2.5"
                >
                  <MapPin size={16} /> Open in Google Maps (as in SMS)
                </a>
              )}
              <div className="text-right">
                <Link to={`/accidents/${la.accident_id}`} className="text-xs font-semibold text-primary hover:underline">
                  View full accident &amp; claim details &rarr;
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-app-border shadow-soft">
              <LocationMap accident={la} height={220} />
            </div>
          </div>
        </div>
      ) : (
        <div className="card border-l-4 border-l-semantic-success bg-white shadow-soft flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 rounded-full bg-semantic-success"></span>
            <div>
              <h2 className="text-sm font-bold text-app-text">System Monitoring Active — No Recent Accidents</h2>
              <p className="text-xs text-app-muted">Listening for live hardware crash telemetry from registered ESP32 units.</p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 text-semantic-success border border-emerald-200 px-3 py-1 text-xs font-semibold">
            All Systems Normal
          </span>
        </div>
      )}

      {/* Tabs & Content */}
      <div className="card">
        <div className="mb-5 flex gap-1 border-b border-app-border overflow-x-auto">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-150 whitespace-nowrap ${
                tab === k
                  ? 'border-primary text-primary'
                  : 'border-transparent text-app-muted hover:text-app-text hover:border-slate-300'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === 'devices' && <Devices dashboardDevices={data.devices} onChanged={reload} />}
        {tab === 'accidents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-app-text">Recent Reported Accidents</h3>
              <Link to="/accidents" className="text-xs font-semibold text-primary hover:underline">
                View all in Accidents section &rarr;
              </Link>
            </div>
            <AccidentTable items={data.recent_accidents || []} showOwner showClaim />
          </div>
        )}
        {tab === 'users' && <Users_ />}
        {tab === 'audit' && <Audit />}
      </div>
    </div>
  )
}
