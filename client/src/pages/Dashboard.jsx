import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { IoCash, IoDesktop, IoPeople, IoCart, IoRefresh } from 'react-icons/io5';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const API = '/api';
const REFRESH_INTERVAL_MS = 10000;

const formatCurrency = (val) => Number(val || 0).toLocaleString('vi-VN') + ' đ';

const getPayloadData = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN');
};

const normalizeActiveSession = (session) => {
  const computerName = session.computer_name || session.computerName || null;
  const computerId = session.computer_id || session.computerId || null;
  const customerName = session.customer_name || session.customerName || null;

  return {
    id: session.id,
    computerName: computerName || (computerId ? `Máy #${computerId}` : 'Máy không rõ'),
    customerName,
    startTime: session.start_time || session.startTime || null,
    currentDurationHours: toNumber(session.current_duration_hours ?? session.currentDurationHours),
    currentAmount: toNumber(session.current_amount ?? session.currentAmount),
    remainingMinutes: session.remaining_minutes ?? session.remainingMinutes ?? null,
    isPrepaid: Number(session.is_prepaid ?? session.isPrepaid ?? 0) === 1,
  };
};

function AnimatedNumber({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const target = toNumber(value);
    const start = display;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(start + (target - start) * eased));

      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };

    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);

  return <>{display.toLocaleString('vi-VN')}</>;
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    activeComputers: 0,
    totalCustomers: 0,
    todayOrders: 0,
  });
  const [chartData, setChartData] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [ordersPending, setOrdersPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError('');

    try {
      const [statsRes, chartRes, sessionsRes, ordersRes] = await Promise.allSettled([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/dashboard/chart`),
        axios.get(`${API}/sessions/active`),
        axios.get(`${API}/orders`),
      ]);

      const nextStats = {
        todayRevenue: 0,
        activeComputers: 0,
        totalCustomers: 0,
        todayOrders: 0,
      };

      if (statsRes.status === 'fulfilled') {
        const statsPayload = getPayloadData(statsRes.value.data) || {};
        nextStats.todayRevenue = toNumber(statsPayload.todayRevenue);
        nextStats.activeComputers = toNumber(statsPayload.activeComputers);
        nextStats.totalCustomers = toNumber(statsPayload.totalCustomers);
        nextStats.todayOrders = toNumber(statsPayload.todayOrders);
      }

      setStats(nextStats);

      if (chartRes.status === 'fulfilled') {
        const chartPayload = getPayloadData(chartRes.value.data) || {};
        const labels = Array.isArray(chartPayload.labels) ? chartPayload.labels : [];
        const values = Array.isArray(chartPayload.values) ? chartPayload.values.map(toNumber) : [];

        if (labels.length > 0 && values.length > 0) {
          setChartData({
            labels,
            datasets: [
              {
                label: 'Doanh thu (đ)',
                data: values,
                borderColor: '#00f0ff',
                backgroundColor: 'rgba(0, 240, 255, 0.08)',
                borderWidth: 2,
                pointBackgroundColor: '#00f0ff',
                pointBorderColor: '#00f0ff',
                pointRadius: 4,
                pointHoverRadius: 7,
                tension: 0.4,
                fill: true,
              },
            ],
          });
        } else {
          setChartData(null);
        }
      } else {
        setChartData(null);
      }

      if (sessionsRes.status === 'fulfilled') {
        const sessionsPayload = getPayloadData(sessionsRes.value.data);
        const sessionsArray = Array.isArray(sessionsPayload) ? sessionsPayload : [];
        setActiveSessions(sessionsArray.map(normalizeActiveSession));
      } else {
        setActiveSessions([]);
      }

      if (ordersRes.status === 'fulfilled') {
        const payload = getPayloadData(ordersRes.value.data);
        const ordersArray = Array.isArray(payload?.orders) ? payload.orders : Array.isArray(payload) ? payload : [];
        setOrdersPending(ordersArray.filter(o => o.status === 'pending' || o.status === 'Chờ xác nhận'));
      } else {
        setOrdersPending([]);
      }

      if (
        statsRes.status !== 'fulfilled' &&
        chartRes.status !== 'fulfilled' &&
        sessionsRes.status !== 'fulfilled' &&
        ordersRes.status !== 'fulfilled'
      ) {
        setError('Không thể tải dữ liệu dashboard. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Không thể tải dữ liệu dashboard. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(false);
    const timer = setInterval(() => fetchDashboard(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchDashboard]);

  const handleConfirmOrder = async (orderId) => {
    try {
      await axios.post(`${API}/orders/${orderId}/confirm`);
      fetchDashboard(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi xác nhận đơn');
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 2500,
      easing: 'easeOutElastic',
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 15, 42, 0.95)',
        borderColor: 'rgba(0, 240, 255, 0.2)',
        borderWidth: 1,
        titleColor: '#f0f0ff',
        bodyColor: '#a0a0c0',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => `Doanh thu: ${formatCurrency(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#606080', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#606080',
          font: { size: 11 },
          callback: (val) => `${Math.round(val / 1000)}k`,
        },
      },
    },
  };

  const statCards = [
    {
      icon: <IoCash />,
      color: 'cyan',
      label: 'Doanh thu hôm nay',
      value: stats.todayRevenue,
      format: 'currency',
      note: 'Từ phiên máy + đơn hàng',
    },
    {
      icon: <IoDesktop />,
      color: 'green',
      label: 'Máy đang sử dụng',
      value: activeSessions.length,
      note: 'Trạng thái thời gian thực',
    },
    {
      icon: <IoPeople />,
      color: 'purple',
      label: 'Tổng khách hàng',
      value: stats.totalCustomers,
      note: 'Dữ liệu hệ thống',
    },
    {
      icon: <IoCart />,
      color: 'yellow',
      label: 'Đơn hàng hôm nay',
      value: stats.todayOrders,
      note: 'Phát sinh trong ngày',
    },
  ];

  const activeSessionsSorted = useMemo(() => {
    return [...activeSessions].sort((a, b) => {
      const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return timeA - timeB;
    });
  }, [activeSessions]);

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
          <h1 className="page-title">Tổng quan</h1>
          <p className="page-subtitle">Chỉ hiển thị dữ liệu thật, không dùng dữ liệu mẫu.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => fetchDashboard(true)} disabled={refreshing}>
          <IoRefresh /> {refreshing ? 'Đang cập nhật...' : 'Làm mới'}
        </button>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: 'var(--spacing-lg)' }}>
          {error}
        </div>
      )}

      <div className="stats-grid">
        {statCards.map((card, idx) => (
          <div className={`stat-card stagger-item delay-${idx + 1}`} key={idx}>
            <div className={`stat-card-icon ${card.color}`}>{card.icon}</div>
            <div className="stat-card-value">
              {card.format === 'currency' ? (
                <>
                  <AnimatedNumber value={card.value} /> đ
                </>
              ) : (
                <AnimatedNumber value={card.value} />
              )}
            </div>
            <div className="stat-card-label">{card.label}</div>
            <div className="text-xs text-muted mt-sm">{card.note}</div>
          </div>
        ))}
      </div>

      <div className="revenue-grid stagger-item delay-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Doanh thu 7 ngày gần nhất</h3>
          </div>
          <div className="chart-container" style={{ minHeight: '350px' }}>
            {chartData ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="empty-state" style={{ padding: 30 }}>
                <p className="empty-state-text">Chưa có dữ liệu doanh thu để vẽ biểu đồ.</p>
              </div>
            )}
          </div>
        </div>

        <div className="card stagger-item delay-6" style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
          <div className="card-header" style={{ marginBottom: 10 }}>
            <h3 className="card-title">Máy đang chơi (thời gian thực)</h3>
          </div>

          {activeSessionsSorted.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
              {activeSessionsSorted.map((session) => (
                <div
                  key={session.id}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--bg-card)',
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div className="flex items-center justify-between gap-sm">
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{session.computerName}</div>
                    <span className="badge badge-green">
                      <span className="badge-dot green"></span>
                      Đang chơi
                    </span>
                  </div>

                  <div className="text-sm" style={{ marginTop: 6 }}>
                    Người đăng nhập: <strong>{session.customerName || 'Khách lẻ (không đăng nhập)'}</strong>
                  </div>

                  <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                    Bắt đầu: {formatDateTime(session.startTime)}
                  </div>

                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                    Đã chơi: {session.currentDurationHours.toFixed(2)} giờ
                  </div>

                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                    Tạm tính: {formatCurrency(session.currentAmount)}
                  </div>

                  {session.isPrepaid && session.remainingMinutes !== null && (
                    <div className="text-xs" style={{ marginTop: 4, color: 'var(--primary)' }}>
                      Phiên trả trước, còn lại: {session.remainingMinutes} phút
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-icon">Chưa hoạt động</div>
              <p className="empty-state-text">Hiện tại chưa có máy nào đang chơi.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
