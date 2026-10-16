const User = require('../models/User');
const Store = require('../models/Store');
const Order = require('../models/Order');
const { restoreStock } = require('../utils/stock');
const { notify } = require('../utils/notify');
const { logAdminAction } = require('../utils/audit');

function shapeStore(s) {
  return {
    id: s._id,
    name: s.name,
    status: s.status,
    rejectionReason: s.rejectionReason,
    banReason: s.banReason,
    bannedAt: s.bannedAt,
    appeal: s.appeal,
    createdAt: s.createdAt,
    owner: s.owner && s.owner.name ? { id: s.owner._id, name: s.owner.name, email: s.owner.email, banned: s.owner.banned } : null,
  };
}

function shapeUser(u) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    banned: !!u.banned,
    banReason: u.banReason,
    createdAt: u.createdAt,
    store: u.storeId && u.storeId.name ? { id: u.storeId._id, name: u.storeId.name, status: u.storeId.status } : null,
  };
}

const reasonOf = (body) => String((body && body.reason) || '').trim().slice(0, 300);

// GET /api/admin/stats
exports.stats = async (req, res) => {
  try {
    const [customers, owners, employees, riders, bannedUsers, pending, approved, banned, appeals] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'owner' }),
      User.countDocuments({ role: 'employee' }),
      User.countDocuments({ role: 'rider' }),
      User.countDocuments({ banned: true }),
      Store.countDocuments({ status: 'pending' }),
      Store.countDocuments({ status: 'approved' }),
      Store.countDocuments({ status: 'banned' }),
      Store.countDocuments({ status: 'banned', 'appeal.status': 'pending' }),
    ]);
    return res.json({ customers, owners, employees, riders, bannedUsers, pending, approved, banned, appeals });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/admin/stores?status=pending|approved|rejected|banned
