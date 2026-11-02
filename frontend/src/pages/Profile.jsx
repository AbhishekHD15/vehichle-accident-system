import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { authService } from '../services/authService'
import { errMsg } from '../services/api'

export default function Profile() {
  const { user, setUser } = useAuth()
  const [f, setF] = useState({ full_name: user.full_name, phone: user.phone || '', current_password: '', new_password: '' })
  const [msg, setMsg] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault(); setMsg(null)
    const body = { full_name: f.full_name, phone: f.phone || null }
    if (f.new_password) { body.current_password = f.current_password; body.new_password = f.new_password }
    try { setUser(await authService.updateProfile(body)); setMsg({ ok: true, t: 'Profile updated.' }); setF({ ...f, current_password: '', new_password: '' }) }
    catch (ex) { setMsg({ ok: false, t: errMsg(ex) }) }
  }
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-2xl font-bold">Profile</h1>
      <form onSubmit={save} className="card space-y-4">
        {msg && <div role="status" className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.t}</div>}
        <div><label className="label">Email</label><input className="input bg-slate-50" disabled value={user.email} /></div>
        <div><label className="label">Role</label><input className="input bg-slate-50" disabled value={user.role + (user.organization ? ` · ${user.organization}` : '')} /></div>
        <div><label className="label" htmlFor="fn">Full name</label><input id="fn" className="input" value={f.full_name} onChange={set('full_name')} /></div>
        <div><label className="label" htmlFor="ph">Phone</label><input id="ph" className="input" value={f.phone} onChange={set('phone')} /></div>
        <hr />
        <p className="text-sm font-medium">Change password (optional)</p>
        <input type="password" placeholder="Current password" className="input" value={f.current_password} onChange={set('current_password')} autoComplete="current-password" />
        <input type="password" placeholder="New password (10+ chars, letters & digits)" className="input" value={f.new_password} onChange={set('new_password')} autoComplete="new-password" />
        <button className="btn-primary">Save changes</button>
      </form>
    </div>
  )
}
