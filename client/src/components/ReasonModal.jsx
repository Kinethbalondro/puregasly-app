import { useState } from 'react';

// Small confirm dialog with an optional reason box (used for bans / rejections).
export default function ReasonModal({ title, description, confirmLabel, danger, requireReason, onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(reason.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{title}</h3>
        {description && <p className="muted">{description}</p>}
        <textarea
          rows={3}
          maxLength={300}
          placeholder={requireReason ? 'Reason (required)' : 'Reason (optional)'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={danger ? 'btn-danger' : 'btn-solid'}
            disabled={busy || (requireReason && !reason.trim())}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
