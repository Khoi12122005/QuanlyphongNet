import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { IoChatbubbles, IoClose, IoSend } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';

const API = '/api';
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

export default function CustomerSupportWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [zoomMode, setZoomMode] = useState(() => {
    if (typeof window === 'undefined') return 'normal';
    return sessionStorage.getItem('customer_support_zoom_mode') || 'normal';
  });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const isCustomer = user && user.role === 'customer';

  const unreadCount = useMemo(
    () => messages.filter((m) => m.sender_role !== 'customer' && m.read_by_customer === false).length,
    [messages]
  );

  const fetchMessages = async (markRead = false) => {
    if (!isCustomer) return;
    try {
      const res = await getWithFallback(messageEndpoints, {
        params: { mark_read: markRead ? 1 : 0 },
      });
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setMessages(data);
    } catch (error) {
      console.error('Support customer fetch error:', error);
    }
  };

  useEffect(() => {
    if (!isCustomer) return undefined;

    fetchMessages(open);
    const timer = setInterval(() => fetchMessages(open), 3000);
    return () => clearInterval(timer);
  }, [isCustomer, open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const toggleZoomMode = () => {
    const nextMode = zoomMode === 'expanded' ? 'normal' : 'expanded';
    setZoomMode(nextMode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('customer_support_zoom_mode', nextMode);
    }
  };

  const panelWidth = zoomMode === 'expanded' ? 'min(94vw, 620px)' : 'min(92vw, 360px)';
  const panelHeight = zoomMode === 'expanded' ? 'min(88vh, 760px)' : 'min(78vh, 500px)';

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || sending) return;

    setSending(true);
    try {
      await axios.post(`${API}/support/messages`, { message });
      setDraft('');
      await fetchMessages(true);
    } catch (error) {
      console.error('Support customer send error:', error);
      alert(error?.response?.data?.message || 'Gửi yêu cầu thất bại');
    } finally {
      setSending(false);
    }
  };

  if (!isCustomer) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            fetchMessages(true);
          }}
          className="btn btn-primary"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 1200,
            borderRadius: 999,
            padding: '12px 16px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
          }}
          title="Yêu cầu thời gian thực"
        >
          <IoChatbubbles /> Hỗ trợ
          {unreadCount > 0 && (
            <span
              style={{
                marginLeft: 8,
                minWidth: 20,
                height: 20,
                borderRadius: 999,
                background: '#ef4444',
                color: '#fff',
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className="card"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            width: panelWidth,
            maxWidth: 'calc(100vw - 16px)',
            height: panelHeight,
            maxHeight: 'calc(100vh - 16px)',
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>Yêu cầu thời gian thực</div>
              <div className="text-xs text-muted">Chat trực tiếp với admin</div>
            </div>
            <div className="flex gap-xs items-center">
              <button className="btn btn-ghost btn-sm" onClick={toggleZoomMode}>
                {zoomMode === 'expanded' ? 'Thu nhỏ' : 'Phóng to'}
              </button>
              <button className="btn btn-ghost btn-icon sm" onClick={() => setOpen(false)}>
                <IoClose />
              </button>
            </div>
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <div className="empty-state" style={{ padding: 20 }}>
                <p className="empty-state-text">Chưa có yêu cầu nào. Bạn có thể nhắn tin ngay bây giờ.</p>
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
                placeholder="Nhập yêu cầu..."
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
          </div>
        </div>
      )}
    </>
  );
}
