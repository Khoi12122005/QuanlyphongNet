import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { IoChatbubbles, IoRefresh, IoSend } from 'react-icons/io5';

const API = '/api';
const POLL_CONVERSATIONS_MS = 3000;
const POLL_MESSAGES_MS = 2500;
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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

export default function SupportChatAdmin() {
  const [conversations, setConversations] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const listRef = useRef(null);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0),
    [conversations]
  );

  const currentConversation = useMemo(
    () => conversations.find((item) => Number(item.customer_id) === Number(selectedCustomerId)) || null,
    [conversations, selectedCustomerId]
  );

  const fetchConversations = async () => {
    try {
      const res = await getWithFallback(conversationEndpoints);
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setConversations(data);

      if (!selectedCustomerId && data.length > 0) {
        setSelectedCustomerId(Number(data[0].customer_id));
      } else if (selectedCustomerId) {
        const stillExists = data.some((item) => Number(item.customer_id) === Number(selectedCustomerId));
        if (!stillExists) {
          setSelectedCustomerId(data.length > 0 ? Number(data[0].customer_id) : null);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không tải được danh sách hội thoại');
    }
  };

  const fetchMessages = async (markRead = true) => {
    if (!selectedCustomerId) {
      setMessages([]);
      return;
    }

    if (!loading) setLoading(true);
    setError('');

    try {
      const res = await getWithFallback(messageEndpoints, {
        params: {
          customer_id: selectedCustomerId,
          mark_read: markRead ? 1 : 0,
        },
      });
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setMessages(data);
      setLastSync(new Date());
    } catch (err) {
      setError(err.response?.data?.message || 'Không tải được tin nhắn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const timer = setInterval(fetchConversations, POLL_CONVERSATIONS_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchMessages(true);
    if (!selectedCustomerId) return undefined;

    const timer = setInterval(() => fetchMessages(true), POLL_MESSAGES_MS);
    return () => clearInterval(timer);
  }, [selectedCustomerId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

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
    } catch (err) {
      alert(err.response?.data?.message || 'Gửi phản hồi thất bại');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header page-header-actions">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IoChatbubbles /> Chat hỗ trợ khách hàng
          </h1>
          <p className="page-subtitle">Yêu cầu theo thời gian thực giữa admin và khách</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-red">Chưa đọc: {totalUnread}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => Promise.all([fetchConversations(), fetchMessages(true)])}>
            <IoRefresh /> Làm mới
          </button>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          minHeight: 'min(72vh, 720px)',
        }}
      >
        <div style={{ borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
            Danh sách khách ({conversations.length})
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
              {currentConversation ? currentConversation.customer_name : 'Chọn một khách hàng để chat'}
            </div>
            <div className="text-xs text-muted">{currentConversation?.customer_phone || ''}</div>
          </div>

          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {!selectedCustomerId && (
              <div className="empty-state" style={{ padding: 20 }}>
                <p className="empty-state-text">Hãy chọn một hội thoại ở cột bên trái.</p>
              </div>
            )}

            {selectedCustomerId && messages.length === 0 && !loading && (
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

            <div className="text-xs text-muted" style={{ marginTop: 8 }}>
              {lastSync ? `Cập nhật lúc ${formatTime(lastSync)}` : 'Đang đồng bộ...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
