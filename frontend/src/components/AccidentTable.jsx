import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { Empty } from './Loading'

export default function AccidentTable({ items, showOwner = false, showClaim = true }) {
  if (!items?.length) return <Empty>No accident records found.</Empty>
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead><tr>
          <th className="th">Accident ID</th><th className="th">Vehicle</th>
          {showOwner && <th className="th">Owner</th>}
          <th className="th">Date &amp; time</th><th className="th">Location (Map)</th><th className="th">Status</th>
          {showClaim && <th className="th">Claim</th>}<th className="th" />
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((a) => {
            const mapUrl = a.google_maps_url || (a.latitude && a.longitude ? `https://www.google.com/maps?q=${a.latitude},${a.longitude}` : null)
            return (
              <tr key={a.accident_id} className="hover:bg-slate-50">
                <td className="td font-mono text-xs">{a.accident_id}</td>
                <td className="td font-medium">{a.vehicle_number}</td>
                {showOwner && <td className="td">{a.owner_name}</td>}
                <td className="td whitespace-nowrap">{new Date(a.accident_date).toLocaleString()}</td>
                <td className="td">
                  {a.gps_valid && a.latitude != null ? (
                    <a
                      className="inline-flex items-center gap-1.5 font-medium text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open in Google Maps"
                    >
                      <MapPin size={14} className="text-red-500 flex-shrink-0" />
                      <span>{a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 text-xs">GPS unavailable</span>
                  )}
                </td>
                <td className="td"><StatusBadge status={a.accident_status} /></td>
                {showClaim && <td className="td"><StatusBadge status={a.claim_status} /></td>}
                <td className="td"><Link className="font-medium text-blue-600 hover:underline" to={`/accidents/${a.accident_id}`}>View details</Link></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
