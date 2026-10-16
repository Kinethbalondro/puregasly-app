import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import OrderTracker from '../components/OrderTracker';
import { errMsg, formatDateTime, formatPHP, STATUS_LABELS, downloadBlob } from '../utils/format';
import ReviewModal from '../components/ReviewModal';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Spinner from '../components/Spinner';
import { SkeletonRows } from '../components/Skeleton';
import usePageTitle from '../utils/usePageTitle';

const FILTERS = [
  { key: 'active', label: 'Active', match: (o) => ['pending', 'preparing', 'out_for_delivery', 'delivered'].includes(o.status) },
  { key: 'done', label: 'Completed', match: (o) => o.status === 'received' },
  { key: 'cancelled', label: 'Cancelled', match: (o) => o.status === 'cancelled' },
];

export default function CustomerOrders() {
  usePageTitle('My Orders');
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/orders/mine');
      setOrders(res.data);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Could not load your orders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // pick up status changes from the store
    return () => clearInterval(t);
  }, [load]);

  async function act(id, action, confirmOptions) {
    if (confirmOptions) {
      const ok = await confirmDialog(confirmOptions.message, confirmOptions);
      if (!ok) return;
    }
    setBusyId(id);
    try {
      await api.patch(`/orders/${id}/${action}`);
      if (action === 'received') toast('Thanks for confirming!');
      if (action === 'cancel') toast('Order cancelled.');
      await load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function downloadReceipt(o) {
    try {
      const res = await api.get(`/orders/${o.id}/receipt`, { responseType: 'blob' });
      downloadBlob(res.data, `${o.orderNo}-receipt.pdf`);
    } catch (err) {
      toast(errMsg(err, 'Could not download the receipt.'), { type: 'error' });
    }
  }

  const current = FILTERS.find((f) => f.key === filter);
  const shown = orders.filter(current.match);

  return (
    <AppShell>
      <h1 className="page-title">My Orders</h1>

      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
            {f.label} ({orders.filter(f.match).length})
          </button>
        ))}
      </div>

      {error && <div className="message error">{error}</div>}
      {loading ? (
        <SkeletonRows count={3} />
      ) : shown.length === 0 ? (
        <p className="empty">Nothing here yet.</p>
      ) : (
        <div className="order-list">
          {shown.map((o) => (
            <div key={o.id} className="order-card">
              <div className="order-head">
                <div>
                  <strong>{o.orderNo}</strong>
                  <span className="muted small"> · {o.storeName}</span>
                  <div className="muted small">{formatDateTime(o.createdAt)}</div>
                </div>
                <strong className="price">{formatPHP(o.total)}</strong>
              </div>

              <OrderTracker status={o.status} />

              <ul className="order-items">
                {o.items.map((it, i) => (
                  <li key={i}>
                    <span>
                      {it.qty} × {it.name}
                      {it.sizeKg ? ` (${it.sizeKg} kg)` : ''}
                    </span>
                    <span>{formatPHP(it.qty * it.unitPrice)}</span>
                  </li>
                ))}
                {o.discount > 0 && (
                  <li className="discount-line">
                    <span>🎟️ Coupon {o.couponCode}</span>
                    <span>-{formatPHP(o.discount)}</span>
                  </li>
                )}
              </ul>
              <p className="muted small">📍 {o.deliveryAddress}</p>
              {o.rider && <p className="muted small">🛵 Rider: {o.rider.name}</p>}

              <div className="order-actions">
                <span className={`status-pill ${o.status}`}>{o.status === 'pending' ? 'Waiting for store' : STATUS_LABELS[o.status]}</span>
                {o.status === 'pending' && (
                  <button
                    className="btn-danger small"
                    disabled={busyId === o.id}
                    onClick={() => act(o.id, 'cancel', { message: 'This cannot be undone.', title: 'Cancel this order?', confirmLabel: 'Cancel Order' })}
                  >
                    {busyId === o.id && <Spinner light />}Cancel Order
                  </button>
                )}
                {o.status === 'delivered' && (
                  <button className="btn-solid" disabled={busyId === o.id} onClick={() => act(o.id, 'received')}>
                    {busyId === o.id && <Spinner light />}ORDER RECEIVED
                  </button>
                )}
                {['delivered', 'received'].includes(o.status) && (
                  <button className="btn-ghost small" onClick={() => downloadReceipt(o)}>
                    ⬇ Receipt
                  </button>
                )}
                {o.status === 'received' && !o.reviewed && (
                  <button className="btn-ghost small" onClick={() => setReviewing(o)}>
                    ⭐ Rate & Review
                  </button>
                )}
                {o.status === 'received' && o.reviewed && <span className="muted small">✓ Reviewed</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewing && (
        <ReviewModal order={reviewing} onClose={() => setReviewing(null)} onSubmitted={load} />
      )}
    </AppShell>
  );
}
