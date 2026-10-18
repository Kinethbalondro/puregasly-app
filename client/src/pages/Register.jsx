import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import usePageTitle from '../utils/usePageTitle';
import Spinner from '../components/Spinner';
import AuthVisual from '../components/AuthVisual';
import DocumentUploads from '../components/DocumentUploads';
import { DOCUMENT_TYPES } from '../utils/documentTypes';
import { errMsg } from '../utils/format';

const RESEND_COOLDOWN_SECONDS = 30;

export default function Register() {
  usePageTitle('Register');
  const navigate = useNavigate();
  const location = useLocation();

  // Coming from the login page with an account that never finished email
  // verification: open the code screen straight away.
  const verifyEmail = location.state?.verifyEmail || '';

  // 'form' = the sign-up form, 'otp' = enter the 6-digit code (customers only)
  const [step, setStep] = useState(verifyEmail ? 'otp' : 'form');

  const [role, setRole] = useState('customer');
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [docs, setDocs] = useState({});
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(verifyEmail ? `Enter the 6-digit code we sent to ${verifyEmail}, or request a new one.` : '');
  const [submitting, setSubmitting] = useState(false);

  // OTP step state
  const [otpEmail, setOtpEmail] = useState(verifyEmail);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Count down the "Resend code" timer.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must be at least 8 characters and include a letter and a number.');
      return;
    }

    if (!acceptedPrivacy) {
      setError('Please accept the Privacy Policy to continue.');
      return;
    }

    if (role === 'owner') {
      const missing = DOCUMENT_TYPES.find((d) => d.required && !docs[d.key]);
      if (missing) {
        setError(`Please upload: ${missing.label}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // multipart so the business documents can travel with the sign-up.
      const form = new FormData();
      form.append('name', name);
      form.append('email', email);
      form.append('password', password);
      form.append('role', role);
      form.append('acceptedPrivacy', 'true');
      if (role === 'owner') {
        form.append('storeName', storeName);
        Object.entries(docs).forEach(([key, file]) => form.append(key, file));
      }
      const res = await api.post('/auth/register', form);

      // Customers get a code by email and must enter it before they can log in.
      if (res.data.otpRequired) {
        setOtpEmail(res.data.email || email);
        setOtp('');
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setInfo(`We sent a 6-digit code to ${res.data.email || email}.`);
        setStep('otp');
        return;
      }

      // Store owners skip the code and wait for admin approval.
      navigate('/login', {
        state: {
          status: res.data.pendingApproval
            ? 'Application submitted! An admin must approve your store before you can log in.'
            : 'Account created! You can now log in.',
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setVerifying(true);
    try {
      await api.post('/auth/verify-otp', { email: otpEmail, otp });
      navigate('/login', { state: { status: 'Email verified! You can now log in.' } });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setError('');
    setInfo('');
    setResending(true);
    try {
      await api.post('/auth/resend-otp', { email: otpEmail });
      setOtp('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setInfo('A new code was sent. Check your inbox (and your spam folder).');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setResending(false);
    }
  }

  function handleChangeEmail() {
    setError('');
    setInfo('');
    setOtp('');
    setStep('form');
  }

  return (
    <div className="auth-page">
      <AuthVisual />

      <div className="auth-form-side">
        {step === 'form' && (
          <Link to="/login" className="auth-back" aria-label="Back to login" title="Back to login">
            ←
          </Link>
        )}

        <div className="auth-form-wrap">
          <div className="brand brand-mobile">
            <img src="/assets/logo.png" alt="PureGasly logo" />
            <span>PureGasly</span>
          </div>

          {step === 'otp' ? (
            <>
              <h1 className="auth-heading">Check your email</h1>
              <p className="subtitle">Enter the 6-digit code to finish creating your account</p>

              {error && <div className="message error">{error}</div>}
              {info && <div className="message success">{info}</div>}

              <form onSubmit={handleVerify}>
                <div className="field">
                  <label htmlFor="otp">Verification code</label>
                  <input
                    type="text"
                    id="otp"
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

                <button type="submit" className="btn-primary" disabled={verifying}>
                  {verifying && <Spinner light />}{verifying ? 'Verifying...' : 'Verify email'}
                </button>
              </form>

              <p className="switch-link">
                Didn't get it?{' '}
                <button type="button" className="link-btn" onClick={handleResend} disabled={cooldown > 0 || resending}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
              </p>

              <p className="switch-link">
                Wrong email?{' '}
                <button type="button" className="link-btn" onClick={handleChangeEmail}>
                  Go back
                </button>
              </p>
            </>
          ) : (
            <>
          <h1 className="auth-heading">Create your account</h1>
          <p className="subtitle">Join PureGasly as a customer or store owner</p>

          {error && <div className="message error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="role-toggle">
              <label className={role === 'customer' ? 'active' : ''}>
                <input
                  type="radio"
                  name="role"
                  value="customer"
                  checked={role === 'customer'}
                  onChange={() => setRole('customer')}
                />
                <span>Customer</span>
              </label>
              <label className={role === 'owner' ? 'active' : ''}>
                <input
                  type="radio"
                  name="role"
                  value="owner"
                  checked={role === 'owner'}
                  onChange={() => setRole('owner')}
                />
                <span>Store Owner</span>
              </label>
            </div>

            <div className="field">
              <label htmlFor="name">Full Name</label>
              <div className="field-icon-wrap">
                <span className="field-icon">👤</span>
                <input
                  type="text"
                  id="name"
                  required
                  minLength={4}
                  placeholder="e.g. Juan Dela Cruz"
                  title="Enter your first and last name (letters only)"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            {role === 'owner' && (
              <div className="field">
                <label htmlFor="storeName">Store Name</label>
                <div className="field-icon-wrap">
                  <span className="field-icon">🏪</span>
                  <input
                    type="text"
                    id="storeName"
                    required
                    placeholder="e.g. Dela Cruz LPG Depot"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                  />
                </div>
              </div>
            )}

            {role === 'owner' && (
              <p className="muted small auth-note">
                Store accounts need admin approval before you can log in.
              </p>
            )}

            {role === 'owner' && <DocumentUploads files={docs} onChange={setDocs} onError={setError} />}

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
            <div className="field-row">
              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="field-icon-wrap">
                  <span className="field-icon">🔒</span>
                  <input
                    type="password"
                    id="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="field-icon-wrap">
                  <span className="field-icon">🔒</span>
                  <input
                    type="password"
                    id="confirmPassword"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <label className="consent">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
              />
              <span>
                I have read and agree to the{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              </span>
            </label>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting && <Spinner light />}{submitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="switch-link">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
