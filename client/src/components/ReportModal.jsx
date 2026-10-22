import { useState } from 'react';
import api from '../api/axios';
import { errMsg } from '../utils/format';
import { useToast } from '../context/ToastContext';

const REPORT_TYPES = [
  { value: 'fake_listing', label: 'Fake listing (wrong photo, price or product)' },
  { value: 'abusive_message', label: 'Abusive message' },
  { value: 'no_show', label: 'No-show (order never arrived)' },
  { value: 'other', label: 'Other' },
];

const OVERLAY = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 1000,
};

// Popup form for reporting a store.
// Props: storeId, storeName, onClose
export default function ReportModal({ storeId, storeName, onClose }) {
  const toast = useToast();
  const [type, setType] = useState('fake_listing');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!reason.trim()) {
      toast('Please tell us what happened.', { type: 'error' });
      return;
    }
    setSending(true);
    try {
      await api.post('/reports', { reportedStore: storeId, type, reason: reason.trim() });
      toast('Report sent. An admin will review it.');
      onClose();
    } catch (err) {
      toast(errMsg(err), { type: 'error' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={OVERLAY} onClick={onClose}>
      <form
        className="panel"
        style={{ width: '100%', maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3>Report {storeName}</h3>
        <p className="muted small">An admin will review your report. Please only report real problems.</p>

        <label className="small" htmlFor="report-type">What happened?</label>
        <select
          id="report-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ width: '100%', marginBottom: 12 }}
        >
          {REPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <label className="small" htmlFor="report-reason">Details</label>
        <textarea
          id="report-reason"
          rows={4}
          maxLength={1000}
          placeholder="Tell us what happened..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ width: '100%', marginBottom: 12 }}
        />

        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn-danger-outline small" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-solid small" disabled={sending}>
            {sending ? 'Sending...' : 'Send report'}
          </button>
        </div>
      </form>
    </div>
  );
}