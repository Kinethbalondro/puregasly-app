const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const requireStoreAccess = require('../middleware/storeAccess');
const { create, listForStore } = require('../controllers/reviewController');

router.post('/', requireAuth, requireRole('customer'), create);
router.get('/store', requireAuth, requireStoreAccess('view_analytics'), listForStore);

module.exports = router;
