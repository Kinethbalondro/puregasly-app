const multer = require('multer');

const MAX_BYTES = 3 * 1024 * 1024; // the browser shrinks photos first; this is the hard cap

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 5, fieldSize: 1024 },
}).single('image');

// Single image in the "image" form field. Errors come back as friendly JSON.
exports.singleImage = (req, res, next) => {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'That image is too large (max 3 MB).' });
    }
    return res.status(400).json({ message: 'Invalid image upload.' });
  });
};

// Real type from the file's first bytes (filenames / mimetypes can be faked).
exports.sniffImage = (buf) => {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
};
