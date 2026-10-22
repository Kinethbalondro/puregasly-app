const User = require('../models/User');

// Blocks users who were muted by an admin.
// Use it right after `requireAuth` on routes a muted user must not use
// (sending messages, posting reviews, filing reports).
//
// requireAuth only sets req.userId (not req.user), so we load mutedUntil here.
exports.notMuted = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('mutedUntil');
    const until = user && user.mutedUntil;

    // Still muted if a mute date exists and it is later than now.
    if (until && new Date(until) > new Date()) {
      return res.status(403).json({
        code: 'ACCOUNT_MUTED',
        message: `Your account is muted until ${new Date(until).toLocaleString()}.`,
      });
    }

    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};