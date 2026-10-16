const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetType: { type: String, enum: ['store', 'product'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  createdAt: { type: Date, default: Date.now },
});

// A customer can only favorite the same store/product once.
favoriteSchema.index({ customer: 1, targetType: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
