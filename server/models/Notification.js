const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'order_placed', // to store: a new order came in
  'order_status', // to customer: their order moved forward
  'rider_assigned', // to rider: you've been assigned a delivery
  'store_status', // to owner: application approved/rejected/banned/unbanned
  'appeal_resolved', // to owner: their appeal was approved/denied
  'new_review', // to owner: a customer reviewed the store
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, default: '', maxlength: 300 },
    // Frontend route to open when the notification is clicked, e.g. "/orders".
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
