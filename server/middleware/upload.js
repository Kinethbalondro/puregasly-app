const multer = require('multer');
const { KEYS } = require('../utils/documentTypes');

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: KEYS.length, fields: 20, fieldSize: 2 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!KEYS.includes(file.fieldname)) return cb(new Error('UNEXPECTED_FIELD'));
    cb(null, true);
  },
});

// Accept one file per document type, using the type key as the form field name.
const uploadStoreDocs = upload.fields(KEYS.map((name) => ({ name, maxCount: 1 })));

// Wraps multer so its errors come back as friendly JSON instead of a 500.
exports.storeDocs = (req, res, next) => {
  uploadStoreDocs(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Each document must be 5 MB or smaller.' });
    }
    return res.status(400).json({ message: 'Invalid document upload.' });
  });
};

// Verify the file's real type from its first bytes - the browser-supplied
// mimetype and filename can be faked. Returns a mime string or null.
exports.sniffType = (buf) => {
  if (!buf || buf.length < 4) return null;
  if (buf.slice(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
};
