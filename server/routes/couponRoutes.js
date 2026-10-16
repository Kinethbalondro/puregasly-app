const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const requireStoreAccess = require('../middleware/storeAccess');
const validateId = require('../middleware/validateId');
const { list, create, update, remove, validate } = require('../controllers/couponController');

router.post('/validate', requireAuth, requireRole('customer'), validate);

router.use(requireAuth, requireStoreAccess(['manage_orders', 'manage_coupons']));
router.get('/', list);
router.post('/', requireStoreAccess('manage_coupons'), create);
router.patch('/:id', validateId('id'), requireStoreAccess('manage_coupons'), update);
router.delete('/:id', validateId('id'), requireStoreAccess('manage_coupons'), remove);

module.exports = router;
