import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import { CATEGORY_LABELS, errMsg, formatPHP } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Spinner from '../components/Spinner';
import usePageTitle from '../utils/usePageTitle';

const BLANK = { name: '', brand: '', category: 'lpg', sizeKg: '', price: '', promoPrice: '', stock: '', lowStockAt: '5' };

function stockState(p) {
  if (p.stock === 0) return 'out';
  if (p.stock <= (p.lowStockAt ?? 5)) return 'low';
  return 'ok';
}

export default function ManageInventory() {
  usePageTitle('Inventory');
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [products, setProducts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await api.get('/inventory');
      setProducts(res.data);
      const d = {};
      res.data.forEach((p) => {
        d[p._id] = { price: p.price, promoPrice: p.promoPrice ?? '', stock: p.stock, active: p.active !== false };
      });
      setDrafts(d);
    } catch (err) {
      setError(errMsg(err, 'Could not load inventory.'));
    } finally {
      setLoading(false);
    }
  }

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleAdd(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/inventory', {
        ...form,
        sizeKg: form.sizeKg === '' ? '' : Number(form.sizeKg),
        price: Number(form.price),
        promoPrice: form.promoPrice === '' ? null : Number(form.promoPrice),
        stock: form.stock === '' ? 0 : Number(form.stock),
        lowStockAt: form.lowStockAt === '' ? 5 : Number(form.lowStockAt),
      });
      setForm(BLANK);
      setShowForm(false);
      toast('Product added.');
      load();
    } catch (err) {
      setFormError(errMsg(err, 'Could not add product.'));
    } finally {
      setSubmitting(false);
    }
  }

  const setDraft = (id, field, value) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  function isDirty(p) {
    const d = drafts[p._id];
    if (!d) return false;
    return (
      Number(d.price) !== p.price ||
      (d.promoPrice === '' ? null : Number(d.promoPrice)) !== (p.promoPrice ?? null) ||
      Number(d.stock) !== p.stock ||
      d.active !== (p.active !== false)
    );
  }

  async function handleSave(p) {
    const d = drafts[p._id];
    setError('');
    setSavingId(p._id);
    try {
      await api.patch(`/inventory/${p._id}`, {
        price: Number(d.price),
        promoPrice: d.promoPrice === '' ? null : Number(d.promoPrice),
        stock: Number(d.stock),
        active: d.active,
      });
      toast('Saved.');
      load();
    } catch (err) {
      toast(errMsg(err, 'Could not update product.'), { type: 'error' });
    } finally {
      setSavingId(null);
    }
  }

  async function handleRemove(id) {
    const ok = await confirmDialog('Remove this product from your inventory? This cannot be undone.', {
      title: 'Remove product?',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await api.delete(`/inventory/${id}`);
      toast('Product removed.');
      load();
    } catch (err) {
      toast(errMsg(err, 'Could not remove product.'), { type: 'error' });
    }
  }

  const stats = useMemo(
    () => ({
      total: products.length,
      units: products.reduce((s, p) => s + p.stock, 0),
      value: products.reduce((s, p) => s + p.stock * p.price, 0),
      low: products.filter((p) => stockState(p) === 'low').length,
      out: products.filter((p) => stockState(p) === 'out').length,
      promo: products.filter((p) => p.onPromo).length,
    }),
    [products]
  );

  const shown = products.filter((p) => {
    const text = `${p.name} ${p.brand}`.toLowerCase();
    if (search && !text.includes(search.toLowerCase())) return false;
    if (filter === 'low') return stockState(p) === 'low';
    if (filter === 'out') return stockState(p) === 'out';
    if (filter === 'promo') return p.onPromo;
    if (filter === 'hidden') return p.active === false;
    return true;
  });

  return (
    <AppShell wide>
      <div className="page-head">
        <div>
          <h1 className="page-title">Inventory & Sales</h1>
          <p className="muted small">Add products, put them on sale and keep an eye on stock.</p>
        </div>
        <button className="btn-solid" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add Product'}
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><span>Products</span><strong>{stats.total}</strong></div>
        <div className="kpi"><span>Units in stock</span><strong>{stats.units}</strong></div>
        <div className="kpi"><span>Stock value</span><strong>{formatPHP(stats.value)}</strong></div>
        <div className={`kpi ${stats.low ? 'warn' : ''}`}><span>Low stock</span><strong>{stats.low}</strong></div>
        <div className={`kpi ${stats.out ? 'danger' : ''}`}><span>Out of stock</span><strong>{stats.out}</strong></div>
        <div className="kpi"><span>On sale</span><strong>{stats.promo}</strong></div>
      </div>

      {error && <div className="message error">{error}</div>}

      {showForm && (
        <form onSubmit={handleAdd} className="panel">
          <h3>New product</h3>
          {formError && <div className="message error">{formError}</div>}
          <div className="form-grid">
            <div className="field"><label>Product name</label>
              <input required maxLength={100} placeholder="e.g. LPG Tank Refill" value={form.name} onChange={setF('name')} /></div>
            <div className="field"><label>Brand</label>
              <input maxLength={60} placeholder="e.g. Petron Gasul" value={form.brand} onChange={setF('brand')} /></div>
            <div className="field"><label>Type</label>
              <select value={form.category} onChange={setF('category')}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="field"><label>Size (kg)</label>
              <input type="number" min="0" step="0.1" value={form.sizeKg} onChange={setF('sizeKg')} /></div>
            <div className="field"><label>Price (₱)</label>
              <input type="number" min="0" step="0.01" required value={form.price} onChange={setF('price')} /></div>
            <div className="field"><label>Sale price (₱, optional)</label>
              <input type="number" min="0" step="0.01" value={form.promoPrice} onChange={setF('promoPrice')} /></div>
            <div className="field"><label>Stock</label>
              <input type="number" min="0" step="1" value={form.stock} onChange={setF('stock')} /></div>
            <div className="field"><label>Low-stock alert at</label>
              <input type="number" min="0" step="1" value={form.lowStockAt} onChange={setF('lowStockAt')} /></div>
          </div>
          <button type="submit" className="btn-solid" disabled={submitting}>{submitting && <Spinner light />}{submitting ? 'Adding...' : 'Add Product'}</button>
        </form>
      )}

      <div className="filter-bar">
        <input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="tabs compact">
          {[['all', 'All'], ['low', 'Low stock'], ['out', 'Out of stock'], ['promo', 'On sale'], ['hidden', 'Hidden']].map(([k, label]) => (
            <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="panel flush">
        {loading ? (
          <div style={{ padding: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-row" style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="skeleton-block" style={{ width: '25%', height: 14, borderRadius: 6 }} />
                <span className="skeleton-block" style={{ width: '15%', height: 14, borderRadius: 6 }} />
                <span className="skeleton-block" style={{ width: '15%', height: 14, borderRadius: 6 }} />
                <span className="skeleton-block" style={{ width: '15%', height: 14, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="empty">{products.length === 0 ? 'No products yet. Add your first one!' : 'No products match this filter.'}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Product</th><th>Price (₱)</th><th>Sale price (₱)</th><th>Stock</th><th>Sold</th><th>Shown</th><th></th></tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const st = stockState(p);
                  const d = drafts[p._id] || {};
                  return (
                    <tr key={p._id} className={p.active === false ? 'row-muted' : ''}>
                      <td>
                        <strong>{p.name}</strong>
                        <div className="muted small">
                          {[CATEGORY_LABELS[p.category] || 'LPG Tank', p.brand, p.sizeKg ? `${p.sizeKg} kg` : null].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td><input type="number" min="0" step="0.01" value={d.price ?? ''} onChange={(e) => setDraft(p._id, 'price', e.target.value)} /></td>
                      <td><input type="number" min="0" step="0.01" placeholder="—" value={d.promoPrice ?? ''} onChange={(e) => setDraft(p._id, 'promoPrice', e.target.value)} /></td>
                      <td>
                        <input type="number" min="0" step="1" value={d.stock ?? ''} onChange={(e) => setDraft(p._id, 'stock', e.target.value)} />
                        <span className={`stock-tag ${st}`}>{st === 'out' ? 'Out' : st === 'low' ? 'Low' : 'OK'}</span>
                      </td>
                      <td>{p.sold || 0}</td>
                      <td>
                        <label className="switch">
                          <input type="checkbox" checked={d.active ?? true} onChange={(e) => setDraft(p._id, 'active', e.target.checked)} />
                          <span />
                        </label>
                      </td>
                      <td className="actions">
                        <button className="btn-solid small" disabled={!isDirty(p) || savingId === p._id} onClick={() => handleSave(p)}>{savingId === p._id && <Spinner light />}Save</button>
                        <button className="btn-danger-outline small" onClick={() => handleRemove(p._id)}>Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
