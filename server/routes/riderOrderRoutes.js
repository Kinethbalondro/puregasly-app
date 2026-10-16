const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const validateId = require('../middleware/validateId');
const { list, advance } = require('../controllers/riderOrderController');

router.use(requireAuth, requireRole('rider'));

router.get('/', list);
router.patch('/:id/advance', validateId('id'), advance);

module.exports = router;
