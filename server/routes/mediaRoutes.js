const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
const { getImage } = require('../controllers/mediaController');

router.get('/:id', validateId('id'), getImage);

module.exports = router;