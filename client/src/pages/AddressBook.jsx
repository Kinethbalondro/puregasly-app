import { useEffect, useState } from 'react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Spinner from '../components/Spinner';
import { SkeletonRows } from '../components/Skeleton';
import usePageTitle from '../utils/usePageTitle';
import { errMsg } from '../utils/format';

const BLANK = { label: '', address: '', contactNumber: '' };

export default function AddressBook() {
  usePageTitle('Addresses');
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    api
      .get('/addresses')
      .then((res) => setAddresses(res.data))
      .catch((err) => toast(errMsg(err, 'Could not load your addresses.'), { type: 'error' }))
      .finally(() => setLoading(false));
  }

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleAdd(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/addresses', form);
      setForm(BLANK);
      setShowForm(false);
      toast('Address saved.');
      load();
    } catch (err) {
      setFormError(errMsg(err, 'Could not save address.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetDefault(id) {
    setBusyId(id);
    try {
      await api.patch(`/addresses/${id}/default`);
      load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id) {
    const ok = await confirmDialog('This cannot be undone.', { title: 'Remove this address?', confirmLabel: 'Remove' });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.delete(`/addresses/${id}`);
      toast('Address removed.');
      load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1 className="page-title">Saved Addresses</h1>
          <p className="muted small">Save addresses here so checkout is faster next time.</p>
        </div>
        <button className="btn-solid" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Address'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="panel">
          <h3>New address</h3>
          {formError && <div className="message error">{formError}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Label</label>
              <input required maxLength={40} placeholder="e.g. Home, Office" value={form.label} onChange={setF('label')} />
            </div>
            <div className="field">
              <label>Contact number</label>
              <input required maxLength={20} type="tel" value={form.contactNumber} onChange={setF('contactNumber')} />
            </div>
            <div className="field span2">
              <label>Full address</label>
              <textarea required rows={2} maxLength={250} value={form.address} onChange={setF('address')} />
            </div>
          </div>
          <button type="submit" className="btn-solid" disabled={submitting}>
            {submitting && <Spinner light />}{submitting ? 'Saving...' : 'Save Address'}
          </button>
        </form>
      )}

      {loading ? (
        <SkeletonRows count={2} />
      ) : addresses.length === 0 ? (
        <p className="empty">No saved addresses yet. Add one to speed up checkout.</p>
      ) : (
        <div className="row-list">
          {addresses.map((a) => (
            <div key={a.id} className="row-item">
              <div>
                <strong>{a.label}</strong>
                {a.isDefault && <span className="status-pill received">default</span>}
                <div className="muted small">{a.address}</div>
                <div className="muted small">📞 {a.contactNumber}</div>
              </div>
              <div className="row-actions">
                {!a.isDefault && (
                  <button className="btn-ghost small" disabled={busyId === a.id} onClick={() => handleSetDefault(a.id)}>
                    Set as default
                  </button>
                )}
                <button className="btn-danger-outline small" disabled={busyId === a.id} onClick={() => handleRemove(a.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
