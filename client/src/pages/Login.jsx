import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IoGameController } from 'react-icons/io5';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  if (user && user.role !== 'customer') {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    if (!normalizedUsername || !normalizedPassword) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }

    setIsLoading(true);
    try {
      await login(normalizedUsername, normalizedPassword);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              marginBottom: '8px'
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                color: 'white',
                boxShadow: '0 0 24px rgba(0, 240, 255, 0.3)'
              }}
            >
              <IoGameController />
            </div>
          </div>
          <div className="login-logo-text">CyberHub</div>
          <p className="login-logo-sub">Hệ thống quản lý phòng net</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form-animate-stagger">
          <div className="form-group">
            <label className="form-label">Tên đăng nhập</label>
            <input
              type="text"
              className="form-input"
              placeholder="Nhập tên đăng nhập"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <input
              type="password"
              className="form-input"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div>
                Đang đăng nhập...
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
