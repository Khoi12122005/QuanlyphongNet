import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import AdminSupportWidget from './AdminSupportWidget';
import { IoMenu } from 'react-icons/io5';

export default function Layout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auto-close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="login-page">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'customer') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={`app-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
          <IoMenu />
        </button>
        <div className="mobile-logo">CyberHub Admin</div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

      <Sidebar 
        isOpen={isSidebarOpen} 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
      />
      <main key={location.pathname} className="main-content page-transition">
        <Outlet />
      </main>
      {location.pathname !== '/admin/support' && <AdminSupportWidget />}
    </div>
  );
}
