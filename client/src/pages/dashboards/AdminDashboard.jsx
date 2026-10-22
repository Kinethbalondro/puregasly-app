import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import ReasonModal from '../../components/ReasonModal';
import { errMsg, formatDateTime } from '../../utils/format';
import StoreDocuments from '../../components/StoreDocuments';
import RatingStars from '../../components/RatingStars';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { SkeletonRows } from '../../components/Skeleton';
import usePageTitle from '../../utils/usePageTitle';

const ROLE_LABEL = { customer: 'Customer', owner: 'Store Owner', employee: 'Employee', rider: 'Rider' };

export default function AdminDashboard({ user }) {
  usePageTitle('Admin');
  const [tab, setTab] = useState('applications');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [recentActivity, setRecentActivity] = useState(null);
  const [pendingReports, setPendingReports] = useState(0); // NEW

  const loadStats = useCallback(() => {
    api.get('/admin/stats').then((r) => setStats(r.data)).catch((e) => setError(errMsg(e)));
    api
      .get('/admin/audit-log')
      .then((r) => setRecentActivity(r.data.slice(0, 5)))
      .catch(() => setRecentActivity([]));
    // NEW: number of reports waiting for review (shown on the Reports tab)
    api
      .get('/reports', { params: { status: 'pending' } })
      .then((r) => setPendingReports(r.data.length))
      .catch(() => setPendingReports(0));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const needsAttention = stats && (stats.pending > 0 || stats.appeals > 0);

  return (
    <>
      <div className="hero">
        <div>
          <h1>Admin Console</h1>
          <p>Signed in as {user.email}</p>
        </div>
        <span className="role-badge">Admin</span>
      </div>

      {!stats && !error && (
        <div className="kpi-grid">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="kpi skeleton-row">
              <span className="skeleton-block" style={{ width: '60%', height: 10 }} />
              <span className="skeleton-block" style={{ width: '35%', height: 20, marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div className="kpi-grid">
          <div className={`kpi ${stats.pending ? 'warn' : ''}`}><span className="kpi-icon">📝</span><span>Pending applications</span><strong>{stats.pending}</strong></div>
          <div className={`kpi ${stats.appeals ? 'warn' : ''}`}><span className="kpi-icon">⚠️</span><span>Open appeals</span><strong>{stats.appeals}</strong></div>
          <div className="kpi"><span className="kpi-icon">🏪</span><span>Live stores</span><strong>{stats.approved}</strong></div>
          <div className={`kpi ${stats.banned ? 'danger' : ''}`}><span className="kpi-icon">🚫</span><span>Banned stores</span><strong>{stats.banned}</strong></div>
          <div className="kpi"><span className="kpi-icon">👤</span><span>Customers</span><strong>{stats.customers}</strong></div>
          <div className="kpi"><span className="kpi-icon">🧑‍💼</span><span>Store owners</span><strong>{stats.owners}</strong></div>
          <div className="kpi"><span className="kpi-icon">👔</span><span>Employees</span><strong>{stats.employees}</strong></div>
          <div className="kpi"><span className="kpi-icon">🛵</span><span>Riders</span><strong>{stats.riders}</strong></div>
          <div className={`kpi ${stats.bannedUsers ? 'danger' : ''}`}><span className="kpi-icon">⛔</span><span>Banned users</span><strong>{stats.bannedUsers}</strong></div>
        </div>
      )}

      {error && <div className="message error">{error}</div>}

      {needsAttention && (
        <div className="message error admin-attention">
          <span>
            {stats.pending > 0 && (
              <span>
                📝 <strong>{stats.pending}</strong> store application{stats.pending === 1 ? '' : 's'} waiting
              </span>
            )}
            {stats.appeals > 0 && (
              <span>
                ⚠️ <strong>{stats.appeals}</strong> appeal{stats.appeals === 1 ? '' : 's'} waiting
              </span>
            )}
          </span>
          <button className="link-btn" onClick={() => setTab('applications')}>Review now →</button>
        </div>
      )}

      <div className="tabs">
        <button className={tab === 'applications' ? 'active' : ''} onClick={() => setTab('applications')}>
          Store Applications{stats?.pending > 0 && <span className="tab-count hot">{stats.pending}</span>}
        </button>
        <button className={tab === 'stores' ? 'active' : ''} onClick={() => setTab('stores')}>
          Stores{stats?.appeals > 0 && <span className="tab-count hot">{stats.appeals}</span>}
        </button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users</button>
        <button className={tab === 'reviews' ? 'active' : ''} onClick={() => setTab('reviews')}>Reviews</button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>
          Reports{pendingReports > 0 && <span className="tab-count hot">{pendingReports}</span>}
        </button>
        <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>Audit Log</button>
      </div>

      {tab === 'applications' && <Applications onChange={loadStats} />}
      {tab === 'stores' && <Stores onChange={loadStats} />}
      {tab === 'users' && <Users onChange={loadStats} />}
      {tab === 'reviews' && <Reviews />}
      {tab === 'reports' && <Reports onChange={loadStats} />}
      {tab === 'audit' && <AuditLog />}

      {tab !== 'audit' && (
        <div className="panel">
          <div className="panel-head">
            <h3>Recent activity</h3>
            <button className="link-btn" onClick={() => setTab('audit')}>View all →</button>
          </div>
          {!recentActivity ? (
            <SkeletonRows count={3} />
          ) : recentActivity.length === 0 ? (
            <p className="empty small">No admin actions logged yet.</p>
          ) : (
            <div className="row-list">
              {recentActivity.map((e) => (
                <div key={e.id} className="row-item compact">
                  <div>
                    <strong>{ACTION_LABELS[e.action] || e.action}</strong>
                    {e.targetLabel && <span className="muted small"> · {e.targetLabel}</span>}
                    <div className="muted small">{e.adminName} · {formatDateTime(e.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ---------- Store applications ---------- */
function Applications({ onChange }) {
  const toast = useToast();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/stores', { params: { status: 'pending' } });
      setStores(res.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id) {
    try {
      await api.patch(`/admin/stores/${id}/approve`);
      toast('Store approved.');
      await load();
      onChange();
    } catch (e) {
      toast(errMsg(e), { type: 'error' });
    }
  }

  async function reject(id, reason) {
    try {
      await api.patch(`/admin/stores/${id}/reject`, { reason });
      toast('Application rejected.');
      await load();
      onChange();
    } catch (e) {
      toast(errMsg(e), { type: 'error' });
    }
  }

  return (
    <div className="panel">
      <h3>Pending store applications</h3>
      {error && <div className="message error">{error}</div>}
      {loading ? (
        <SkeletonRows count={2} />
      ) : stores.length === 0 ? (
        <p className="empty">No applications waiting. 🎉</p>
      ) : (
        <div className="row-list">
          {stores.map((s) => (
            <div key={s.id} className="row-item">
              <div>
                <strong>{s.name}</strong>
                <div className="muted small">
                  Owner: {s.owner?.name} · {s.owner?.email}
                </div>
                <div className="muted small">Applied {formatDateTime(s.createdAt)}</div>
                <StoreDocuments storeId={s.id} documents={s.documents} missingRequired={s.missingRequired} />
              </div>
              <div className="row-actions">
                <button className="btn-solid small" onClick={() => approve(s.id)}>Approve</button>
                <button className="btn-danger-outline small" onClick={() => setRejecting(s)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {rejecting && (
        <ReasonModal
          title={`Reject ${rejecting.name}?`}
          description="The owner will see this reason when they try to log in."
          confirmLabel="Reject application"
          danger
          onSubmit={(reason) => reject(rejecting.id, reason)}
          onClose={() => setRejecting(null)}
        />
      )}
    </div>
  );
}

/* ---------- Stores (ban / unban / appeals) ---------- */
function Stores({ onChange }) {
  const toast = useToast();
  const [stores, setStores] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { type: 'ban' | 'deny', store }

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/stores', { params: { status: filter || undefined } });
      setStores(res.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function call(path, body, successMsg) {
    setError('');
    try {
      await api.patch(path, body);
      if (successMsg) toast(successMsg);
      await load();
      onChange();
    } catch (e) {
      toast(errMsg(e), { type: 'error' });
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>All stores</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="approved">Live</option>
          <option value="banned">Banned</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {error && <div className="message error">{error}</div>}
      {loading ? (
        <SkeletonRows count={3} />
      ) : stores.length === 0 ? (
        <p className="empty">No stores.</p>
      ) : (
        <div className="row-list">
          {stores.map((s) => {
            const appealPending = s.status === 'banned' && s.appeal?.status === 'pending';
            return (
              <div key={s.id} className="row-item">
                <div>
                  <strong>{s.name}</strong> <span className={`status-pill ${s.status}`}>{s.status}</span>
                  {appealPending && <span className="status-pill preparing">appeal waiting</span>}
                  <div className="muted small">Owner: {s.owner?.name} · {s.owner?.email}</div>
                  {s.status === 'banned' && s.banReason && <div className="small text-danger">Ban reason: {s.banReason}</div>}
                  {s.status === 'rejected' && s.rejectionReason && <div className="small text-danger">Rejected: {s.rejectionReason}</div>}
                  {appealPending && (
                    <div className="appeal-box">
                      <strong className="small">Appeal ({formatDateTime(s.appeal.submittedAt)}):</strong>
                      <p className="small">{s.appeal.message}</p>
                    </div>
                  )}
                  <StoreDocuments storeId={s.id} documents={s.documents} missingRequired={s.missingRequired} />
                </div>
                <div className="row-actions">
                  {s.status === 'approved' && (
                    <button className="btn-danger-outline small" onClick={() => setModal({ type: 'ban', store: s })}>Ban store</button>
                  )}
                  {s.status === 'banned' && !appealPending && (
                    <button className="btn-solid small" onClick={() => call(`/admin/stores/${s.id}/unban`, undefined, 'Store reinstated.')}>Reinstate</button>
                  )}
                  {appealPending && (
                    <>
                      <button className="btn-solid small" onClick={() => call(`/admin/stores/${s.id}/appeal`, { decision: 'approve' }, 'Appeal approved.')}>Approve appeal</button>
                      <button className="btn-danger-outline small" onClick={() => setModal({ type: 'deny', store: s })}>Deny</button>
                    </>
                  )}
                  {s.status === 'rejected' && (
                    <button className="btn-solid small" onClick={() => call(`/admin/stores/${s.id}/approve`, undefined, 'Store approved.')}>Approve</button>
                  )}
                  {s.status === 'pending' && (
                    <button className="btn-solid small" onClick={() => call(`/admin/stores/${s.id}/approve`, undefined, 'Store approved.')}>Approve</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === 'ban' && (
        <ReasonModal
          title={`Ban ${modal.store.name}?`}
          description="The store is hidden from customers, employees are locked out, and the owner can only log in to send an appeal. Unaccepted orders are cancelled."
          confirmLabel="Ban store"
          danger
          requireReason
          onSubmit={(reason) => call(`/admin/stores/${modal.store.id}/ban`, { reason }, 'Store banned.')}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'deny' && (
        <ReasonModal
          title="Deny this appeal?"
          description="Add a note the owner will see. They can send another appeal."
          confirmLabel="Deny appeal"
          danger
          onSubmit={(note) => call(`/admin/stores/${modal.store.id}/appeal`, { decision: 'deny', note }, 'Appeal denied.')}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

/* ---------- Users ---------- */
function Users({ onChange }) {
  const toast = useToast();
  const [role, setRole] = useState('customer');
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banning, setBanning] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users', { params: { role } });
      setUsers(res.data);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    load();
  }, [load]);

  async function setBan(u, reason) {
    try {
      await api.patch(`/admin/users/${u.id}/${reason === null ? 'unban' : 'ban'}`, { reason });
      toast(reason === null ? 'User unbanned.' : 'User banned.');
      await load();
      onChange();
    } catch (e) {
      toast(errMsg(e), { type: 'error' });
    }
  }

  const term = search.trim().toLowerCase();
  const shown = users.filter((u) => !term || `${u.name} ${u.email} ${u.store?.name || ''}`.toLowerCase().includes(term));

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="tabs compact">
          {Object.entries(ROLE_LABEL).map(([k, label]) => (
            <button key={k} className={role === k ? 'active' : ''} onClick={() => setRole(k)}>{label}s</button>
          ))}
        </div>
        <input className="search-input" placeholder="Search name, email, store..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error && <div className="message error">{error}</div>}
      {loading ? (
        <SkeletonRows count={4} />
      ) : shown.length === 0 ? (
        <p className="empty">No users found.</p>
      ) : (
        <div className="row-list">
          {shown.map((u) => (
            <div key={u.id} className={`row-item ${u.banned ? 'banned' : ''}`}>
              <div>
                <strong>{u.name}</strong> {u.banned && <span className="status-pill cancelled">banned</span>}
                <div className="muted small">{u.email}</div>
                {u.store && <div className="muted small">🏪 {u.store.name} ({u.store.status})</div>}
                {u.banned && u.banReason && <div className="small text-danger">Reason: {u.banReason}</div>}
              </div>
              <div className="row-actions">
                {u.banned ? (
                  <button className="btn-solid small" onClick={() => setBan(u, null)}>Unban</button>
                ) : (
                  <button className="btn-danger-outline small" onClick={() => setBanning(u)}>Ban</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {banning && (
        <ReasonModal
          title={`Ban ${banning.name}?`}
          description="They will be signed out and unable to log in until unbanned."
          confirmLabel="Ban user"
          danger
          requireReason
          onSubmit={(reason) => setBan(banning, reason)}
          onClose={() => setBanning(null)}
        />
      )}
    </div>
  );
}

/* ---------- Reviews moderation ---------- */
function Reviews() {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/reviews');
      setReviews(res.data);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id) {
    const ok = await confirmDialog('This cannot be undone.', { title: 'Remove this review?', confirmLabel: 'Remove' });
    if (!ok) return;
    try {
      await api.delete(`/admin/reviews/${id}`);
      toast('Review removed.');
      load();
    } catch (e) {
      toast(errMsg(e), { type: 'error' });
    }
  }

  return (
    <div className="panel">
      <h3>All reviews</h3>
      {error && <div className="message error">{error}</div>}
      {loading ? (
        <SkeletonRows count={3} />
      ) : reviews.length === 0 ? (
        <p className="empty">No reviews yet.</p>
      ) : (
        <div className="row-list">
          {reviews.map((r) => (
            <div key={r.id} className="row-item">
              <div>
                <strong>{r.storeName}</strong> <RatingStars value={r.rating} size="sm" />
                <div className="muted small">{r.customerName} · {r.customerEmail} · {formatDateTime(r.createdAt)}</div>
                {r.comment && <p className="small">{r.comment}</p>}
              </div>
              <div className="row-actions">
                <button className="btn-danger-outline small" onClick={() => remove(r.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Reports (abusive messages, fake listings, no-shows) ---------- */
const REPORT_TYPE_LABEL = {
  abusive_message: 'Abusive message',
  fake_listing: 'Fake listing',
  no_show: 'No-show',
  other: 'Other',
};

// Reuses the status-pill colors that already exist in the stylesheet.
const REPORT_STATUS_PILL = {
  pending: 'preparing',
  actioned: 'approved',
  dismissed: 'cancelled',
};

const ACTION_DONE_LABEL = {
  warn: 'Warned',
  mute: 'Muted',
  remove: 'Removed',
  none: 'Dismissed',
};

function Reports({ onChange }) {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('pending');
  const [type, setType] = useState('');
  const [muteDays, setMuteDays] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { action: 'warn' | 'mute' | 'remove', report }

  const load = useCallback(async () => {
    try {
      const res = await api.get('/reports', {
        params: { status: status || undefined, type: type || undefined },
      });
      setReports(res.data);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [status, type]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(report, action, adminNote, successMsg) {
    try {
      await api.patch(`/reports/${report._id || report.id}`, { action, adminNote, muteDays });
      toast(successMsg);
      await load();
      onChange();
    } catch (e) {
      toast(errMsg(e), { type: 'error' });
    }
  }

  const targetName = (r) => r.reportedUser?.name || r.reportedStore?.name || 'this account';

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Reports</h3>
        <div className="row-actions">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="actioned">Action taken</option>
            <option value="dismissed">Dismissed</option>
            <option value="">All</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(REPORT_TYPE_LABEL).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          <select value={muteDays} onChange={(e) => setMuteDays(Number(e.target.value))} title="How long the Mute action lasts">
            <option value={1}>Mute: 1 day</option>
            <option value={3}>Mute: 3 days</option>
            <option value={7}>Mute: 7 days</option>
            <option value={30}>Mute: 30 days</option>
          </select>
        </div>
      </div>

      {error && <div className="message error">{error}</div>}

      {loading ? (
        <SkeletonRows count={3} />
      ) : reports.length === 0 ? (
        <p className="empty">{status === 'pending' ? 'No reports waiting. 🎉' : 'No reports found.'}</p>
      ) : (
        <div className="row-list">
          {reports.map((r) => {
            const id = r._id || r.id;
            const isPending = r.status === 'pending';
            const mutedNow = r.reportedUser?.mutedUntil && new Date(r.reportedUser.mutedUntil) > new Date();
            const warningCount = r.reportedUser?.warnings?.length || 0;

            return (
              <div key={id} className="row-item">
                <div>
                  <strong>{REPORT_TYPE_LABEL[r.type] || r.type}</strong>{' '}
                  <span className={`status-pill ${REPORT_STATUS_PILL[r.status] || ''}`}>{r.status}</span>

                  <div className="small">
                    Against:{' '}
                    <strong>
                      {r.reportedUser
                        ? `${r.reportedUser.name} (${ROLE_LABEL[r.reportedUser.role] || r.reportedUser.role})`
                        : r.reportedStore
                        ? `🏪 ${r.reportedStore.name}`
                        : 'Unknown'}
                    </strong>
                  </div>
                  {r.reportedUser && (
                    <div className="muted small">
                      {r.reportedUser.email}
                      {warningCount > 0 && ` · ${warningCount} warning${warningCount === 1 ? '' : 's'}`}
                      {mutedNow && ' · currently muted'}
                      {r.reportedUser.banned && ' · banned'}
                    </div>
                  )}

                  <div className="muted small">
                    Reported by {r.reporter?.name || 'Unknown'} ({r.reporter?.email || 'no email'}) · {formatDateTime(r.createdAt)}
                  </div>

                  <p className="small">{r.reason}</p>

                  {!isPending && (
                    <div className="muted small">
                      {ACTION_DONE_LABEL[r.action] || r.action}
                      {r.adminNote && ` · Note: ${r.adminNote}`}
                      {r.resolvedAt && ` · ${formatDateTime(r.resolvedAt)}`}
                    </div>
                  )}
                </div>

                {isPending && (
                  <div className="row-actions">
                    <button
                      className="btn-solid small"
                      onClick={() => resolve(r, 'dismiss', '', 'Report dismissed.')}
                    >
                      Dismiss
                    </button>
                    <button className="btn-danger-outline small" onClick={() => setModal({ action: 'warn', report: r })}>Warn</button>
                    <button className="btn-danger-outline small" onClick={() => setModal({ action: 'mute', report: r })}>Mute</button>
                    <button className="btn-danger-outline small" onClick={() => setModal({ action: 'remove', report: r })}>Remove</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal?.action === 'warn' && (
        <ReasonModal
          title={`Warn ${targetName(modal.report)}?`}
          description="The warning is saved on the account. If only a store was reported, the store owner gets the warning."
          confirmLabel="Send warning"
          danger
          requireReason
          onSubmit={(note) => resolve(modal.report, 'warn', note, 'Warning sent.')}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.action === 'mute' && (
        <ReasonModal
          title={`Mute ${targetName(modal.report)} for ${muteDays} day${muteDays === 1 ? '' : 's'}?`}
          description="While muted they cannot send messages, post reviews or file reports. If only a store was reported, the store owner is muted."
          confirmLabel="Mute"
          danger
          requireReason
          onSubmit={(note) => resolve(modal.report, 'mute', note, 'Account muted.')}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.action === 'remove' && (
        <ReasonModal
          title={`Remove ${targetName(modal.report)} from the network?`}
          description="A reported user is banned and signed out. A reported store is suspended (banned) and hidden from customers."
          confirmLabel="Remove"
          danger
          requireReason
          onSubmit={(note) => resolve(modal.report, 'remove', note, 'Removed from the network.')}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

/* ---------- Audit log ---------- */
const ACTION_LABELS = {
  'store.approve': 'Approved store',
  'store.reject': 'Rejected store application',
  'store.ban': 'Banned store',
  'store.unban': 'Reinstated store',
  'store.appeal_approve': 'Approved appeal',
  'store.appeal_deny': 'Denied appeal',
  'user.ban': 'Banned user',
  'user.unban': 'Unbanned user',
  'review.remove': 'Removed review',
};

function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/audit-log')
      .then((res) => setEntries(res.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="panel">
      <h3>Admin activity</h3>
      <p className="muted small" style={{ marginTop: -6 }}>
        Every approve, reject, ban, unban, and review removal performed by an admin.
      </p>
      {error && <div className="message error">{error}</div>}
      {loading ? (
        <SkeletonRows count={4} />
      ) : entries.length === 0 ? (
        <p className="empty">No admin actions logged yet.</p>
      ) : (
        <div className="row-list">
          {entries.map((e) => (
            <div key={e.id} className="row-item">
              <div>
                <strong>{ACTION_LABELS[e.action] || e.action}</strong>
                {e.targetLabel && <span className="muted small"> · {e.targetLabel}</span>}
                <div className="muted small">{e.adminName} · {formatDateTime(e.createdAt)}</div>
                {e.details && <p className="small">{e.details}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}