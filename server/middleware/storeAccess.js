const User = require('../models/User');
const Store = require('../models/Store');

/**
 * Grants access if the logged-in user is the Owner of an APPROVED store
 * (owners implicitly have every permission on their own store - see
 * User.hasPermission), or an Employee whose owner has granted them the given
 * permission.
 *
 * Pass one permission, or an array to accept ANY of them (useful when a
 * route is genuinely useful to more than one job, e.g. viewing riders is
 * handy for whoever manages orders OR whoever manages riders).
 *
 * Usage: router.use(requireAuth, requireStoreAccess('manage_inventory'))
 *        router.use(requireAuth, requireStoreAccess(['manage_orders', 'manage_riders']))
 */
function requireStoreAccess(permission) {
  const required = Array.isArray(permission) ? permission : [permission];
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized.' });
      }

      if (!user.storeId || !['owner', 'employee'].includes(user.role)) {
        return res.status(403).json({ message: 'No store is associated with this account.' });
      }

      const store = await Store.findById(user.storeId);
      if (!store || store.status !== 'approved') {
        return res.status(403).json({
          code: 'STORE_NOT_ACTIVE',
          message: 'Your store is not active right now.',
        });
      }

      if (!required.some((p) => user.hasPermission(p))) {
        return res.status(403).json({ message: 'You do not have permission to do that.' });
      }

      req.currentUser = user;
      req.currentStore = store;
      next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Something went wrong.' });
    }
  };
}

module.exports = requireStoreAccess;
