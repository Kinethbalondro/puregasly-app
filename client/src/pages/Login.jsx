import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import usePageTitle from '../utils/usePageTitle';
import Spinner from '../components/Spinner';
import AuthVisual from '../components/AuthVisual';

export default function Login() {
  usePageTitle('Log In');
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // 'login' = normal login form, 'change' = set a new password (temporary password users)
  const [step, setStep] = useState('login');
  const [pendingToken, setPendingToken] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const statusMessage = location.state?.status;
  const [notice] = useState(() => {
    const n = sessionStorage.getItem('pg_notice');
    sessionStorage.removeItem('pg_notice');
    return n || '';
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await api.post('/auth/login', { email, password });

      // Temporary password: don't sign in yet, ask for a new password first.
      if (res.data.user?.mustChangePassword) {
        setPendingToken(res.data.token);
        setNewPassword('');
        setConfirmNewPassword('');
        setStep('change');
        return;
      }

      login(res.data.token, res.data.refreshToken, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password must be at least 8 characters and include a letter and a number.');
      return;
    }
    if (newPassword === password) {
      setError('Your new password must be different from the temporary one.');
      return;
    }

    setSubmitting(true);
    try {
      // The temporary password they just typed is the "current password".
      const res = await api.post(
        '/auth/change-password',
        { currentPassword: password, newPassword },
        { headers: { Authorization: `Bearer ${pendingToken}` } }
      );
      login(res.data.token, res.data.refreshToken, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancelChange() {
    setError('');
    setPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPendingToken('');
    setStep('login');
  }

  return (
    <div className="auth-page">
      <AuthVisual />

      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="brand brand-mobile">
            <img src="/assets/logo.png" alt="PureGasly logo" />
            <span>PureGasly</span>
          </div>

          {step === 'change' ? (
            <>
              <h1 className="auth-heading">Set a new password</h1>
              <p className="subtitle">
                You signed in with a temporary password. Choose your own password to continue.
              </p>

              {error && <div className="message error">{error}</div>}

              <form onSubmit={handleChangePassword}>
                <div className="field">
                  <label htmlFor="newPassword">New password</label>
                  <div className="field-icon-wrap">
                    <span className="field-icon">🔒</span>
                    <input
                      type="password"
                      id="newPassword"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="confirmNewPassword">Confirm new password</label>
                  <div className="field-icon-wrap">
                    <span className="field-icon">🔒</span>
                    <input
                      type="password"
                      id="confirmNewPassword"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                  </div>
                </div>
                <p className="muted small auth-note">
                  At least 8 characters, with a letter and a number.
                </p>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting && <Spinner light />}{submitting ? 'Saving...' : 'Save password'}
                </button>
              </form>

              <p className="switch-link">
                Not you?{' '}
                <button
                  type="button"
                  onClick={handleCancelChange}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    color: 'inherit',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Back to log in
                </button>
              </p>
            </>
          ) : (
            <>
              <h1 className="auth-heading">Welcome back</h1>
              <p className="subtitle">Log in to your account to continue</p>

              {statusMessage && <div className="message success">{statusMessage}</div>}
              {notice && <div className="message error">{notice}</div>}
              {error && <div className="message error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <div className="field-icon-wrap">
                    <span className="field-icon">✉️</span>
                    <input
                      type="email"
                      id="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div className="field-icon-wrap">
                    <span className="field-icon">🔒</span>
                    <input
                      type="password"
                      id="password"
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting && <Spinner light />}{submitting ? 'Logging in...' : 'Log In'}
                </button>
              </form>

              <p className="switch-link">
                Don't have an account? <Link to="/register">Sign up</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}