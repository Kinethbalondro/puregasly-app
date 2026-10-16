const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const requireActiveStore = require('../middleware/activeStore');
const { appeal, updateProfile } = require('../controllers/storeController');

router.use(requireAuth, requireRole('owner'));

// Works while the store is banned (that's the whole point of it).
router.post('/appeal', appeal);

router.patch('/profile', requireActiveStore, updateProfile);

module.exports = router;
