import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import {
  IoAdd,
  IoArrowForward,
  IoCheckmarkCircle,
  IoDesktop,
  IoFastFood,
  IoRefresh,
  IoRemove,
  IoStar,
  IoVideocam,
  IoWallet,
  IoTrophy,
  IoQrCode
} from 'react-icons/io5';

const API = '/api';
const SESSION_REFRESH_MS = 10000;
const ORDER_REFRESH_MS = 12000;

const zones = [
  {
    id: 'regular',
    name: 'Khu Thường',
    icon: <IoDesktop />,
    price: '50.000 đ / giờ',
    specs: ['RTX 3060', 'Intel i5 12th Gen', '16GB RAM', '144Hz Monitor'],
    color: 'cyan',
    desc: 'Phù hợp cho chơi game phổ thông và các tựa esports.',
  },
  {
    id: 'vip',
    name: 'Khu VIP',
    icon: <IoStar />,
    price: '100.000 đ / giờ',
    specs: ['RTX 4070 Ti', 'Intel i7 13th Gen', '32GB RAM', '240Hz Monitor'],
    color: 'purple',
    desc: 'Hiệu năng cao cho thi đấu và game AAA.',
  },
  {
    id: 'streaming',
    name: 'Phòng Streaming',
    icon: <IoVideocam />,
    price: '150.000 đ / giờ',
    specs: ['RTX 4090', 'Intel i9 14th Gen', '64GB RAM', 'Dual 4K Monitors', 'Pro Audio Setup'],
    color: 'yellow',
    desc: 'Phòng riêng với bộ thiết bị streaming chuyên nghiệp.',
  },
];

const formatCurrency = (amount) => Number(amount || 0).toLocaleString('vi-VN') + ' d';
const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatDuration = (secondsInput) => {
  const seconds = Math.max(0, Math.floor(Number(secondsInput || 0)));
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const categoryLabel = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'food') return 'Đồ ăn';
  if (normalized === 'drink') return 'Đồ uống';
  if (normalized === 'other') return 'Khác';
  return value || 'Khác';
};

const normalizeProduct = (product) => ({
  id: Number(product?.id || 0),
  name: product?.name || 'Sản phẩm',
  category: categoryLabel(product?.category),
  price: toNumber(product?.price),
  stock: toNumber(product?.stock),
});

const normalizeOrder = (order) => ({
  id: Number(order?.id || 0),
  createdAt: order?.created_at || order?.createdAt || null,
  totalAmount: toNumber(order?.total_amount ?? order?.totalAmount ?? order?.total),
  itemCount: toNumber(order?.item_count ?? order?.itemCount ?? order?.items?.length ?? 0),
  computerName: order?.computer_name || order?.computerName || null,
  status: String(order?.status || 'confirmed').toLowerCase(),
});

