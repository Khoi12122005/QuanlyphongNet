import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { IoCalendar, IoTime, IoDesktop, IoCheckmarkCircle } from 'react-icons/io5';

const zoneRates = {
  regular: 50000,
  vip: 100000,
  streaming: 150000,
};

const zoneLabels = {
  regular: 'Khu Thường',
  vip: 'Khu VIP',
  streaming: 'Phòng Streaming',
};

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function Booking() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    duration: '2',
    zone: 'regular',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    if (!user) {
      navigate('/client-login', { state: { returnTo: '/book' } });
      return;
    }
    setStep(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTimeout(() => {
      setStep(3);
    }, 1000);
  };

  const today = new Date().toISOString().split('T')[0];
  const totalEstimated = parseInt(formData.duration, 10) * (zoneRates[formData.zone] || 0);

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
      <div className="page-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 className="page-title">Đặt Máy Trước</h1>
        <p className="page-subtitle">Đặt trước dàn máy gaming chất lượng cao.</p>
      </div>

      <div className="card" style={{ padding: '40px' }}>
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', color: 'var(--primary)' }}>Bước 1: Thông tin đặt máy</h2>
            <div className="form-group">
              <label className="form-label"><IoCalendar style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Ngày</label>
              <input
                type="date"
                name="date"
                min={today}
                value={formData.date}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-row" style={{ marginBottom: '20px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label"><IoTime style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Giờ bắt đầu</label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Thời lượng (giờ)</label>
                <select name="duration" value={formData.duration} onChange={handleChange} className="form-select">
                  <option value="1">1 giờ</option>
                  <option value="2">2 giờ</option>
                  <option value="3">3 giờ</option>
                  <option value="5">5 giờ</option>
                  <option value="10">10 giờ (vé ngày)</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '30px' }}>
              <label className="form-label"><IoDesktop style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Chọn khu</label>
              <select name="zone" value={formData.zone} onChange={handleChange} className="form-select">
                <option value="regular">Khu Thường ({formatVND(zoneRates.regular)}/giờ)</option>
                <option value="vip">Khu VIP ({formatVND(zoneRates.vip)}/giờ)</option>
                <option value="streaming">Phòng Streaming ({formatVND(zoneRates.streaming)}/giờ)</option>
              </select>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleNext}
              disabled={!formData.date || !formData.time}
            >
              Tiếp tục
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', color: 'var(--primary)' }}>Bước 2: Xác nhận đặt máy</h2>

            <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: 'var(--border-radius-md)', marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Ngày:</span>
                <span style={{ fontWeight: 'bold' }}>{formData.date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Thời gian:</span>
                <span style={{ fontWeight: 'bold' }}>{formData.time} trong {formData.duration} giờ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Khu:</span>
                <span style={{ fontWeight: 'bold' }}>{zoneLabels[formData.zone]}</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '15px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem' }}>
                <span style={{ color: 'var(--text-primary)' }}>Tổng tạm tính:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--accent-green)' }}>
                  {formatVND(totalEstimated)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>Quay lại</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSubmit}>Xác nhận đặt máy</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
            <IoCheckmarkCircle style={{ fontSize: '5rem', color: 'var(--accent-green)', marginBottom: '20px' }} />
            <h2 style={{ marginBottom: '10px', fontSize: '1.5rem' }}>Đặt máy thành công!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
              Hệ thống đã nhận lịch đặt của bạn. Vui lòng có mặt tại quầy trước giờ hẹn 5 phút.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Về trang chủ</button>
          </div>
        )}
      </div>
    </div>
  );
}
