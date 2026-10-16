const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const { list, markRead, markAllRead } = require('../controllers/notificationController');

router.use(requireAuth);

router.get('/', list);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', validateId('id'), markRead);

module.exports = router;
