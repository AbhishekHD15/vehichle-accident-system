import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import icon2x from 'leaflet/dist/images/marker-icon-2x.png'
import shadow from 'leaflet/dist/images/marker-shadow.png'

L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon, iconRetinaUrl: icon2x, shadowUrl: shadow, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

/** Shows a marker only for a validated GPS fix. Never shows a placeholder location. */
export default function LocationMap({ accident, height = 320 }) {
  if (!accident?.gps_valid || accident.latitude == null || accident.longitude == null) {
    return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">GPS location unavailable.</div>
  }
  const pos = [accident.latitude, accident.longitude]
  return (
    <div>
      <MapContainer center={pos} zoom={15} style={{ height, width: '100%' }} className="rounded-lg">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={pos}>
          <Popup>
            <b>{accident.accident_id}</b><br />{accident.vehicle_number}<br />
            {accident.latitude.toFixed(5)}, {accident.longitude.toFixed(5)}<br />
            {new Date(accident.accident_date).toLocaleString()}
          </Popup>
        </Marker>
      </MapContainer>
      <p className="mt-2 text-xs text-slate-500">
        {accident.latitude.toFixed(6)}, {accident.longitude.toFixed(6)} · position at time of event ({new Date(accident.accident_date).toLocaleString()}) ·{' '}
        <a className="text-blue-600 underline" href={accident.google_maps_url} target="_blank" rel="noreferrer">Open in Google Maps</a>
      </p>
    </div>
  )
}
