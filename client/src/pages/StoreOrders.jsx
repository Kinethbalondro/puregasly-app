import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import OrderTracker from '../components/OrderTracker';
import { errMsg, formatDateTime, formatPHP, STATUS_LABELS, downloadBlob } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Spinner from '../components/Spinner';
import { SkeletonRows } from '../components/Skeleton';
import usePageTitle from '../utils/usePageTitle';
import { toCSV, downloadCSV } from '../utils/csv';

const TABS = ['pending', 'preparing', 'out_for_delivery', 'delivered', 'received', 'cancelled'];

// What the store's next button says for each status.
const ACTION_LABEL = {
  pending: 'Accept · Start Preparing',
  preparing: 'Out for Delivery',
  out_for_delivery: 'Mark as Delivered',
};

export default function StoreOrders() {
  usePageTitle('Orders');
  const toast = useToast();
  const confirmDialog = useConfirm();
  const { user } = useAuth();
  const canManageRiders = user.role === 'owner' || user.permissions?.includes('manage_orders') || user.permissions?.includes('manage_riders');

  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/store-orders');
      setOrders(res.data);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Could not load orders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // new orders show up on their own
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (canManageRiders) {
      api.get('/riders').then((res) => setRiders(res.data)).catch(() => {});
    }
  }, [canManageRiders]);

  async function act(id, action, confirmOptions) {
    if (confirmOptions) {
      const ok = await confirmDialog(confirmOptions.message, confirmOptions);
      if (!ok) return;
    }
    setBusyId(id);
    try {
      await api.patch(`/store-orders/${id}/${action}`);
      if (action === 'decline') toast('Order declined.');
      await load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function assignRider(id, riderId) {
    setBusyId(id);
    try {
      await api.patch(`/store-orders/${id}/assign-rider`, { riderId: riderId || null });
      toast(riderId ? 'Rider assigned.' : 'Rider unassigned.');
      await load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function downloadReceipt(o) {
    try {
      const res = await api.get(`/store-orders/${o.id}/receipt`, { responseType: 'blob' });
      downloadBlob(res.data, `${o.orderNo}-receipt.pdf`);
    } catch (err) {
      toast(errMsg(err, 'Could not download the receipt.'), { type: 'error' });
    }
  }

  const counts = TABS.reduce((acc, t) => ({ ...acc, [t]: orders.filter((o) => o.status === t).length }), {});
  const shown = orders.filter((o) => o.status === tab);

  function exportCSV() {
    const csv = toCSV(
      [
        { key: 'orderNo', label: 'Order No' },
        { key: 'createdAt', label: 'Date', value: (o) => formatDateTime(o.createdAt) },
        { key: 'status', label: 'Status', value: (o) => STATUS_LABELS[o.status] || o.status },
        { key: 'customer', label: 'Customer', value: (o) => o.customer?.name || '' },
        { key: 'contactNumber', label: 'Contact' },
        { key: 'deliveryAddress', label: 'Address' },
        { key: 'items', label: 'Items', value: (o) => o.items.map((it) => `${it.qty}x ${it.name}`).join('; ') },
        { key: 'subtotal', label: 'Subtotal' },
        { key: 'discount', label: 'Discount' },
        { key: 'couponCode', label: 'Coupon' },
        { key: 'total', label: 'Total' },
        { key: 'rider', label: 'Rider', value: (o) => o.rider?.name || '' },
      ],
      orders
    );
    downloadCSV(`orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <AppShell wide>
      <div className="page-head">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="muted small">Accept new orders, then move them along until they're delivered. Refreshes automatically.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={exportCSV}>⬇ Export CSV</button>
          <button className="btn-ghost" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      <div className="tabs scroll">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {STATUS_LABELS[t]}
            {counts[t] > 0 && <span className={`tab-count ${t === 'pending' ? 'hot' : ''}`}>{counts[t]}</span>}
          </button>
        ))}
      </div>

      {error && <div className="message error">{error}</div>}
      {loading ? (
        <SkeletonRows count={3} />
      ) : shown.length === 0 ? (
        <p className="empty">No {STATUS_LABELS[tab].toLowerCase()} orders.</p>
      ) : (
        <div className="order-list">
          {shown.map((o) => (
            <div key={o.id} className="order-card">
              <div className="order-head">
                <div>
                  <strong>{o.orderNo}</strong>
                  <span className="muted small"> · {formatDateTime(o.createdAt)}</span>
                  <div className="small">
                    👤 {o.customer?.name || 'Customer'} · 📞 {o.contactNumber}
                  </div>
                </div>
                <strong className="price">{formatPHP(o.total)}</strong>
              </div>

              <OrderTracker status={o.status} />

              <ul className="order-items">
                {o.items.map((it, i) => (
                  <li key={i}>
                    <span>
                      {it.qty} × {it.name}
                      {it.brand ? ` · ${it.brand}` : ''}
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
              <p className="small">📍 {o.deliveryAddress}</p>
              {o.notes && <p className="small muted">📝 {o.notes}</p>}
              <p className="muted small">Payment: Cash on Delivery</p>

              {canManageRiders && ['preparing', 'out_for_delivery'].includes(o.status) && (
                <div className="field" style={{ maxWidth: 260, margin: '10px 0 0' }}>
                  <label className="form-label" style={{ margin: '0 0 4px' }}>Rider</label>
                  <select
                    value={o.rider?.id || ''}
                    disabled={busyId === o.id}
                    onChange={(e) => assignRider(o.id, e.target.value)}
                  >
                    <option value="">Unassigned (store delivers)</option>
                    {riders.filter((r) => !r.banned).map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                    {o.rider && riders.find((r) => r.id === o.rider.id)?.banned && (
                      <option value={o.rider.id}>{o.rider.name} (banned — reassign)</option>
                    )}
                  </select>
                </div>
              )}
              {o.rider && !['preparing', 'out_for_delivery'].includes(o.status) && (
                <p className="muted small">🛵 Rider: {o.rider.name}</p>
              )}

              <div className="order-actions">
                {ACTION_LABEL[o.status] && (
                  <button className="btn-solid" disabled={busyId === o.id} onClick={() => act(o.id, 'advance')}>
                    {busyId === o.id && <Spinner light />}{ACTION_LABEL[o.status]}
                  </button>
                )}
                {o.status === 'pending' && (
                  <button
                    className="btn-danger-outline"
                    disabled={busyId === o.id}
                    onClick={() =>
                      act(o.id, 'decline', { message: 'The customer will be notified and any stock reserved will be released.', title: 'Decline this order?', confirmLabel: 'Decline Order' })
                    }
                  >
                    Decline
                  </button>
                )}
                {o.status === 'delivered' && <span className="muted small">Waiting for the customer to confirm receipt.</span>}
                {['delivered', 'received'].includes(o.status) && (
                  <button className="btn-ghost small" onClick={() => downloadReceipt(o)}>
                    ⬇ Receipt
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
