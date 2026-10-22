const Product = require('../models/Product');
const PriceHistory = require('../models/PriceHistory'); // NEW
const { saveImage, deleteMedia } = require('../utils/media');

const CATEGORIES = ['lpg', 'refill', 'accessory'];

// Returns { error } or { value } for the fields that were supplied.
// `partial` = true for PATCH (only validate fields that are present).
function parseProductBody(body, partial) {
  const out = {};
  const has = (k) => body[k] !== undefined;

  if (!partial || has('name')) {
    const name = String(body.name || '').trim();
    if (!name) return { error: 'Name is required.' };
    if (name.length > 100) return { error: 'Name is too long.' };
    out.name = name;
  }

  if (has('brand')) out.brand = String(body.brand || '').trim().slice(0, 60);

  if (has('category')) {
    if (!CATEGORIES.includes(body.category)) return { error: 'Invalid category.' };
    out.category = body.category;
  }

  if (has('sizeKg')) {
    if (body.sizeKg === '' || body.sizeKg === null) {
      out.sizeKg = undefined;
    } else {
      const n = Number(body.sizeKg);
      if (Number.isNaN(n) || n < 0 || n > 1000) return { error: 'Size must be a valid number.' };
      out.sizeKg = n;
    }
  }

  if (!partial || has('price')) {
    if (body.price === undefined || body.price === '' || body.price === null) {
      return { error: 'Price is required.' };
    }
    const n = Number(body.price);
    if (Number.isNaN(n) || n < 0 || n > 10000000) return { error: 'Price must be a valid non-negative number.' };
    out.price = n;
  }

  if (has('promoPrice')) {
    if (body.promoPrice === '' || body.promoPrice === null) {
      out.promoPrice = null;
    } else {
      const n = Number(body.promoPrice);
      if (Number.isNaN(n) || n < 0) return { error: 'Sale price must be a valid non-negative number.' };
      out.promoPrice = n;
    }
  }

  if (has('stock')) {
    const n = body.stock === '' ? 0 : Number(body.stock);
    if (!Number.isInteger(n) || n < 0 || n > 1000000) return { error: 'Stock must be a whole number, 0 or more.' };
    out.stock = n;
  }

  if (has('lowStockAt')) {
    const n = body.lowStockAt === '' ? 5 : Number(body.lowStockAt);
    if (!Number.isInteger(n) || n < 0) return { error: 'Low-stock alert must be a whole number.' };
    out.lowStockAt = n;
  }

  if (has('active')) out.active = Boolean(body.active);

  return { value: out };
}

function checkPromo(price, promoPrice) {
  if (promoPrice != null && promoPrice >= price) {
    return 'Sale price must be lower than the regular price.';
  }
  return null;
}

// NEW: Saves one price-history row. Never blocks the request if it fails.
async function recordPrice(product) {
  try {
    await PriceHistory.create({
      product: product._id,
      storeId: product.storeId,
      productName: product.name,
      brand: product.brand,
      category: product.category,
      sizeKg: product.sizeKg ?? null,
      price: product.price,
      promoPrice: product.promoPrice ?? null,
      effectivePrice: product.effectivePrice,
    });
  } catch (err) {
    console.error('Price history error: - inventoryController.js:95', err.message);
  }
}

// GET /api/inventory
exports.list = async (req, res) => {
  try {
    const products = await Product.find({ storeId: req.currentUser.storeId }).sort({ createdAt: -1 });
    return res.json(products);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/inventory
exports.create = async (req, res) => {
  try {
    const { error, value } = parseProductBody(req.body, false);
    if (error) return res.status(400).json({ message: error });

    const promoErr = checkPromo(value.price, value.promoPrice);
    if (promoErr) return res.status(400).json({ message: promoErr });

    const product = await Product.create({ ...value, storeId: req.currentUser.storeId });
    await recordPrice(product); // NEW
    return res.status(201).json(product);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/inventory/:id
exports.update = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, storeId: req.currentUser.storeId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const { error, value } = parseProductBody(req.body, true);
    if (error) return res.status(400).json({ message: error });

    const nextPrice = value.price !== undefined ? value.price : product.price;
    const nextPromo = value.promoPrice !== undefined ? value.promoPrice : product.promoPrice;
    const promoErr = checkPromo(nextPrice, nextPromo);
    if (promoErr) return res.status(400).json({ message: promoErr });

    // NEW: remember the old prices so we only record real changes
    const priceBefore = product.price;
    const promoBefore = product.promoPrice;

    product.set(value);
    await product.save();

    // NEW
    if (product.price !== priceBefore || product.promoPrice !== promoBefore) {
      await recordPrice(product);
    }

    return res.json(product);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/inventory/:id/image   (multipart field "image")
exports.setImage = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, storeId: req.currentUser.storeId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const { media, error } = await saveImage(req.file, 'product', req.userId);
    if (error) return res.status(400).json({ message: error });

    const old = product.image;
    product.image = media._id;
    await product.save();
    if (old) await deleteMedia(old);

    return res.json(product);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/inventory/:id/image
exports.removeImage = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, storeId: req.currentUser.storeId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const old = product.image;
    product.image = null;
    await product.save();
    if (old) await deleteMedia(old);

    return res.json(product);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/inventory/:id
exports.remove = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      storeId: req.currentUser.storeId,
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    if (product.image) await deleteMedia(product.image);

    return res.json({ message: 'Product removed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};