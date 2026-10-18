const mongoose = require('mongoose');

const ORDER_STATUSES = ['pending', 'preparing', 'out_for_delivery', 'delivered', 'received', 'cancelled'];

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    brand: { type: String, default: '' },
    sizeKg: { type: Number },
    unitPrice: { type: Number, required: true, min: 0 }, // price at the time of ordering
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 }, // before any coupon discount
    discount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: '' },
    total: { type: Number, required: true, min: 0 }, // subtotal - discount
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: ORDER_STATUSES },
        at: { type: Date, default: Date.now },
      },
    ],
    deliveryAddress: { type: String, required: true, trim: true, maxlength: 250 },
    contactNumber: { type: String, required: true, trim: true, maxlength: 30 },
    // Map pin copied from the customer's address at checkout, so the store and
    // rider can see where to deliver. Null if the address had no pin.
    deliveryLat: { type: Number, default: null, min: -90, max: 90 },
    deliveryLng: { type: Number, default: null, min: -180, max: 180 },

    // When the customer wants it: "asap", or a chosen time slot.
    // scheduledFor is the start of the slot; scheduledLabel is the text shown to
    // the store and rider, e.g. "Oct 19, 2026, 9:00 AM - 11:00 AM".
    deliveryTimeType: { type: String, enum: ['asap', 'scheduled'], default: 'asap' },
    scheduledFor: { type: Date, default: null },
    scheduledLabel: { type: String, default: '', trim: true, maxlength: 80 },

    // Proof of delivery: a 4-digit code only the customer can see. A rider must
    // enter it to mark the order delivered. Empty on older orders (no code needed).
    deliveryCode: { type: String, default: '', maxlength: 8 },
    deliveredAt: { type: Date, default: null },

    notes: { type: String, trim: true, default: '', maxlength: 200 },
    paymentMethod: { type: String, enum: ['COD'], default: 'COD' },
    // Optional - the store can hand a preparing/out-for-delivery order to a rider,
    // who then owns the out_for_delivery -> delivered steps for it.
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;