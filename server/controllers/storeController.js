const Store = require('../models/Store');

// Reads an optional map pin from the request body.
// Returns { ok: true, lat, lng } (both null when clearing) or { ok: false } if invalid.
function parseCoords(lat, lng) {
  const empty = (v) => v === undefined || v === null || v === '';
  if (empty(lat) && empty(lng)) return { ok: true, lat: null, lng: null };
  if (empty(lat) || empty(lng)) return { ok: false };

  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return { ok: false };
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return { ok: false };
  return { ok: true, lat: la, lng: ln };
}

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
    const { address, phone, description, lat, lng } = req.body;
    const store = req.currentStore;

    if (address !== undefined) store.address = String(address).trim().slice(0, 200);
    if (phone !== undefined) store.phone = String(phone).trim().slice(0, 30);
    if (description !== undefined) store.description = String(description).trim().slice(0, 300);

    // Only touch the pin when lat/lng were sent (send both as null to clear it)
    if (lat !== undefined || lng !== undefined) {
      const coords = parseCoords(lat, lng);
      if (!coords.ok) return res.status(400).json({ message: 'The pinned location is not valid.' });
      store.lat = coords.lat;
      store.lng = coords.lng;
    }

    await store.save();

    return res.json({
      id: store._id,
      name: store.name,
      status: store.status,
      address: store.address,
      phone: store.phone,
      description: store.description,
      lat: store.lat ?? null,
      lng: store.lng ?? null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};