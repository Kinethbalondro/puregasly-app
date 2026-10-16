const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireStoreAccess = require('../middleware/storeAccess');
const validateId = require('../middleware/validateId');
const { list, create, remove } = require('../controllers/riderController');

router.use(requireAuth);

// Viewing the rider list is also handy for whoever assigns orders to them.
router.get('/', requireStoreAccess(['manage_orders', 'manage_riders']), list);
// Adding/removing riders is a manage_riders action.
router.post('/', requireStoreAccess('manage_riders'), create);
router.delete('/:id', validateId('id'), requireStoreAccess('manage_riders'), remove);

module.exports = router;
