import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import OrderTracker from '../components/OrderTracker';
import RouteMap from './RouteMap';
import {
  errMsg,
  formatDateTime,
  formatPHP,
  STATUS_LABELS,
  downloadBlob,
} from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Spinner from '../components/Spinner';
import { SkeletonRows } from '../components/Skeleton';
import usePageTitle from '../utils/usePageTitle';
import { toCSV, downloadCSV } from '../utils/csv';

const TABS = [
  'pending',
  'preparing',
  'out_for_delivery',
  'delivered',
  'received',
  'cancelled',
];

const ACTION_LABEL = {
  pending: 'Accept · Start Preparing',
  preparing: 'Out for Delivery',
  out_for_delivery: 'Mark as Delivered',
};

const hasPin = (o) =>
  typeof o.deliveryLat === 'number' &&
  typeof o.deliveryLng === 'number';

// Text shown for when the customer wants the delivery.
const deliverWhen = (o) =>
  o.deliveryTimeType === 'scheduled' && o.scheduledLabel ? o.scheduledLabel : 'ASAP';

export default function StoreOrders() {
  usePageTitle('Orders');

  const toast = useToast();
  const confirmDialog = useConfirm();
  const { user } = useAuth();

  const canManageRiders =
    user?.role === 'owner' ||
    user?.permissions?.includes('manage_orders') ||
    user?.permissions?.includes('manage_riders');

  const storePin =
    typeof user?.store?.lat === 'number' &&
    typeof user?.store?.lng === 'number'
      ? { lat: user.store.lat, lng: user.store.lng }
      : null;

  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [mapOpenId, setMapOpenId] = useState(null);

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

    const timer = setInterval(load, 15000);

    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (canManageRiders) {
      api
        .get('/riders')
        .then((res) => setRiders(res.data))
        .catch(() => {});
    }
  }, [canManageRiders]);

  async function act(id, action, confirmOptions) {
    if (confirmOptions) {
      const ok = await confirmDialog(
        confirmOptions.message,
        confirmOptions
      );

      if (!ok) return;
    }

    setBusyId(id);

    try {
      await api.patch(`/store-orders/${id}/${action}`);

      if (action === 'decline') {
        toast('Order declined.');
      }

      await load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function assignRider(id, riderId) {
    setBusyId(id);

    try {
      await api.patch(`/store-orders/${id}/assign-rider`, {
        riderId: riderId || null,
      });

      toast(riderId ? 'Rider assigned.' : 'Rider unassigned.');

      await load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function downloadReceipt(order) {
    try {
      const res = await api.get(
        `/store-orders/${order.id}/receipt`,
        { responseType: 'blob' }
      );

      downloadBlob(
        res.data,
        `${order.orderNo}-receipt.pdf`
      );
    } catch (err) {
      toast(
        errMsg(err, 'Could not download the receipt.'),
        { type: 'error' }
      );
    }
  }

  const counts = TABS.reduce((acc, status) => {
    acc[status] = orders.filter(
      (order) => order.status === status
    ).length;

    return acc;
  }, {});

  const shown = orders.filter(
    (order) => order.status === tab
  );

  function exportCSV() {
    const csv = toCSV(
      [
        { key: 'orderNo', label: 'Order No' },
        {
          key: 'createdAt',
          label: 'Date',
          value: (o) => formatDateTime(o.createdAt),
        },
        {
          key: 'status',
          label: 'Status',
          value: (o) => STATUS_LABELS[o.status] || o.status,
        },
        {
          key: 'customer',
          label: 'Customer',
          value: (o) => o.customer?.name || '',
        },
        { key: 'contactNumber', label: 'Contact' },
        { key: 'deliveryAddress', label: 'Address' },
        {
          key: 'deliverWhen',
          label: 'Deliver',
          value: (o) => deliverWhen(o),
        },
        {
          key: 'items',
          label: 'Items',
          value: (o) =>
            o.items
              .map((item) => `${item.qty}x ${item.name}`)
              .join('; '),
        },
        { key: 'subtotal', label: 'Subtotal' },
        { key: 'discount', label: 'Discount' },
        { key: 'couponCode', label: 'Coupon' },
        { key: 'total', label: 'Total' },
        {
          key: 'rider',
          label: 'Rider',
          value: (o) => o.rider?.name || '',
        },
      ],
      orders
    );

    downloadCSV(
      `orders-${new Date().toISOString().slice(0, 10)}.csv`,
      csv
    );
  }

  return (
    <AppShell wide>
      <div className="page-head">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="muted small">
            Accept new orders, then move them along until
            they're delivered. Refreshes automatically.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={exportCSV}>
            ⬇ Export CSV
          </button>

          <button className="btn-ghost" onClick={load}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="tabs scroll">
        {TABS.map((status) => (
          <button
            key={status}
            className={tab === status ? 'active' : ''}
            onClick={() => setTab(status)}
          >
            {STATUS_LABELS[status]}

            {counts[status] > 0 && (
              <span
                className={`tab-count ${
                  status === 'pending' ? 'hot' : ''
                }`}
              >
                {counts[status]}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="message error">{error}</div>
      )}

      {loading ? (
        <SkeletonRows count={3} />
      ) : shown.length === 0 ? (
        <p className="empty">
          No {STATUS_LABELS[tab].toLowerCase()} orders.
        </p>
      ) : (
        <div className="order-list">
          {shown.map((o) => (
            <div key={o.id} className="order-card">
              <div className="order-head">
                <div>
                  <strong>{o.orderNo}</strong>

                  <span className="muted small">
                    {' · '}{formatDateTime(o.createdAt)}
                  </span>

                  <div className="small">
                    👤 {o.customer?.name || 'Customer'}
                    {' · '}📞 {o.contactNumber}
                  </div>
                </div>

                <strong className="price">
                  {formatPHP(o.total)}
                </strong>
              </div>

              <OrderTracker status={o.status} />

              <ul className="order-items">
                {(o.items || []).map((item, index) => (
                  <li key={index}>
                    <span>
                      {item.qty} × {item.name}
                      {item.brand ? ` · ${item.brand}` : ''}
                      {item.sizeKg
                        ? ` (${item.sizeKg} kg)`
                        : ''}
                    </span>

                    <span>
                      {formatPHP(item.qty * item.unitPrice)}
                    </span>
                  </li>
                ))}

                {o.discount > 0 && (
                  <li className="discount-line">
                    <span>🎟️ Coupon {o.couponCode}</span>
                    <span>-{formatPHP(o.discount)}</span>
                  </li>
                )}
              </ul>

              <p className="small">
                📍 {o.deliveryAddress}
              </p>

              <p className="small">
                🕒 Deliver:{' '}
                {o.deliveryTimeType === 'scheduled' ? (
                  <strong>{deliverWhen(o)}</strong>
                ) : (
                  deliverWhen(o)
                )}
              </p>

              {hasPin(o) ? (
                <div
                  className="small"
                  style={{
                    margin: '4px 0 8px',
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${o.deliveryLat},${o.deliveryLng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🗺️ Open in Google Maps
                  </a>

                  <button
                    type="button"
                    className="link-btn"
                    onClick={() =>
                      setMapOpenId(
                        mapOpenId === o.id ? null : o.id
                      )
                    }
                  >
                    {mapOpenId === o.id
                      ? 'Hide route'
                      : 'Show route'}
                  </button>
                </div>
              ) : (
                <p className="muted small">
                  No map pin for this address.
                </p>
              )}

              {mapOpenId === o.id && hasPin(o) && (
                <div style={{ marginBottom: 10 }}>
                  {storePin ? (
                    <RouteMap
                      from={storePin}
                      to={{
                        lat: o.deliveryLat,
                        lng: o.deliveryLng,
                      }}
                      fromLabel="Your store"
                      toLabel={o.deliveryAddress}
                      height={260}
                    />
                  ) : (
                    <p className="muted small">
                      Pin your store location in Dashboard
                      → Store profile to see the route.
                    </p>
                  )}
                </div>
              )}

              {o.notes && (
                <p className="small muted">
                  📝 {o.notes}
                </p>
              )}

              <p className="muted small">
                Payment: Cash on Delivery
              </p>

              {canManageRiders &&
                ['preparing', 'out_for_delivery'].includes(
                  o.status
                ) && (
                  <div
                    className="field"
                    style={{
                      maxWidth: 260,
                      margin: '10px 0 0',
                    }}
                  >
                    <label
                      className="form-label"
                      style={{ margin: '0 0 4px' }}
                    >
                      Rider
                    </label>

                    <select
                      value={o.rider?.id || ''}
                      disabled={busyId === o.id}
                      onChange={(event) =>
                        assignRider(o.id, event.target.value)
                      }
                    >
                      <option value="">
                        Unassigned (store delivers)
                      </option>

                      {riders
                        .filter((rider) => !rider.banned)
                        .map((rider) => (
                          <option
                            key={rider.id}
                            value={rider.id}
                          >
                            {rider.name}
                          </option>
                        ))}

                      {o.rider &&
                        riders.find(
                          (rider) => rider.id === o.rider.id
                        )?.banned && (
                          <option value={o.rider.id}>
                            {o.rider.name} (banned — reassign)
                          </option>
                        )}
                    </select>
                  </div>
                )}

              {o.rider &&
                !['preparing', 'out_for_delivery'].includes(
                  o.status
                ) && (
                  <p className="muted small">
                    🛵 Rider: {o.rider.name}
                  </p>
                )}

              <div className="order-actions">
                {ACTION_LABEL[o.status] && (
                  <button
                    className="btn-solid"
                    disabled={busyId === o.id}
                    onClick={() => act(o.id, 'advance')}
                  >
                    {busyId === o.id && <Spinner light />}
                    {ACTION_LABEL[o.status]}
                  </button>
                )}

                {o.status === 'pending' && (
                  <button
                    className="btn-danger-outline"
                    disabled={busyId === o.id}
                    onClick={() =>
                      act(o.id, 'decline', {
                        message:
                          'The customer will be notified and any stock reserved will be released.',
                        title: 'Decline this order?',
                        confirmLabel: 'Decline Order',
                      })
                    }
                  >
                    Decline
                  </button>
                )}

                {o.status === 'delivered' && (
                  <span className="muted small">
                    Waiting for the customer to confirm receipt.
                  </span>
                )}

                {['delivered', 'received'].includes(o.status) && (
                  <button
                    className="btn-ghost small"
                    onClick={() => downloadReceipt(o)}
                  >
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