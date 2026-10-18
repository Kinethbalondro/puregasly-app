import { DOCUMENT_TYPES, MAX_DOC_BYTES, ALLOWED_DOC_TYPES } from '../utils/documentTypes';

// Controlled list of file pickers for the store sign-up form.
// `files` is an object { [typeKey]: File }, `onChange` receives the new object.
export default function DocumentUploads({ files, onChange, onError }) {
  function pick(key, file) {
    if (!file) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      onError('Only PDF, JPG or PNG files are accepted.');
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      onError('Each document must be 5 MB or smaller.');
      return;
    }
    onError('');
    onChange({ ...files, [key]: file });
  }

  function clear(key) {
    const next = { ...files };
    delete next[key];
    onChange(next);
  }

  return (
    <div className="doc-uploads">
      <h4 className="doc-uploads-title">Business documents</h4>
      <p className="muted small">PDF, JPG or PNG, up to 5 MB each. An admin reviews these before your store goes live.</p>
      {DOCUMENT_TYPES.map((d) => {
        const file = files[d.key];
        return (
          <div key={d.key} className={`doc-upload ${file ? 'has-file' : ''}`}>
            <div className="doc-upload-info">
              <span className="doc-upload-label">
                {d.label} {d.required ? <em className="doc-req">required</em> : <em className="doc-opt">optional</em>}
              </span>
              {file && <span className="muted small doc-file-name">📎 {file.name} ({Math.ceil(file.size / 1024)} KB)</span>}
            </div>
            <div className="doc-upload-actions">
              <label className="btn-ghost small doc-pick">
                {file ? 'Replace' : 'Choose file'}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  hidden
                  onChange={(e) => {
                    pick(d.key, e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {file && (
                <button type="button" className="link-btn" onClick={() => clear(d.key)}>Remove</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
