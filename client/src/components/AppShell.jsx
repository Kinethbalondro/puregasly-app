import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import CartDrawer from './CartDrawer';
import NotificationBell from './NotificationBell';
import Avatar from './Avatar';
import { useTheme } from '../context/ThemeContext';

function navFor(user) {
  const has = (p) => user.role === 'owner' || user.permissions?.includes(p);
  const links = [{ to: '/dashboard', label: 'Dashboard', end: true }];

  if (user.role === 'customer') {
    links[0].label = 'Shop';
    links.push({ to: '/orders', label: 'My Orders' });
    links.push({ to: '/favorites', label: 'Favorites' });
    links.push({ to: '/addresses', label: 'Addresses' });
  }
  if (user.role === 'rider') {
    links[0].label = 'My Deliveries';
  }
  if (user.role === 'owner' || user.role === 'employee') {
    if (has('manage_orders')) links.push({ to: '/store-orders', label: 'Orders' });
    if (has('manage_inventory')) links.push({ to: '/inventory', label: 'Inventory' });
    if (has('manage_orders') || has('manage_coupons')) links.push({ to: '/coupons', label: 'Coupons' });
    if (has('view_analytics')) links.push({ to: '/analytics', label: 'Analytics' });
    if (has('manage_orders') || has('manage_riders')) links.push({ to: '/riders', label: 'Riders' });
    if (user.role === 'owner') links.push({ to: '/employees', label: 'Employees' });
  }
  return links;
}

export default function AppShell({ children, wide }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const cart = useCart();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the phone menu whenever the page changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // While the menu is open: Esc closes it and the page behind doesn't scroll.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate('/login');
  }

  return (
    <div className="dashboard-shell">
      <div className="topbar">
        <Link to="/dashboard" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src="/assets/logo.png" alt="PureGasly logo" />
          <span>PureGasly</span>
        </Link>

        <nav className="topnav">
          {navFor(user).map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-right">
          {user.role === 'customer' && (
            <button className="cart-btn" onClick={() => cart.setOpen(true)} aria-label="Open cart">
              🛒<span className="cart-label"> Cart</span>{cart.count > 0 && <span className="cart-count">{cart.count}</span>}
            </button>
          )}
          <button className="icon-toggle desk-only" onClick={toggle} aria-label="Toggle dark mode" title="Toggle dark mode">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <NotificationBell />
          <button className="icon-toggle desk-only" onClick={() => navigate('/security')} aria-label="Security" title="Security">
            🔒
          </button>
          <Link to="/profile" className="user-chip" title="My profile">
            <Avatar name={user.name} src={user.avatar} size={30} />
            <span className="user-chip-name">{user.name}</span>
          </Link>
          <button className="logout-btn desk-only" onClick={handleLogout}>
            Log Out
          </button>
          <button
            className="menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)}>
          <nav className="mobile-menu" aria-label="Main menu" onClick={(e) => e.stopPropagation()}>
            <Link to="/profile" className="mobile-menu-user">
              <Avatar name={user.name} src={user.avatar} size={44} />
              <span>
                <strong>{user.name}</strong>
                <em>{user.email}</em>
              </span>
            </Link>
            {navFor(user).map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `mobile-menu-link${isActive ? ' active' : ''}`}>
                {l.label}
              </NavLink>
            ))}
            <div className="mobile-menu-sep" />
            <NavLink to="/profile" className={({ isActive }) => `mobile-menu-link${isActive ? ' active' : ''}`}>My profile</NavLink>
            <NavLink to="/security" className={({ isActive }) => `mobile-menu-link${isActive ? ' active' : ''}`}>🔒 Security</NavLink>
            <button type="button" className="mobile-menu-link" onClick={toggle}>
              {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
            </button>
            <div className="mobile-menu-sep" />
            <button type="button" className="mobile-menu-link danger" onClick={handleLogout}>Log out</button>
          </nav>
        </div>
      )}

      <div className="page-main">
        <div key={location.pathname} className={wide ? 'page wide page-enter' : 'page page-enter'}>
          {children}
        </div>
      </div>

      <footer className="app-footer">
        <span>© {new Date().getFullYear()} PureGasly</span>
        <Link to="/privacy">Privacy Policy</Link>
      </footer>

      {user.role === 'customer' && <CartDrawer />}
    </div>
  );
}
