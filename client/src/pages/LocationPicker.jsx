import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Pin icon (emoji) so we don't depend on Leaflet's default image files
const pinIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:30px;line-height:30px;">📍</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

// Philippines overview, used until a location is chosen
const DEFAULT_CENTER = [12.8797, 121.774];

// value = { lat, lng } or null. onChange({ lat, lng }) is called when the pin moves.
// onPlaceSelected(name) is optional: called with the place name picked from the search results.
export default function LocationPicker({ value, onChange, onPlaceSelected, height = 320 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [msg, setMsg] = useState('');

  // Place search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');

  onChangeRef.current = onChange;

  const hasValue = !!value && Number.isFinite(value.lat) && Number.isFinite(value.lng);

  // Create the map once
  useEffect(() => {
    const map = L.map(elRef.current).setView(DEFAULT_CENTER, 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.on('click', (e) => {
      onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Keep the pin in sync with the value
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!hasValue) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    const pos = [value.lat, value.lng];
    if (!markerRef.current) {
      const marker = L.marker(pos, { icon: pinIcon, draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      markerRef.current = marker;
      map.setView(pos, 16);
    } else {
      markerRef.current.setLatLng(pos);
      if (map.getZoom() < 15) map.setView(pos, 16);
      else map.panTo(pos);
    }
  }, [hasValue, value?.lat, value?.lng]);

  function useMyLocation() {
    setMsg('');
    if (!navigator.geolocation) {
      setMsg('Your browser does not support location. Search or tap the map instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMsg('Could not get your location. Allow location access, or search for it instead.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function runSearch() {
    const q = query.trim();
    setSearchMsg('');
    setResults([]);
    if (q.length < 3) {
      setSearchMsg('Type at least 3 letters to search.');
      return;
    }

    setSearching(true);
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=ph&accept-language=en&q=' +
        encodeURIComponent(q);
      const res = await fetch(url);
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      if (!data.length) {
        setSearchMsg('No places found. Try a nearby barangay, street, or city name.');
      } else {
        setResults(data);
      }
    } catch {
      setSearchMsg('Search is not available right now. Tap the map instead.');
    } finally {
      setSearching(false);
    }
  }

  function pickResult(r) {
    onChange({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    if (onPlaceSelected) onPlaceSelected(r.display_name);
    setResults([]);
    setSearchMsg('');
  }

  return (
    <div>
      {/* Search box (not a <form>, because this component sits inside other forms) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={query}
          placeholder="Search a place, e.g. Dagupan City"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runSearch();
            }
          }}
          style={{ flex: 1, minWidth: 180 }}
        />
        <button
          type="button"
          className="btn-primary"
          onClick={runSearch}
          disabled={searching}
          style={{ width: 'auto', padding: '8px 14px' }}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searchMsg && <p className="muted small" style={{ marginBottom: 8 }}>{searchMsg}</p>}

      {results.length > 0 && (
        <div
          style={{
            border: '1px solid rgba(128,128,128,0.35)',
            borderRadius: 12,
            marginBottom: 8,
            overflow: 'hidden',
          }}
        >
          {results.map((r, i) => {
            const parts = String(r.display_name).split(',');
            const title = parts[0];
            const rest = parts.slice(1).join(',').trim();
            return (
              <button
                key={r.place_id}
                type="button"
                onClick={() => pickResult(r)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(128,128,128,0.25)',
                  color: 'inherit',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                <strong>📍 {title}</strong>
                {rest && (
                  <div className="muted small" style={{ marginTop: 2 }}>
                    {rest}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={elRef}
        style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', zIndex: 0 }}
      />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" onClick={useMyLocation} style={{ width: 'auto', padding: '8px 14px' }}>
          Use my current location
        </button>
        <span className="muted small">
          {hasValue
            ? `Pin set: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
            : 'Search above, or tap the map to drop a pin, then drag it to adjust.'}
        </span>
      </div>
      {msg && <p className="muted small" style={{ marginTop: 6 }}>{msg}</p>}
    </div>
  );
}