import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { authService } from '../services/authService'
import { errMsg } from '../services/api'

export default function Profile() {
  const { user, setUser } = useAuth()
  const [f, setF] = useState({
    full_name: user.full_name,
    phone: user.phone || '',
    current_password: '',
    new_password: '',
  })
  const [msg, setMsg] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setMsg(null)
    const body = { full_name: f.full_name, phone: f.phone || null }
    if (f.new_password) {
      body.current_password = f.current_password
      body.new_password = f.new_password
    }
    try {
      setUser(await authService.updateProfile(body))
      setMsg({ ok: true, t: 'Profile updated successfully.' })
      setF({ ...f, current_password: '', new_password: '' })
    } catch (ex) {
      setMsg({ ok: false, t: errMsg(ex) })
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-app-text">Profile</h1>
        <p className="text-xs text-app-muted mt-0.5">Manage your personal credentials and contact phone</p>
      </div>
      <form onSubmit={save} className="card space-y-4">
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
        <div>
          <label className="label">Email</label>
          <input className="input bg-slate-50 cursor-not-allowed text-app-muted" disabled value={user.email} />
        </div>
        <div>
          <label className="label">Role &amp; Organization</label>
          <input
            className="input bg-slate-50 cursor-not-allowed text-app-muted"
            disabled
            value={user.role + (user.organization ? ` · ${user.organization}` : '')}
          />
        </div>
        <div>
          <label className="label" htmlFor="fn">
            Full name
          </label>
          <input id="fn" className="input" value={f.full_name} onChange={set('full_name')} />
        </div>
        <div>
          <label className="label" htmlFor="ph">
            Phone number (used for emergency SMS routing)
          </label>
          <input id="ph" className="input" value={f.phone} onChange={set('phone')} />
        </div>
        <hr className="border-app-border my-2" />
        <div>
          <p className="text-sm font-semibold text-app-text mb-2">Change password (optional)</p>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Current password"
              className="input"
              value={f.current_password}
              onChange={set('current_password')}
              autoComplete="current-password"
            />
            <input
              type="password"
              placeholder="New password (10+ chars, letters & digits)"
              className="input"
              value={f.new_password}
              onChange={set('new_password')}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="pt-2">
          <button className="btn-primary w-full sm:w-auto">Save changes</button>
        </div>
      </form>
    </div>
  )
}
