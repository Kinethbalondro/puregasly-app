import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errMsg } from '../utils/format';
import { uploadImage, IMAGE_ACCEPT } from '../utils/image';
import usePageTitle from '../utils/usePageTitle';

const ROLE_LABEL = { admin: 'Admin', owner: 'Store Owner', employee: 'Employee', rider: 'Rider', customer: 'Customer' };

export default function Profile() {
  usePageTitle('My Profile');
  const { user, refresh } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await uploadImage('/profile/avatar', file, { square: true, maxWidth: 512, maxHeight: 512 });
      await refresh();
      toast('Profile photo updated.');
    } catch (err) {
      toast(err.response ? errMsg(err) : err.message, { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      await api.delete('/profile/avatar');
      await refresh();
      toast('Profile photo removed.');
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="panel profile-card">
        <Avatar name={user.name} src={user.avatar} size={96} />
        <div className="profile-info">
          <h2>{user.name}</h2>
          <p className="muted small">{user.email}</p>
          <p className="small">
            <span className="role-badge inline">{ROLE_LABEL[user.role] || user.role}</span>
            {user.store?.name && <span className="muted"> · 🏪 {user.store.name}</span>}
          </p>
          <div className="profile-actions">
            <button className="btn-solid small" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy && <Spinner light />}{user.avatar ? 'Change photo' : 'Upload photo'}
            </button>
            {user.avatar && (
              <button className="btn-danger-outline small" disabled={busy} onClick={onRemove}>Remove</button>
            )}
            <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={onPick} />
          </div>
          <p className="muted small">JPG, PNG or WebP. Your photo is cropped to a square and shown next to your name.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Account</h3>
        <div className="row-list">
          <div className="row-item compact">
            <div><strong>Security</strong><div className="muted small">Password, email and signed-in devices</div></div>
            <Link to="/security" className="btn-ghost small">Open</Link>
          </div>
          <div className="row-item compact">
            <div><strong>Privacy Policy</strong><div className="muted small">How PureGasly handles your information</div></div>
            <Link to="/privacy" className="btn-ghost small">Read</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
