const express = require('express');
const Product = require('../models/Product');
const Store = require('../models/Store');
const router = express.Router();

// ⚠ I-check ang dalawang linyang ito: ang path at pangalan ng auth middleware ninyo
const authMod = require('../middleware/auth');
const requireAuth = authMod.requireAuth || authMod.protect || authMod.auth || authMod;

const MIN_PEER_STORES = 3; // privacy: hindi magpapakita kung kulang ang ibang store

const myStore = (req) => Store.findOne({ owner: req.user._id || req.user.id });

// "Petron", "petron", "Petron Gasul" -> iisa
const brandOf = (p) => {
  const b = (p.brand || '').trim().toLowerCase();
  return /^petron/.test(b) ? 'petron gasul' : b;
};
// tank = bagong tank / may laman, refill = palit-gas lang (magkaiba ang presyo)
const kindOf = (p) => (/new\s*tank|with\s*gas/i.test(p.name) ? 'tank' : 'refill');
const keyOf = (p) => `${brandOf(p)}|${p.sizeKg}|${kindOf(p)}`;

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// GET /api/store/benchmark?scope=province|city
router.get('/benchmark', requireAuth, async (req, res) => {
  try {
    const scope = req.query.scope === 'city' ? 'city' : 'province';
    const me = await myStore(req);
    if (!me) return res.status(404).json({ message: 'Walang store sa account na ito.' });
    if (!me[scope]) {
      return res.status(400).json({ needLocation: true, message: `Ilagay muna ang ${scope} ng store.` });
    }

    // approved na ibang store lang sa parehong lugar
    const peerIds = (
      await Store.find({ status: 'approved', [scope]: me[scope], _id: { $ne: me._id } }).select('_id')
    ).map((s) => s._id);

    // walang accessory, walang test product, walang sirang presyo (hal. ₱0.23)
    const base = {
      active: true,
      category: { $ne: 'accessory' },
      name: { $not: /^test/i },
      price: { $gte: 50 },
    };
    // list price ang gamit (hindi promo) para hindi madumihan ng pansamantalang bawas-presyo
    const [mine, peers] = await Promise.all([
      Product.find({ ...base, storeId: me._id }),
      Product.find({ ...base, storeId: { $in: peerIds } }),
    ]);

    const groups = {};
    for (const p of peers) {
      const g = (groups[keyOf(p)] ||= {
        brand: brandOf(p), sizeKg: p.sizeKg, kind: kindOf(p), prices: [], stores: new Set(),
      });
      g.prices.push(p.price);
      g.stores.add(String(p.storeId));
    }

    let hidden = 0;
    const items = [];
    for (const [key, g] of Object.entries(groups)) {
      if (g.stores.size < MIN_PEER_STORES) { hidden++; continue; }
      const min = Math.min(...g.prices);
      const max = Math.max(...g.prices);
      const med = median(g.prices);
      const mp = mine.find((p) => keyOf(p) === key);
      items.push({
        brand: g.brand,
        sizeKg: g.sizeKg,
        kind: g.kind,
        area: { min, median: med, max, stores: g.stores.size },
        mine: mp
          ? {
              price: mp.price,
              vsMedianPct: med ? Math.round(((mp.price - med) / med) * 100) : 0,
              position: mp.price < min ? 'below' : mp.price > max ? 'above' : 'within',
            }
          : null,
      });
    }

    items.sort((a, b) => (a.sizeKg || 0) - (b.sizeKg || 0) || a.brand.localeCompare(b.brand));
    res.json({ scope, area: me[scope], items, hidden });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Hindi makuha ang benchmark.' });
  }
});

// PATCH /api/store/location  { city, province }
router.patch('/location', requireAuth, async (req, res) => {
  try {
    const store = await myStore(req);
    if (!store) return res.status(404).json({ message: 'Walang store sa account na ito.' });
    const { city, province } = req.body || {};
    if (typeof city === 'string') store.city = city;
    if (typeof province === 'string' && province.trim()) store.province = province;
    await store.save();
    res.json({ city: store.city, province: store.province });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Hindi ma-save.' });
  }
});

module.exports = router;