exports.listStores = async (req, res) => {
  try {
    const filter = {};
    if (['pending', 'approved', 'rejected', 'banned'].includes(req.query.status)) filter.status = req.query.status;
    const stores = await Store.find(filter).populate('owner', 'name email banned').sort({ createdAt: -1 });
    return res.json(stores.map(shapeStore));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

async function loadStore(req, res) {
  const store = await Store.findById(req.params.id).populate('owner', 'name email banned');
  if (!store) res.status(404).json({ message: 'Store not found.' });
  return store;
}

// PATCH /api/admin/stores/:id/approve   (pending or rejected -> approved)
exports.approveStore = async (req, res) => {
  try {
    const store = await loadStore(req, res);
    if (!store) return;
    if (!['pending', 'rejected'].includes(store.status)) {
      return res.status(400).json({ message: 'Only pending or rejected applications can be approved.' });
    }
    store.status = 'approved';
    store.rejectionReason = '';
    await store.save();

    if (store.owner?._id) {
      notify(store.owner._id, {
        type: 'store_status',
        title: `${store.name} was approved!`,
        message: 'Your store is now live and visible to customers.',
        link: '/dashboard',
      });
    }

    logAdminAction({
      adminId: req.currentUser._id,
      adminName: req.currentUser.name,
      action: 'store.approve',
      targetType: 'store',
      targetId: store._id,
      targetLabel: store.name,
    });

    return res.json(shapeStore(store));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/admin/stores/:id/reject   body: { reason }
exports.rejectStore = async (req, res) => {
  try {
    const store = await loadStore(req, res);
    if (!store) return;
    if (store.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending applications can be rejected.' });
    }
    store.status = 'rejected';
    store.rejectionReason = reasonOf(req.body);
    await store.save();

    if (store.owner?._id) {
      notify(store.owner._id, {
        type: 'store_status',
        title: `${store.name}'s application was not approved`,
        message: store.rejectionReason,
        link: '/dashboard',
      });
    }

    logAdminAction({
      adminId: req.currentUser._id,
      adminName: req.currentUser.name,
      action: 'store.reject',
      targetType: 'store',
      targetId: store._id,
      targetLabel: store.name,
      details: store.rejectionReason,
    });

    return res.json(shapeStore(store));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/admin/stores/:id/ban   body: { reason }
exports.banStore = async (req, res) => {
  try {
    const store = await loadStore(req, res);
    if (!store) return;
    if (store.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved stores can be banned.' });
    }
    store.status = 'banned';
    store.banReason = reasonOf(req.body);
    store.bannedAt = new Date();
    store.appeal = { status: 'none', message: '', submittedAt: null, resolvedAt: null, adminNote: '' };
    await store.save();

    if (store.owner?._id) {
      notify(store.owner._id, {
        type: 'store_status',
        title: `${store.name} has been suspended`,
        message: store.banReason,
        link: '/dashboard',
      });
    }

    logAdminAction({
      adminId: req.currentUser._id,
      adminName: req.currentUser.name,
      action: 'store.ban',
      targetType: 'store',
      targetId: store._id,
      targetLabel: store.name,
      details: store.banReason,
    });

    // Orders nobody has accepted yet can never be fulfilled - cancel them and return the stock.
    const pending = await Order.find({ storeId: store._id, status: 'pending' });
    for (const order of pending) {
      order.status = 'cancelled';
      order.statusHistory.push({ status: 'cancelled', at: new Date() });
      await order.save();
      await restoreStock(order.items);
    }

    return res.json(shapeStore(store));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/admin/stores/:id/unban
exports.unbanStore = async (req, res) => {
  try {
    const store = await loadStore(req, res);
    if (!store) return;
    if (store.status !== 'banned') {
      return res.status(400).json({ message: 'This store is not banned.' });
    }
    store.status = 'approved';
    store.banReason = '';
    store.bannedAt = null;
    if (store.appeal && store.appeal.status === 'pending') {
      store.appeal.status = 'approved';
      store.appeal.resolvedAt = new Date();
    }
    await store.save();

    if (store.owner?._id) {
      notify(store.owner._id, {
        type: 'store_status',
        title: `${store.name} has been reinstated`,
        message: 'Your store is live again.',
        link: '/dashboard',
      });
    }

    logAdminAction({
      adminId: req.currentUser._id,
      adminName: req.currentUser.name,
      action: 'store.unban',
      targetType: 'store',
      targetId: store._id,
      targetLabel: store.name,
    });

    return res.json(shapeStore(store));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/admin/stores/:id/appeal   body: { decision: 'approve' | 'deny', note }
exports.resolveAppeal = async (req, res) => {
  try {
    const store = await loadStore(req, res);
    if (!store) return;
    const { decision, note } = req.body;

    if (store.status !== 'banned' || !store.appeal || store.appeal.status !== 'pending') {
      return res.status(400).json({ message: 'There is no pending appeal for this store.' });
    }
    if (!['approve', 'deny'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approve or deny.' });
    }

    store.appeal.resolvedAt = new Date();
    store.appeal.adminNote = String(note || '').trim().slice(0, 300);

    if (decision === 'approve') {
      store.appeal.status = 'approved';
      store.status = 'approved';
      store.banReason = '';
      store.bannedAt = null;
    } else {
      store.appeal.status = 'denied';
    }
    await store.save();

    if (store.owner?._id) {
      notify(store.owner._id, {
        type: 'appeal_resolved',
        title: decision === 'approve' ? `Your appeal for ${store.name} was approved` : `Your appeal for ${store.name} was denied`,
        message: store.appeal.adminNote,
        link: '/dashboard',
      });
    }

    logAdminAction({
      adminId: req.currentUser._id,
      adminName: req.currentUser.name,
      action: decision === 'approve' ? 'store.appeal_approve' : 'store.appeal_deny',
      targetType: 'store',
      targetId: store._id,
      targetLabel: store.name,
      details: store.appeal.adminNote,
    });

    return res.json(shapeStore(store));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/admin/users?role=customer|owner|employee
exports.listUsers = async (req, res) => {
  try {
    const role = ['customer', 'owner', 'employee', 'rider'].includes(req.query.role) ? req.query.role : null;
    const filter = role ? { role } : { role: { $in: ['customer', 'owner', 'employee', 'rider'] } };
    const users = await User.find(filter).populate('storeId', 'name status').sort({ createdAt: -1 });
    return res.json(users.map(shapeUser));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

async function setBan(req, res, banned) {
  try {
    const user = await User.findById(req.params.id).populate('storeId', 'name status');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be banned.' });
    }

    user.banned = banned;
    user.banReason = banned ? reasonOf(req.body) : '';
    user.bannedAt = banned ? new Date() : null;
    // Unbanning also lifts any login lockout, so a cleared user isn't stuck waiting it out.
    if (!banned) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }
    await user.save();

    logAdminAction({
      adminId: req.currentUser._id,
      adminName: req.currentUser.name,
      action: banned ? 'user.ban' : 'user.unban',
      targetType: 'user',
      targetId: user._id,
      targetLabel: user.email,
      details: user.banReason,
    });

    return res.json(shapeUser(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}

exports.banUser = (req, res) => setBan(req, res, true);
exports.unbanUser = (req, res) => setBan(req, res, false);

// GET /api/admin/audit-log
exports.auditLog = async (req, res) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const entries = await AuditLog.find({}).sort({ createdAt: -1 }).limit(200);
    return res.json(
      entries.map((e) => ({
        id: e._id,
        adminName: e.adminName,
        action: e.action,
        targetType: e.targetType,
        targetLabel: e.targetLabel,
        details: e.details,
        createdAt: e.createdAt,
      }))
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
