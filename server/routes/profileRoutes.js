const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const { singleImage } = require('../middleware/imageUpload');
const { setAvatar, removeAvatar } = require('../controllers/profileController');

router.use(requireAuth);

router.post('/avatar', singleImage, setAvatar);
router.delete('/avatar', removeAvatar);

module.exports = router;
