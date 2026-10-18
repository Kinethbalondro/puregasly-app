const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: 40 }, // e.g. "Home", "Work"
    address: { type: String, required: true, trim: true, maxlength: 250 },
    contactNumber: { type: String, required: true, trim: true, maxlength: 30 },
    isDefault: { type: Boolean, default: false },
    // Pinned map location (optional)
    lat: { type: Number, default: null, min: -90, max: 90 },
    lng: { type: Number, default: null, min: -180, max: 180 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Address', addressSchema);