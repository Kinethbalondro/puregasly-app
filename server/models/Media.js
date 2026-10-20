const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: [
        'avatar',
        'store_logo',
        'store_cover',
        'store_gallery',
        'product',
      ],
      required: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    size: {
      type: Number,
      required: true,
    },

    data: {
      type: Buffer,
      required: true,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Media', mediaSchema);