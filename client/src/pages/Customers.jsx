import { useEffect, useState } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import { IoAdd, IoCall, IoPencil, IoPerson, IoSearch, IoTime, IoTrash, IoWallet } from 'react-icons/io5';

const API = '/api';

const formatCurrency = (val) => Number(val || 0).toLocaleString('vi-VN') + ' đ';

const extractArray = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload[key])) return payload[key];
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
};

const normalizeCustomer = (customer) => ({
  ...customer,
  balance: Number(customer.balance || 0),
  totalHours: Number(customer.totalHours ?? customer.total_hours ?? 0),
});

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [topUpCustomer, setTopUpCustomer] = useState(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', balance: 0 });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API}/customers`);
      setCustomers(extractArray(res.data, 'customers').map(normalizeCustomer));
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = customers.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search)
  );

  const openAdd = () => {
    setEditingCustomer(null);
    setForm({ name: '', phone: '', email: '', balance: 0 });
    setShowModal(true);
  };

  const openEdit = (cust) => {
    setEditingCustomer(cust);
    setForm({
      name: cust.name || '',
      phone: cust.phone || '',
      email: cust.email || '',
      balance: cust.balance || 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
      };

      if (editingCustomer) {
        await axios.put(`${API}/customers/${editingCustomer.id}`, payload);
      } else {
        await axios.post(`${API}/customers`, payload);
      }

      setShowModal(false);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi lưu khách hàng');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa khách hàng này?')) return;
    try {
      await axios.delete(`${API}/customers/${id}`);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi xóa');
    }
  };

  const openTopUp = (cust) => {
    setTopUpCustomer(cust);
    setTopUpAmount('');
    setShowTopUpModal(true);
  };

  const handleTopUp = async () => {
    if (!topUpAmount || Number(topUpAmount) <= 0) return;
    try {
      await axios.post(`${API}/customers/${topUpCustomer.id}/topup`, {
        amount: Number(topUpAmount),
      });
      setShowTopUpModal(false);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi nạp tiền');
    }
  };

  const quickTopUpAmounts = [10000, 20000, 50000, 100000, 200000, 500000];

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header page-header-actions">
        <div>
          <h1 className="page-title">Khách hàng</h1>
          <p className="page-subtitle">{customers.length} khách hàng đã đăng ký</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <IoAdd /> Thêm khách hàng
        </button>
      </div>

      <div className="search-box" style={{ maxWidth: 400, marginBottom: 'var(--spacing-lg)' }}>
        <IoSearch className="search-icon" />
        <input
          type="text"
          className="form-input"
          placeholder="Tìm theo tên hoặc số điện thoại..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Số điện thoại</th>
                <th>Số dư</th>
                <th>Tổng giờ chơi</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cust) => (
                <tr key={cust.id}>
                  <td>
                    <div className="flex items-center gap-md">
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'white',
                          flexShrink: 0,
                        }}
                      >
                        {cust.name?.charAt(0)?.toUpperCase() || 'K'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cust.name}</div>
                        {cust.email && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cust.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-sm">
                      <IoCall style={{ color: 'var(--text-muted)' }} />
                      {cust.phone || '—'}
                    </div>
                  </td>
                  <td>
                    <span className="currency" style={{ color: 'var(--primary)' }}>
                      {formatCurrency(cust.balance)}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-sm">
                      <IoTime style={{ color: 'var(--text-muted)' }} />
                      {cust.totalHours.toFixed(1)} giờ
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-xs">
                      <button className="btn btn-sm btn-success" onClick={() => openTopUp(cust)} title="Nạp tiền">
                        <IoWallet /> Nạp
                      </button>
                      <button className="btn btn-ghost btn-icon sm" onClick={() => openEdit(cust)} title="Sửa">
                        <IoPencil />
                      </button>
                      <button className="btn btn-ghost btn-icon sm" onClick={() => handleDelete(cust.id)} title="Xóa">
                        <IoTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <IoPerson />
                      </div>
                      <p className="empty-state-text">Không tìm thấy khách hàng nào</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCustomer ? 'Sửa khách hàng' : 'Thêm khách hàng'}
      >
        <div className="form-group">
          <label className="form-label">Họ tên</label>
          <input
            type="text"
            className="form-input"
            placeholder="Nhập họ tên khách hàng"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Số điện thoại</label>
            <input
              type="text"
              className="form-input"
              placeholder="0901234567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="email@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {editingCustomer ? 'Cập nhật' : 'Thêm mới'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showTopUpModal} onClose={() => setShowTopUpModal(false)} title="Nạp tiền">
        {topUpCustomer && (
          <div>
            <div
              style={{
                textAlign: 'center',
                padding: '16px',
                background: 'var(--bg-card)',
                borderRadius: '12px',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 4 }}>{topUpCustomer.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Số dư hiện tại:{' '}
                <span className="currency" style={{ color: 'var(--primary)' }}>
                  {formatCurrency(topUpCustomer.balance)}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Số tiền nạp (đ)</label>
              <input
                type="number"
                className="form-input"
                placeholder="Nhập số tiền"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                style={{ fontSize: '1.2rem', fontWeight: 600, textAlign: 'center' }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginBottom: '20px',
              }}
            >
              {quickTopUpAmounts.map((amount) => (
                <button
                  key={amount}
                  className="btn btn-ghost btn-sm"
                  onClick={() => setTopUpAmount(String(amount))}
                  style={{ fontSize: '0.8rem' }}
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowTopUpModal(false)}>
                Hủy
              </button>
              <button className="btn btn-success" onClick={handleTopUp}>
                <IoWallet /> Nạp {topUpAmount ? formatCurrency(Number(topUpAmount)) : ''}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
