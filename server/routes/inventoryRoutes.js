const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const requireStoreAccess = require('../middleware/storeAccess');
const validateId = require('../middleware/validateId');
const { singleImage } = require('../middleware/imageUpload');

const {
  list,
  create,
  update,
  remove,
  setImage,
  removeImage,
} = require('../controllers/inventoryController');

router.use(requireAuth, requireStoreAccess('manage_inventory'));

router.get('/', list);
router.post('/', create);
router.patch('/:id', validateId('id'), update);
router.post('/:id/image', validateId('id'), singleImage, setImage);
router.delete('/:id/image', validateId('id'), removeImage);
router.delete('/:id', validateId('id'), remove);

module.exports = router;