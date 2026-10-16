import { Link } from 'react-router-dom';
import usePageTitle from '../../utils/usePageTitle';

export default function EmployeeDashboard({ user }) {
  usePageTitle('Dashboard');
  const has = (perm) => user.permissions?.includes(perm);
  const none = !user.permissions || user.permissions.length === 0;

  return (
    <>
      <div className="hero">
        <div>
          <h1>Welcome, {user.name}!</h1>
          <p>Store: {user.store?.name || 'Not assigned yet'}</p>
        </div>
        <span className="role-badge">Employee</span>
      </div>

      <div className="feature-grid big">
        {has('manage_orders') && (
          <Link to="/store-orders" className="feature-card clickable">📦 Orders<span>Accept & update deliveries</span></Link>
        )}
        {has('manage_inventory') && (
          <Link to="/inventory" className="feature-card clickable">📊 Inventory & Sales<span>Products & stock</span></Link>
        )}
        {(has('manage_orders') || has('manage_coupons')) && (
          <Link to="/coupons" className="feature-card clickable">🎟️ Coupons<span>Promo codes</span></Link>
        )}
        {has('view_analytics') && (
          <Link to="/analytics" className="feature-card clickable">📈 Analytics<span>Revenue & top products</span></Link>
        )}
        {(has('manage_orders') || has('manage_riders')) && (
          <Link to="/riders" className="feature-card clickable">🛵 Riders<span>Add & assign deliveries</span></Link>
        )}
        {none && <div className="feature-card">No permissions assigned yet<span>Ask your owner</span></div>}
      </div>

      <p className="placeholder-note">
        Employees are created by their store owner, and the owner decides which sections each employee can open.
      </p>
    </>
  );
}
