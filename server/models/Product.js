const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g. "LPG Tank Refill"
    brand: { type: String, trim: true, default: '' }, // e.g. "Petron Gasul"
    category: { type: String, enum: ['lpg', 'refill', 'accessory'], default: 'lpg' },
    sizeKg: { type: Number, min: 0 }, // e.g. 11, 22, 50
    price: { type: Number, required: true, min: 0 },
    // When set (and lower than price) the product is "on sale" / a promo.
    promoPrice: { type: Number, min: 0, default: null },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockAt: { type: Number, min: 0, default: 5 },
    // Units sold (incremented when an order is marked Delivered).
    sold: { type: Number, min: 0, default: 0 },
    // Inactive products are hidden from customers but kept in inventory.
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.virtual('onPromo').get(function () {
  return this.promoPrice != null && this.promoPrice < this.price;
});

productSchema.virtual('effectivePrice').get(function () {
  return this.promoPrice != null && this.promoPrice < this.price ? this.promoPrice : this.price;
});

module.exports = mongoose.model('Product', productSchema);
