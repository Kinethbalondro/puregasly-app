const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Store = require('../models/Store');
const accessGate = require('../utils/accessGate');

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

  try {
    const user = await User.findById(decoded.id).select('role banned banReason storeId');
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

    req.userId = user._id;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

module.exports = requireAuth;
