const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // pending  -> waiting for admin approval (new registrations)
    // approved -> live, visible to customers
    // rejected -> admin declined the application
    // banned   -> suspended by admin; only the owner can log in (to send an appeal)
    //
    // Default is 'approved' so stores created before this phase keep working.
    // New registrations explicitly set 'pending'.
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'banned'],
      default: 'approved',
    },
    rejectionReason: { type: String, default: '' },
    banReason: { type: String, default: '' },
    bannedAt: { type: Date, default: null },

    // Owner-editable public info shown to customers.
    address: { type: String, trim: true, default: '', maxlength: 200 },
    phone: { type: String, trim: true, default: '', maxlength: 30 },
    description: { type: String, trim: true, default: '', maxlength: 300 },

    // Used for the area price benchmark (stored lowercase so matching is easy).
    city: { type: String, trim: true, lowercase: true, default: '', maxlength: 60, index: true },
    province: { type: String, trim: true, lowercase: true, default: 'pangasinan', maxlength: 60, index: true },

    // Pinned map location of the store (optional). Used as the start of the
    // delivery route shown to riders.
    lat: { type: Number, default: null, min: -90, max: 90 },
    lng: { type: Number, default: null, min: -180, max: 180 },

    // Re-appeal for a banned store.
    appeal: {
      status: { type: String, enum: ['none', 'pending', 'approved', 'denied'], default: 'none' },
      message: { type: String, default: '' },
      submittedAt: { type: Date, default: null },
      resolvedAt: { type: Date, default: null },
      adminNote: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Store', storeSchema);