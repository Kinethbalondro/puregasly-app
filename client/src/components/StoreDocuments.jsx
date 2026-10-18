import { useState } from 'react';
import api from '../api/axios';
import { errMsg } from '../utils/format';
import { useToast } from '../context/ToastContext';

function prettySize(bytes) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

// Admin-side checklist of a store's submitted documents with a View button.
// Files need the auth header, so they're fetched as a blob and opened in a new tab.
export default function StoreDocuments({ storeId, documents = [], missingRequired = [] }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  async function view(doc) {
    // Open the tab synchronously (inside the click) so popup blockers allow it.
    const tab = window.open('', '_blank');
    setBusyId(doc.id);
    try {
      const res = await api.get(`/admin/stores/${storeId}/documents/${doc.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      if (tab) tab.close();
      toast(errMsg(e), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="store-docs">
      <strong className="small">Submitted documents ({documents.length})</strong>
      {missingRequired.length > 0 && (
        <div className="message error small store-docs-missing">
          Missing required: {missingRequired.join(', ')}
        </div>
      )}
      {documents.length === 0 ? (
        <p className="muted small">No documents were submitted with this application.</p>
      ) : (
        <ul className="store-docs-list">
          {documents.map((d) => (
            <li key={d.id}>
              <span>
                {d.mimeType === 'application/pdf' ? '📄' : '🖼️'} {d.label}
                <span className="muted small"> · {d.originalName} · {prettySize(d.size)}</span>
              </span>
              <button type="button" className="btn-ghost small" disabled={busyId === d.id} onClick={() => view(d)}>
                {busyId === d.id ? 'Opening...' : 'View'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
