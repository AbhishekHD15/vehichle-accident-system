
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, Car, Cpu, FileText, Users, MapPin, ExternalLink } from 'lucide-react'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
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
    e.preventDefault(); setMsg('')
    try { await adminService.createUser({ ...f, phone: f.phone || null, organization: f.organization || null }); setF({ ...f, full_name: '', email: '', password: '' }); refresh() } catch (x) { setMsg(errMsg(x)) }
  }
  const toggle = async (u) => { try { await adminService.updateUser(u.id, { is_active: !u.is_active }); refresh() } catch (x) { setMsg(errMsg(x)) } }
  const reset = async (u) => { const p = window.prompt(`New password for ${u.email} (10+ chars, letters & digits):`); if (p) try { await adminService.resetPassword(u.id, p); setMsg('Password reset; user sessions revoked.') } catch (x) { setMsg(errMsg(x)) } }
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="space-y-4">
      {msg && <div role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{msg}</div>}
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-3">
        <input required className="input" placeholder="Full name" value={f.full_name} onChange={s('full_name')} /><input required type="email" className="input" placeholder="Email" value={f.email} onChange={s('email')} />
        <input className="input" placeholder="Phone" value={f.phone} onChange={s('phone')} /><input required type="password" className="input" placeholder="Initial password" value={f.password} onChange={s('password')} />
        <select className="input" value={f.role} onChange={s('role')}>{['INSURANCE', 'ADMIN', 'OWNER', 'FAMILY'].map((r) => <option key={r}>{r}</option>)}</select>
        <input className="input" placeholder="Insurance company (must match vehicles)" value={f.organization} onChange={s('organization')} />
        <button className="btn-primary sm:col-span-3">Create user</button>
      </form>
      {loading ? <Loading /> : error ? <ErrorBox message={error} /> : (
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead><tr><th className="th">ID</th><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Organization</th><th className="th">Active</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.map((u) => (<tr key={u.id}><td className="td">{u.id}</td><td className="td">{u.full_name}</td><td className="td">{u.email}</td><td className="td">{u.role}</td><td className="td">{u.organization || '—'}</td>
            <td className="td">{u.is_active ? 'Yes' : 'No'}</td><td className="td whitespace-nowrap">{u.id !== me.id && <><button className="mr-3 text-blue-600 hover:underline" onClick={() => toggle(u)}>{u.is_active ? 'Disable' : 'Enable'}</button><button className="text-blue-600 hover:underline" onClick={() => reset(u)}>Reset password</button></>}</td></tr>))}</tbody></table></div>)}
    </div>
  )
}

function Devices({ dashboardDevices, onChanged }) {
  const [f, setF] = useState({ device_id: '', vehicle_id: '' })
  const [key, setKey] = useState(null)
  const [msg, setMsg] = useState('')
  const [disable, setDisable] = useState(null)
  const create = async (e) => {
    e.preventDefault(); setMsg('')
    try { const d = await adminService.createDevice({ device_id: f.device_id.toUpperCase(), vehicle_id: f.vehicle_id ? Number(f.vehicle_id) : null }); setKey(d); setF({ device_id: '', vehicle_id: '' }); onChanged() } catch (x) { setMsg(errMsg(x)) }
  }
  const doDisable = async () => { try { await adminService.updateDevice(disable.device_id, { device_status: 'DISABLED' }); onChanged() } catch (x) { setMsg(errMsg(x)) } setDisable(null) }
  const act = async (d, body) => { try { await adminService.updateDevice(d.device_id, body); onChanged() } catch (x) { setMsg(errMsg(x)) } }
  const rotate = async (d) => { try { setKey(await adminService.rotateKey(d.device_id)) } catch (x) { setMsg(errMsg(x)) } }
  return (
    <div className="space-y-4">
      {msg && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{msg}</div>}
      {key && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><b>Device key (shown once):</b> <code className="break-all">{key.device_key}</code><br />Put it in <code>firmware/src/secrets.h</code> as DEVICE_KEY. Device ID: {key.device_id}. <button className="ml-2 underline" onClick={() => setKey(null)}>Dismiss</button></div>}
      <form onSubmit={create} className="flex flex-wrap gap-3"><input required pattern="[A-Za-z0-9]{2,12}" className="input max-w-[200px]" placeholder="Device ID e.g. ESP01" value={f.device_id} onChange={(e) => setF({ ...f, device_id: e.target.value })} />
        <input type="number" className="input max-w-[200px]" placeholder="Vehicle ID (optional)" value={f.vehicle_id} onChange={(e) => setF({ ...f, vehicle_id: e.target.value })} /><button className="btn-primary">Register device</button></form>
      {!dashboardDevices.length ? <Empty>No devices registered.</Empty> : (
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead><tr><th className="th">Device</th><th className="th">Vehicle</th><th className="th">Status</th><th className="th">Connection</th><th className="th">Last seen</th><th className="th">Firmware</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">{dashboardDevices.map((d) => (<tr key={d.device_id}><td className="td font-mono">{d.device_id}</td><td className="td">{d.vehicle_number || 'unassigned'}</td><td className="td"><StatusBadge status={d.device_status} /></td>
            <td className="td">{d.online ? <span className="text-green-700">● Online</span> : <span className="text-slate-500">○ Offline</span>}</td><td className="td">{d.last_seen ? new Date(d.last_seen).toLocaleString() : 'never'}</td><td className="td">{d.firmware_version || '—'}</td>
            <td className="td whitespace-nowrap">{d.device_status === 'ACTIVE' ? <button className="mr-3 text-red-600 hover:underline" onClick={() => setDisable(d)}>Disable</button> : <button className="mr-3 text-blue-600 hover:underline" onClick={() => act(d, { device_status: 'ACTIVE' })}>Enable</button>}
              <button className="text-blue-600 hover:underline" onClick={() => rotate(d)}>Rotate key</button></td></tr>))}</tbody></table></div>)}
      <ConfirmDialog open={!!disable} danger title="Disable device?" message={`${disable?.device_id} will be rejected by the API until re-enabled. Use this for lost or compromised devices.`} confirmLabel="Disable" onConfirm={doDisable} onCancel={() => setDisable(null)} />
    </div>
  )
}

