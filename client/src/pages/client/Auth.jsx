import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { IoGameController, IoMail, IoLockClosed, IoPerson } from 'react-icons/io5';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loginCustomer, registerCustomer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    username: '',
    phone: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const name = formData.username.trim();
    const identity = formData.phone.trim();
    const password = formData.password.trim();

    if (!identity || !password || (!isLogin && !name)) {
      setError('Vui lòng nhập đầy đủ các trường bắt buộc');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        await loginCustomer(identity, password);
      } else {
        await registerCustomer(name, identity, password);
        // Automatically login after register
        await loginCustomer(identity, password);
      }
      const returnTo = location.state?.returnTo || '/';
      navigate(returnTo, { replace: true });
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err?.response?.data?.message || 'Xác thực thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ 
            width: '60px', height: '60px', 
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))', 
            borderRadius: '16px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '30px', color: 'white',
            margin: '0 auto 20px'
          }}>
            <IoGameController />
          </div>
          <h1 style={{ fontSize: '1.5rem' }}>{isLogin ? 'Chào mừng quay lại' : 'Tham gia CyberHub'}</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {isLogin ? 'Đăng nhập để quản lý đặt máy' : 'Tạo tài khoản để đặt máy'}
          </p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form key={isLogin ? 'login' : 'register'} onSubmit={handleSubmit} className="form-animate-stagger">
          {!isLogin && (
            <div className="form-group">
              <label className="form-label"><IoPerson style={{ marginRight: '5px' }}/> Họ và tên</label>
              <input
                type="text"
                name="username"
                className="form-input"
                placeholder="Nhập họ và tên"
                value={formData.username}
                onChange={handleChange}
                required={!isLogin}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              <IoMail style={{ marginRight: '5px' }}/>
              {isLogin ? 'Số điện thoại hoặc tên' : 'Số điện thoại'}
            </label>
            <input
              type="text"
              name="phone"
              className="form-input"
              placeholder={isLogin ? 'Nhập số điện thoại hoặc họ tên' : 'Nhập số điện thoại'}
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label"><IoLockClosed style={{ marginRight: '5px' }}/> Mật khẩu</label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="Nhập mật khẩu"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '10px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Vui lòng chờ...' : isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <button 
            type="button" 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            disabled={isSubmitting}
            style={{ 
              background: 'none', border: 'none', color: 'var(--primary)', 
              fontWeight: 'bold', cursor: 'pointer', padding: 0 
            }}
          >
            {isLogin ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  );
}
