import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireShop() {
  const { user, loading, isShopUser } = useAuth();
  if (loading) return <FullPageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isShopUser) return <Navigate to="/portal" replace />;
  return <Outlet />;
}

export function RequireDealer() {
  const { user, loading, isDealerUser } = useAuth();
  if (loading) return <FullPageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isDealerUser) return <Navigate to="/shop/board" replace />;
  return <Outlet />;
}

export function FullPageLoading() {
  return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
}
