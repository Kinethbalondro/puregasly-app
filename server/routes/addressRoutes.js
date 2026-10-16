const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const validateId = require('../middleware/validateId');
const { list, create, update, setDefault, remove } = require('../controllers/addressController');

router.use(requireAuth, requireRole('customer'));

router.get('/', list);
router.post('/', create);
router.patch('/:id', validateId('id'), update);
router.patch('/:id/default', validateId('id'), setDefault);
router.delete('/:id', validateId('id'), remove);

module.exports = router;
