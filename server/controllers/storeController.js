const Store = require('../models/Store');

// POST /api/store/appeal   (owner of a banned store)
exports.appeal = async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (message.length < 10) {
      return res.status(400).json({ message: 'Please explain your appeal in at least a few words.' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ message: 'Appeal is too long (max 1000 characters).' });
    }

    const store = await Store.findById(req.currentUser.storeId);
    if (!store || store.status !== 'banned') {
      return res.status(400).json({ message: 'Only banned stores can send an appeal.' });
    }
    if (store.appeal && store.appeal.status === 'pending') {
      return res.status(409).json({ message: 'You already have an appeal waiting for review.' });
    }

    store.appeal = {
      status: 'pending',
      message,
      submittedAt: new Date(),
      resolvedAt: null,
      adminNote: '',
    };
    await store.save();

    return res.json({ message: 'Appeal sent. An admin will review it.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/store/profile   (owner of an active store)
exports.updateProfile = async (req, res) => {
  try {
    const { address, phone, description } = req.body;
    const store = req.currentStore;

    if (address !== undefined) store.address = String(address).trim().slice(0, 200);
    if (phone !== undefined) store.phone = String(phone).trim().slice(0, 30);
    if (description !== undefined) store.description = String(description).trim().slice(0, 300);
    await store.save();

    return res.json({
      id: store._id,
      name: store.name,
      status: store.status,
      address: store.address,
      phone: store.phone,
      description: store.description,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
