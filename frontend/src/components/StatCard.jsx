const TONES = {
  primary: 'bg-teal-50 text-primary border-teal-100',
  blue: 'bg-sky-50 text-semantic-info border-sky-100',
  info: 'bg-sky-50 text-semantic-info border-sky-100',
  red: 'bg-red-50 text-semantic-danger border-red-100',
  danger: 'bg-red-50 text-semantic-danger border-red-100',
  green: 'bg-emerald-50 text-semantic-success border-emerald-100',
  success: 'bg-emerald-50 text-semantic-success border-emerald-100',
  amber: 'bg-amber-50 text-semantic-warning border-amber-100',
  warning: 'bg-amber-50 text-semantic-warning border-amber-100',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
}

export default function StatCard({ icon: Icon, label, value, tone = 'primary' }) {
  const chipStyle = TONES[tone] || TONES.primary

  return (
    <div className="card flex items-center gap-4 transition-all duration-150 hover:shadow-md">
      {Icon && (
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${chipStyle} flex-shrink-0`}>
          <Icon size={22} strokeWidth={2.2} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-2xl font-bold tracking-tight text-app-text">{value ?? '—'}</div>
        <div className="text-sm font-medium text-app-muted truncate">{label}</div>
      </div>
    </div>
  )
}
