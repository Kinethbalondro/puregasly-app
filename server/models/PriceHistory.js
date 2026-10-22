const mongoose = require('mongoose');

// One row every time a product's price changes (or when the product is first created).
const priceHistorySchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },

  // Copied from the product so we can group by type/size later, even if the product is edited or deleted.
  productName: { type: String, default: '' },
  brand: { type: String, default: '' },
  category: { type: String, default: 'lpg' },
  sizeKg: { type: Number, default: null },

  price: { type: Number, required: true, min: 0 },
  promoPrice: { type: Number, min: 0, default: null },
  effectivePrice: { type: Number, required: true, min: 0 },

  recordedAt: { type: Date, default: Date.now, index: true },

  // true only for demo rows made by scripts/seedPriceHistory.js
  seeded: { type: Boolean, default: false, index: true },
});

priceHistorySchema.index({ storeId: 1, recordedAt: -1 });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);