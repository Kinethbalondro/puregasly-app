const Media = require('../models/Media');
const { sniffImage } = require('../middleware/imageUpload');

// Validates the multer file and stores it. Returns { media } or { error }.
async function saveImage(file, kind, userId) {
  if (!file) return { error: 'Please choose an image.' };
  const mimeType = sniffImage(file.buffer);
  if (!mimeType) return { error: 'Only JPG, PNG or WebP images are accepted.' };
  const media = await Media.create({ kind, uploadedBy: userId, mimeType, size: file.size, data: file.buffer });
  return { media };
}

// Best-effort delete of one or many media ids; never throws.
async function deleteMedia(ids) {
  try {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (list.length) await Media.deleteMany({ _id: { $in: list } });
  } catch (err) {
    console.error('deleteMedia failed', err);
  }
}

module.exports = { saveImage, deleteMedia };
