import React, { useState } from 'react';
import { IoCalendar, IoCheckmark, IoClose, IoSearch } from 'react-icons/io5';

const initialBookings = [
  { id: 1, customer: 'JohnDoe', date: '2026-05-26', time: '14:00', duration: 2, zone: 'VIP', status: 'pending', amount: 80000 },
  { id: 2, customer: 'JaneSmith', date: '2026-05-26', time: '16:00', duration: 3, zone: 'Thường', status: 'confirmed', amount: 150000 },
  { id: 3, customer: 'ProGamer99', date: '2026-05-27', time: '10:00', duration: 5, zone: 'Streaming', status: 'confirmed', amount: 750000 },
  { id: 4, customer: 'CasualGamer', date: '2026-05-27', time: '18:00', duration: 1, zone: 'Thường', status: 'cancelled', amount: 50000 },
];

export default function Bookings() {
  const [bookings, setBookings] = useState(initialBookings);
  const [searchTerm, setSearchTerm] = useState('');

  const handleStatusChange = (id, newStatus) => {
    setBookings(bookings.map(b => b.id === id ? { ...b, status: newStatus } : b));
  };

  const filteredBookings = bookings.filter(b => 
    b.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.date.includes(searchTerm)
  );

  return (
    <div className="bookings-page">
      <div className="page-header">
        <h1 className="page-title">Quản lý đặt máy</h1>
        <p className="page-subtitle">Quản lý lịch đặt máy của khách hàng.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Lịch đặt gần đây</h2>
          <div className="search-box">
            <IoSearch className="search-icon" />
            <input
              type="text"
              placeholder="Tìm theo khách hàng hoặc ngày..."
              className="form-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '300px' }}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Khách hàng</th>
                <th>Ngày & giờ</th>
                <th>Thời lượng</th>
                <th>Khu</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((booking) => (
                <tr key={booking.id}>
                  <td>#{booking.id}</td>
                  <td style={{ fontWeight: 600 }}>{booking.customer}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <IoCalendar style={{ color: 'var(--text-muted)' }} />
                      {booking.date} lúc {booking.time}
                    </div>
                  </td>
                  <td>{booking.duration} giờ</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      background: booking.zone === 'VIP' ? 'var(--secondary-dim)' :
                                 booking.zone === 'Streaming' ? 'var(--accent-yellow-dim)' : 'var(--primary-dim)',
                      color: booking.zone === 'VIP' ? 'var(--secondary)' :
                             booking.zone === 'Streaming' ? 'var(--accent-yellow)' : 'var(--primary)',
                    }}>
                      {booking.zone}
                    </span>
                  </td>
                  <td>{booking.amount.toLocaleString('vi-VN')} đ</td>
                  <td>
                    <span className={`stat-card-trend ${
                      booking.status === 'confirmed' ? 'up' : 
                      booking.status === 'cancelled' ? 'down' : ''
                    }`} style={{ margin: 0 }}>
                      {booking.status === 'confirmed' ? 'Đã xác nhận' : booking.status === 'cancelled' ? 'Đã hủy' : 'Chờ xác nhận'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {booking.status === 'pending' && (
                        <>
                          <button 
                            className="btn btn-icon btn-success sm"
                            onClick={() => handleStatusChange(booking.id, 'confirmed')}
                            title="Xác nhận"
                          >
                            <IoCheckmark />
                          </button>
                          <button 
                            className="btn btn-icon btn-danger sm"
                            onClick={() => handleStatusChange(booking.id, 'cancelled')}
                            title="Hủy"
                          >
                            <IoClose />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>
                    Không tìm thấy lịch đặt nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
