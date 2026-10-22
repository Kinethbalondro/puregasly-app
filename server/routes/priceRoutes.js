const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const { trends } = require('../controllers/priceController');

router.get('/trends', requireAuth, trends);

module.exports = router;