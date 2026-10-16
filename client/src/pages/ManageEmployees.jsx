import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import Spinner from '../components/Spinner';
import usePageTitle from '../utils/usePageTitle';

const PERMISSION_OPTIONS = [
  { key: 'manage_inventory', label: 'Manage Inventory' },
  { key: 'manage_orders', label: 'Manage Orders' },
  { key: 'view_analytics', label: 'View Analytics' },
  { key: 'manage_riders', label: 'Manage Riders' },
  { key: 'manage_coupons', label: 'Manage Coupons' },
];

export default function ManageEmployees() {
  usePageTitle('Employees');
  const { user } = useAuth();
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // The temporary password is shown once, right after the account is created.
  const [created, setCreated] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    setLoading(true);
    try {
      const res = await api.get('/employees');
      setEmployees(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load employees.');
    } finally {
      setLoading(false);
    }
  }

  function togglePermission(key) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  }

  async function handleAddEmployee(e) {
    e.preventDefault();
    setFormError('');
    setCreated(null);
    setSubmitting(true);

    try {
      const res = await api.post('/employees', { name, email, permissions });
      setCreated({
        name: res.data.name,
        email: res.data.email,
        tempPassword: res.data.tempPassword,
      });
      setName('');
      setEmail('');
      setPermissions([]);
      toast('Employee added.');
      loadEmployees();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not add employee.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyPassword() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.tempPassword);
      toast('Temporary password copied.');
    } catch {
      toast('Could not copy. Select the password and copy it manually.', { type: 'error' });
    }
  }

  async function handleTogglePermission(employeeId, key, currentPermissions) {
    const next = currentPermissions.includes(key)
      ? currentPermissions.filter((p) => p !== key)
      : [...currentPermissions, key];

    try {
      await api.patch(`/employees/${employeeId}`, { permissions: next });
      loadEmployees();
    } catch (err) {
      toast(err.response?.data?.message || 'Could not update permissions.', { type: 'error' });
    }
  }

  async function handleRemove(employeeId) {
    const ok = await confirmDialog('This cannot be undone.', { title: 'Remove this employee?', confirmLabel: 'Remove' });
    if (!ok) return;
    try {
      await api.delete(`/employees/${employeeId}`);
      toast('Employee removed.');
      loadEmployees();
    } catch (err) {
      toast(err.response?.data?.message || 'Could not remove employee.', { type: 'error' });
    }
  }

  return (
    <AppShell>
      <div>
        <div className="manage-card">
          <h1>Manage Employees</h1>
          <p className="subtitle" style={{ marginBottom: 24 }}>
            Store: {user.store?.name || 'Not set'}
          </p>

          {error && <div className="message error">{error}</div>}

          <form onSubmit={handleAddEmployee} className="employee-form">
            {formError && <div className="message error">{formError}</div>}

            <div className="form-row">
              <div className="field">
                <label htmlFor="empName">Full Name</label>
                <input
                  id="empName"
                  type="text"
                  required
                  minLength={4}
                  placeholder="e.g. Juan Dela Cruz"
                  title="First and last name, letters only"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="empEmail">Email</label>
                <input
                  id="empEmail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <p className="muted small" style={{ marginBottom: 16 }}>
              A temporary password is made for the employee after you add them. They must set their
              own password the first time they log in.
            </p>

            <div className="field">
              <label>Permissions</label>
              <div className="permission-checkboxes">
                {PERMISSION_OPTIONS.map((opt) => (
                  <label key={opt.key} className="checkbox-pill">
                    <input
                      type="checkbox"
                      checked={permissions.includes(opt.key)}
                      onChange={() => togglePermission(opt.key)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting && <Spinner light />}{submitting ? 'Adding...' : 'Add Employee'}
            </button>
          </form>

          {created && (
            <div className="message success" style={{ marginTop: 20 }}>
              <strong>{created.name} was added.</strong>
              <p style={{ margin: '8px 0' }}>
                Give them this temporary password. It is shown only once, so copy it now. They log in
                with <strong>{created.email}</strong> and will be asked to choose their own password.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <code
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    fontSize: '1.1rem',
                    letterSpacing: '0.08em',
                    userSelect: 'all',
                  }}
                >
                  {created.tempPassword}
                </code>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => setCreated(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    font: 'inherit',
                    textDecoration: 'underline',
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          <h2 className="section-heading">Current Employees</h2>

          {loading ? (
            <p className="placeholder-note">Loading...</p>
          ) : employees.length === 0 ? (
            <p className="placeholder-note">No employees yet. Add your first one above.</p>
          ) : (
            <div className="employee-list">
              {employees.map((emp) => (
                <div key={emp.id} className="employee-row">
                  <div>
                    <strong>{emp.name}</strong>
                    <span className="employee-email">{emp.email}</span>
                    {emp.mustChangePassword && (
                      <span className="employee-email">Has not set their own password yet</span>
                    )}
                  </div>
                  <div className="permission-checkboxes">
                    {PERMISSION_OPTIONS.map((opt) => (
                      <label key={opt.key} className="checkbox-pill small">
                        <input
                          type="checkbox"
                          checked={emp.permissions.includes(opt.key)}
                          onChange={() => handleTogglePermission(emp.id, opt.key, emp.permissions)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <button className="remove-btn" onClick={() => handleRemove(emp.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}