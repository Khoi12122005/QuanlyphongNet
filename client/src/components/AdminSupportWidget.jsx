import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { IoChatbubbles, IoClose, IoSend } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';

const API = '/api';
const conversationEndpoints = [`${API}/support/conversations`, `${API}/conversations`, '/conversations'];
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

export default function AdminSupportWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [zoomMode, setZoomMode] = useState(() => {
    if (typeof window === 'undefined') return 'normal';
    return sessionStorage.getItem('admin_support_zoom_mode') || 'normal';
  });
  const [conversations, setConversations] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const isAdminSide = user && user.role !== 'customer';

  const totalUnread = useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0),
    [conversations]
  );

  const fetchConversations = async () => {
    if (!isAdminSide) return;
    try {
      const res = await getWithFallback(conversationEndpoints);
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setConversations(data);

      if (!selectedCustomerId && data.length > 0) {
        setSelectedCustomerId(Number(data[0].customer_id));
      }

      if (selectedCustomerId) {
        const stillExists = data.some((item) => Number(item.customer_id) === Number(selectedCustomerId));
        if (!stillExists) {
          setSelectedCustomerId(data.length > 0 ? Number(data[0].customer_id) : null);
        }
      }
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      if (![401, 403].includes(status)) {
        console.error('Support admin conversations error:', error);
      }
    }
  };

  const fetchMessages = async (markRead = false) => {
    if (!isAdminSide || !selectedCustomerId) {
      setMessages([]);
      return;
    }

    try {
      const res = await getWithFallback(messageEndpoints, {
        params: { customer_id: selectedCustomerId, mark_read: markRead ? 1 : 0 },
      });
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setMessages(data);
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      if (![401, 403].includes(status)) {
        console.error('Support admin messages error:', error);
      }
    }
  };

  useEffect(() => {
    if (!isAdminSide) return undefined;
    fetchConversations();
    const timer = setInterval(fetchConversations, 3000);
    return () => clearInterval(timer);
  }, [isAdminSide]);

  useEffect(() => {
    if (!isAdminSide || !open || !selectedCustomerId) return undefined;

    fetchMessages(true);
    const timer = setInterval(() => fetchMessages(true), 2500);
    return () => clearInterval(timer);
  }, [isAdminSide, open, selectedCustomerId]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const currentConversation = useMemo(
    () => conversations.find((item) => Number(item.customer_id) === Number(selectedCustomerId)) || null,
    [conversations, selectedCustomerId]
  );

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || !selectedCustomerId || sending) return;

    setSending(true);
    try {
      await axios.post(`${API}/support/messages`, {
        customerId: selectedCustomerId,
        message,
      });
      setDraft('');
      await Promise.all([fetchMessages(true), fetchConversations()]);
    } catch (error) {
      console.error('Support admin send error:', error);
      alert(error?.response?.data?.message || 'Gửi phản hồi thất bại');
    } finally {
      setSending(false);
    }
  };

  const toggleZoomMode = () => {
    const nextMode = zoomMode === 'expanded' ? 'normal' : 'expanded';
    setZoomMode(nextMode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('admin_support_zoom_mode', nextMode);
    }
  };

  const panelWidth = zoomMode === 'expanded' ? 'min(96vw, 1120px)' : 'min(92vw, 720px)';
  const panelHeight = zoomMode === 'expanded' ? 'min(90vh, 760px)' : 'min(82vh, 520px)';
  const panelColumns = zoomMode === 'expanded' ? '300px 1fr' : '260px 1fr';

  if (!isAdminSide) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="btn btn-secondary"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 1200,
            borderRadius: 999,
            padding: '12px 16px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
          }}
          title="Yêu cầu thời gian thực từ khách hàng"
        >
          <IoChatbubbles /> Hỗ trợ KH
          {totalUnread > 0 && (
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
              {totalUnread}
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
            display: 'grid',
            gridTemplateColumns: panelColumns,
            padding: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
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
                <div style={{ fontWeight: 700 }}>Yêu cầu KH</div>
                <div className="text-xs text-muted">Thời gian thực</div>
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

            <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {conversations.length === 0 && (
                <div className="empty-state" style={{ padding: 16 }}>
                  <p className="empty-state-text">Chưa có yêu cầu nào từ khách.</p>
                </div>
              )}

              {conversations.map((item) => {
                const active = Number(item.customer_id) === Number(selectedCustomerId);
                return (
                  <button
                    key={item.customer_id}
                    onClick={() => setSelectedCustomerId(Number(item.customer_id))}
                    style={{
                      textAlign: 'left',
                      width: '100%',
                      border: '1px solid var(--border-color)',
                      background: active ? 'var(--primary-dim)' : 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      borderRadius: 10,
                      padding: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className="truncate">{item.customer_name || `KH #${item.customer_id}`}</span>
                      {Number(item.unread_count || 0) > 0 && (
                        <span className="badge badge-red" style={{ padding: '2px 8px' }}>{item.unread_count}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate" style={{ marginTop: 4 }}>{item.last_message || ''}</div>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>{formatTime(item.last_message_at)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700 }}>
                {currentConversation ? currentConversation.customer_name : 'Chọn một khách hàng'}
              </div>
              <div className="text-xs text-muted">{currentConversation?.customer_phone || ''}</div>
            </div>

            <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!selectedCustomerId && (
                <div className="empty-state" style={{ padding: 20 }}>
                  <p className="empty-state-text">Hãy chọn một hội thoại bên trái.</p>
                </div>
              )}

              {selectedCustomerId && messages.length === 0 && (
                <div className="empty-state" style={{ padding: 20 }}>
                  <p className="empty-state-text">Chưa có tin nhắn nào.</p>
                </div>
              )}

              {messages.map((message) => {
                const mine = message.sender_role !== 'customer';
                return (
                  <div
                    key={message.id}
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: mine ? 'var(--secondary-dim)' : 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 12,
                      padding: '8px 10px',
                    }}
                  >
                    <div className="text-xs" style={{ opacity: 0.8, marginBottom: 4 }}>
                      {mine ? 'Admin' : message.sender_name || 'Khách'}
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
                  placeholder={selectedCustomerId ? 'Nhập phản hồi cho khách...' : 'Chọn khách hàng trước'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!selectedCustomerId}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                />
                <button
                  className="btn btn-secondary btn-icon"
                  onClick={handleSend}
                  disabled={!selectedCustomerId || sending || !draft.trim()}
                >
                  <IoSend />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
