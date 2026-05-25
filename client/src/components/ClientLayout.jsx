import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IoGameController, IoPerson, IoLogOut } from 'react-icons/io5';
import CustomerSupportWidget from './CustomerSupportWidget';

export default function ClientLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="client-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="client-header" style={{
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(10, 10, 26, 0.9)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <Link to="/" className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="sidebar-logo-icon">
            <IoGameController />
          </div>
          <span>CyberHub</span>
        </Link>
        <nav style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
          <Link to="/" style={{ fontWeight: 600, color: 'var(--text-primary)', transition: 'color 0.2s' }}>Trang chủ</Link>
          <Link to="/book" style={{ fontWeight: 600, color: 'var(--text-primary)', transition: 'color 0.2s' }}>Đặt máy</Link>
          <Link to="/support" style={{ fontWeight: 600, color: 'var(--text-primary)', transition: 'color 0.2s' }}>Chat hỗ trợ</Link>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                <IoPerson />
                <span>{user.full_name || user.name || user.username || 'Người dùng'}</span>
              </div>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm" title="Đăng xuất">
                <IoLogOut />
              </button>
            </div>
          ) : (
            <Link to="/client-login" className="btn btn-primary btn-sm">Đăng nhập / Đăng ký</Link>
          )}
        </nav>
      </header>

      <main key={location.pathname} className="page-transition" style={{ flex: 1, position: 'relative' }}>
        <Outlet />
      </main>

      {location.pathname !== '/support' && <CustomerSupportWidget />}

      <footer style={{
        padding: '40px',
        textAlign: 'center',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-muted)',
      }}>
        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
          <IoGameController style={{ fontSize: '24px', color: 'var(--primary)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 'bold' }}>CyberHub</span>
        </div>
        <p>© 2026 CyberHub Gaming Center. Bảo lưu mọi quyền.</p>
        <p style={{ marginTop: '10px', fontSize: '0.85rem' }}>Trải nghiệm gaming cao cấp.</p>
      </footer>
    </div>
  );
}
