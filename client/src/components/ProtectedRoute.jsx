import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StoreBannedGate from './StoreBannedGate';

// roles (optional): only these roles may open the route.
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // A banned store's owner can log in, but only to see the notice and appeal.
  if (user.role === 'owner' && user.store?.status === 'banned') {
    return <StoreBannedGate />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
