import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import LocationMap from '../components/LocationMap'
import Loading, { Empty, ErrorBox } from '../components/Loading'
import StatusBadge from '../components/StatusBadge'
import { vehicleService } from '../services/vehicleService'
import { errMsg } from '../services/api'
import { useFetch } from '../hooks/useFetch'
import { useAuth } from '../hooks/useAuth'

const EMPTY = { vehicle_number: '', vehicle_model: '', vehicle_type: '', insurance_policy_number: '', insurance_company: '', insurance_expiry_date: '', owner_id: '' }

function VehicleForm({ initial, isAdmin, onSaved, onCancel }) {
  const [f, setF] = useState({ ...EMPTY, ...Object.fromEntries(Object.entries(initial || {}).map(([k, v]) => [k, v ?? ''])) })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    const body = { ...f, owner_id: f.owner_id ? Number(f.owner_id) : null }
    Object.keys(body).forEach((k) => { if (body[k] === '') body[k] = null })
    try { initial?.id ? await vehicleService.update(initial.id, body) : await vehicleService.create(body); onSaved() }
    catch (ex) { setErr(errMsg(ex)) }
  }
  const fld = (k, label, type = 'text', req = false) => (<div><label className="label" htmlFor={k}>{label}</label><input id={k} type={type} required={req} className="input" value={f[k]} onChange={set(k)} /></div>)
  return (
    <form onSubmit={submit} className="card mb-6 grid gap-4 sm:grid-cols-2">
      {err && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{err}</div>}
      {fld('vehicle_number', 'Registration number *', 'text', true)}{fld('vehicle_model', 'Model')}{fld('vehicle_type', 'Type (car, bike…)')}
      {fld('insurance_company', 'Insurance company')}{fld('insurance_policy_number', 'Policy number')}{fld('insurance_expiry_date', 'Insurance expiry', 'date')}
      {isAdmin && !initial?.id && fld('owner_id', 'Owner user ID *', 'number', true)}
      <div className="flex gap-2 sm:col-span-2"><button className="btn-primary">Save vehicle</button><button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button></div>
    </form>
  )
}

function VehicleDetails({ id }) {
  const { user } = useAuth()
  const { data: v, loading, error, refresh } = useFetch(() => vehicleService.get(id), [id])
  const fam = useFetch(() => (['OWNER', 'ADMIN'].includes(user.role) ? vehicleService.family(id) : Promise.resolve([])), [id])
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} onRetry={refresh} />
  const share = async (e) => { e.preventDefault(); setMsg(''); try { await vehicleService.share(id, email); setEmail(''); fam.refresh() } catch (ex) { setMsg(errMsg(ex)) } }
  const row = (k, val) => <div className="flex justify-between border-b border-slate-100 py-2 text-sm"><span className="text-slate-500">{k}</span><span className="font-medium">{val || '—'}</span></div>
  return (
    <div className="space-y-6">
      <div><Link to={['OWNER', 'ADMIN'].includes(user.role) ? '/vehicles' : '/'} className="text-sm text-blue-600 hover:underline">← Back</Link>
        <h1 className="text-2xl font-bold">{v.vehicle_number}</h1></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card"><h2 className="mb-2 font-semibold">Vehicle information</h2>
          {row('Owner', v.owner_name)}{row('Model', v.vehicle_model)}{row('Type', v.vehicle_type)}
          {user.role !== 'FAMILY' && <>{row('Insurance company', v.insurance_company)}{row('Policy number', v.insurance_policy_number)}{row('Insurance expiry', v.insurance_expiry_date)}</>}
          {row('IoT device', v.device_id || 'Not linked (ask an administrator)')}</div>
        <div className="card"><h2 className="mb-2 font-semibold">Last reported event location</h2>
          {v.latest_accident ? <><p className="mb-2 text-sm text-slate-500">{v.latest_accident.accident_id} · <StatusBadge status={v.latest_accident.accident_status} /> — this is the location recorded at the time of the last event, not live tracking.</p><LocationMap accident={v.latest_accident} height={240} /></>
            : <Empty>No events reported for this vehicle.</Empty>}</div>
      </div>
      {['OWNER', 'ADMIN'].includes(user.role) && (
        <div className="card"><h2 className="mb-2 font-semibold">Family members with access</h2>
          <ul className="mb-3 divide-y divide-slate-100 text-sm">{(fam.data || []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between py-2"><span>{m.full_name} · {m.email}</span>
              <button className="text-red-600 hover:underline" onClick={async () => { await vehicleService.unshare(id, m.user_id); fam.refresh() }}>Remove</button></li>))}
            {!fam.data?.length && <li className="py-2 text-slate-500">Not shared with anyone.</li>}</ul>
          <form onSubmit={share} className="flex flex-wrap gap-2"><input type="email" required className="input max-w-xs" placeholder="Family member's account email" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="btn-primary">Share</button></form>
          {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}</div>)}
    </div>
  )
}

export default function VehicleManagement() {
  const { vehicleId } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const { data, loading, error, refresh } = useFetch(() => (vehicleId ? Promise.resolve([]) : vehicleService.list()), [vehicleId])
  const [form, setForm] = useState(null)
  const [del, setDel] = useState(null)
  const [msg, setMsg] = useState('')
  if (vehicleId) return <VehicleDetails id={vehicleId} />
  const remove = async () => { try { await vehicleService.remove(del.id); setDel(null); refresh() } catch (e) { setMsg(errMsg(e)); setDel(null) } }
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-bold">{user.role === 'ADMIN' ? 'All vehicles' : 'My vehicles'}</h1>
        <button className="btn-primary" onClick={() => setForm({})}><Plus size={16} /> Add vehicle</button></div>
      {msg && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{msg}</div>}
      {form && <VehicleForm initial={form.id ? form : null} isAdmin={user.role === 'ADMIN'} onCancel={() => setForm(null)} onSaved={() => { setForm(null); refresh() }} />}
      <div className="card overflow-x-auto">
        {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={refresh} /> : !data.length ? <Empty>No vehicles registered yet.</Empty> : (
          <table className="min-w-full divide-y divide-slate-200"><thead><tr><th className="th">Number</th><th className="th">Model</th><th className="th">Insurer</th><th className="th">Policy</th><th className="th">Device</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50"><td className="td font-medium"><Link className="text-blue-600 hover:underline" to={`/vehicles/${v.id}`}>{v.vehicle_number}</Link></td>
                <td className="td">{v.vehicle_model || '—'}</td><td className="td">{v.insurance_company || '—'}</td><td className="td">{v.insurance_policy_number || '—'}</td><td className="td">{v.device_id || '—'}</td>
                <td className="td whitespace-nowrap text-right"><button aria-label="Edit" className="mr-3 text-slate-600 hover:text-blue-600" onClick={() => { setForm(v); window.scrollTo(0, 0) }}><Pencil size={16} /></button>
                  <button aria-label="Delete" className="text-slate-600 hover:text-red-600" onClick={() => setDel(v)}><Trash2 size={16} /></button></td></tr>))}</tbody></table>)}
      </div>
      <ConfirmDialog open={!!del} danger title="Delete vehicle?" message={`Delete ${del?.vehicle_number}? Vehicles with accident records or a linked device cannot be deleted.`} confirmLabel="Delete" onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  )
}
