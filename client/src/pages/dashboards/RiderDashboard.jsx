import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import RouteMap from '../RouteMap';
import { errMsg, formatDateTime, formatPHP } from '../../utils/format';
import usePageTitle from '../../utils/usePageTitle';

const ACTION_LABEL = { preparing: 'Start Delivery (Out for Delivery)', out_for_delivery: 'Mark as Delivered' };
const STATUS_LABEL = { preparing: 'Ready for pickup', out_for_delivery: 'Out for Delivery', delivered: 'Delivered' };

const hasPin = (o) => typeof o.deliveryLat === 'number' && typeof o.deliveryLng === 'number';

// Text shown for when the customer wants the delivery.
const deliverWhen = (o) =>
  o.deliveryTimeType === 'scheduled' && o.scheduledLabel ? o.scheduledLabel : 'ASAP';

export default function RiderDashboard({ user }) {
  usePageTitle('My Deliveries');
  const [orders, setOrders] = useState([]);
  const [onlyActive, setOnlyActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [mapOpenId, setMapOpenId] = useState(null);
  // Delivery code typed by the rider, per order id
  const [codes, setCodes] = useState({});

  // Where the store is pinned (start of the route)
  const storePin =
    typeof user.store?.lat === 'number' && typeof user.store?.lng === 'number'
      ? { lat: user.store.lat, lng: user.store.lng }
      : null;

  const load = useCallback(async () => {
    try {
      const res = await api.get('/rider-orders', { params: { active: onlyActive ? 'true' : undefined } });
      setOrders(res.data);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Could not load your deliveries.'));
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function act(o) {
    setBusyId(o.id);
    setError('');
    try {
      const body = o.status === 'out_for_delivery' && o.requiresCode ? { code: (codes[o.id] || '').trim() } : {};
      await api.patch(`/rider-orders/${o.id}/advance`, body);
      setCodes((c) => ({ ...c, [o.id]: '' }));
      await load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="hero">
        <div>
          <h1>Hi {user.name.split(' ')[0]} 🛵</h1>
          <p>Your assigned deliveries. Move each one forward as you go.</p>
        </div>
        <span className="role-badge">Rider</span>
      </div>

      <div className="tabs compact">
        <button className={onlyActive ? 'active' : ''} onClick={() => setOnlyActive(true)}>Active</button>
        <button className={!onlyActive ? 'active' : ''} onClick={() => setOnlyActive(false)}>All</button>
      </div>

      {error && <div className="message error">{error}</div>}
      {loading ? (
        <p className="empty">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="empty">No deliveries assigned to you right now.</p>
      ) : (
        <div className="order-list">
          {orders.map((o) => (
            <div key={o.id} className="order-card">
              <div className="order-head">
                <div>
                  <strong>{o.orderNo}</strong>
                  <span className="muted small"> · {o.storeName}</span>
                  <div className="muted small">{formatDateTime(o.createdAt)}</div>
                </div>
                <strong className="price">{formatPHP(o.total)}</strong>
              </div>

              <span className={`status-pill ${o.status}`}>{STATUS_LABEL[o.status] || o.status}</span>

              <p className="small">👤 {o.customer?.name || 'Customer'} · 📞 {o.contactNumber}</p>
              <p className="small">📍 {o.deliveryAddress}</p>
              <p className="small">
                🕒 Deliver:{' '}
                {o.deliveryTimeType === 'scheduled' ? <strong>{deliverWhen(o)}</strong> : deliverWhen(o)}
              </p>

              {hasPin(o) ? (
                <div className="small" style={{ margin: '4px 0 8px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${o.deliveryLat},${o.deliveryLng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🧭 Navigate in Google Maps
                  </a>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setMapOpenId(mapOpenId === o.id ? null : o.id)}
                  >
                    {mapOpenId === o.id ? 'Hide route' : 'Show route'}
                  </button>
                </div>
              ) : (
                <p className="muted small">No map pin for this address. Call the customer if you need directions.</p>
              )}

              {mapOpenId === o.id && hasPin(o) && (
                <div style={{ marginBottom: 10 }}>
                  {storePin ? (
                    <RouteMap
                      from={storePin}
                      to={{ lat: o.deliveryLat, lng: o.deliveryLng }}
                      fromLabel={o.storeName || 'Store'}
                      toLabel={o.deliveryAddress}
                      height={260}
                    />
                  ) : (
                    <p className="muted small">The store has not pinned its location yet, so the route can't be shown.</p>
                  )}
                </div>
              )}

              {o.notes && <p className="muted small">📝 {o.notes}</p>}

              <ul className="order-items">
                {o.items.map((it, i) => (
                  <li key={i}>
                    <span>{it.qty} × {it.name}{it.sizeKg ? ` (${it.sizeKg} kg)` : ''}</span>
                  </li>
                ))}
              </ul>

              {o.status === 'out_for_delivery' && o.requiresCode && (
                <div className="field" style={{ maxWidth: 260, margin: '10px 0 0' }}>
                  <label className="form-label" style={{ margin: '0 0 4px' }}>
                    🔐 Customer's 4-digit delivery code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    value={codes[o.id] || ''}
                    onChange={(e) =>
                      setCodes((c) => ({ ...c, [o.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))
                    }
                  />
                  <p className="muted small" style={{ marginTop: 4 }}>
                    Ask the customer for the code shown in their My Orders page.
                  </p>
                </div>
              )}

              {ACTION_LABEL[o.status] && (
                <div className="order-actions">
                  <button className="btn-solid" disabled={busyId === o.id} onClick={() => act(o)}>
                    {ACTION_LABEL[o.status]}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}