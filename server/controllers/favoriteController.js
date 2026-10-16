const Favorite = require('../models/Favorite');
const Store = require('../models/Store');
const Product = require('../models/Product');
const { isValidId } = require('../utils/helpers');

// GET /api/favorites  - this customer's favorited stores + products, with live details
exports.list = async (req, res) => {
  try {
    const favs = await Favorite.find({ customer: req.userId }).sort({ createdAt: -1 });

    const storeIds = favs.filter((f) => f.targetType === 'store').map((f) => f.targetId);
    const productIds = favs.filter((f) => f.targetType === 'product').map((f) => f.targetId);

    const [stores, products] = await Promise.all([
      Store.find({ _id: { $in: storeIds } }),
      Product.find({ _id: { $in: productIds } }),
    ]);

    const productStoreIds = [...new Set(products.map((p) => String(p.storeId)))];
    const productStores = await Store.find({ _id: { $in: productStoreIds } }).select('name');
    const productStoreMap = new Map(productStores.map((s) => [String(s._id), s.name]));

    const favoriteStores = stores
      .filter((s) => s.status === 'approved')
      .map((s) => ({ id: s._id, name: s.name, address: s.address, description: s.description }));

    const favoriteProducts = products
      .filter((p) => p.active !== false)
      .map((p) => ({
        id: p._id,
        storeId: p.storeId,
        storeName: productStoreMap.get(String(p.storeId)) || '',
        name: p.name,
        brand: p.brand,
        sizeKg: p.sizeKg,
        price: p.price,
        promoPrice: p.promoPrice != null && p.promoPrice < p.price ? p.promoPrice : null,
        effectivePrice: p.promoPrice != null && p.promoPrice < p.price ? p.promoPrice : p.price,
        onPromo: p.promoPrice != null && p.promoPrice < p.price,
        stock: p.stock,
        sold: p.sold || 0,
      }));

    return res.json({ stores: favoriteStores, products: favoriteProducts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/favorites/ids  - just the ids, for quick "is this favorited" checks client-side
exports.ids = async (req, res) => {
  try {
    const favs = await Favorite.find({ customer: req.userId }).select('targetType targetId');
    return res.json({
      stores: favs.filter((f) => f.targetType === 'store').map((f) => f.targetId),
      products: favs.filter((f) => f.targetType === 'product').map((f) => f.targetId),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/favorites   body: { targetType, targetId }
exports.add = async (req, res) => {
  try {
    const { targetType, targetId } = req.body;
    if (!['store', 'product'].includes(targetType) || !isValidId(targetId)) {
      return res.status(400).json({ message: 'Invalid favorite.' });
    }

    const exists =
      targetType === 'store' ? await Store.findById(targetId) : await Product.findById(targetId);
    if (!exists) return res.status(404).json({ message: 'Not found.' });

    try {
      await Favorite.create({ customer: req.userId, targetType, targetId });
    } catch (err) {
      if (err.code !== 11000) throw err; // already favorited - fine, treat as success
    }

    return res.status(201).json({ message: 'Added to favorites.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/favorites/:targetType/:targetId
exports.remove = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!['store', 'product'].includes(targetType) || !isValidId(targetId)) {
      return res.status(400).json({ message: 'Invalid favorite.' });
    }
    await Favorite.deleteOne({ customer: req.userId, targetType, targetId });
    return res.json({ message: 'Removed from favorites.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
