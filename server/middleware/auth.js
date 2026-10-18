const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Store = require('../models/Store');
const RefreshToken = require('../models/RefreshToken');
const accessGate = require('../utils/accessGate');

// While someone is still on a temporary password (employees and riders an owner
// created) the ONLY things their token may do are set a new password, read their
// own account, and sign out. Enforced here, on the server - not just in the login page.
const ALLOWED_WHILE_TEMP_PASSWORD = new Set(['/api/auth/change-password', '/api/auth/me', '/api/auth/logout']);

// Verifies the token AND re-checks the account on every request, so a ban or a
// suspended store takes effect immediately instead of when the token expires.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  // The token must belong to a session that hasn't been logged out. This is what
  // makes "log out everywhere" / "log out this device" take effect right away on
  // the other devices instead of after the 15-minute access token runs out.
  // (Tokens from before sessions existed have no sid; the client silently
  // refreshes and gets a proper one.)
  if (!decoded.sid) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  try {
    const live = await RefreshToken.exists({ sessionId: decoded.sid, user: decoded.id, revokedAt: null, expiresAt: { $gt: new Date() } });
    if (!live) {
      return res.status(401).json({ message: 'Your session has ended. Please log in again.', code: 'SESSION_ENDED' });
    }

    const user = await User.findById(decoded.id).select('role banned banReason storeId mustChangePassword');
    if (!user) {
      return res.status(401).json({ message: 'Account no longer exists.' });
    }

    const store = user.storeId
      ? await Store.findById(user.storeId).select('status rejectionReason')
      : null;

    const blocked = accessGate(user, store);
    if (blocked) {
      return res.status(403).json(blocked);
    }

    if (user.mustChangePassword && !ALLOWED_WHILE_TEMP_PASSWORD.has(req.baseUrl + req.path)) {
      return res.status(403).json({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Please set a new password before continuing.',
      });
    }

    req.userId = user._id;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

module.exports = requireAuth;
