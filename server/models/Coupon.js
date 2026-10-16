const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    type: { type: String, enum: ['percent', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 }, // percent (1-100) or a PHP amount
    minOrder: { type: Number, default: 0, min: 0 },
    maxUses: { type: Number, default: null, min: 1 }, // null = unlimited
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One code per store (case-insensitive via the uppercase transform above).
couponSchema.index({ storeId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Coupon', couponSchema);
