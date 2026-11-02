const COLORS = {
  EMERGENCY_DISPATCHED: 'bg-red-100 text-red-800', DETECTED: 'bg-amber-100 text-amber-800',
  CANCELLED: 'bg-slate-200 text-slate-700', RESOLVED: 'bg-green-100 text-green-800', FALSE_ALARM: 'bg-slate-200 text-slate-700',
  NOT_INITIATED: 'bg-slate-100 text-slate-600', SUBMITTED: 'bg-blue-100 text-blue-800', IN_PROGRESS: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800', REJECTED: 'bg-red-100 text-red-800', SETTLED: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-slate-100 text-slate-700', DELIVERED: 'bg-green-100 text-green-800', FAILED: 'bg-red-100 text-red-800',
  UNKNOWN: 'bg-amber-100 text-amber-800', ACTIVE: 'bg-green-100 text-green-800', DISABLED: 'bg-red-100 text-red-800',
}
export default function StatusBadge({ status }) {
  if (!status) return null
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLORS[status] || 'bg-slate-100 text-slate-700'}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}
