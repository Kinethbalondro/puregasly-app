import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const icon = (emoji) =>
  L.divIcon({
    className: '',
    html: `<div style="font-size:28px;line-height:28px;">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

const isPoint = (p) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

// Shows a blue route line between two points, with distance and estimated time.
// from / to = { lat, lng }
export default function RouteMap({
  from,
  to,
  fromLabel = 'Store',
  toLabel = 'Delivery address',
  height = 320,
}) {
  const elRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const ok = isPoint(from) && isPoint(to);

  useEffect(() => {
    if (!ok || !elRef.current) return;

    let cancelled = false;
    setInfo(null);
    setError('');

    const map = L.map(elRef.current, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.marker([from.lat, from.lng], { icon: icon('🏪') }).addTo(map).bindPopup(fromLabel);
    L.marker([to.lat, to.lng], { icon: icon('📍') }).addTo(map).bindPopup(toLabel);
    map.fitBounds(
      [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
      { padding: [40, 40] }
    );

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const route = data.routes && data.routes[0];
        if (!route) {
          setError('No route found between these two points.');
          return;
        }
        const line = L.geoJSON(route.geometry, {
          style: { color: '#2563eb', weight: 6, opacity: 0.9 },
        }).addTo(map);
        map.fitBounds(line.getBounds(), { padding: [40, 40] });
        setInfo({ km: route.distance / 1000, min: Math.max(1, Math.round(route.duration / 60)) });
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the route. Check your internet and try again.');
      });

    return () => {
      cancelled = true;
      map.remove();
    };
  }, [ok, from?.lat, from?.lng, to?.lat, to?.lng, fromLabel, toLabel]);

  if (!ok) {
    return <p className="muted small">Route is not available yet. Both locations need to be pinned.</p>;
  }

  return (
    <div>
      <div
        ref={elRef}
        style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', zIndex: 0 }}
      />
      {info && (
        <p style={{ marginTop: 8 }}>
          <strong>{info.km.toFixed(1)} km</strong> · about <strong>{info.min} min</strong>
        </p>
      )}
      {error && <p className="muted small" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}