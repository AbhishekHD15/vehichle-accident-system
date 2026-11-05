import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import icon2x from 'leaflet/dist/images/marker-icon-2x.png'
import shadow from 'leaflet/dist/images/marker-shadow.png'

L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: icon2x,
  shadowUrl: shadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

/** Shows a marker only for a validated GPS fix. Never shows a placeholder location. */
export default function LocationMap({ accident, height = 320 }) {
  if (!accident?.gps_valid || accident.latitude == null || accident.longitude == null) {
    return (
      <div className="rounded-xl border border-dashed border-app-border bg-slate-50/70 p-6 text-center text-xs text-app-muted">
        GPS location unavailable for this event.
      </div>
    )
  }
  const pos = [accident.latitude, accident.longitude]
  return (
    <div>
      <MapContainer center={pos} zoom={15} style={{ height, width: '100%' }} className="rounded-xl">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={pos}>
          <Popup>
            <div className="text-xs">
              <b className="text-app-text">{accident.accident_id}</b>
              <br />
              <span>{accident.vehicle_number}</span>
              <br />
              <span className="font-mono">
                {accident.latitude.toFixed(5)}, {accident.longitude.toFixed(5)}
              </span>
              <br />
              <span className="text-slate-500">{new Date(accident.accident_date).toLocaleString()}</span>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
      <p className="mt-2 text-xs text-app-muted">
        <span className="font-mono font-medium">
          {accident.latitude.toFixed(6)}, {accident.longitude.toFixed(6)}
        </span>{' '}
        · recorded {new Date(accident.accident_date).toLocaleString()} ·{' '}
        <a
          className="font-medium text-primary hover:text-primary-hover hover:underline"
          href={accident.google_maps_url || `https://www.google.com/maps?q=${accident.latitude},${accident.longitude}`}
          target="_blank"
          rel="noreferrer"
        >
          Open in Google Maps &rarr;
        </a>
      </p>
    </div>
  )
}
