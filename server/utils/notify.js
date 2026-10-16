const Notification = require('../models/Notification');

// Fire-and-forget: a notification failing to save should never break the
// request that triggered it (an order, a status change, etc.).
async function notify(userId, { type, title, message = '', link = '' }) {
  if (!userId) return;
  try {
    await Notification.create({ user: userId, type, title, message, link });
  } catch (err) {
    console.error('notify() failed:', err.message);
  }
}

// Notifies every owner/employee of a store who has the given permission
// (owners always qualify). Used for "a new order came in" style alerts.
async function notifyStoreStaff(storeId, permission, payload) {
  const User = require('../models/User');
  const staff = await User.find({
    storeId,
    role: { $in: ['owner', 'employee'] },
    banned: false,
  }).select('_id role permissions');

  const targets = staff.filter((u) => u.role === 'owner' || u.permissions.includes(permission));
  await Promise.all(targets.map((u) => notify(u._id, payload)));
}

module.exports = { notify, notifyStoreStaff };
