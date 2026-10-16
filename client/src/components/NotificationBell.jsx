import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

function timeAgo(d) {
  const secs = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const boxRef = useRef(null);
  const prevCountRef = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setItems(res.data.items);
      setUnreadCount(res.data.unreadCount);

      // Wiggle the bell when a genuinely new notification arrives (not on
      // first load, and not when the count only went down from reading one).
      if (prevCountRef.current !== null && res.data.unreadCount > prevCountRef.current) {
        setRinging(true);
        setTimeout(() => setRinging(false), 700);
      }
      prevCountRef.current = res.data.unreadCount;
    } catch {
      // silent - notifications are a nice-to-have, never block the app
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function openNotification(n) {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      setUnreadCount((c) => Math.max(0, c - 1));
      api.patch(`/notifications/${n.id}/read`).catch(() => {});
    }
    if (n.link) navigate(n.link);
  }

  async function markAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnreadCount(0);
    try {
      await api.patch('/notifications/read-all');
    } catch {
      load();
    }
  }

  return (
    <div className="bell-wrap" ref={boxRef}>
      <button className={`bell-btn ${ringing ? 'ring' : ''}`} onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="bell-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="bell-dropdown enter">
          <div className="bell-head">
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button className="link-btn" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="empty small">No notifications yet.</p>
          ) : (
            <div className="bell-list">
              {items.map((n) => (
                <button key={n.id} className={`bell-item ${n.read ? '' : 'unread'}`} onClick={() => openNotification(n)}>
                  <span className="bell-title">{n.title}</span>
                  {n.message && <span className="bell-message">{n.message}</span>}
                  <span className="bell-time">{timeAgo(n.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
