import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AuthVisual from '../components/AuthVisual';
import Spinner from '../components/Spinner';
import { errMsg } from '../utils/format';
import usePageTitle from '../utils/usePageTitle';

const RESEND_COOLDOWN_SECONDS = 60;

// Step 1: ask for a code by email. Step 2: type the code and choose a new password.
export default function ForgotPassword() {
  usePageTitle('Forgot password');
  const navigate = useNavigate();

  const [step, setStep] = useState('email'); // 'email' | 'reset'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(e) {
    e?.preventDefault();
    if (busy || cooldown > 0) return;
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setStep('reset');
      setOtp('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      // Same wording whether or not the account exists, so nobody can probe for accounts.
      setInfo(`If an account exists for ${email.trim()}, we sent a 6-digit code to it.`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/auth/reset-password', { email: email.trim(), otp, newPassword });
      navigate('/login', { state: { status: 'Password updated. Log in with your new password.' } });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <AuthVisual />

      <div className="auth-form-side">
        <Link to="/login" className="auth-back" aria-label="Back to login" title="Back to login">
          ←
        </Link>

        <div className="auth-form-wrap">
          <div className="brand brand-mobile">
            <img src="/assets/logo.png" alt="PureGasly logo" />
            <span>PureGasly</span>
          </div>

          {step === 'email' ? (
            <>
              <h1 className="auth-heading">Forgot your password?</h1>
              <p className="subtitle">Enter your email and we'll send you a code to reset it</p>

              {error && <div className="message error">{error}</div>}

              <form onSubmit={requestCode}>
                <div className="field">
                  <label htmlFor="fp-email">Email</label>
                  <div className="field-icon-wrap">
                    <span className="field-icon">✉️</span>
                    <input
                      type="email"
                      id="fp-email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy && <Spinner light />}{busy ? 'Sending...' : 'Send code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="auth-heading">Choose a new password</h1>
              <p className="subtitle">Enter the code we emailed you, then your new password</p>

              {error && <div className="message error">{error}</div>}
              {info && <div className="message success">{info}</div>}

              <form onSubmit={resetPassword}>
                <div className="field">
                  <label htmlFor="fp-otp">Verification code</label>
                  <input
                    type="text"
                    id="fp-otp"
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
                <div className="field">
                  <label htmlFor="fp-new">New password</label>
                  <div className="field-icon-wrap">
                    <span className="field-icon">🔒</span>
                    <input
                      type="password"
                      id="fp-new"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <span className="hint">At least 8 characters, with a letter and a number.</span>
                </div>
                <div className="field">
                  <label htmlFor="fp-confirm">Confirm new password</label>
                  <div className="field-icon-wrap">
                    <span className="field-icon">🔒</span>
                    <input
                      type="password"
                      id="fp-confirm"
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy && <Spinner light />}{busy ? 'Saving...' : 'Reset password'}
                </button>
              </form>

              <p className="switch-link">
                Didn't get it?{' '}
                <button type="button" className="link-btn" onClick={requestCode} disabled={cooldown > 0 || busy}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
              </p>
              <p className="switch-link">
                Wrong email?{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setStep('email');
                    setError('');
                    setInfo('');
                  }}
                >
                  Go back
                </button>
              </p>
            </>
          )}

          <p className="switch-link">
            Remembered it? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
