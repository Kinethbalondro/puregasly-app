import { useState } from 'react';
import api from '../api/axios';
import Spinner from './Spinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errMsg } from '../utils/format';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../utils/password';

// Signed-in "change my password". Every OTHER device is signed out by the server;
// this one gets a fresh session, which we store so the person stays logged in here.
export default function ChangePasswordForm({ onChanged }) {
  const { login } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (!isStrongPassword(next)) return setError(PASSWORD_RULE_MESSAGE);
    if (next !== confirm) return setError('The two new passwords do not match.');
    if (next === current) return setError('Your new password must be different from the current one.');

    setBusy(true);
    try {
      const res = await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      login(res.data.token, res.data.refreshToken, res.data.user);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('Password updated. Your other devices were signed out.');
      onChanged?.();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h3>Change password</h3>
      <p className="muted small">You'll stay signed in here. Any other device will be signed out.</p>
      {error && <div className="message error">{error}</div>}

      <div className="form-grid">
        <div className="field span2">
          <label htmlFor="cp-current">Current password</label>
          <input id="cp-current" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cp-new">New password</label>
          <input id="cp-new" type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <span className="hint">At least 8 characters, with a letter and a number.</span>
        </div>
        <div className="field">
          <label htmlFor="cp-confirm">Confirm new password</label>
          <input id="cp-confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
      </div>

      <button className="btn-solid" disabled={busy}>
        {busy && <Spinner light />}{busy ? 'Saving...' : 'Update password'}
      </button>
    </form>
  );
}
