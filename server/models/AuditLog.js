const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminName: { type: String, required: true }, // denormalized so the log survives if the admin account changes
  action: { type: String, required: true }, // e.g. "store.approve", "user.ban"
  targetType: { type: String, enum: ['store', 'user', 'review'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetLabel: { type: String, default: '' }, // e.g. the store name or user email, for a readable log
  details: { type: String, default: '', maxlength: 400 },
  createdAt: { type: Date, default: Date.now },
});

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
