import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ShieldAlert } from 'lucide-react'
import { homePathFor, useAuth } from '../hooks/useAuth'
import { errMsg } from '../services/api'

export default function Login() {
  const { user, login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [f, setF] = useState({ email: '', password: '', remember: false })
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  if (user) return <Navigate to={homePathFor(user.role)} replace />

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const u = await login(f.email, f.password, f.remember)
      nav(loc.state?.from?.pathname || homePathFor(u.role), { replace: true })
    } catch (ex) { setErr(errMsg(ex, 'Login failed')) } finally { setBusy(false) }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2 text-xl font-semibold text-navy-900"><ShieldAlert className="text-blue-600" /> SafeDrive Portal</div>
        <h1 className="mb-1 text-2xl font-bold">Sign in</h1>
        <p className="mb-6 text-sm text-slate-500">Vehicle accident monitoring &amp; insurance management</p>
        {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input id="password" type={show ? 'text' : 'password'} required autoComplete="current-password" className="input pr-10" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
              <button type="button" className="absolute right-2 top-2 text-slate-500" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div></div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.remember} onChange={(e) => setF({ ...f, remember: e.target.checked })} /> Remember me</label>
            <button type="button" className="text-blue-600 hover:underline" onClick={() => setForgot(!forgot)}>Forgot password?</button>
          </div>
          {forgot && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Self-service email reset is not configured. Please ask your administrator to reset your password.</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">New here? <Link to="/register" className="font-medium text-blue-600 hover:underline">Create an account</Link></p>
      </div>
    </div>
  )
}
