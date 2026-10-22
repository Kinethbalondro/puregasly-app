const Order = require('../models/Order');
const Product = require('../models/Product');
const { dayKey, round2 } = require('../utils/helpers');

const SALE_STATUSES = ['delivered', 'received'];

// GET /api/analytics/summary?days=30
exports.summary = async (req, res) => {
  try {
    const storeId = req.currentUser.storeId;
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 90);

    const [orders, products] = await Promise.all([
      Order.find({ storeId }).sort({ createdAt: 1 }),
      Product.find({ storeId }),
    ]);

    const sales = orders.filter((o) => SALE_STATUSES.includes(o.status));

    // ---- totals
    const revenue = sales.reduce((s, o) => s + o.total, 0);
    const unitsSold = sales.reduce((s, o) => s + o.items.reduce((n, it) => n + it.qty, 0), 0);
    const statusBreakdown = {};
    orders.forEach((o) => {
      statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1;
    });

    // ---- daily series (zero-filled so the chart has no gaps)
    const daily = new Map();
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
      daily.set(dayKey(now - i * 86400000), { date: dayKey(now - i * 86400000), revenue: 0, orders: 0 });
    }
    sales.forEach((o) => {
      const bucket = daily.get(dayKey(o.createdAt));
      if (bucket) {
        bucket.revenue = round2(bucket.revenue + o.total);
        bucket.orders += 1;
      }
    });
    const series = [...daily.values()];
    const periodRevenue = series.reduce((s, d) => s + d.revenue, 0);
    const periodOrders = series.reduce((s, d) => s + d.orders, 0);

    const todayKey = dayKey(now);
    const today = daily.get(todayKey) || { revenue: 0, orders: 0 };

    // ---- top products (by revenue) within the period
    const cutoff = now - days * 86400000;
    const perProduct = new Map();
    sales
      .filter((o) => new Date(o.createdAt).getTime() >= cutoff)
      .forEach((o) => {
        o.items.forEach((it) => {
          const key = String(it.product);
          const row = perProduct.get(key) || { name: it.name, brand: it.brand, units: 0, revenue: 0 };
          row.units += it.qty;
          row.revenue = round2(row.revenue + it.unitPrice * it.qty);
          perProduct.set(key, row);
        });
      });
    const topProducts = [...perProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // ---- inventory health
    const lowStock = products
      .filter((p) => p.stock > 0 && p.stock <= (p.lowStockAt ?? 5))
      .sort((a, b) => a.stock - b.stock)
      .map((p) => ({ id: p._id, name: p.name, brand: p.brand, stock: p.stock, lowStockAt: p.lowStockAt ?? 5 }));

    const inventory = {
      totalProducts: products.length,
      totalUnits: products.reduce((s, p) => s + p.stock, 0),
      stockValue: round2(products.reduce((s, p) => s + p.stock * p.price, 0)),
      outOfStock: products.filter((p) => p.stock === 0).length,
      onPromo: products.filter((p) => p.onPromo).length,
      lowStock,
    };

    return res.json({
      days,
      totals: {
        revenue: round2(revenue),
        completedOrders: sales.length,
        totalOrders: orders.length,
        unitsSold,
        avgOrderValue: sales.length ? round2(revenue / sales.length) : 0,
        newOrders: statusBreakdown.pending || 0,
        activeOrders: (statusBreakdown.preparing || 0) + (statusBreakdown.out_for_delivery || 0),
      },
      today: { revenue: round2(today.revenue), orders: today.orders },
      period: { revenue: round2(periodRevenue), orders: periodOrders },
      series,
      statusBreakdown,
      topProducts,
      inventory,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// NEW: GET /api/analytics/demand?days=90
// Anonymous demand patterns for this store: busiest days, popular sizes, top areas.
// No customer names or exact addresses are ever returned.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PH_OFFSET = 8 * 60 * 60 * 1000; // Philippine time (UTC+8)

function areaOf(address) {
  const parts = String(address || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'Unknown area';
  // Keep only the barangay/city part, never the street or house number.
  return parts.slice(-2).join(', ');
}

exports.demand = async (req, res) => {
  try {
    const storeId = req.currentUser.storeId;
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 90, 7), 180);
    const since = new Date(Date.now() - days * 86400000);

    const orders = await Order.find({
      storeId,
      status: { $ne: 'cancelled' },
      createdAt: { $gte: since },
    }).select('createdAt items deliveryAddress');

    // ---- busiest days (orders per weekday)
    const dayCounts = WEEKDAYS.map((name) => ({ day: name, orders: 0 }));
    orders.forEach((o) => {
      const d = new Date(new Date(o.createdAt).getTime() + PH_OFFSET).getUTCDay();
      dayCounts[d].orders += 1;
    });

    // ---- popular sizes (units sold per size)
    const sizeMap = new Map();
    orders.forEach((o) => {
      o.items.forEach((it) => {
        const label = it.sizeKg ? `${it.sizeKg} kg` : 'Other / no size';
        sizeMap.set(label, (sizeMap.get(label) || 0) + it.qty);
      });
    });
    const sizes = [...sizeMap.entries()]
      .map(([size, units]) => ({ size, units }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 8);

    // ---- areas that order most
    const areaMap = new Map();
    orders.forEach((o) => {
      const area = areaOf(o.deliveryAddress);
      areaMap.set(area, (areaMap.get(area) || 0) + 1);
    });
    const areas = [...areaMap.entries()]
      .map(([area, count]) => ({ area, orders: count }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 8);

    const busiest = [...dayCounts].sort((a, b) => b.orders - a.orders)[0];

    return res.json({
      days,
      totalOrders: orders.length,
      busiestDay: busiest && busiest.orders > 0 ? busiest.day : null,
      byDay: dayCounts,
      sizes,
      areas,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};