import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { errMsg, formatDateTime } from '../utils/format';

// Shown instead of the app when the owner's store is banned.
export default function StoreBannedGate() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const store = user.store;
  const appeal = store.appeal || { status: 'none' };

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendAppeal(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/store/appeal', { message });
      setMessage('');
      await refresh();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="modal-backdrop solid">
      <div className="modal wide">
        <div className="ban-icon">⛔</div>
        <h2>{store.name} has been suspended</h2>
        <p className="muted">
          Your store is hidden from customers and your team can't log in while it is suspended.
        </p>

        {store.banReason && (
          <div className="message error">
            <strong>Reason:</strong> {store.banReason}
          </div>
        )}

        {appeal.status === 'pending' ? (
          <div className="message success">
            Your appeal was sent {appeal.submittedAt ? formatDateTime(appeal.submittedAt) : ''} and is waiting for
            review. Check back later.
          </div>
        ) : (
          <form onSubmit={sendAppeal}>
            {appeal.status === 'denied' && (
              <div className="message error">
                Your last appeal was denied.{appeal.adminNote ? ` Admin note: ${appeal.adminNote}` : ''} You may send a
                new one.
              </div>
            )}
            <label className="form-label" htmlFor="appealMsg">
              Send a re-appeal for review
            </label>
            <textarea
              id="appealMsg"
              rows={4}
              maxLength={1000}
              required
              placeholder="Explain why the suspension should be lifted..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {error && <div className="message error">{error}</div>}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Sending...' : 'Send Appeal'}
            </button>
          </form>
        )}

        <button className="btn-ghost full" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </div>
  );
}
