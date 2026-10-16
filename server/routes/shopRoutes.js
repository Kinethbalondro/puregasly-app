const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const validateId = require('../middleware/validateId');
const { listStores, getStore, listProducts } = require('../controllers/shopController');

router.use(requireAuth, requireRole('customer'));

router.get('/stores', listStores);
router.get('/stores/:id', validateId('id'), getStore);
router.get('/products', listProducts);

module.exports = router;
