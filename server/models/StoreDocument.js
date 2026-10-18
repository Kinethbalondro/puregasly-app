const mongoose = require('mongoose');

// Files are stored in MongoDB (not on disk) because hosts like Render's free
// tier have an ephemeral filesystem - anything written to disk disappears on
// redeploy. `data` is never selected by default so listing stays light.
const storeDocumentSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    type: { type: String, required: true },
    originalName: { type: String, default: '' },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StoreDocument', storeDocumentSchema);
