const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const requireActiveStore = require('../middleware/activeStore');
const validateId = require('../middleware/validateId');
const { list, create, updatePermissions, remove } = require('../controllers/employeeController');

router.use(requireAuth, requireRole('owner'), requireActiveStore);

router.get('/', list);
router.post('/', create);
router.patch('/:id', validateId('id'), updatePermissions);
router.delete('/:id', validateId('id'), remove);

module.exports = router;
