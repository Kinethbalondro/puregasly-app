const Store = require('../models/Store');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { escapeRegex } = require('../utils/helpers');

const PRODUCT_SORTS = {
  price_asc: (a, b) => a.effectivePrice - b.effectivePrice,
  price_desc: (a, b) => b.effectivePrice - a.effectivePrice,
  sales_desc: (a, b) => (b.sold || 0) - (a.sold || 0),
  sales_asc: (a, b) => (a.sold || 0) - (b.sold || 0),
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
};

function shapeProduct(p, storeName) {
  return {
    id: p._id,
    storeId: p.storeId,
    storeName,
    name: p.name,
    brand: p.brand,
    category: p.category || 'lpg',
    sizeKg: p.sizeKg,
    price: p.price,
    promoPrice: p.onPromo ? p.promoPrice : null,
    effectivePrice: p.effectivePrice,
    onPromo: p.onPromo,
    stock: p.stock,
    sold: p.sold || 0,
    createdAt: p.createdAt,
  };
}

async function approvedStores(search) {
  const filter = { status: 'approved' };
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
  return Store.find(filter);
}

// Returns a Map<storeId, { avgRating, reviewCount }>.
async function ratingsFor(storeIds) {
  const rows = await Review.aggregate([
    { $match: { storeId: { $in: storeIds } } },
    { $group: { _id: '$storeId', avgRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ]);
  const map = new Map();
  rows.forEach((r) => map.set(String(r._id), { avgRating: Math.round(r.avgRating * 10) / 10, reviewCount: r.reviewCount }));
  return map;
}

// GET /api/shop/stores?search=&sort=&promo=true
// sort: name | price_asc | price_desc | sales_desc | sales_asc
exports.listStores = async (req, res) => {
  try {
    const { search = '', sort = 'name', promo } = req.query;
    const stores = await approvedStores(String(search).trim().slice(0, 60));
    const products = await Product.find({
      storeId: { $in: stores.map((s) => s._id) },
      active: { $ne: false },
    });

    const byStore = new Map();
    products.forEach((p) => {
      const key = String(p.storeId);
      if (!byStore.has(key)) byStore.set(key, []);
      byStore.get(key).push(p);
    });

    let result = stores.map((s) => {
      const list = byStore.get(String(s._id)) || [];
      const prices = list.map((p) => p.effectivePrice);
      return {
        id: s._id,
        name: s.name,
        address: s.address,
        phone: s.phone,
        description: s.description,
        productCount: list.length,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        promoCount: list.filter((p) => p.onPromo).length,
        totalSold: list.reduce((sum, p) => sum + (p.sold || 0), 0),
      };
    });

    const ratings = await ratingsFor(stores.map((s) => s._id));
    result = result.map((s) => ({
      ...s,
      avgRating: ratings.get(String(s.id))?.avgRating ?? null,
      reviewCount: ratings.get(String(s.id))?.reviewCount ?? 0,
    }));

    if (promo === 'true') result = result.filter((s) => s.promoCount > 0);

    const nullLast = (v, dir) => (v == null ? (dir === 'asc' ? Infinity : -Infinity) : v);
    switch (sort) {
      case 'price_asc':
        result.sort((a, b) => nullLast(a.minPrice, 'asc') - nullLast(b.minPrice, 'asc'));
        break;
      case 'price_desc':
        result.sort((a, b) => nullLast(b.minPrice, 'desc') - nullLast(a.minPrice, 'desc'));
        break;
      case 'sales_desc':
        result.sort((a, b) => b.totalSold - a.totalSold);
        break;
      case 'sales_asc':
        result.sort((a, b) => a.totalSold - b.totalSold);
        break;
      case 'rating_desc':
        result.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1));
        break;
      default:
        result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/shop/stores/:id
exports.getStore = async (req, res) => {
  try {
    const store = await Store.findOne({ _id: req.params.id, status: 'approved' });
    if (!store) return res.status(404).json({ message: 'Store not found.' });

    const [products, ratingMap, recentReviews] = await Promise.all([
      Product.find({ storeId: store._id, active: { $ne: false } }).sort({ name: 1 }),
      ratingsFor([store._id]),
      Review.find({ storeId: store._id })
        .populate('customer', 'name')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);
    const rating = ratingMap.get(String(store._id)) || { avgRating: null, reviewCount: 0 };

    return res.json({
      store: {
        id: store._id,
        name: store.name,
        address: store.address,
        phone: store.phone,
        description: store.description,
        avgRating: rating.avgRating,
        reviewCount: rating.reviewCount,
      },
      products: products.map((p) => shapeProduct(p, store.name)),
      reviews: recentReviews.map((r) => ({
        id: r._id,
        customerName: r.customer?.name || 'Customer',
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/shop/products?search=&sort=&promo=true&category=&minPrice=&maxPrice=&storeId=
exports.listProducts = async (req, res) => {
  try {
    const { search = '', sort = 'price_asc', promo, category, minPrice, maxPrice, storeId } = req.query;

    const stores = await Store.find({ status: 'approved' }).select('name');
    const storeNames = new Map(stores.map((s) => [String(s._id), s.name]));

    const filter = { storeId: { $in: stores.map((s) => s._id) }, active: { $ne: false } };
    if (storeId && storeNames.has(String(storeId))) filter.storeId = storeId;
    if (['lpg', 'refill', 'accessory'].includes(category)) filter.category = category;

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = { $regex: escapeRegex(term), $options: 'i' };
      filter.$or = [{ name: rx }, { brand: rx }];
    }

    let products = await Product.find(filter);

    if (promo === 'true') products = products.filter((p) => p.onPromo);
    if (minPrice !== undefined && minPrice !== '' && !Number.isNaN(Number(minPrice))) {
      products = products.filter((p) => p.effectivePrice >= Number(minPrice));
    }
    if (maxPrice !== undefined && maxPrice !== '' && !Number.isNaN(Number(maxPrice))) {
      products = products.filter((p) => p.effectivePrice <= Number(maxPrice));
    }

    products.sort(PRODUCT_SORTS[sort] || PRODUCT_SORTS.price_asc);

    return res.json(products.map((p) => shapeProduct(p, storeNames.get(String(p.storeId)))));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
