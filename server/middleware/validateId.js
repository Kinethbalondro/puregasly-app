const { isValidId } = require('../utils/helpers');

// Usage: router.patch('/:id', validateId('id'), handler)
// Rejects malformed ids with a clean 400 instead of a Mongoose CastError.
module.exports = function validateId(param = 'id') {
  return (req, res, next) => {
    if (!isValidId(req.params[param])) {
      return res.status(400).json({ message: 'Invalid id.' });
    }
    next();
  };
};
