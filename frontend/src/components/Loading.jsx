export default function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
export function ErrorBox({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
      {message}
      {onRetry && <button onClick={onRetry} className="ml-3 font-semibold underline">Retry</button>}
    </div>
  )
}
export function Empty({ children = 'Nothing to show yet.' }) {
  return <div className="p-8 text-center text-sm text-slate-500">{children}</div>
}
