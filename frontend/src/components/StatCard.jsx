export default function StatCard({ icon: Icon, label, value, tone = 'blue' }) {
  const tones = { blue: 'bg-blue-50 text-blue-600', red: 'bg-red-50 text-red-600', green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600' }
  return (
    <div className="card flex items-center gap-4">
      {Icon && <div className={`rounded-lg p-3 ${tones[tone]}`}><Icon size={22} /></div>}
      <div>
        <div className="text-2xl font-bold">{value ?? '—'}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  )
}
