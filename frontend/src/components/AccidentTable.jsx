import { Link } from 'react-router-dom'
import { MapPin, ShieldAlert, ChevronRight } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { Empty } from './Loading'

export default function AccidentTable({ items, showOwner = false, showClaim = true }) {
  if (!items?.length) {
    return (
      <Empty
        icon={ShieldAlert}
        title="No accident records"
      >
        No incidents have been logged yet for the selected view.
      </Empty>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-app-border bg-white shadow-soft">
      <table className="min-w-full divide-y divide-app-border">
        <thead>
          <tr>
            <th className="th">Accident ID</th>
            <th className="th">Vehicle</th>
            {showOwner && <th className="th">Owner</th>}
            <th className="th">Date &amp; Time</th>
            <th className="th">Location (Map)</th>
            <th className="th">Status</th>
            {showClaim && <th className="th">Claim</th>}
            <th className="th text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border bg-white">
          {items.map((a) => {
            const mapUrl =
              a.google_maps_url ||
              (a.latitude && a.longitude
                ? `https://www.google.com/maps?q=${a.latitude},${a.longitude}`
                : null)

            return (
              <tr key={a.accident_id} className="hover:bg-slate-50/80 transition-colors duration-100">
                <td className="td font-mono text-xs font-semibold text-app-text">{a.accident_id}</td>
                <td className="td font-medium text-app-text">{a.vehicle_number}</td>
                {showOwner && <td className="td text-app-muted">{a.owner_name}</td>}
                <td className="td whitespace-nowrap text-app-muted text-xs">
                  {new Date(a.accident_date).toLocaleString()}
                </td>
                <td className="td">
                  {a.gps_valid && a.latitude != null ? (
                    <a
                      className="inline-flex items-center gap-1.5 font-medium text-xs text-primary hover:text-primary-hover hover:underline"
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open in Google Maps"
                    >
                      <MapPin size={14} className="text-semantic-danger flex-shrink-0" />
                      <span>
                        {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
                      </span>
                    </a>
                  ) : (
                    <span className="text-xs text-app-muted italic">GPS unavailable</span>
                  )}
                </td>
                <td className="td">
                  <StatusBadge status={a.accident_status} />
                </td>
                {showClaim && (
                  <td className="td">
                    <StatusBadge status={a.claim_status} />
                  </td>
                )}
                <td className="td text-right">
                  <Link
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                    to={`/accidents/${a.accident_id}`}
                  >
                    View details <ChevronRight size={14} />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
