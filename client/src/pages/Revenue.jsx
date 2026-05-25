import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import {
  IoCash,
  IoDesktop,
  IoFastFood,
  IoCalendar,
  IoTrendingUp,
} from 'react-icons/io5';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

const API = '/api';
const formatCurrency = (val) => Number(val || 0).toLocaleString('vi-VN') + ' đ';
const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatDateLabel = (dateInput) => {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const normalizeDaily = (row) => ({
  date: row?.date || null,
  sessionRevenue: toNumber(row?.session_revenue),
  orderRevenue: toNumber(row?.order_revenue),
  totalRevenue: toNumber(row?.total_revenue),
  sessionCount: toNumber(row?.session_count),
  orderCount: toNumber(row?.order_count),
});

const normalizeTopMachine = (row) => ({
  id: toNumber(row?.id),
  name: row?.name || 'Máy không rõ',
  totalSessions: toNumber(row?.total_sessions),
  totalRevenue: toNumber(row?.total_revenue),
  totalHours: toNumber(row?.total_hours),
});

const normalizeTopCustomer = (row) => ({
  id: toNumber(row?.id),
  name: row?.name || 'Khách không rõ',
  phone: row?.phone || '',
  totalSessions: toNumber(row?.total_sessions),
  totalSpending: toNumber(row?.total_spending),
  totalHours: toNumber(row?.total_hours),
});

export default function Revenue() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const [summary, setSummary] = useState({
    today: { session_revenue: 0, order_revenue: 0, total: 0 },
    this_week: { session_revenue: 0, order_revenue: 0, total: 0 },
    this_month: { session_revenue: 0, order_revenue: 0, total: 0 },
    total_sessions: 0,
    active_sessions: 0,
  });

  const [dailyRows, setDailyRows] = useState([]);
  const [topMachines, setTopMachines] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRevenue();
  }, [dateFrom, dateTo]);

  const fetchRevenue = async () => {
    setLoading(true);
    setError('');

    try {
      const [summaryRes, dailyRes, machinesRes, customersRes] = await Promise.all([
        axios.get(`${API}/revenue/summary`),
        axios.get(`${API}/revenue/by-date`, { params: { from: dateFrom, to: dateTo } }),
        axios.get(`${API}/revenue/top-computers`, { params: { limit: 5 } }),
        axios.get(`${API}/revenue/top-customers`, { params: { limit: 5 } }),
      ]);

      const summaryData = summaryRes.data?.data || {};
      setSummary({
        today: {
          session_revenue: toNumber(summaryData?.today?.session_revenue),
          order_revenue: toNumber(summaryData?.today?.order_revenue),
          total: toNumber(summaryData?.today?.total),
        },
        this_week: {
          session_revenue: toNumber(summaryData?.this_week?.session_revenue),
          order_revenue: toNumber(summaryData?.this_week?.order_revenue),
          total: toNumber(summaryData?.this_week?.total),
        },
        this_month: {
          session_revenue: toNumber(summaryData?.this_month?.session_revenue),
          order_revenue: toNumber(summaryData?.this_month?.order_revenue),
          total: toNumber(summaryData?.this_month?.total),
        },
        total_sessions: toNumber(summaryData?.total_sessions),
        active_sessions: toNumber(summaryData?.active_sessions),
      });

      const daily = Array.isArray(dailyRes.data?.data) ? dailyRes.data.data : [];
      setDailyRows(daily.map(normalizeDaily));

      const machineRows = Array.isArray(machinesRes.data?.data) ? machinesRes.data.data : [];
      setTopMachines(machineRows.map(normalizeTopMachine));

      const customerRows = Array.isArray(customersRes.data?.data) ? customersRes.data.data : [];
      setTopCustomers(customerRows.map(normalizeTopCustomer));
    } catch (err) {
      console.error('Revenue error:', err);
      setError(err.response?.data?.message || 'Không tải được dữ liệu doanh thu thực tế.');
      setSummary({
        today: { session_revenue: 0, order_revenue: 0, total: 0 },
        this_week: { session_revenue: 0, order_revenue: 0, total: 0 },
        this_month: { session_revenue: 0, order_revenue: 0, total: 0 },
        total_sessions: 0,
        active_sessions: 0,
      });
      setDailyRows([]);
      setTopMachines([]);
      setTopCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const periodStats = useMemo(() => {
    return dailyRows.reduce(
      (acc, row) => {
        acc.totalRevenue += row.totalRevenue;
        acc.sessionRevenue += row.sessionRevenue;
        acc.orderRevenue += row.orderRevenue;
        return acc;
      },
      { totalRevenue: 0, sessionRevenue: 0, orderRevenue: 0 }
    );
  }, [dailyRows]);

  const dailyChartData = useMemo(() => ({
    labels: dailyRows.map((row) => formatDateLabel(row.date)),
    datasets: [
      {
        label: 'Doanh thu tổng',
        data: dailyRows.map((row) => row.totalRevenue),
        borderColor: '#00f0ff',
        backgroundColor: 'rgba(0, 240, 255, 0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#00f0ff',
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      },
    ],
  }), [dailyRows]);

  const sourceChartData = useMemo(() => ({
    labels: ['Phiên máy', 'Món ăn'],
    datasets: [
      {
        label: 'Doanh thu',
        data: [periodStats.sessionRevenue, periodStats.orderRevenue],
        backgroundColor: ['rgba(0, 240, 255, 0.7)', 'rgba(124, 58, 237, 0.7)'],
        borderColor: ['#00f0ff', '#7c3aed'],
        borderWidth: 1,
        borderRadius: 8,
        barThickness: 64,
      },
    ],
  }), [periodStats.orderRevenue, periodStats.sessionRevenue]);

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
          callback: (val) => `${Math.round(Number(val || 0) / 1000)}k`,
        },
      },
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
          label: (ctx) => formatCurrency(ctx.raw),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#a0a0c0', font: { size: 12 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#606080',
          font: { size: 11 },
          callback: (val) => `${Math.round(Number(val || 0) / 1000)}k`,
        },
      },
    },
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
          <h1 className="page-title">Doanh thu</h1>
          <p className="page-subtitle">Chỉ dùng dữ liệu thật từ hệ thống</p>
        </div>
        <div className="date-range">
          <IoCalendar style={{ color: 'var(--text-muted)' }} />
          <input
            type="date"
            className="form-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="date-range-separator">đến</span>
          <input
            type="date"
            className="form-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--spacing-lg)',
          marginBottom: 'var(--spacing-xl)',
        }}
      >
        <div className="stat-card">
          <div className="stat-card-icon cyan"><IoCash /></div>
          <div className="stat-card-value" style={{ fontSize: '1.45rem' }}>
            {formatCurrency(periodStats.totalRevenue)}
          </div>
          <div className="stat-card-label">Tổng doanh thu trong khoảng ngày</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon green"><IoDesktop /></div>
          <div className="stat-card-value" style={{ fontSize: '1.45rem' }}>
            {formatCurrency(periodStats.sessionRevenue)}
          </div>
          <div className="stat-card-label">Doanh thu phiên máy</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon purple"><IoFastFood /></div>
          <div className="stat-card-value" style={{ fontSize: '1.45rem' }}>
            {formatCurrency(periodStats.orderRevenue)}
          </div>
          <div className="stat-card-label">Doanh thu gọi món</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div
          style={{
            padding: '14px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <div className="text-xs text-muted">Hôm nay</div>
            <div style={{ fontWeight: 700 }}>{formatCurrency(summary.today?.total)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Tuần này</div>
            <div style={{ fontWeight: 700 }}>{formatCurrency(summary.this_week?.total)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Tháng này</div>
            <div style={{ fontWeight: 700 }}>{formatCurrency(summary.this_month?.total)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Tổng phiên</div>
            <div style={{ fontWeight: 700 }}>{toNumber(summary.total_sessions)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Phiên đang chạy</div>
            <div style={{ fontWeight: 700 }}>{toNumber(summary.active_sessions)}</div>
          </div>
        </div>
      </div>

      <div className="revenue-grid" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <IoTrendingUp style={{ marginRight: 8, color: 'var(--primary)' }} />
              Xu hướng doanh thu
            </h3>
          </div>
          <div className="chart-container">
            {dailyRows.length > 0 ? (
              <Line data={dailyChartData} options={lineOptions} />
            ) : (
              <div className="empty-state" style={{ padding: 18 }}>
                <p className="empty-state-text">Không có doanh thu trong khoảng ngày đã chọn.</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Cơ cấu doanh thu</h3>
          </div>
          <div className="chart-container">
            <Bar data={sourceChartData} options={barOptions} />
          </div>
        </div>
      </div>

      <div className="order-flow">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top máy có doanh thu</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Máy</th>
                  <th>Doanh thu</th>
                  <th>Số giờ</th>
                </tr>
              </thead>
              <tbody>
                {topMachines.map((machine, i) => (
                  <tr key={machine.id || i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{machine.name}</td>
                    <td>
                      <span className="currency" style={{ color: 'var(--primary)' }}>
                        {formatCurrency(machine.totalRevenue)}
                      </span>
                    </td>
                    <td>{machine.totalHours.toFixed(2)}h</td>
                  </tr>
                ))}
                {topMachines.length === 0 && (
                  <tr>
                    <td colSpan="4">
                      <div className="empty-state" style={{ padding: 14 }}>
                        <p className="empty-state-text">Chưa có dữ liệu máy.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top khách chi tiêu</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Khách hàng</th>
                  <th>Chi tiêu</th>
                  <th>Số giờ</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((customer, i) => (
                  <tr key={customer.id || i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {customer.name}
                      {customer.phone ? <div className="text-xs text-muted">{customer.phone}</div> : null}
                    </td>
                    <td>
                      <span className="currency" style={{ color: 'var(--primary)' }}>
                        {formatCurrency(customer.totalSpending)}
                      </span>
                    </td>
                    <td>{customer.totalHours.toFixed(2)}h</td>
                  </tr>
                ))}
                {topCustomers.length === 0 && (
                  <tr>
                    <td colSpan="4">
                      <div className="empty-state" style={{ padding: 14 }}>
                        <p className="empty-state-text">Chưa có dữ liệu khách hàng.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
