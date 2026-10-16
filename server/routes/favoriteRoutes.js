const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const { list, ids, add, remove } = require('../controllers/favoriteController');

router.use(requireAuth, requireRole('customer'));

router.get('/', list);
router.get('/ids', ids);
router.post('/', add);
router.delete('/:targetType/:targetId', remove);

module.exports = router;
