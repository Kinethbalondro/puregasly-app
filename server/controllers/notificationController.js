const Notification = require('../models/Notification');

function shape(n) {
  return {
    id: n._id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt,
  };
}

// GET /api/notifications  - latest 30 + unread count, in one call
exports.list = async (req, res) => {
  try {
    const [items, unreadCount] = await Promise.all([
      Notification.find({ user: req.userId }).sort({ createdAt: -1 }).limit(30),
      Notification.countDocuments({ user: req.userId, read: false }),
    ]);
    return res.json({ items: items.map(shape), unreadCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: { read: true } },
      { new: true }
    );
    if (!n) return res.status(404).json({ message: 'Notification not found.' });
    return res.json(shape(n));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.userId, read: false }, { $set: { read: true } });
    return res.json({ message: 'All caught up.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
