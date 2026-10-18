const Address = require('../models/Address');

const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;

function shape(a) {
  return {
    id: a._id,
    label: a.label,
    address: a.address,
    contactNumber: a.contactNumber,
    isDefault: a.isDefault,
    lat: a.lat ?? null,
    lng: a.lng ?? null,
    createdAt: a.createdAt,
  };
}

// Reads an optional map pin from the request body.
// Returns { ok: true, lat, lng } (both null when no pin) or { ok: false } if invalid.
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

// GET /api/addresses
exports.list = async (req, res) => {
  try {
    const addresses = await Address.find({ customer: req.userId }).sort({ isDefault: -1, createdAt: -1 });
    return res.json(addresses.map(shape));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/addresses
exports.create = async (req, res) => {
  try {
    const { label, address, contactNumber, isDefault, lat, lng } = req.body;

    const trimmedLabel = String(label || '').trim();
    const trimmedAddress = String(address || '').trim();
    const trimmedPhone = String(contactNumber || '').trim();

    if (!trimmedLabel) return res.status(400).json({ message: 'Please give this address a label.' });
    if (trimmedAddress.length < 8) return res.status(400).json({ message: 'Please enter a complete address.' });
    if (!PHONE_REGEX.test(trimmedPhone)) return res.status(400).json({ message: 'Please enter a valid contact number.' });

    const coords = parseCoords(lat, lng);
    if (!coords.ok) return res.status(400).json({ message: 'The pinned location is not valid.' });

    const count = await Address.countDocuments({ customer: req.userId });
    if (count >= 10) {
      return res.status(400).json({ message: 'You can save up to 10 addresses.' });
    }

    if (isDefault || count === 0) {
      await Address.updateMany({ customer: req.userId }, { $set: { isDefault: false } });
    }

    const created = await Address.create({
      customer: req.userId,
      label: trimmedLabel.slice(0, 40),
      address: trimmedAddress.slice(0, 250),
      contactNumber: trimmedPhone,
      isDefault: isDefault || count === 0,
      lat: coords.lat,
      lng: coords.lng,
    });

    return res.status(201).json(shape(created));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/addresses/:id
exports.update = async (req, res) => {
  try {
    const addr = await Address.findOne({ _id: req.params.id, customer: req.userId });
    if (!addr) return res.status(404).json({ message: 'Address not found.' });

    const { label, address, contactNumber, lat, lng } = req.body;
    if (label !== undefined) {
      const l = String(label).trim();
      if (!l) return res.status(400).json({ message: 'Please give this address a label.' });
      addr.label = l.slice(0, 40);
    }
    if (address !== undefined) {
      const a = String(address).trim();
      if (a.length < 8) return res.status(400).json({ message: 'Please enter a complete address.' });
      addr.address = a.slice(0, 250);
    }
    if (contactNumber !== undefined) {
      const p = String(contactNumber).trim();
      if (!PHONE_REGEX.test(p)) return res.status(400).json({ message: 'Please enter a valid contact number.' });
      addr.contactNumber = p;
    }
    // Only touch the pin when lat/lng were sent (send both as null to clear it)
    if (lat !== undefined || lng !== undefined) {
      const coords = parseCoords(lat, lng);
      if (!coords.ok) return res.status(400).json({ message: 'The pinned location is not valid.' });
      addr.lat = coords.lat;
      addr.lng = coords.lng;
    }

    await addr.save();
    return res.json(shape(addr));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/addresses/:id/default
exports.setDefault = async (req, res) => {
  try {
    const addr = await Address.findOne({ _id: req.params.id, customer: req.userId });
    if (!addr) return res.status(404).json({ message: 'Address not found.' });

    await Address.updateMany({ customer: req.userId }, { $set: { isDefault: false } });
    addr.isDefault = true;
    await addr.save();

    return res.json(shape(addr));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/addresses/:id
exports.remove = async (req, res) => {
  try {
    const addr = await Address.findOneAndDelete({ _id: req.params.id, customer: req.userId });
    if (!addr) return res.status(404).json({ message: 'Address not found.' });

    // If we just deleted the default, promote the most recent remaining one.
    if (addr.isDefault) {
      const next = await Address.findOne({ customer: req.userId }).sort({ createdAt: -1 });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }

    return res.json({ message: 'Address removed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};