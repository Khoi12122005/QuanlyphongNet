import { useEffect, useState } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import { IoAdd, IoCart, IoCheckmarkCircle, IoEye, IoRemove, IoTime, IoTrash, IoExpand, IoContract } from 'react-icons/io5';

const API = '/api';
const ORDER_REFRESH_MS = 10000;
const formatCurrency = (val) => Number(val || 0).toLocaleString('vi-VN') + ' đ';

const orderStatusMeta = {
  pending: { label: 'Chờ xác nhận', className: 'badge-yellow' },
  confirmed: { label: 'Đã xác nhận', className: 'badge-green' },
  cancelled: { label: 'Đã hủy', className: 'badge-red' },
};

const extractArray = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload[key])) return payload[key];
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
};

const normalizeOrder = (order) => ({
  ...order,
  customerName: order.customerName ?? order.customer_name ?? order.customer?.name ?? null,
  createdAt: order.createdAt ?? order.created_at ?? null,
  confirmedAt: order.confirmedAt ?? order.confirmed_at ?? null,
  confirmedByName: order.confirmedByName ?? order.confirmed_by_name ?? null,
  status: String(order.status || 'confirmed').toLowerCase(),
  totalAmount: Number(order.totalAmount ?? order.total_amount ?? order.total ?? 0),
  itemCount: Number(order.itemCount ?? order.item_count ?? order.items?.length ?? 0),
  items: Array.isArray(order.items) ? order.items : [],
});

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    const timer = setInterval(fetchAll, ORDER_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const fetchAll = async () => {
    try {
      const [ordersRes, productsRes, customersRes, sessionsRes] = await Promise.allSettled([
        axios.get(`${API}/orders`),
        axios.get(`${API}/products`),
        axios.get(`${API}/customers`),
        axios.get(`${API}/sessions?status=active`),
      ]);

      if (ordersRes.status === 'fulfilled') {
        setOrders(extractArray(ordersRes.value.data, 'orders').map(normalizeOrder));
      }

      if (productsRes.status === 'fulfilled') {
        setProducts(extractArray(productsRes.value.data, 'products'));
      }

      if (customersRes.status === 'fulfilled') {
        setCustomers(extractArray(customersRes.value.data, 'customers'));
      }

      if (sessionsRes.status === 'fulfilled') {
        setSessions(extractArray(sessionsRes.value.data, 'sessions'));
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setSelectedCustomer('');
    setSelectedSession('');
    setCart([]);
    setShowCreateModal(true);
  };

  const addToCart = (product) => {
    const existing = cart.find((item) => item.productId === product.id);
    if (existing) {
      setCart(
        cart.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          price: Number(product.price || 0),
          quantity: 1,
        },
      ]);
    }
  };

  const updateQty = (productId, delta) => {
    setCart(
      cart
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      alert('Vui lòng thêm sản phẩm vào đơn hàng');
      return;
    }

    try {
      await axios.post(`${API}/orders`, {
        customer_id: selectedCustomer || undefined,
        session_id: selectedSession || undefined,
        items: cart.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
      });
      setShowCreateModal(false);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi tạo đơn hàng');
    }
  };

  const handleConfirmOrder = async (order) => {
    if (!order || order.status === 'confirmed') return;

    if (!window.confirm(`Xác nhận đơn #${String(order.id || '').padStart(4, '0')}?`)) {
      return;
    }

    try {
      await axios.post(`${API}/orders/${order.id}/confirm`);
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xác nhận đơn hàng');
    }
  };

  const viewDetail = async (order) => {
    try {
      const res = await axios.get(`${API}/orders/${order.id}`);
      const detail = normalizeOrder(res.data?.data || order);
      setSelectedOrder(detail);
    } catch (err) {
      console.error('Order detail error:', err);
      setSelectedOrder(order);
    } finally {
      setShowDetailModal(true);
    }
  };

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
          <h1 className="page-title">Đơn hàng</h1>
          <p className="page-subtitle">{orders.length} đơn hàng</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <IoAdd /> Tạo đơn hàng
        </button>
      </div>

      <div className={`card ${isFullscreen ? 'card-fullscreen' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '10px' }}>
          <button 
            className={`btn btn-ghost btn-icon btn-fullscreen-toggle ${isFullscreen ? 'is-active' : ''}`}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Thu nhỏ bảng' : 'Phóng to toàn màn hình'}
            style={{ color: 'var(--text-muted)' }}
          >
            {isFullscreen ? <IoContract size={20} /> : <IoExpand size={20} />}
          </button>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Số món</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                      #{String(order.id || '').padStart(4, '0')}
                    </span>
                  </td>
                  <td>{order.customerName || 'Khách lẻ'}</td>
                  <td>{order.itemCount || 0} món</td>
                  <td>
                    <span className="currency" style={{ color: 'var(--primary)' }}>
                      {formatCurrency(order.totalAmount)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${orderStatusMeta[order.status]?.className || 'badge-purple'}`}>
                      {orderStatusMeta[order.status]?.label || order.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-sm">
                      <IoTime style={{ color: 'var(--text-muted)' }} />
                      {order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : '-'}
                    </div>
                  </td>
                  <td>
                    {order.status === 'pending' && (
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleConfirmOrder(order)}
                        style={{ marginRight: 6 }}
                        title="Xác nhận món"
                      >
                        <IoCheckmarkCircle /> Xác nhận
                      </button>
                    )}
                    <button className="btn btn-ghost btn-icon sm" onClick={() => viewDetail(order)} title="Chi tiết">
                      <IoEye />
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <IoCart />
                      </div>
                      <p className="empty-state-text">Chưa có đơn hàng nào</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Tạo đơn hàng mới" wide>
        <div className="order-flow">
          <div>
            <h4 style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Chọn sản phẩm</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {products.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => addToCart(prod)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  className="cursor-pointer"
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{prod.name}</div>
                    <div className="currency text-sm" style={{ color: 'var(--primary)' }}>
                      {formatCurrency(prod.price)}
                    </div>
                  </div>
                  <button className="btn btn-primary btn-icon sm">
                    <IoAdd />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Khách hàng</label>
                <select className="form-select" value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
                  <option value="">-- Khách lẻ --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phiên máy (tùy chọn)</label>
                <select className="form-select" value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}>
                  <option value="">-- Không gán phiên --</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.computer_name || s.computerName || `Phiên ${s.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <h4 style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Giỏ hàng ({cart.length})</h4>

            {cart.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>
                <p className="text-sm text-muted">Chưa có sản phẩm nào</p>
              </div>
            ) : (
              <div className="order-items-list">
                {cart.map((item) => (
                  <div key={item.productId} className="order-item">
                    <div className="order-item-info">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</div>
                        <div className="text-xs text-muted">{formatCurrency(item.price)}</div>
                      </div>
                    </div>
                    <div className="order-item-qty">
                      <button className="btn btn-ghost btn-icon sm" onClick={() => updateQty(item.productId, -1)}>
                        <IoRemove />
                      </button>
                      <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                      <button className="btn btn-ghost btn-icon sm" onClick={() => updateQty(item.productId, 1)}>
                        <IoAdd />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon sm"
                        onClick={() => removeFromCart(item.productId)}
                        style={{ color: 'var(--accent-red)', marginLeft: 4 }}
                      >
                        <IoTrash />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="order-total">Tổng: {formatCurrency(cartTotal)}</div>
              </div>
            )}

            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
                Hủy
              </button>
              <button className="btn btn-success" onClick={handleCreateOrder} disabled={cart.length === 0}>
                <IoCheckmarkCircle /> Xác nhận đơn
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Chi tiết đơn hàng">
        {selectedOrder && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginBottom: 20,
                padding: 16,
                background: 'var(--bg-card)',
                borderRadius: 12,
              }}
            >
              <div>
                <div className="text-xs text-muted">Mã đơn</div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                  #{String(selectedOrder.id || '').padStart(4, '0')}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">Khách hàng</div>
                <div style={{ fontWeight: 600 }}>{selectedOrder.customerName || 'Khách lẻ'}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Thời gian</div>
                <div>{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('vi-VN') : '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Tổng tiền</div>
                <span className="currency" style={{ color: 'var(--primary)' }}>
                  {formatCurrency(selectedOrder.totalAmount)}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted">Trạng thái</div>
                <span className={`badge ${orderStatusMeta[selectedOrder.status]?.className || 'badge-purple'}`}>
                  {orderStatusMeta[selectedOrder.status]?.label || selectedOrder.status}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted">Người xác nhận</div>
                <div>{selectedOrder.confirmedByName || '-'}</div>
              </div>
            </div>

            <h4 style={{ marginBottom: 12, fontSize: '0.9rem' }}>Sản phẩm</h4>
            <div className="order-items-list">
              {(selectedOrder.items || []).map((item, i) => (
                <div key={i} className="order-item">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {item.name || item.product_name || item.product?.name || `Sản phẩm ${i + 1}`}
                    </div>
                    <div className="text-xs text-muted">
                      {formatCurrency(item.unit_price ?? item.price ?? 0)} x {item.quantity || 1}
                    </div>
                  </div>
                  <div className="currency" style={{ color: 'var(--primary)' }}>
                    {formatCurrency((item.unit_price ?? item.price ?? 0) * (item.quantity || 1))}
                  </div>
                </div>
              ))}
            </div>

            <div className="order-total">Tổng: {formatCurrency(selectedOrder.totalAmount)}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
