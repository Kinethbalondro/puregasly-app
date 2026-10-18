import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:30px;line-height:30px;">📍</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

// Read-only map that shows where a store is
export default function StoreMap({ lat, lng, name, height = 240 }) {
  const elRef = useRef(null);
  const valid = Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!valid || !elRef.current) return;

    const map = L.map(elRef.current, { scrollWheelZoom: false }).setView([lat, lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    if (name) marker.bindPopup(name).openPopup();

    return () => map.remove();
  }, [valid, lat, lng, name]);

  if (!valid) {
    return <p className="muted small">This store has not set its location yet.</p>;
  }

  return (
    <div>
      <div
        ref={elRef}
        style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', zIndex: 0 }}
      />
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
        className="small"
        style={{ display: 'inline-block', marginTop: 6 }}
      >
        Open in Google Maps
      </a>
    </div>
  );
}