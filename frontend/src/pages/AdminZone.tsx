import { Navigate, Outlet } from 'react-router-dom';
import AdminLayout from './admin/AdminLayout.tsx';

export default function AdminZone() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

export function AdminIndex() {
  return <Navigate to="/admin/users" replace />;
}
