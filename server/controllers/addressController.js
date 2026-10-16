const Address = require('../models/Address');

const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;

function shape(a) {
  return {
    id: a._id,
    label: a.label,
    address: a.address,
    contactNumber: a.contactNumber,
    isDefault: a.isDefault,
    createdAt: a.createdAt,
  };
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
    const { label, address, contactNumber, isDefault } = req.body;

    const trimmedLabel = String(label || '').trim();
    const trimmedAddress = String(address || '').trim();
    const trimmedPhone = String(contactNumber || '').trim();

    if (!trimmedLabel) return res.status(400).json({ message: 'Please give this address a label.' });
    if (trimmedAddress.length < 8) return res.status(400).json({ message: 'Please enter a complete address.' });
    if (!PHONE_REGEX.test(trimmedPhone)) return res.status(400).json({ message: 'Please enter a valid contact number.' });

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

    const { label, address, contactNumber } = req.body;
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