function Audit() {
  const [page, setPage] = useState(1)
  const { data, loading, error } = useFetch(() => adminService.auditLogs({ page, page_size: 25 }), [page])
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} />
  return (<div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead><tr><th className="th">When</th><th className="th">Who</th><th className="th">Action</th><th className="th">Entity</th><th className="th">Change</th></tr></thead>
    <tbody className="divide-y divide-slate-100">{data.items.map((a) => (<tr key={a.id}><td className="td whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td><td className="td">{a.user}</td><td className="td">{a.action}</td><td className="td">{a.entity_type} {a.entity_id}</td>
      <td className="td max-w-xs truncate font-mono text-xs" title={JSON.stringify(a.new)}>{a.new ? JSON.stringify(a.new) : ''}</td></tr>))}</tbody></table>
    <div className="mt-3 flex items-center gap-2 text-sm"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="btn-secondary" disabled={page * 25 >= data.total} onClick={() => setPage(page + 1)}>Next</button></div></div>)
}

export default function AdminDashboard() {
  const { data, loading, error, reload, refresh } = useFetch(() => dashboardService.get('ADMIN'), [])
  useRealtime(() => reload(), 30000)
  const [tab, setTab] = useState('devices')
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} onRetry={refresh} />
  const tabs = [
    ['devices', 'Devices'],
    ['accidents', `Accidents (${data.total_accidents})`],
    ['users', 'Users & insurers'],
    ['audit', 'Audit log']
  ]
  const la = data.latest_accident
  const mapUrl = la?.google_maps_url || (la?.latitude && la?.longitude ? `https://www.google.com/maps?q=${la.latitude},${la.longitude}` : null)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System administration</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Users} label="Users" value={data.total_users} />
        <StatCard icon={Car} label="Vehicles" value={data.total_vehicles} />
        <StatCard icon={Cpu} tone="green" label="Devices (online / total)" value={`${data.online_devices} / ${data.total_devices}`} />
        <StatCard icon={AlertTriangle} tone="red" label="Accidents" value={data.total_accidents} />
        <StatCard icon={FileText} tone="amber" label="Claims" value={data.total_claims} />
        <StatCard icon={Bell} tone="amber" label="Pending / failed notifications" value={data.pending_notifications} />
      </div>

      {/* Latest Accident & Live Location Section */}
      {la && (
        <div className="card border-l-4 border-l-red-500 bg-white shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
              </span>
              <h2 className="text-lg font-bold text-slate-800">Latest Accident Alert &amp; Location</h2>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/accidents/${la.accident_id}`} className="font-mono text-sm font-semibold text-blue-600 hover:underline">
                {la.accident_id}
              </Link>
              <StatusBadge status={la.accident_status} />
              {la.claim_status && <StatusBadge status={la.claim_status} />}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 text-sm">
              <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Vehicle Number:</span>
                  <span className="font-semibold text-slate-900">{la.vehicle_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Owner Name:</span>
                  <span className="font-medium text-slate-800">{la.owner_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date &amp; Time:</span>
                  <span className="font-medium text-slate-800">{new Date(la.accident_date).toLocaleString()}</span>
                </div>
                {la.acceleration_g != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Impact Force:</span>
                    <span className="font-bold text-red-600">{Number(la.acceleration_g).toFixed(2)} G</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">GPS Coordinates:</span>
                  {la.gps_valid && la.latitude != null ? (
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      {la.latitude.toFixed(6)}, {la.longitude.toFixed(6)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">GPS unavailable</span>
                  )}
                </div>
              </div>

              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  <MapPin size={16} /> Open in Google Maps (as in SMS)
                </a>
              )}
              <div className="text-right">
                <Link to={`/accidents/${la.accident_id}`} className="text-xs font-medium text-blue-600 hover:underline">
                  View full accident &amp; claim details &rarr;
                </Link>
              </div>
            </div>

            <div>
              <LocationMap accident={la} height={240} />
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="mb-4 flex gap-2 border-b border-slate-200">{tabs.map(([k, l]) => (<button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>{l}</button>))}</div>
        {tab === 'devices' && <Devices dashboardDevices={data.devices} onChanged={reload} />}
        {tab === 'accidents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Recent Reported Accidents</h3>
              <Link to="/accidents" className="text-xs font-medium text-blue-600 hover:underline">
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
