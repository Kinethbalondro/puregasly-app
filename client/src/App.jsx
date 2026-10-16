import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { setNavigate } from './utils/navigation';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { FavoritesProvider } from './context/FavoritesContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ManageEmployees from './pages/ManageEmployees';
import ManageInventory from './pages/ManageInventory';
import StoreOrders from './pages/StoreOrders';
import StoreAnalytics from './pages/StoreAnalytics';
import CustomerOrders from './pages/CustomerOrders';
import ManageRiders from './pages/ManageRiders';
import SecuritySettings from './pages/SecuritySettings';
import Favorites from './pages/Favorites';
import AddressBook from './pages/AddressBook';
import ManageCoupons from './pages/ManageCoupons';

const guard = (element, roles) => <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;

// Registers React Router's navigate() with utils/navigation.js so code
// outside of components (the axios interceptor) can trigger a client-side
// route change instead of a hard page reload.
function NavigationSync() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate(navigate);
    return () => setNavigate(null);
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <FavoritesProvider>
            <CartProvider>
              <ScrollToTop />
              <NavigationSync />
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={guard(<Dashboard />)} />
                <Route path="/orders" element={guard(<CustomerOrders />, ['customer'])} />
                <Route path="/employees" element={guard(<ManageEmployees />, ['owner'])} />
                <Route path="/inventory" element={guard(<ManageInventory />, ['owner', 'employee'])} />
                <Route path="/store-orders" element={guard(<StoreOrders />, ['owner', 'employee'])} />
                <Route path="/analytics" element={guard(<StoreAnalytics />, ['owner', 'employee'])} />
                <Route path="/riders" element={guard(<ManageRiders />, ['owner', 'employee'])} />
                <Route path="/security" element={guard(<SecuritySettings />)} />
                <Route path="/favorites" element={guard(<Favorites />, ['customer'])} />
                <Route path="/addresses" element={guard(<AddressBook />, ['customer'])} />
                <Route path="/coupons" element={guard(<ManageCoupons />, ['owner', 'employee'])} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </CartProvider>
            </FavoritesProvider>
          </ConfirmProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