export default function Home() {
  const { user } = useAuth();
  const isCustomer = user && user.role === 'customer';

  const [activeSession, setActiveSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loadingCommerce, setLoadingCommerce] = useState(false);
  const [commerceError, setCommerceError] = useState('');
  const [cart, setCart] = useState([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderNotice, setOrderNotice] = useState({ type: '', message: '' });

  // Nạp tiền & Loyalty
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [isToppingUp, setIsToppingUp] = useState(false);

  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const fetchActiveSession = useCallback(async () => {
    if (!isCustomer) {
      setActiveSession(null);
      return;
    }

    setLoadingSession(true);
    setSessionError('');

    try {
      const res = await axios.get(`${API}/sessions/active`);
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setActiveSession(list.length > 0 ? list[0] : null);
    } catch (error) {
      console.error('Customer active session fetch error:', error);
      setSessionError('Không thể tải dữ liệu phiên chơi. Vui lòng thử lại.');
    } finally {
      setLoadingSession(false);
    }
  }, [isCustomer]);

  const fetchCommerceData = useCallback(async () => {
    if (!isCustomer) {
      setProducts([]);
      setOrders([]);
      return;
    }

    setLoadingCommerce(true);
    setCommerceError('');

    try {
      const [productsRes, ordersRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/orders`),
      ]);

      const productList = Array.isArray(productsRes.data?.data) ? productsRes.data.data : [];
      const orderList = Array.isArray(ordersRes.data?.data) ? ordersRes.data.data : [];

      setProducts(productList.map(normalizeProduct).filter((item) => item.id > 0));
      setOrders(orderList.map(normalizeOrder));
    } catch (error) {
      console.error('Customer commerce fetch error:', error);
      setCommerceError('Không tải được menu hoặc lịch sử đặt món.');
    } finally {
      setLoadingCommerce(false);
    }
  }, [isCustomer]);

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  useEffect(() => {
    fetchCommerceData();
  }, [fetchCommerceData]);

  useEffect(() => {
    if (!isCustomer) return undefined;
    const timer = setInterval(fetchActiveSession, SESSION_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isCustomer, fetchActiveSession]);

  useEffect(() => {
    if (!isCustomer) return undefined;
    const timer = setInterval(fetchCommerceData, ORDER_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isCustomer, fetchCommerceData]);

  useEffect(() => {
    if (!isCustomer) return undefined;
    const tick = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [isCustomer]);

  const sessionMetrics = useMemo(() => {
    if (!activeSession) return null;

    const startTime = activeSession.start_time ? new Date(activeSession.start_time).getTime() : null;
    const plannedEnd = activeSession.planned_end_time ? new Date(activeSession.planned_end_time).getTime() : null;
    const pricePerHour = toNumber(activeSession.price_per_hour);
    const prepaidAmount = toNumber(activeSession.prepaid_amount);
    const isPrepaid = Number(activeSession.is_prepaid || 0) === 1;

    const elapsedSeconds = startTime ? Math.max(0, Math.floor((nowTick - startTime) / 1000)) : 0;
    const elapsedHours = elapsedSeconds / 3600;

    const liveUsedAmount = Math.round(elapsedHours * pricePerHour);
    const usedAmount = isPrepaid ? Math.min(prepaidAmount, liveUsedAmount) : liveUsedAmount;
    const remainingAmount = isPrepaid ? Math.max(0, prepaidAmount - usedAmount) : null;

    const remainingSeconds = plannedEnd ? Math.max(0, Math.floor((plannedEnd - nowTick) / 1000)) : null;

    return {
      sessionId: Number(activeSession.id || 0),
      computerName: activeSession.computer_name || activeSession.computerName || 'Máy không rõ',
      customerName: activeSession.customer_name || activeSession.customerName || user?.name || user?.full_name || 'Khách',
      elapsedSeconds,
      remainingSeconds,
      usedAmount,
      remainingAmount,
      isPrepaid,
    };
  }, [activeSession, nowTick, user?.full_name, user?.name]);

  const addToCart = (product) => {
    if (!product || product.id <= 0) return;
    setOrderNotice({ type: '', message: '' });

    setCart((prev) => {
      const existed = prev.find((item) => item.productId === product.id);
      if (existed) {
        if (existed.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      if (product.stock <= 0) return prev;

      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          stock: product.stock,
        },
      ];
    });
  };

  const changeQuantity = (productId, delta) => {
    setOrderNotice({ type: '', message: '' });

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (nextQty > item.stock) return item;
          return { ...item, quantity: nextQty };
        })
        .filter(Boolean)
    );
  };

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + toNumber(item.price) * toNumber(item.quantity), 0),
    [cart]
  );

  const submitOrder = async () => {
    if (cart.length === 0 || submittingOrder) return;

    setSubmittingOrder(true);
    setOrderNotice({ type: '', message: '' });

    try {
      const payload = {
        items: cart.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
      };

      if (sessionMetrics?.sessionId) {
        payload.session_id = sessionMetrics.sessionId;
      }

      const res = await axios.post(`${API}/orders`, payload);
      setCart([]);
      setOrderNotice({
        type: 'success',
        message: res.data?.message || 'Đặt món thành công. Admin đã nhận yêu cầu.',
      });

      await fetchCommerceData();
    } catch (error) {
      setOrderNotice({
        type: 'error',
        message: error.response?.data?.message || 'Đặt món thất bại. Vui lòng thử lại.',
      });
    } finally {
      setSubmittingOrder(false);
    }
  };

  const topProducts = useMemo(
    () => products.filter((item) => item.stock > 0).slice(0, 10),
    [products]
  );

  const handleGenerateQR = () => {
    if (!topupAmount || topupAmount < 10000) {
      alert('Vui lòng nhập số tiền hợp lệ (tối thiểu 10.000đ)');
      return;
    }
    // Tạo mã VietQR theo thông tin tài khoản của hệ thống
    const amount = parseInt(topupAmount, 10);
    const memo = `NAPTIEN ${user?.phone || user?.id}`;
    const url = `https://api.vietqr.io/image/970423-15712122005-tvhG0fa.jpg?accountName=NGUYEN%20HUYNH%20KHOI&amount=${amount}&addInfo=${encodeURIComponent(memo)}`;
    setQrUrl(url);
  };

  const handleConfirmTopup = async () => {
    setIsToppingUp(true);
    try {
      const amount = parseInt(topupAmount, 10);
      const res = await axios.post(`${API}/customer-auth/topup_qr`, { amount });
      alert(res.data.message);
      setShowTopupModal(false);
      setQrUrl('');
      setTopupAmount('');
      window.location.reload(); 
    } catch (error) {
      alert(error.response?.data?.message || 'Lỗi nạp tiền');
    } finally {
      setIsToppingUp(false);
    }
  };

  const handleRedeem = async (points, rewardName) => {
    if (!user || user.points < points) {
      alert('Bạn không đủ điểm để đổi quà này!');
      return;
    }
    if (window.confirm(`Bạn muốn dùng ${points} điểm để đổi ${rewardName}?`)) {
      setRedeeming(true);
      try {
        const res = await axios.post(`${API}/customer-auth/redeem`, { points_to_spend: points, reward_type: rewardName });
        alert(res.data.message);
        window.location.reload();
      } catch (error) {
        alert(error.response?.data?.message || 'Lỗi đổi quà');
      } finally {
        setRedeeming(false);
      }
    }
  };

  return (
    <div className="home-page">
      {isCustomer && (
        <section style={{ padding: '28px 20px 0 20px', maxWidth: '1200px', margin: '0 auto' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div className="page-header page-header-actions" style={{ marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: 4 }}>Thông tin chơi của bạn (thời gian thực)</h2>
                <p className="text-sm text-muted">Dữ liệu lấy trực tiếp từ phiên đang hoạt động của tài khoản khách.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={fetchActiveSession} disabled={loadingSession}>
                <IoRefresh /> {loadingSession ? 'Đang cập nhật' : 'Làm mới'}
              </button>
            </div>

            {sessionError && <div className="login-error" style={{ marginBottom: 12 }}>{sessionError}</div>}

            {!sessionError && !sessionMetrics && (
              <div className="empty-state" style={{ padding: 16 }}>
                <p className="empty-state-text">Bạn chưa có phiên nào đang chơi.</p>
              </div>
            )}

            {sessionMetrics && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div className="card" style={{ padding: 14 }}>
                  <div className="text-xs text-muted">Máy đang chơi</div>
                  <div style={{ fontWeight: 700, marginTop: 4 }}>{sessionMetrics.computerName}</div>
                </div>

                <div className="card" style={{ padding: 14 }}>
                  <div className="text-xs text-muted">Người đăng nhập</div>
                  <div style={{ fontWeight: 700, marginTop: 4 }}>{sessionMetrics.customerName}</div>
                </div>

                <div className="card" style={{ padding: 14 }}>
                  <div className="text-xs text-muted">Thời gian đã chơi</div>
                  <div style={{ fontWeight: 700, marginTop: 4 }}>{formatDuration(sessionMetrics.elapsedSeconds)}</div>
                </div>

                <div className="card" style={{ padding: 14 }}>
                  <div className="text-xs text-muted">Thời gian còn lại</div>
                  <div style={{ fontWeight: 700, marginTop: 4 }}>
                    {sessionMetrics.remainingSeconds === null ? 'Không giới hạn' : formatDuration(sessionMetrics.remainingSeconds)}
                  </div>
                </div>

                <div className="card" style={{ padding: 14 }}>
                  <div className="text-xs text-muted">Số tiền đã sử dụng</div>
                  <div style={{ fontWeight: 700, marginTop: 4, color: 'var(--accent-yellow)' }}>
                    {formatCurrency(sessionMetrics.usedAmount)}
                  </div>
                </div>

                <div className="card" style={{ padding: 14 }}>
                  <div className="text-xs text-muted">Số tiền còn lại</div>
                  <div style={{ fontWeight: 700, marginTop: 4, color: 'var(--accent-green)' }}>
                    {sessionMetrics.isPrepaid
                      ? formatCurrency(sessionMetrics.remainingAmount)
                      : 'Tính theo thực tế tại quầy'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 16, padding: 20 }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IoWallet /> Ví & Thẻ Thành Viên
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <div className="text-sm text-muted">Số dư khả dụng</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', margin: '8px 0' }}>
                  {formatCurrency(user?.balance)}
                </div>
                <button className="btn btn-primary" onClick={() => setShowTopupModal(!showTopupModal)}>
                  <IoQrCode style={{ marginRight: 6 }} /> Nạp tiền qua QR (Tự động)
                </button>
                {showTopupModal && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                    {!qrUrl ? (
                      <div>
                        <div className="form-group" style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: '0.9rem', marginBottom: 6, display: 'block' }}>Nhập số tiền muốn nạp (VNĐ)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            placeholder="Ví dụ: 50000"
                            value={topupAmount}
                            onChange={(e) => setTopupAmount(e.target.value)}
                          />
                        </div>
                        <button className="btn btn-primary" onClick={handleGenerateQR} style={{ width: '100%' }}>
                          Tạo mã QR
                        </button>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ 
                          background: '#ffffff', 
                          padding: '16px', 
                          borderRadius: '16px', 
                          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
                          marginBottom: '24px',
                          display: 'inline-block'
                        }}>
                          <img src={qrUrl} alt="VietQR" style={{ width: '100%', maxWidth: 220, height: 'auto', borderRadius: '8px', objectFit: 'contain' }} />
                          <div style={{ color: '#1e293b', fontSize: '0.85rem', marginTop: '12px', fontWeight: 600, letterSpacing: '0.5px' }}>
                            NGUYEN HUYNH KHOI<br/>TPBank - 15712122005
                          </div>
                        </div>
                        <div style={{ width: '100%' }}>
                          <button 
                            className="btn btn-primary" 
                            onClick={handleConfirmTopup} 
                            disabled={isToppingUp}
                            style={{ width: '100%' }}
                          >
                            {isToppingUp ? 'Đang xử lý...' : 'Tôi đã chuyển khoản xong'}
                          </button>
                          <div className="text-muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
                            Hệ thống sẽ kiểm tra và cộng tiền vào tài khoản của bạn.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <div className="text-sm text-muted">Hạng thành viên</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 20px 0' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-yellow)' }}>
                    {user?.member_rank || 'Bronze'}
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    <IoTrophy style={{ color: 'var(--accent-yellow)', marginRight: 4, verticalAlign: 'middle' }} />
                    {user?.points || 0} điểm
                  </div>
                </div>
                <div style={{ width: '100%', height: 8, background: 'var(--bg-dark)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
                  <div style={{ 
                    width: `${Math.min(100, ((user?.points || 0) / 1000) * 100)}%`, 
                    height: '100%', 
                    background: 'linear-gradient(90deg, var(--primary), var(--secondary))' 
                  }}></div>
                </div>
                <button className="btn btn-ghost" onClick={() => setShowRedeemModal(!showRedeemModal)} disabled={redeeming}>
                  Đổi điểm lấy quà
                </button>
                {showRedeemModal && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ display: 'block', marginBottom: 4 }}>Nước ngọt (Tùy chọn)</strong>
                        <div className="text-muted text-sm">200 điểm</div>
                      </div>
                      <button className="btn btn-primary btn-sm" style={{ marginLeft: 16 }} onClick={() => handleRedeem(200, 'Nước ngọt')}>Đổi ngay</button>
                    </div>
                    <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ display: 'block', marginBottom: 4 }}>Combo Nước + Mì tôm xào</strong>
                        <div className="text-muted text-sm">500 điểm</div>
                      </div>
                      <button className="btn btn-primary btn-sm" style={{ marginLeft: 16 }} onClick={() => handleRedeem(500, 'Combo Mì Nước')}>Đổi ngay</button>
                    </div>
                    <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ display: 'block', marginBottom: 4 }}>Thêm 2 giờ chơi (Khu thường)</strong>
                        <div className="text-muted text-sm">1000 điểm</div>
                      </div>
                      <button className="btn btn-primary btn-sm" style={{ marginLeft: 16 }} onClick={() => handleRedeem(1000, '2H Chơi')}>Đổi ngay</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16, padding: 20 }}>
            <div className="page-header page-header-actions" style={{ marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IoFastFood /> Gọi món từ máy khách
                </h2>
                <p className="text-sm text-muted">
                  Đơn sẽ được gửi trực tiếp đến admin.
                  {sessionMetrics ? ` Đang liên kết với ${sessionMetrics.computerName}.` : ' Không cần phiên chơi vẫn đặt được.'}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={fetchCommerceData} disabled={loadingCommerce}>
                <IoRefresh /> {loadingCommerce ? 'Đang cập nhật' : 'Làm mới'}
              </button>
            </div>

            {commerceError && <div className="login-error" style={{ marginBottom: 12 }}>{commerceError}</div>}

            {orderNotice.message && (
              <div
                className={orderNotice.type === 'error' ? 'login-error' : ''}
                style={{
                  marginBottom: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: orderNotice.type === 'error' ? undefined : '1px solid rgba(16, 185, 129, 0.35)',
                  background: orderNotice.type === 'error' ? undefined : 'rgba(16, 185, 129, 0.15)',
                  color: orderNotice.type === 'error' ? undefined : 'var(--accent-green)',
                  fontWeight: 600,
                }}
              >
                {orderNotice.type !== 'error' && <IoCheckmarkCircle style={{ marginRight: 6, verticalAlign: 'middle' }} />}
                {orderNotice.message}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}>
              <div>
                <h4 style={{ marginBottom: 10, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Menu đang có</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 330, overflowY: 'auto' }}>
                  {topProducts.map((product) => (
                    <div
                      key={product.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        background: 'var(--bg-card)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{product.name}</div>
                        <div className="text-xs text-muted">
                          {product.category} | Còn {product.stock}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="currency" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                          {formatCurrency(product.price)}
                        </div>
                        <button className="btn btn-primary btn-icon sm" onClick={() => addToCart(product)}>
                          <IoAdd />
                        </button>
                      </div>
                    </div>
                  ))}

                  {!loadingCommerce && topProducts.length === 0 && (
                    <div className="empty-state" style={{ padding: 18 }}>
                      <p className="empty-state-text">Chưa có món ăn/đồ uống khả dụng.</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: 10, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Giỏ món của bạn</h4>
                <div className="order-items-list" style={{ maxHeight: 210, overflowY: 'auto' }}>
                  {cart.map((item) => (
                    <div key={item.productId} className="order-item">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                        <div className="text-xs text-muted">{formatCurrency(item.price)}</div>
                      </div>
                      <div className="order-item-qty">
                        <button className="btn btn-ghost btn-icon sm" onClick={() => changeQuantity(item.productId, -1)}>
                          <IoRemove />
                        </button>
                        <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{item.quantity}</span>
                        <button className="btn btn-ghost btn-icon sm" onClick={() => changeQuantity(item.productId, 1)}>
                          <IoAdd />
                        </button>
                      </div>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <div className="empty-state" style={{ padding: 16 }}>
                      <p className="empty-state-text">Chưa có món nào trong giỏ.</p>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 10, marginBottom: 10, fontWeight: 700 }}>
                  Tổng tiền: <span className="currency" style={{ color: 'var(--primary)' }}>{formatCurrency(cartTotal)}</span>
                </div>

                <button
                  className="btn btn-success"
                  style={{ width: '100%' }}
                  onClick={submitOrder}
                  disabled={cart.length === 0 || submittingOrder}
                >
                  <IoCheckmarkCircle /> {submittingOrder ? 'Đang gửi đơn...' : 'Gửi đơn đến admin'}
                </button>

                <h4 style={{ marginTop: 16, marginBottom: 10, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  Đơn gần đây
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                  {orders.slice(0, 5).map((order) => (
                    <div
                      key={order.id}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        background: 'var(--bg-card)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong>Đơn #{String(order.id).padStart(4, '0')}</strong>
                        <span className="currency" style={{ color: 'var(--primary)' }}>
                          {formatCurrency(order.totalAmount)}
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        {order.itemCount} món
                        {order.computerName ? ` | ${order.computerName}` : ''}
                        {order.createdAt ? ` | ${new Date(order.createdAt).toLocaleString('vi-VN')}` : ''}
                      </div>
                      <div className="text-xs" style={{ marginTop: 4 }}>
                        <span
                          className={`badge ${
                            order.status === 'pending'
                              ? 'badge-yellow'
                              : order.status === 'confirmed'
                                ? 'badge-green'
                                : 'badge-red'
                          }`}
                        >
                          {order.status === 'pending'
                            ? 'Chờ admin xác nhận'
                            : order.status === 'confirmed'
                              ? 'Đã xác nhận'
                              : 'Đã hủy'}
                        </span>
                      </div>
                    </div>
                  ))}

                  {orders.length === 0 && (
                    <div className="empty-state" style={{ padding: 12 }}>
                      <p className="empty-state-text">Chưa có đơn nào.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section
        style={{
          padding: '100px 20px',
          textAlign: 'center',
          background: 'radial-gradient(circle at center, var(--primary-dim) 0%, transparent 70%)',
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '4rem',
            fontWeight: 800,
            marginBottom: '20px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Nâng Tầm Trải Nghiệm Game
        </h1>
        <p
          style={{
            fontSize: '1.2rem',
            color: 'var(--text-secondary)',
            maxWidth: '600px',
            marginBottom: '40px',
            lineHeight: 1.6,
          }}
        >
          Trải nghiệm gaming đỉnh cao tại CyberHub với cấu hình mạnh, không gian xịn và internet tốc độ cao.
        </p>
        <div style={{ display: 'flex', gap: '20px' }}>
          <Link to="/book" className="btn btn-primary" style={{ padding: '15px 30px', fontSize: '1.1rem' }}>
            Đặt máy ngay <IoArrowForward />
          </Link>
          {!isCustomer && (
            <Link to="/client-login" className="btn btn-ghost" style={{ padding: '15px 30px', fontSize: '1.1rem' }}>
              Tham gia CyberHub
            </Link>
          )}
        </div>
      </section>

      <section style={{ padding: '80px 40px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '15px' }}>Các Khu Chơi Tại CyberHub</h2>
          <p style={{ color: 'var(--text-muted)' }}>Chọn cấu hình phù hợp nhất với nhu cầu của bạn.</p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '30px',
          }}
        >
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: `var(--${zone.color === 'cyan' ? 'primary' : zone.color === 'purple' ? 'secondary' : 'accent-yellow'})`,
                }}
              ></div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div className={`stat-card-icon ${zone.color}`} style={{ marginBottom: 0 }}>
                  {zone.icon}
                </div>
                <div
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: `var(--${zone.color === 'cyan' ? 'primary' : zone.color === 'purple' ? 'secondary' : 'accent-yellow'})`,
                  }}
                >
                  {zone.price}
                </div>
              </div>

              <h3 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>{zone.name}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '25px', flex: 1 }}>{zone.desc}</p>

              <ul style={{ marginBottom: '30px' }}>
                {zone.specs.map((spec, index) => (
                  <li
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      color: 'var(--text-secondary)',
                      marginBottom: '8px',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                    {spec}
                  </li>
                ))}
              </ul>

              <Link
                to="/book"
                className={`btn ${zone.color === 'cyan' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%' }}
              >
                Chọn {zone.name}
              </Link>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
