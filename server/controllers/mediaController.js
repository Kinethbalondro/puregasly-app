const Media = require('../models/Media');

// GET /api/media/:id  - public, so plain <img> tags work (they can't send the
// auth header). Only profile pictures and store photos ever live here.
exports.serve = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id).select('+data mimeType');
    if (!media) return res.status(404).json({ message: 'Not found.' });
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // helmet defaults to same-origin; the site is on a different Render origin.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Every upload gets a brand-new id, so a given URL never changes - safe to cache hard.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.removeHeader('Pragma');
    res.removeHeader('Expires');
    return res.send(media.data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
