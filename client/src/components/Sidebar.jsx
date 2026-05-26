import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  IoGameController,
  IoGrid,
  IoDesktop,
  IoPeople,
  IoFastFood,
  IoCart,
  IoStatsChart,
  IoLogOut,
  IoCalendar,
  IoChatbubbles,
  IoChevronBack,
  IoChevronForward,
  IoBriefcase
} from 'react-icons/io5';

const navItems = [
  { path: '/admin', label: 'Tổng quan', icon: <IoGrid />, section: 'TỔNG QUAN' },
  { path: '/admin/shifts', label: 'Giao ca', icon: <IoBriefcase />, section: 'HỆ THỐNG' },
  { path: '/admin/computers', label: 'Máy tính', icon: <IoDesktop />, section: 'QUẢN LÝ' },
  { path: '/admin/bookings', label: 'Đặt máy', icon: <IoCalendar /> },
  { path: '/admin/customers', label: 'Khách hàng', icon: <IoPeople /> },
  { path: '/admin/products', label: 'Sản phẩm', icon: <IoFastFood /> },
  { path: '/admin/orders', label: 'Đơn hàng', icon: <IoCart /> },
  { path: '/admin/support', label: 'Chat hỗ trợ', icon: <IoChatbubbles /> },
  { path: '/admin/revenue', label: 'Doanh thu', icon: <IoStatsChart />, section: 'BÁO CÁO' },
];

export default function Sidebar({ isOpen, isCollapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  let lastSection = null;
  const displayName = user?.full_name || user?.username || 'Người dùng';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo-icon">
          <IoGameController />
        </div>
        {!isCollapsed && <span className="sidebar-logo">CyberHub</span>}
        <button 
          className="sidebar-collapse-btn" 
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Phóng to' : 'Thu nhỏ'}
        >
          {isCollapsed ? <IoChevronForward /> : <IoChevronBack />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;

          return (
            <div key={item.path}>
              {showSection && <div className="sidebar-section-title">{item.section}</div>}
              <NavLink
                to={item.path}
                end={item.path === '/admin'}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-link-icon" title={isCollapsed ? item.label : ''}>{item.icon}</span>
                {!isCollapsed && <span className="sidebar-link-text">{item.label}</span>}
              </NavLink>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar" title={isCollapsed ? displayName : ''}>{getInitials(displayName)}</div>
          {!isCollapsed && (
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{displayName}</div>
              <div className="sidebar-user-role">{user?.role || 'staff'}</div>
            </div>
          )}
          <button className="sidebar-logout-btn" onClick={logout} title="Đăng xuất">
            <IoLogOut />
          </button>
        </div>
      </div>
    </aside>
  );
}
