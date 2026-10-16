const Store = require('../models/Store');

// For owner-only routes (req.currentUser must already be set by requireRole).
// Blocks the owner while the store isn't approved (e.g. banned).
module.exports = async function requireActiveStore(req, res, next) {
  try {
    const store = req.currentUser.storeId ? await Store.findById(req.currentUser.storeId) : null;
    if (!store || store.status !== 'approved') {
      return res.status(403).json({ code: 'STORE_NOT_ACTIVE', message: 'Your store is not active right now.' });
    }
    req.currentStore = store;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
