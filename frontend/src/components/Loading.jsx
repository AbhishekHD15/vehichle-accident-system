import { FolderOpen } from 'lucide-react'

export default function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-app-muted" role="status">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div
      className="flex items-start justify-between rounded-xl border border-red-200 bg-red-50/75 p-4 text-sm text-semantic-danger shadow-soft"
      role="alert"
    >
      <div className="font-medium">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-3 font-semibold underline hover:no-underline flex-shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function Empty({
  icon: Icon = FolderOpen,
  title = 'No records found',
  children = 'Nothing to display at this time.',
  action = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 border border-slate-200/60 shadow-soft">
        <Icon size={24} strokeWidth={1.75} />
      </div>
      <h3 className="text-sm font-semibold text-app-text">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-app-muted leading-relaxed">
        {children}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
