import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import Modal from '../components/Modal';
import { IoAdd, IoDesktop, IoPencil, IoPlay, IoStatsChart, IoStop, IoTrash } from 'react-icons/io5';
import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const API = '/api';
const ZONE_OPTIONS = ['Thường', 'VIP', 'Streaming'];
const FILTER_OPTIONS = ['Tất cả', ...ZONE_OPTIONS];
const SESSION_DURATION_OPTIONS = [30, 60, 90, 120, 180, 240];

const ZONE_LABELS = {
  Thường: 'Thường',
  VIP: 'VIP',
  Streaming: 'Streaming',
};

const ZONE_DEFAULT_PRICES = {
  Thường: 50000,
  VIP: 100000,
  Streaming: 150000,
};

const statusLabels = {
  available: 'Sẵn sàng',
  in_use: 'Đang dùng',
  maintenance: 'Bảo trì',
};

const extractArray = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload[key])) return payload[key];
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
};

const normalizeZone = (value) => {
  const zone = String(value || '').trim().toLowerCase();
  if (zone.includes('vip')) return 'VIP';
  if (zone.includes('stream')) return 'Streaming';
  return 'Thường';
};

const normalizeCustomer = (customer) => ({
  ...customer,
  balance: Number(customer.balance || 0),
});

const normalizeComputer = (computer) => ({
  ...computer,
  zone: normalizeZone(computer.zone),
  specs: computer.specs || '',
  pricePerHour: Number(computer.pricePerHour ?? computer.price_per_hour ?? 0),
  customerName: computer.customerName ?? computer.customer_name ?? null,
  sessionStart: computer.sessionStart ?? computer.session_start ?? null,
  sessionId: computer.sessionId ?? computer.session_id ?? null,
  sessionPlannedMinutes: Number(computer.sessionPlannedMinutes ?? computer.session_planned_minutes ?? 0) || null,
  sessionPlannedEnd: computer.sessionPlannedEnd ?? computer.session_planned_end ?? null,
  sessionPrepaidAmount: Number(computer.sessionPrepaidAmount ?? computer.session_prepaid_amount ?? 0),
  sessionIsPrepaid: Number(computer.sessionIsPrepaid ?? computer.session_is_prepaid ?? 0) === 1,
});

const formatCurrency = (value) => Number(value || 0).toLocaleString('vi-VN') + ' đ';
const getZoneDefaultPrice = (zone) => ZONE_DEFAULT_PRICES[normalizeZone(zone)] || ZONE_DEFAULT_PRICES.Thường;

const isVirtualMachine = (computer) => {
  const name = String(computer.name || '').toLowerCase();
  const specs = String(computer.specs || '').toLowerCase();
  return name.startsWith('vm-') || specs.includes('virtual');
};

const getActiveMinutes = (startTime) => {
  if (!startTime) return 0;
  const diffMs = Date.now() - new Date(startTime).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
};

const computePrepaidAmount = (pricePerHour, durationMinutes) => {
  const minutes = Number(durationMinutes || 0);
  return Math.round((minutes / 60) * Number(pricePerHour || 0));
};

const formatClock = (seconds) => {
  const sec = Math.max(0, Math.floor(seconds || 0));
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

function SessionElapsedTimer({ startTime }) {
  const [elapsed, setElapsed] = useState('00:00:00');
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!startTime) return undefined;

    const update = () => {
      const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
      setElapsed(formatClock(diff));
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => clearInterval(intervalRef.current);
  }, [startTime]);

  return <div className="computer-card-timer">Đã chơi: {elapsed}</div>;
}

function SessionCountdownTimer({ endTime }) {
  const [remaining, setRemaining] = useState('00:00:00');
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!endTime) return undefined;

    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
      setRemaining(formatClock(diff));
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => clearInterval(intervalRef.current);
  }, [endTime]);

  return <div className="computer-card-timer">Còn lại: {remaining}</div>;
}

