const AuditLog = require('../models/AuditLog');

// Fire-and-forget, same philosophy as notify(): an audit entry failing to
// save should never break the admin action that triggered it.
async function logAdminAction({ adminId, adminName, action, targetType, targetId, targetLabel = '', details = '' }) {
  try {
    await AuditLog.create({ admin: adminId, adminName, action, targetType, targetId, targetLabel, details });
  } catch (err) {
    console.error('logAdminAction() failed:', err.message);
  }
}

module.exports = { logAdminAction };
