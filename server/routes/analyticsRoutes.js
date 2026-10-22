const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireStoreAccess = require('../middleware/storeAccess');
const { summary, demand } = require('../controllers/analyticsController'); // NEW: added demand

router.use(requireAuth, requireStoreAccess('view_analytics'));

router.get('/summary', summary);
router.get('/demand', demand); // NEW

module.exports = router;