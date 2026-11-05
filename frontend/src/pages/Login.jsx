import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { homePathFor, useAuth } from '../hooks/useAuth'
import { errMsg } from '../services/api'
import Logo from '../components/Logo'

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
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const u = await login(f.email, f.password, f.remember)
      nav(loc.state?.from?.pathname || homePathFor(u.role), { replace: true })
    } catch (ex) {
      setErr(errMsg(ex, 'Login failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar-bg p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-app-border">
        <div className="mb-6 flex items-center gap-2.5 text-xl font-bold text-app-text">
          <Logo size={26} className="text-primary" />
          <span>CrashSense</span>
        </div>
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-app-text">Sign in</h1>
        <p className="mb-6 text-sm text-app-muted">Vehicle accident monitoring &amp; insurance claims portal</p>
        {err && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-semantic-danger">
            {err}
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={show ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="input pr-10"
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
              />
              <button
                type="button"
                className="absolute right-2.5 top-2.5 text-app-muted hover:text-app-text"
                onClick={() => setShow(!show)}
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-app-text cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-app-border text-primary focus:ring-primary"
                checked={f.remember}
                onChange={(e) => setF({ ...f, remember: e.target.checked })}
              />
              Remember me
            </label>
            <button
              type="button"
              className="text-primary font-medium hover:underline text-xs"
              onClick={() => setForgot(!forgot)}
            >
              Forgot password?
            </button>
          </div>
          {forgot && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-app-muted">
              Self-service email reset is not configured. Please ask your administrator to reset your password.
            </p>
          )}
          <button className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-app-muted">
          New here?{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
