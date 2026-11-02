import { Link } from 'react-router-dom'
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <h1 className="text-5xl font-bold text-slate-800">404</h1>
      <p className="text-slate-500">That page does not exist.</p>
      <Link to="/" className="btn-primary">Go home</Link>
    </div>
  )
}
