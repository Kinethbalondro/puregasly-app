const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireStoreAccess = require('../middleware/storeAccess');
const validateId = require('../middleware/validateId');
const { list, create, update, remove } = require('../controllers/inventoryController');

router.use(requireAuth, requireStoreAccess('manage_inventory'));

router.get('/', list);
router.post('/', create);
router.patch('/:id', validateId('id'), update);
router.delete('/:id', validateId('id'), remove);

module.exports = router;
