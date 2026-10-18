const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
const { serve } = require('../controllers/mediaController');

router.get('/:id', validateId('id'), serve);

module.exports = router;
