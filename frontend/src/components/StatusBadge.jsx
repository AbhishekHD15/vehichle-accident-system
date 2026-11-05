const BADGE_STYLES = {
  // Accident Statuses
  DETECTED: 'bg-red-50 text-semantic-danger border-red-200',
  EMERGENCY_DISPATCHED: 'bg-red-50 text-semantic-danger border-red-200',
  UNDER_REVIEW: 'bg-amber-50 text-semantic-warning border-amber-200',
  CONFIRMED: 'bg-orange-50 text-semantic-orange border-orange-200',
  RESOLVED: 'bg-emerald-50 text-semantic-success border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
  FALSE_ALARM: 'bg-slate-100 text-slate-600 border-slate-200',

  // Claim Statuses
  NOT_INITIATED: 'bg-slate-100 text-slate-600 border-slate-200',
  SUBMITTED: 'bg-sky-50 text-semantic-info border-sky-200',
  IN_PROGRESS: 'bg-amber-50 text-semantic-warning border-amber-200',
  APPROVED: 'bg-emerald-50 text-semantic-success border-emerald-200',
  REJECTED: 'bg-red-50 text-semantic-danger border-red-200',
  SETTLED: 'bg-emerald-50 text-semantic-success border-emerald-200',

  // Device Statuses
  ACTIVE: 'bg-emerald-50 text-semantic-success border-emerald-200',
  DISABLED: 'bg-slate-100 text-slate-600 border-slate-200',

  // Notification Statuses
  PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
  DELIVERED: 'bg-emerald-50 text-semantic-success border-emerald-200',
  SENT: 'bg-emerald-50 text-semantic-success border-emerald-200',
  FAILED: 'bg-red-50 text-semantic-danger border-red-200',
  UNKNOWN: 'bg-amber-50 text-semantic-warning border-amber-200',

  // Online / Offline
  ONLINE: 'bg-emerald-50 text-semantic-success border-emerald-200',
  OFFLINE: 'bg-slate-100 text-slate-500 border-slate-200',
}

export function ConnectionDot({ online }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className={`h-2 w-2 rounded-full ${
          online ? 'bg-semantic-success animate-pulse' : 'bg-slate-400'
        }`}
      />
      <span className={online ? 'text-semantic-success font-semibold' : 'text-slate-500'}>
        {online ? 'Online' : 'Offline'}
      </span>
    </span>
  )
}

export default function StatusBadge({ status, isOnline = null, className = '' }) {
  if (isOnline !== null) {
    return <ConnectionDot online={Boolean(isOnline)} />
  }

  if (!status) return null

  const normalized = String(status).toUpperCase().replace(/\s+/g, '_')
  const style = BADGE_STYLES[normalized] || 'bg-slate-100 text-slate-700 border-slate-200'
  const displayText = status.replaceAll('_', ' ')

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${style} ${className}`}
    >
      {displayText}
    </span>
  )
}
