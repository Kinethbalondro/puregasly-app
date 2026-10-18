const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Only a SHA-256 hash is stored - the raw token (what the client holds) is
  // never written to the database, so a DB leak alone can't be used to log in.
  tokenHash: { type: String, required: true, unique: true },
  // Stays the same when the token is rotated, so one device = one sessionId.
  // Access tokens carry it, which lets us end a session instantly (logout
  // everywhere / log out one device) instead of waiting for the token to expire.
  sessionId: { type: String, default: '', index: true },
  userAgent: { type: String, default: '', maxlength: 300 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
});

// MongoDB TTL index - documents are automatically deleted once expiresAt passes.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
