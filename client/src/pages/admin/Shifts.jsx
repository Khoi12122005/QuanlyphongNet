import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
const formatCurrency = (value) => {
  return Number(value || 0).toLocaleString('vi-VN') + ' đ';
};

export default function Shifts() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // For Start Shift
  const [startingCash, setStartingCash] = useState(0);
  
  // For End Shift
  const [endingCash, setEndingCash] = useState(0);
  const [note, setNote] = useState('');

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/shifts');
      setShifts(res.data.data || []);
      const current = res.data.data.find(s => !s.end_time);
      setCurrentShift(current || null);
    } catch (error) {
      console.error('Error fetching shifts', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleStartShift = async () => {
    if (window.confirm(`Xác nhận nhận ca với số tiền đầu ca: ${formatCurrency(startingCash)}?`)) {
      try {
        await axios.post('/api/shifts/start', { starting_cash: startingCash });
        alert('Nhận ca thành công!');
        fetchShifts();
      } catch (error) {
        alert(error.response?.data?.message || 'Lỗi nhận ca');
      }
    }
  };

  const handleEndShift = async () => {
    if (window.confirm(`Xác nhận bàn giao ca với số tiền cuối ca: ${formatCurrency(endingCash)}?`)) {
      try {
        await axios.post('/api/shifts/end', { ending_cash: endingCash, note });
        alert('Bàn giao ca thành công!');
        fetchShifts();
      } catch (error) {
        alert(error.response?.data?.message || 'Lỗi bàn giao ca');
      }
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Quản lý Ca Trực (Giao ca)</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>Trạng thái ca trực</h3>
          {currentShift ? (
            <div>
              <div className="alert alert-success" style={{ marginBottom: '15px' }}>
                Đang trong ca trực của <strong>{user?.name || 'Admin'}</strong>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <span className="text-muted">Bắt đầu lúc: </span>
                <strong>{new Date(currentShift.start_time).toLocaleString('vi-VN')}</strong>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <span className="text-muted">Tiền đầu ca: </span>
                <strong className="text-primary">{formatCurrency(currentShift.starting_cash)}</strong>
              </div>
              
              <hr style={{ margin: '15px 0' }} />
              <h4 style={{ marginBottom: '15px' }}>Bàn giao ca</h4>
              <div className="form-group">
                <label>Số tiền bàn giao cuối ca (VNĐ)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={endingCash} 
                  onChange={(e) => setEndingCash(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Ghi chú (nếu có lệch tiền)</label>
                <textarea 
                  className="form-input" 
                  rows="3" 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: Lệch 50k do khách nợ..."
                ></textarea>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleEndShift}>
                Xác nhận bàn giao
              </button>
            </div>
          ) : (
            <div>
              <div className="alert alert-warning" style={{ marginBottom: '15px' }}>
                Hiện không có ca trực nào đang mở!
              </div>
              <div className="form-group">
                <label>Số tiền quỹ đầu ca (VNĐ)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={startingCash} 
                  onChange={(e) => setStartingCash(e.target.value)}
                />
              </div>
              <button className="btn btn-success" style={{ width: '100%' }} onClick={handleStartShift}>
                Nhận ca trực
              </button>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>Lịch sử giao ca</h3>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Bắt đầu</th>
                <th>Kết thúc</th>
                <th>Tiền đầu ca</th>
                <th>Tiền cuối ca</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map(shift => (
                <tr key={shift.id}>
                  <td>#{shift.id}</td>
                  <td>{new Date(shift.start_time).toLocaleString('vi-VN')}</td>
                  <td>{shift.end_time ? new Date(shift.end_time).toLocaleString('vi-VN') : <span className="badge badge-success">Đang trực</span>}</td>
                  <td className="text-primary">{formatCurrency(shift.starting_cash)}</td>
                  <td className="text-success">{shift.end_time ? formatCurrency(shift.ending_cash) : '-'}</td>
                  <td>{shift.note || '-'}</td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>Chưa có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
