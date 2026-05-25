import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { IoChatbubbles, IoRefresh, IoSend } from 'react-icons/io5';
import { useAuth } from '../../context/AuthContext';

const API = '/api';
const POLL_MS = 2500;
const messageEndpoints = [`${API}/support/messages`, `${API}/messages`, '/messages'];

const getWithFallback = async (endpoints, config) => {
  let fallbackError = null;
  for (const endpoint of endpoints) {
    try {
      return await axios.get(endpoint, config);
    } catch (error) {
      if (error?.response?.status === 404) {
        fallbackError = error;
        continue;
      }
      throw error;
    }
  }
  throw fallbackError || new Error('All endpoints unavailable');
};

const formatTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

export default function SupportChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const listRef = useRef(null);

  const isCustomer = user?.role === 'customer';

  const unreadCount = useMemo(
    () => messages.filter((m) => m.sender_role !== 'customer' && m.read_by_customer === false).length,
    [messages]
  );

  const fetchMessages = async (markRead = true) => {
    if (!isCustomer) return;

    if (!loading) setLoading(true);
    setError('');

    try {
      const res = await getWithFallback(messageEndpoints, {
        params: { mark_read: markRead ? 1 : 0 },
      });
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setMessages(data);
      setLastSync(new Date());
    } catch (err) {
      setError(err.response?.data?.message || 'Không tải được tin nhắn chat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isCustomer) return undefined;

    fetchMessages(true);
    const timer = setInterval(() => fetchMessages(true), POLL_MS);
    return () => clearInterval(timer);
  }, [isCustomer]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || sending) return;

    setSending(true);
    try {
      await axios.post(`${API}/support/messages`, { message });
      setDraft('');
      await fetchMessages(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Gửi tin nhắn thất bại');
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px' }}>
        <div className="card" style={{ padding: 24 }}>
          <h1 className="page-title" style={{ marginBottom: 10 }}>Chat hỗ trợ</h1>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            Bạn cần đăng nhập tài khoản khách hàng để chat với admin.
          </p>
          <Link to="/client-login" className="btn btn-primary">Đăng nhập khách hàng</Link>
        </div>
      </div>
    );
  }

  if (!isCustomer) {
    return <Navigate to="/admin/support" replace />;
  }

  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', padding: '0 20px 20px 20px' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IoChatbubbles /> Chat với admin
            </h1>
            <p className="text-xs text-muted" style={{ marginTop: 4 }}>
              Yêu cầu theo thời gian thực giữa khách hàng và admin.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-blue">Chưa đọc: {unreadCount}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => fetchMessages(true)}>
              <IoRefresh /> Làm mới
            </button>
          </div>
        </div>

        {error && <div className="login-error" style={{ margin: 12 }}>{error}</div>}

        <div
          ref={listRef}
          style={{
            height: 'min(62vh, 620px)',
            overflowY: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {messages.length === 0 && !loading && (
            <div className="empty-state" style={{ padding: 20 }}>
              <p className="empty-state-text">Chưa có tin nhắn nào. Hãy gửi yêu cầu đầu tiên.</p>
            </div>
          )}

          {messages.map((message) => {
            const mine = message.sender_role === 'customer';
            return (
              <div
                key={message.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: mine ? 'var(--primary-dim)' : 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: '8px 10px',
                }}
              >
                <div className="text-xs" style={{ opacity: 0.8, marginBottom: 4 }}>
                  {mine ? 'Bạn' : message.sender_name || message.sender_role}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14 }}>{message.message}</div>
                <div className="text-xs text-muted" style={{ marginTop: 6, textAlign: 'right' }}>
                  {formatTime(message.created_at)}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Nhập tin nhắn cho admin..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
            />
            <button className="btn btn-primary btn-icon" onClick={handleSend} disabled={sending || !draft.trim()}>
              <IoSend />
            </button>
          </div>

          <div className="text-xs text-muted" style={{ marginTop: 8 }}>
            {lastSync ? `Cập nhật lúc ${formatTime(lastSync)}` : 'Đang đồng bộ...'}
          </div>
        </div>
      </div>
    </div>
  );
}
