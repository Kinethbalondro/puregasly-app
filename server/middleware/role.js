const User = require('../models/User');

/**
 * Usage: router.get('/some-owner-only-route', requireAuth, requireRole('owner'), handler)
 */
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ message: 'You are not authorized to do that.' });
      }
      req.currentUser = user;
      next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Something went wrong.' });
    }
  };
}

module.exports = requireRole;
