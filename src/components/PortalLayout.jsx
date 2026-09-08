import { Outlet } from 'react-router-dom';
import { LayoutGrid, History, FolderOpen, Bell, Receipt } from 'lucide-react';
import Layout from './Layout';

const navItems = [
  { to: '/portal', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/portal/history', label: 'History', icon: History },
  { to: '/portal/documents', label: 'Documents', icon: FolderOpen },
  { to: '/portal/invoices', label: 'Invoices', icon: Receipt },
  { to: '/portal/settings', label: 'Alert Settings', icon: Bell },
];

export default function PortalLayout() {
  return (
    <Layout title="Dealer Portal" navItems={navItems}>
      <Outlet />
    </Layout>
  );
}
