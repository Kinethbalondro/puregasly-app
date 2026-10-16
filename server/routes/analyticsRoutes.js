const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireStoreAccess = require('../middleware/storeAccess');
const { summary } = require('../controllers/analyticsController');

router.use(requireAuth, requireStoreAccess('view_analytics'));

router.get('/summary', summary);

module.exports = router;
