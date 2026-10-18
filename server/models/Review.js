const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, default: '', maxlength: 500 },

    // Rider rating (optional). riderId is the rider who delivered the order.
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    riderRating: { type: Number, min: 1, max: 5, default: null },
    riderComment: { type: String, trim: true, default: '', maxlength: 500 },

    // The store's reply to this review (optional)
    storeReply: {
      text: { type: String, trim: true, default: '', maxlength: 500 },
      repliedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);