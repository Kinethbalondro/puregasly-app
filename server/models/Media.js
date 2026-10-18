const mongoose = require('mongoose');

// Profile pictures and store photos. Stored in MongoDB (not on disk) because
// Render's free tier has an ephemeral filesystem. `data` is never selected by
// default. Business documents live in StoreDocument and are NOT served here.
const mediaSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['avatar', 'store_logo', 'store_cover', 'store_gallery'], required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Media', mediaSchema);
