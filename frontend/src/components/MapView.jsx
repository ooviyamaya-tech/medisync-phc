import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';

const pin = color => L.divIcon({ className: 'map-pin', html: `<span style="--pin:${color}"></span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
const urgencyColor = level => ({ CRITICAL: '#dc4b4b', HIGH: '#e89135', MEDIUM: '#d1aa32', LOW: '#16a085' })[level] || '#0d9488';

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => { if (positions.length > 1) map.fitBounds(positions, { padding: [32, 32] }); else if (positions.length) map.setView(positions[0], 11); }, [map, positions]);
  return null;
}

export default function MapView({ phcs = [], selected, onSelect, recommendations = [], destination }) {
  const points = phcs.filter(phc => Number.isFinite(phc.latitude) && Number.isFinite(phc.longitude));
  const destinationPoint = destination && [destination.latitude, destination.longitude];
  const line = destinationPoint ? [destinationPoint, ...recommendations.slice(0, 1).map(item => [item.latitude, item.longitude])] : [];
  return <div className="map-frame"><MapContainer center={[20.2, 85.8]} zoom={9} scrollWheelZoom className="leaflet-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><FitBounds positions={[...points.map(item => [item.latitude, item.longitude]), ...(destinationPoint ? [destinationPoint] : [])]} />{points.map(phc => <Marker key={phc.id} position={[phc.latitude, phc.longitude]} icon={pin(urgencyColor(phc.urgency))} eventHandlers={{ click: () => onSelect?.(phc) }}><Popup><strong>{phc.name}</strong><br />{phc.urgency || 'PHC'}<br />{phc.shortage || ''}</Popup></Marker>)}{destinationPoint && <Marker position={destinationPoint} icon={pin('#087f79')}><Popup>Requesting PHC</Popup></Marker>}{line.length > 1 && <Polyline positions={line} pathOptions={{ color: '#087f79', dashArray: '7 8', weight: 3 }} />}</MapContainer></div>;
}