export default function Computers() {
  const [computers, setComputers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filter, setFilter] = useState('Tất cả');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showVirtualModal, setShowVirtualModal] = useState(false);
  const [editingComputer, setEditingComputer] = useState(null);
  const [selectedComputer, setSelectedComputer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(60);
  const [chartTick, setChartTick] = useState(0);
  const [form, setForm] = useState({
    name: '',
    zone: 'Thường',
    pricePerHour: getZoneDefaultPrice('Thường'),
    specs: '',
  });
  const [virtualForm, setVirtualForm] = useState({
    count: 1,
    zone: 'Thường',
    pricePerHour: getZoneDefaultPrice('Thường'),
    prefix: 'VM',
    specs: 'Máy ảo',
  });

  useEffect(() => {
    fetchComputers();
    fetchCustomers();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setChartTick((prev) => prev + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchComputers = async () => {
    try {
      const res = await axios.get(`${API}/computers`);
      setComputers(extractArray(res.data, 'computers').map(normalizeComputer));
    } catch (err) {
      console.error('Error fetching computers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API}/customers`);
      setCustomers(extractArray(res.data, 'customers').map(normalizeCustomer));
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const filtered = filter === 'Tất cả' ? computers : computers.filter((computer) => computer.zone === filter);
  const activeMachines = useMemo(() => computers.filter((computer) => computer.status === 'in_use'), [computers]);

  const selectedDuration = Math.max(15, Math.min(720, Number(sessionDurationMinutes || 60)));
  const selectedCustomerData = useMemo(
    () => customers.find((customer) => Number(customer.id) === Number(selectedCustomer)) || null,
    [customers, selectedCustomer]
  );
  const sessionPrepaidAmount = useMemo(
    () => computePrepaidAmount(selectedComputer?.pricePerHour, selectedDuration),
    [selectedComputer?.pricePerHour, selectedDuration]
  );
  const insufficientBalance = Boolean(selectedCustomerData && selectedCustomerData.balance < sessionPrepaidAmount);

  const activeChartData = useMemo(
    () => ({
      labels: activeMachines.map((machine) => machine.name),
      datasets: [
        {
          label: 'Thời gian hoạt động (phút)',
          data: activeMachines.map((machine) => getActiveMinutes(machine.sessionStart)),
          backgroundColor: 'rgba(0, 240, 255, 0.45)',
          borderColor: '#00f0ff',
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    }),
    [activeMachines, chartTick]
  );

  const activeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.raw} phút`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: '#a0a0c0' },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#f0f0ff' },
      },
    },
  };

  const handleComputerClick = (computer) => {
    setSelectedComputer(computer);
    setSelectedCustomer('');
    setSessionDurationMinutes(60);
    setShowSessionModal(true);
  };

  const handleStartSession = async () => {
    if (!selectedComputer) return;

    try {
      await axios.post(`${API}/sessions/start`, {
        computerId: selectedComputer.id,
        customerId: selectedCustomer || undefined,
        durationMinutes: selectedDuration,
      });

      setShowSessionModal(false);
      await Promise.all([fetchComputers(), fetchCustomers()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi bắt đầu phiên');
    }
  };

  const handleEndSession = async () => {
    if (!selectedComputer?.sessionId) return;

    try {
      const res = await axios.post(`${API}/sessions/${selectedComputer.sessionId}/end`);
      const payload = res?.data?.data;
      if (payload?.is_prepaid) {
        alert(`Phiên đã kết thúc. Tổng tiền trả trước: ${formatCurrency(payload.total_amount)}`);
      }
      setShowSessionModal(false);
      fetchComputers();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi kết thúc phiên');
    }
  };

  const openAddModal = () => {
    setEditingComputer(null);
    setForm({
      name: '',
      zone: 'Thường',
      pricePerHour: getZoneDefaultPrice('Thường'),
      specs: '',
    });
    setShowModal(true);
  };

  const openEditModal = (computer, event) => {
    event.stopPropagation();
    setEditingComputer(computer);
    setForm({
      name: computer.name || '',
      zone: normalizeZone(computer.zone),
      pricePerHour: computer.pricePerHour || getZoneDefaultPrice(computer.zone),
      specs: computer.specs || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        zone: normalizeZone(form.zone),
      };

      if (editingComputer) {
        await axios.put(`${API}/computers/${editingComputer.id}`, payload);
      } else {
        await axios.post(`${API}/computers`, payload);
      }

      setShowModal(false);
      fetchComputers();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi lưu máy tính');
    }
  };

  const handleDelete = async (id, event) => {
    event.stopPropagation();
    if (!confirm('Bạn có chắc muốn xóa máy tính này?')) return;
    try {
      await axios.delete(`${API}/computers/${id}`);
      fetchComputers();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi xóa');
    }
  };

  const openVirtualModal = () => {
    setVirtualForm({
      count: 1,
      zone: 'Thường',
      pricePerHour: getZoneDefaultPrice('Thường'),
      prefix: 'VM',
      specs: 'Máy ảo',
    });
    setShowVirtualModal(true);
  };

  const handleCreateVirtual = async () => {
    try {
      await axios.post(`${API}/computers/virtual`, {
        count: Number(virtualForm.count) || 1,
        zone: normalizeZone(virtualForm.zone),
        pricePerHour: Number(virtualForm.pricePerHour),
        prefix: virtualForm.prefix || 'VM',
        specs: virtualForm.specs || 'Máy ảo',
      });
      setShowVirtualModal(false);
      fetchComputers();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi tạo máy ảo');
    }
  };

  const applyZonePricing = async () => {
    try {
      await Promise.all(
        computers.map((computer) =>
          axios.put(`${API}/computers/${computer.id}`, {
            ...computer,
            zone: normalizeZone(computer.zone),
            pricePerHour: getZoneDefaultPrice(computer.zone),
          })
        )
      );
      fetchComputers();
      alert('Đã cập nhật giá 50k/100k/150k theo khu vực.');
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật giá hàng loạt');
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
          <h1 className="page-title">Quản lý máy tính</h1>
          <p className="page-subtitle">
            {activeMachines.length}/{computers.length} máy đang hoạt động
          </p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-ghost" onClick={applyZonePricing}>
            Áp giá 50k/100k/150k
          </button>
          <button className="btn btn-secondary" onClick={openVirtualModal}>
            <IoAdd /> Thêm máy ảo
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <IoAdd /> Thêm máy
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="card-header">
          <h3 className="card-title">
            <IoStatsChart style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Biểu đồ máy đang hoạt động
          </h3>
        </div>
        {activeMachines.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <p className="empty-state-text">Hiện không có máy nào đang chạy phiên.</p>
          </div>
        ) : (
          <div className="chart-container" style={{ height: 300 }}>
            <Bar data={activeChartData} options={activeChartOptions} />
          </div>
        )}
      </div>

      <div className="filter-tabs">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option}
            className={`filter-tab ${filter === option ? 'active' : ''}`}
            onClick={() => setFilter(option)}
          >
            {option === 'Tất cả' ? 'Tất cả' : ZONE_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="computer-grid">
        {filtered.map((computer) => (
          <div
            key={computer.id}
            className={`computer-card ${computer.status}`}
            onClick={() => handleComputerClick(computer)}
          >
            <div className="computer-card-icon">
              <IoDesktop />
            </div>
            <div className="computer-card-name">{computer.name}</div>
            <div className="computer-card-zone">{ZONE_LABELS[normalizeZone(computer.zone)]}</div>
            <div className="text-sm text-muted">{formatCurrency(computer.pricePerHour)}/giờ</div>

            {isVirtualMachine(computer) && (
              <span className="badge badge-purple" style={{ marginTop: 8 }}>
                Máy ảo
              </span>
            )}

            <span
              className={`badge ${
                computer.status === 'available'
                  ? 'badge-green'
                  : computer.status === 'in_use'
                    ? 'badge-red'
                    : 'badge-yellow'
              }`}
              style={{ marginTop: 8 }}
            >
              <span
                className={`badge-dot ${
                  computer.status === 'available' ? 'green' : computer.status === 'in_use' ? 'red' : 'yellow'
                }`}
              ></span>
              {statusLabels[computer.status] || computer.status}
            </span>

            {computer.status === 'in_use' && computer.customerName && (
              <div className="computer-card-user">{computer.customerName}</div>
            )}

            {computer.status === 'in_use' && computer.sessionIsPrepaid && computer.sessionPlannedEnd && (
              <SessionCountdownTimer endTime={computer.sessionPlannedEnd} />
            )}

            {computer.status === 'in_use' && (!computer.sessionIsPrepaid || !computer.sessionPlannedEnd) && computer.sessionStart && (
              <SessionElapsedTimer startTime={computer.sessionStart} />
            )}

            {computer.status === 'in_use' && computer.sessionIsPrepaid && (
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                Trả trước: {formatCurrency(computer.sessionPrepaidAmount)}
              </div>
            )}

            <div className="product-card-actions" style={{ justifyContent: 'center', marginTop: 10 }}>
              <button className="btn btn-ghost btn-icon sm" onClick={(event) => openEditModal(computer, event)} title="Sửa">
                <IoPencil />
              </button>
              <button className="btn btn-ghost btn-icon sm" onClick={(event) => handleDelete(computer.id, event)} title="Xóa">
                <IoTrash />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">Không có dữ liệu</div>
          <p className="empty-state-text">Không tìm thấy máy tính nào</p>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingComputer ? 'Sửa máy tính' : 'Thêm máy tính'}>
        <div className="form-group">
          <label className="form-label">Tên máy</label>
          <input
            type="text"
            className="form-input"
            placeholder="VD: PC-01 hoặc VM-01"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Khu vực</label>
            <select
              className="form-select"
              value={form.zone}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  zone: normalizeZone(e.target.value),
                  pricePerHour: getZoneDefaultPrice(e.target.value),
                }))
              }
            >
              <option value="Thường">Thường - 50.000 đ/giờ</option>
              <option value="VIP">VIP - 100.000 đ/giờ</option>
              <option value="Streaming">Streaming - 150.000 đ/giờ</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Giá/giờ (đ)</label>
            <input
              type="number"
              className="form-input"
              value={form.pricePerHour}
              onChange={(e) => setForm({ ...form, pricePerHour: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Cấu hình / Ghi chú</label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Ví dụ: Máy ảo hoặc cấu hình phần cứng"
            value={form.specs}
            onChange={(e) => setForm({ ...form, specs: e.target.value })}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {editingComputer ? 'Cập nhật' : 'Thêm mới'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showVirtualModal} onClose={() => setShowVirtualModal(false)} title="Thêm máy ảo hàng loạt">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Số lượng</label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={100}
              value={virtualForm.count}
              onChange={(e) => setVirtualForm({ ...virtualForm, count: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tiền tố tên máy</label>
            <input
              type="text"
              className="form-input"
              value={virtualForm.prefix}
              onChange={(e) => setVirtualForm({ ...virtualForm, prefix: e.target.value.toUpperCase() })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Khu vực</label>
            <select
              className="form-select"
              value={virtualForm.zone}
              onChange={(e) =>
                setVirtualForm((prev) => ({
                  ...prev,
                  zone: normalizeZone(e.target.value),
                  pricePerHour: getZoneDefaultPrice(e.target.value),
                }))
              }
            >
              <option value="Thường">Thường - 50.000 đ/giờ</option>
              <option value="VIP">VIP - 100.000 đ/giờ</option>
              <option value="Streaming">Streaming - 150.000 đ/giờ</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Giá/giờ (đ)</label>
            <input
              type="number"
              className="form-input"
              value={virtualForm.pricePerHour}
              onChange={(e) => setVirtualForm({ ...virtualForm, pricePerHour: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Mô tả</label>
          <textarea
            rows={3}
            className="form-textarea"
            value={virtualForm.specs}
            onChange={(e) => setVirtualForm({ ...virtualForm, specs: e.target.value })}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowVirtualModal(false)}>
            Hủy
          </button>
          <button className="btn btn-secondary" onClick={handleCreateVirtual}>
            <IoAdd /> Tạo máy ảo
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        title={selectedComputer?.name || 'Máy tính'}
      >
        {selectedComputer && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '3rem', marginBottom: 8 }}>
                <IoDesktop />
              </div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', marginBottom: 4 }}>
                {selectedComputer.name}
              </h3>
              <p className="text-muted text-sm">
                {ZONE_LABELS[normalizeZone(selectedComputer.zone)]} - {formatCurrency(selectedComputer.pricePerHour)}/giờ
              </p>
              <div style={{ marginTop: 12 }}>
                <span
                  className={`badge ${
                    selectedComputer.status === 'available'
                      ? 'badge-green'
                      : selectedComputer.status === 'in_use'
                        ? 'badge-red'
                        : 'badge-yellow'
                  }`}
                >
                  {statusLabels[selectedComputer.status]}
                </span>
              </div>
              {selectedComputer.status === 'in_use' && selectedComputer.sessionIsPrepaid && selectedComputer.sessionPlannedEnd && (
                <SessionCountdownTimer endTime={selectedComputer.sessionPlannedEnd} />
              )}
              {selectedComputer.status === 'in_use' && selectedComputer.sessionStart && (
                <SessionElapsedTimer startTime={selectedComputer.sessionStart} />
              )}
            </div>

            {selectedComputer.status === 'available' && (
              <>
                <div className="form-group">
                  <label className="form-label">Chọn khách hàng (tùy chọn)</label>
                  <select
                    className="form-select"
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                  >
                    <option value="">-- Khách lẻ --</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone} (số dư: {formatCurrency(customer.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Thời lượng chơi</label>
                    <select
                      className="form-select"
                      value={sessionDurationMinutes}
                      onChange={(e) => setSessionDurationMinutes(Number(e.target.value))}
                    >
                      {SESSION_DURATION_OPTIONS.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} phút
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nhập phút (15-720)</label>
                    <input
                      type="number"
                      min={15}
                      max={720}
                      step={15}
                      className="form-input"
                      value={sessionDurationMinutes}
                      onChange={(e) => setSessionDurationMinutes(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="card" style={{ padding: 12, marginBottom: 16 }}>
                  <div className="text-sm">Tiền cần trả trước: <span className="currency">{formatCurrency(sessionPrepaidAmount)}</span></div>
                  {selectedCustomerData ? (
                    <div className="text-sm text-muted" style={{ marginTop: 6 }}>
                      Số dư hiện tại: {formatCurrency(selectedCustomerData.balance)}
                    </div>
                  ) : (
                    <div className="text-sm text-muted" style={{ marginTop: 6 }}>
                      Khách lẻ: vui lòng thu tiền mặt trước khi bấm bắt đầu.
                    </div>
                  )}
                  {insufficientBalance && (
                    <div className="login-error" style={{ marginTop: 10, marginBottom: 0 }}>
                      Số dư không đủ để bắt đầu phiên trả trước.
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setShowSessionModal(false)}>
                    Hủy
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={handleStartSession}
                    disabled={insufficientBalance || selectedDuration < 15 || selectedDuration > 720}
                  >
                    <IoPlay /> Bắt đầu (trả trước)
                  </button>
                </div>
              </>
            )}

            {selectedComputer.status === 'in_use' && (
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowSessionModal(false)}>
                  Đóng
                </button>
                <button className="btn btn-danger" onClick={handleEndSession}>
                  <IoStop /> Kết thúc phiên
                </button>
              </div>
            )}

            {selectedComputer.status === 'maintenance' && (
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowSessionModal(false)}>
                  Đóng
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
