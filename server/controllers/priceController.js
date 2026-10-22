const PriceHistory = require('../models/PriceHistory');

// GET /api/prices/trends?period=weeks|months&category=lpg|refill|accessory&sizeKg=11
// Average price per week (last 13 weeks) or per month (last 6 months) across all stores.
exports.trends = async (req, res) => {
  try {
    const period = req.query.period === 'months' ? 'months' : 'weeks';
    const { category, sizeKg } = req.query;

    const DAY = 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - (period === 'months' ? 183 : 91) * DAY);

    const match = { recordedAt: { $gte: since } };
    if (['lpg', 'refill', 'accessory'].includes(category)) match.category = category;
    if (sizeKg !== undefined && sizeKg !== '' && !Number.isNaN(Number(sizeKg))) {
      match.sizeKg = Number(sizeKg);
    }

    const format = period === 'months' ? '%Y-%m' : '%G-W%V';

    const points = await PriceHistory.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format, date: '$recordedAt' } },
          avg: { $avg: '$effectivePrice' },
          min: { $min: '$effectivePrice' },
          max: { $max: '$effectivePrice' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Types the user can choose from (category + size)
    const options = await PriceHistory.aggregate([
      { $group: { _id: { category: '$category', sizeKg: '$sizeKg' } } },
      { $sort: { '_id.category': 1, '_id.sizeKg': 1 } },
    ]);

    return res.json({
      period,
      points: points.map((p) => ({
        label: p._id,
        avg: Math.round(p.avg * 100) / 100,
        min: p.min,
        max: p.max,
        count: p.count,
      })),
      options: options.map((o) => ({ category: o._id.category, sizeKg: o._id.sizeKg })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};