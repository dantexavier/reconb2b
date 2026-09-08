import { Outlet } from 'react-router-dom';
import { KanbanSquare, ClipboardPlus, Building2, BarChart3, Wrench } from 'lucide-react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';

export default function ShopLayout() {
  const { user } = useAuth();
  const isTech = user?.role === 'tech';

  const navItems = isTech
    ? [{ to: '/shop/tech', label: 'My Lines', icon: Wrench, end: true }]
    : [
        { to: '/shop/board', label: 'Board', icon: KanbanSquare, end: true },
        { to: '/shop/intake', label: 'Intake', icon: ClipboardPlus },
        { to: '/shop/dealers', label: 'Dealers', icon: Building2 },
        { to: '/shop/analytics', label: 'Analytics', icon: BarChart3 },
      ];

  return (
    <Layout title="Shop" navItems={navItems}>
      <Outlet />
    </Layout>
  );
}
