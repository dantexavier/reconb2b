import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RequireAuth, RequireShop, RequireDealer, FullPageLoading } from './components/ProtectedRoute';
import ShopLayout from './components/ShopLayout';
import PortalLayout from './components/PortalLayout';

import Login from './pages/Login';
import Board from './pages/shop/Board';
import Intake from './pages/shop/Intake';
import RODetail from './pages/shop/RODetail';
import Dealers from './pages/shop/Dealers';
import Analytics from './pages/shop/Analytics';
import TechView from './pages/shop/TechView';

import PortalHome from './pages/portal/Home';
import VehicleDetail from './pages/portal/VehicleDetail';
import History from './pages/portal/History';
import Documents from './pages/portal/Documents';
import Settings from './pages/portal/Settings';
import Invoices from './pages/portal/Invoices';

function ShopIndexRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoading />;
  return <Navigate to={user?.role === 'tech' ? '/shop/tech' : '/shop/board'} replace />;
}

function RootRedirect() {
  const { user, loading, isShopUser } = useAuth();
  if (loading) return <FullPageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isShopUser ? '/shop/board' : '/portal'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route path="/" element={<RootRedirect />} />

            <Route element={<RequireShop />}>
              <Route path="/shop" element={<ShopLayout />}>
                <Route index element={<ShopIndexRedirect />} />
                <Route path="board" element={<Board />} />
                <Route path="intake" element={<Intake />} />
                <Route path="ro/:id" element={<RODetail />} />
                <Route path="dealers" element={<Dealers />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="tech" element={<TechView />} />
              </Route>
            </Route>

            <Route element={<RequireDealer />}>
              <Route path="/portal" element={<PortalLayout />}>
                <Route index element={<PortalHome />} />
                <Route path="vehicle/:id" element={<VehicleDetail />} />
                <Route path="history" element={<History />} />
                <Route path="documents" element={<Documents />} />
                <Route path="settings" element={<Settings />} />
                <Route path="invoices" element={<Invoices />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
