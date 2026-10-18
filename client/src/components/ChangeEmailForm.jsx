import { useEffect, useState } from 'react';
import api from '../api/axios';
import Spinner from './Spinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errMsg } from '../utils/format';

const RESEND_COOLDOWN_SECONDS = 60;

// Signed-in "change my email": password + new address, then a code sent to the NEW address.
// The email only changes once the code is confirmed.
export default function ChangeEmailForm() {
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState('form'); // 'form' | 'code'
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function reset() {
    setStep('form');
    setNewEmail('');
    setPassword('');
    setOtp('');
    setError('');
    setInfo('');
    setCooldown(0);
  }

  async function requestCode(e) {
    e?.preventDefault();
    if (busy || cooldown > 0) return;
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const res = await api.post('/auth/change-email/request', { newEmail: newEmail.trim(), currentPassword: password });
      setStep('code');
      setOtp('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setInfo(res.data.message);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code from your email.');

    setBusy(true);
    try {
      await api.post('/auth/change-email/confirm', { otp });
      await refresh();
      toast('Email updated. Use your new email to log in from now on.');
      reset();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h3>Email address</h3>
      <p className="muted small">
        Your email is <strong className="break">{user.email}</strong>. It is what you log in with, and where password reset codes are sent.
      </p>
      {error && <div className="message error">{error}</div>}
      {info && step === 'code' && <div className="message success">{info}</div>}

      {step === 'form' ? (
        <form onSubmit={requestCode}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ce-new">New email</label>
              <input id="ce-new" type="email" required autoComplete="email" placeholder="you@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ce-pass">Current password</label>
              <input id="ce-pass" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <button className="btn-solid" disabled={busy}>
            {busy && <Spinner light />}{busy ? 'Sending...' : 'Send confirmation code'}
          </button>
        </form>
      ) : (
        <form onSubmit={confirm}>
          <div className="field">
            <label htmlFor="ce-otp">Code sent to {newEmail.trim().toLowerCase()}</label>
            <input
              id="ce-otp"
              type="text"
              className="otp-input"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <div className="inline-actions">
            <button className="btn-solid" disabled={busy}>
              {busy && <Spinner light />}{busy ? 'Confirming...' : 'Confirm new email'}
            </button>
            <button type="button" className="btn-ghost" onClick={requestCode} disabled={cooldown > 0 || busy}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
            <button type="button" className="link-btn" onClick={reset}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
