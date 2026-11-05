import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import { errMsg } from '../services/api'
import Logo from '../components/Logo'

export default function Register() {
  const nav = useNavigate()
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '', role: 'OWNER' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await authService.register({ ...f, phone: f.phone || null })
      nav('/login', { replace: true })
    } catch (ex) {
      setErr(errMsg(ex, 'Registration failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar-bg p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-app-border">
        <div className="mb-4 flex items-center gap-2.5 text-xl font-bold text-app-text">
          <Logo size={26} className="text-primary" />
          <span>CrashSense</span>
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-app-text">Create account</h1>
        <p className="mb-6 text-sm text-app-muted">Join CrashSense for real-time safety monitoring</p>
        {err && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-semantic-danger">
            {err}
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="n">Full name</label>
            <input id="n" required className="input" placeholder="e.g. Rahul Sharma" value={f.full_name} onChange={set('full_name')} />
          </div>
          <div>
            <label className="label" htmlFor="e">Email</label>
            <input id="e" type="email" required className="input" placeholder="you@example.com" value={f.email} onChange={set('email')} />
          </div>
          <div>
            <label className="label" htmlFor="p">Phone (optional)</label>
            <input id="p" className="input" placeholder="+919876543210" value={f.phone} onChange={set('phone')} />
          </div>
          <div>
            <label className="label" htmlFor="pw">Password</label>
            <input id="pw" type="password" required minLength={10} className="input" value={f.password} onChange={set('password')} />
            <p className="mt-1 text-xs text-app-muted">At least 10 characters, with letters and digits.</p>
          </div>
          <div>
            <label className="label" htmlFor="r">I am a</label>
            <select id="r" className="input" value={f.role} onChange={set('role')}>
              <option value="OWNER">Vehicle owner</option>
              <option value="FAMILY">Family member</option>
            </select>
            <p className="mt-1 text-xs text-app-muted">Insurance and administrator accounts are created by an administrator.</p>
          </div>
          <button className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-app-muted">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
