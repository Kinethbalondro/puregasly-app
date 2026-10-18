import { useCallback, useEffect, useState } from 'react';
import useAutoRefresh from '../utils/useAutoRefresh';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import { errMsg, formatDateTime } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Spinner from '../components/Spinner';
import { SkeletonRows } from '../components/Skeleton';
import usePageTitle from '../utils/usePageTitle';
import ChangePasswordForm from '../components/ChangePasswordForm';
import ChangeEmailForm from '../components/ChangeEmailForm';

function parseDevice(ua) {
  if (!ua) return 'Unknown device';
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android device';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/macintosh|mac os/i.test(ua)) return 'Mac';
  if (/linux/i.test(ua)) return 'Linux PC';
  return 'Unknown device';
}

function parseBrowser(ua) {
  if (!ua) return '';
  if (/edg\//i.test(ua)) return 'Edge';
  if (/chrome\//i.test(ua)) return 'Chrome';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/safari\//i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  return '';
}

export default function SecuritySettings() {
  usePageTitle('Security');
  const navigate = useNavigate();
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const load = useCallback(async (silent) => {
    try {
      const current = localStorage.getItem('pg_refresh') || '';
      const res = await api.get('/auth/sessions', { params: { current } });
      setSessions(res.data);
      setError('');
    } catch (err) {
      if (silent !== true) setError(errMsg(err, 'Could not load your sessions.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load(true), 10000);

  async function revoke(id) {
    setBusyId(id);
    try {
      await api.delete(`/auth/sessions/${id}`);
      toast('Device logged out.');
      await load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function logoutAll() {
    const ok = await confirmDialog('This will log out every device, including this one.', {
      title: 'Log out everywhere?',
      confirmLabel: 'Log out everywhere',
    });
    if (!ok) return;
    setLoggingOutAll(true);
    try {
      await api.post('/auth/logout-all');
    } catch {
      // continue anyway - we're about to clear local storage regardless
    }
    localStorage.removeItem('pg_token');
    localStorage.removeItem('pg_refresh');
    localStorage.removeItem('pg_user');
    window.dispatchEvent(new Event('pg:session-ended'));
    navigate('/login', { replace: true });
  }

  return (
    <AppShell>
      <h1 className="page-title">Security</h1>
      <p className="muted small" style={{ marginBottom: 20 }}>
        Manage your password and email, and see which devices are signed in to your account.
      </p>

      <ChangePasswordForm onChanged={() => load(true)} />
      <ChangeEmailForm />

      {error && <div className="message error">{error}</div>}

      <div className="panel">
        <div className="panel-head">
          <h3>Active sessions</h3>
          <button className="btn-danger-outline small" onClick={logoutAll} disabled={loggingOutAll}>
            {loggingOutAll ? 'Logging out...' : 'Log out everywhere'}
          </button>
        </div>

        {loading ? (
          <SkeletonRows count={2} />
        ) : sessions.length === 0 ? (
          <p className="empty">No active sessions found.</p>
        ) : (
          <div className="row-list">
            {sessions.map((s) => (
              <div key={s.id} className="row-item">
                <div>
                  <strong>
                    {parseDevice(s.userAgent)}
                    {parseBrowser(s.userAgent) ? ` · ${parseBrowser(s.userAgent)}` : ''}
                  </strong>
                  {s.current && <span className="status-pill received">this device</span>}
                  <div className="muted small">Signed in {formatDateTime(s.createdAt)}</div>
                </div>
                {!s.current && (
                  <button className="btn-danger-outline small" disabled={busyId === s.id} onClick={() => revoke(s.id)}>
                    {busyId === s.id && <Spinner />}Log out
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
