const mongoose = require('mongoose');
const Media = require('../models/Media');

exports.getImage = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid image ID.' });
    }

    const media = await Media.findById(id).select('+data');

    if (!media) {
      return res.status(404).json({ message: 'Image not found.' });
    }

    res.set('Content-Type', media.mimeType);
    return res.send(media.data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Unable to load image.' });
  }
};