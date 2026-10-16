const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireStoreAccess = require('../middleware/storeAccess');
const validateId = require('../middleware/validateId');
const { list, advance, decline, assignRider, receipt } = require('../controllers/storeOrderController');

router.use(requireAuth, requireStoreAccess('manage_orders'));

router.get('/', list);
router.get('/:id/receipt', validateId('id'), receipt);
router.patch('/:id/advance', validateId('id'), advance);
router.patch('/:id/decline', validateId('id'), decline);
router.patch('/:id/assign-rider', validateId('id'), assignRider);

module.exports = router;

module.exports = router;
