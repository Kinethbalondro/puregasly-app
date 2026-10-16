import { useEffect, useState } from 'react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Spinner from '../components/Spinner';
import { SkeletonRows } from '../components/Skeleton';
import usePageTitle from '../utils/usePageTitle';
import { errMsg, formatDateTime, formatPHP } from '../utils/format';

const BLANK = { code: '', type: 'percent', value: '', minOrder: '', maxUses: '', expiresAt: '' };

export default function ManageCoupons() {
  usePageTitle('Coupons');
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [coupons, setCoupons] = useState([]);
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
      .get('/coupons')
      .then((res) => setCoupons(res.data))
      .catch((err) => toast(errMsg(err, 'Could not load coupons.'), { type: 'error' }))
      .finally(() => setLoading(false));
  }

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleAdd(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/coupons', {
        ...form,
        value: Number(form.value),
        minOrder: form.minOrder === '' ? 0 : Number(form.minOrder),
        maxUses: form.maxUses === '' ? null : Number(form.maxUses),
        expiresAt: form.expiresAt || null,
      });
      setForm(BLANK);
      setShowForm(false);
      toast('Coupon created.');
      load();
    } catch (err) {
      setFormError(errMsg(err, 'Could not create coupon.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(c) {
    setBusyId(c.id);
    try {
      await api.patch(`/coupons/${c.id}`, { active: !c.active });
      load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id) {
    const ok = await confirmDialog('This cannot be undone.', { title: 'Remove this coupon?', confirmLabel: 'Remove' });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.delete(`/coupons/${id}`);
      toast('Coupon removed.');
      load();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell wide>
      <div className="page-head">
        <div>
          <h1 className="page-title">Coupons</h1>
          <p className="muted small">Promo codes customers can apply at checkout.</p>
        </div>
        <button className="btn-solid" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ New Coupon'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="panel">
          <h3>New coupon</h3>
          {formError && <div className="message error">{formError}</div>}
          <div className="form-grid">
            <div className="field">
              <label>Code</label>
              <input required maxLength={20} placeholder="e.g. WELCOME10" value={form.code} onChange={setF('code')} style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="field">
              <label>Discount type</label>
              <select value={form.type} onChange={setF('type')}>
                <option value="percent">Percent off</option>
                <option value="fixed">Fixed amount off (₱)</option>
              </select>
            </div>
            <div className="field">
              <label>{form.type === 'percent' ? 'Percent (1-100)' : 'Amount (₱)'}</label>
              <input type="number" min="0" max={form.type === 'percent' ? 100 : undefined} step="0.01" required value={form.value} onChange={setF('value')} />
            </div>
            <div className="field">
              <label>Minimum order (₱, optional)</label>
              <input type="number" min="0" step="0.01" value={form.minOrder} onChange={setF('minOrder')} />
            </div>
            <div className="field">
              <label>Usage limit (optional)</label>
              <input type="number" min="1" step="1" placeholder="Unlimited" value={form.maxUses} onChange={setF('maxUses')} />
            </div>
            <div className="field">
              <label>Expires on (optional)</label>
              <input type="date" value={form.expiresAt} onChange={setF('expiresAt')} />
            </div>
          </div>
          <button type="submit" className="btn-solid" disabled={submitting}>
            {submitting && <Spinner light />}{submitting ? 'Creating...' : 'Create Coupon'}
          </button>
        </form>
      )}

      {loading ? (
        <SkeletonRows count={3} />
      ) : coupons.length === 0 ? (
        <p className="empty">No coupons yet. Create one to offer customers a discount.</p>
      ) : (
        <div className="row-list">
          {coupons.map((c) => {
            const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
            const usedUp = c.maxUses != null && c.usedCount >= c.maxUses;
            return (
              <div key={c.id} className={`row-item ${!c.active || expired || usedUp ? 'row-muted' : ''}`}>
                <div>
                  <strong>{c.code}</strong>{' '}
                  <span className="chip">{c.type === 'percent' ? `${c.value}% off` : `${formatPHP(c.value)} off`}</span>
                  {!c.active && <span className="status-pill cancelled">disabled</span>}
                  {expired && <span className="status-pill cancelled">expired</span>}
                  {usedUp && <span className="status-pill cancelled">limit reached</span>}
                  <div className="muted small">
                    {c.minOrder > 0 ? `Min order ${formatPHP(c.minOrder)} · ` : ''}
                    Used {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}
                    {c.expiresAt ? ` · Expires ${formatDateTime(c.expiresAt)}` : ''}
                  </div>
                </div>
                <div className="row-actions">
                  <button className="btn-ghost small" disabled={busyId === c.id} onClick={() => toggleActive(c)}>
                    {c.active ? 'Disable' : 'Enable'}
                  </button>
                  <button className="btn-danger-outline small" disabled={busyId === c.id} onClick={() => handleRemove(c.id)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
