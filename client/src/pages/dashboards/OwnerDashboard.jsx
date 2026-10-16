import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { errMsg, formatPHP, formatDateTime, STATUS_LABELS } from '../../utils/format';
import { SkeletonRows } from '../../components/Skeleton';
import usePageTitle from '../../utils/usePageTitle';

export default function OwnerDashboard({ user }) {
  usePageTitle('Dashboard');
  const { refresh } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState(null);

  const [address, setAddress] = useState(user.store?.address || '');
  const [phone, setPhone] = useState(user.store?.phone || '');
  const [description, setDescription] = useState(user.store?.description || '');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/analytics/summary', { params: { days: 7 } }).then((r) => setStats(r.data)).catch(() => {});
    api
      .get('/store-orders')
      .then((r) => setRecentOrders(r.data.slice(0, 5)))
      .catch(() => setRecentOrders([]));
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      await api.patch('/store/profile', { address, phone, description });
      await refresh();
      setMsg({ type: 'success', text: 'Store profile saved.' });
    } catch (err) {
      setMsg({ type: 'error', text: errMsg(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="hero">
        <div>
          <h1>{user.store?.name || 'Your store'}</h1>
          <p>Welcome back, {user.name}. Here's how the store is doing.</p>
        </div>
        <span className="role-badge">Store Owner</span>
      </div>

      {!stats && (
        <div className="kpi-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kpi skeleton-row">
              <span className="skeleton-block" style={{ width: '55%', height: 10 }} />
              <span className="skeleton-block" style={{ width: '40%', height: 20, marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div className="kpi-grid">
          <div className="kpi accent"><span className="kpi-icon">💰</span><span>Today's revenue</span><strong>{formatPHP(stats.today.revenue)}</strong><em>{stats.today.orders} orders</em></div>
          <div className={`kpi ${stats.totals.newOrders ? 'warn' : ''}`}><span className="kpi-icon">🔔</span><span>New orders</span><strong>{stats.totals.newOrders}</strong><em>{stats.totals.activeOrders} in progress</em></div>
          <div className="kpi"><span className="kpi-icon">📈</span><span>Last 7 days</span><strong>{formatPHP(stats.period.revenue)}</strong><em>{stats.period.orders} orders</em></div>
          <div className={`kpi ${stats.inventory.lowStock.length + stats.inventory.outOfStock ? 'danger' : ''}`}>
            <span className="kpi-icon">⚠️</span>
            <span>Needs restock</span><strong>{stats.inventory.lowStock.length + stats.inventory.outOfStock}</strong>
            <em>{stats.inventory.outOfStock} out of stock</em>
          </div>
        </div>
      )}

      <div className="feature-grid big">
        <Link to="/store-orders" className="feature-card clickable">📦 Orders<span>Accept & update deliveries</span></Link>
        <Link to="/inventory" className="feature-card clickable">📊 Inventory & Sales<span>Products, stock, promos</span></Link>
        <Link to="/coupons" className="feature-card clickable">🎟️ Coupons<span>Promo codes</span></Link>
        <Link to="/analytics" className="feature-card clickable">📈 Analytics<span>Revenue & top products</span></Link>
        <Link to="/riders" className="feature-card clickable">🛵 Riders<span>Add & assign deliveries</span></Link>
        <Link to="/employees" className="feature-card clickable">👥 Employees<span>Add & assign roles</span></Link>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Recent orders</h3>
          <Link to="/store-orders" className="link-btn">View all →</Link>
        </div>
        {!recentOrders ? (
          <SkeletonRows count={3} />
        ) : recentOrders.length === 0 ? (
          <p className="empty small">No orders yet.</p>
        ) : (
          <div className="row-list">
            {recentOrders.map((o) => (
              <div key={o.id} className="row-item compact">
                <div>
                  <strong>{o.orderNo}</strong>
                  <span className="muted small"> · {o.customer?.name || 'Customer'}</span>
                  <div className="muted small">{formatDateTime(o.createdAt)} · {formatPHP(o.total)}</div>
                </div>
                <span className={`status-pill ${o.status}`}>{o.status === 'pending' ? 'New' : STATUS_LABELS[o.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <form className="panel" onSubmit={saveProfile}>
        <h3>Store profile</h3>
        <p className="muted small">This is what customers see when they browse stores.</p>
        {msg.text && <div className={`message ${msg.type}`}>{msg.text}</div>}
        <div className="form-grid">
          <div className="field"><label>Address</label><input maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="field"><label>Phone</label><input maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="field span2"><label>Short description</label><input maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <button className="btn-solid" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
      </form>
    </>
  );
}
