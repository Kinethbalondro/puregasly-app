const User = require('../models/User');
const { saveImage, deleteMedia } = require('../utils/media');

// POST /api/profile/avatar   (any signed-in role; multipart field "image")
exports.setAvatar = async (req, res) => {
  try {
    const { media, error } = await saveImage(req.file, 'avatar', req.userId);
    if (error) return res.status(400).json({ message: error });

    const user = await User.findById(req.userId);
    const old = user.avatar;
    user.avatar = media._id;
    await user.save();
    if (old) await deleteMedia(old);

    return res.json({ avatar: String(media._id) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/profile/avatar
exports.removeAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const old = user.avatar;
    user.avatar = null;
    await user.save();
    if (old) await deleteMedia(old);
    return res.json({ avatar: null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
