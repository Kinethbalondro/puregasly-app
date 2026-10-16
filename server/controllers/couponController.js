const Coupon = require('../models/Coupon');
const { checkCoupon } = require('../utils/coupons');

function shape(c) {
  return {
    id: c._id,
    code: c.code,
    type: c.type,
    value: c.value,
    minOrder: c.minOrder,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    expiresAt: c.expiresAt,
    active: c.active,
    createdAt: c.createdAt,
  };
}

function parseBody(body) {
  const code = String(body.code || '').trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{3,20}$/.test(code)) {
    return { error: 'Code must be 3-20 letters, numbers, - or _.' };
  }
  if (!['percent', 'fixed'].includes(body.type)) {
    return { error: 'Invalid discount type.' };
  }
  const value = Number(body.value);
  if (Number.isNaN(value) || value <= 0) return { error: 'Value must be a positive number.' };
  if (body.type === 'percent' && value > 100) return { error: 'Percent discount cannot exceed 100.' };

  const minOrder = body.minOrder === undefined || body.minOrder === '' ? 0 : Number(body.minOrder);
  if (Number.isNaN(minOrder) || minOrder < 0) return { error: 'Minimum order must be 0 or more.' };

  let maxUses = null;
  if (body.maxUses !== undefined && body.maxUses !== '' && body.maxUses !== null) {
    maxUses = Number(body.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1) return { error: 'Usage limit must be a whole number, 1 or more.' };
  }

  let expiresAt = null;
  if (body.expiresAt) {
    const d = new Date(body.expiresAt);
    if (Number.isNaN(d.getTime())) return { error: 'Invalid expiry date.' };
    expiresAt = d;
  }

  return { value: { code, type: body.type, value, minOrder, maxUses, expiresAt } };
}

// GET /api/coupons  - this store's coupons
exports.list = async (req, res) => {
  try {
    const coupons = await Coupon.find({ storeId: req.currentStore._id }).sort({ createdAt: -1 });
    return res.json(coupons.map(shape));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/coupons
exports.create = async (req, res) => {
  try {
    const { error, value } = parseBody(req.body);
    if (error) return res.status(400).json({ message: error });

    let coupon;
    try {
      coupon = await Coupon.create({ ...value, storeId: req.currentStore._id });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'You already have a coupon with that code.' });
      throw err;
    }
    return res.status(201).json(shape(coupon));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/coupons/:id   - active toggle, or edit the non-code fields
exports.update = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ _id: req.params.id, storeId: req.currentStore._id });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found.' });

    if (req.body.active !== undefined) coupon.active = Boolean(req.body.active);

    if (req.body.value !== undefined || req.body.minOrder !== undefined || req.body.maxUses !== undefined || req.body.expiresAt !== undefined) {
      const { error, value } = parseBody({ ...coupon.toObject(), ...req.body, code: coupon.code });
      if (error) return res.status(400).json({ message: error });
      coupon.type = value.type;
      coupon.value = value.value;
      coupon.minOrder = value.minOrder;
      coupon.maxUses = value.maxUses;
      coupon.expiresAt = value.expiresAt;
    }

    await coupon.save();
    return res.json(shape(coupon));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/coupons/:id
exports.remove = async (req, res) => {
  try {
    const coupon = await Coupon.findOneAndDelete({ _id: req.params.id, storeId: req.currentStore._id });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found.' });
    return res.json({ message: 'Coupon removed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/coupons/validate   body: { storeId, code, subtotal }   (customer - cart preview)
exports.validate = async (req, res) => {
  try {
    const { storeId, code, subtotal } = req.body;
    const sub = Number(subtotal);
    if (!storeId || Number.isNaN(sub) || sub < 0) {
      return res.status(400).json({ message: 'Invalid request.' });
    }

    const result = await checkCoupon(storeId, code, sub);
    if (result.error) return res.status(400).json({ message: result.error });

    return res.json({ valid: true, discount: result.discount, code: result.coupon.code });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
