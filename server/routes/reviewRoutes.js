const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const requireStoreAccess = require('../middleware/storeAccess');
const { create, listForStore, reply, listForRider } = require('../controllers/reviewController');

// Customer posts a review (store rating, plus an optional rider rating)
router.post('/', requireAuth, requireRole('customer'), create);

// Store sees its reviews and replies to them
router.get('/store', requireAuth, requireStoreAccess('view_analytics'), listForStore);
router.post('/:id/reply', requireAuth, requireStoreAccess('view_analytics'), reply);

// Rider sees the ratings they received
router.get('/rider', requireAuth, requireRole('rider'), listForRider);

module.exports = router;