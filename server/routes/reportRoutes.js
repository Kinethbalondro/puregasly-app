const express = require('express');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const { notMuted } = require('../middleware/moderation');
const {
  createReport,
  myReports,
  listReports,
  resolveReport,
} = require('../controllers/reportController');

const router = express.Router();

// Any logged-in user can file a report (muted users cannot).
router.post('/', requireAuth, notMuted, createReport);

// Reports I filed.
router.get('/mine', requireAuth, myReports);

// Admin only: list reports and resolve them.
router.get('/', requireAuth, requireRole('admin'), listReports);
router.patch('/:id', requireAuth, requireRole('admin'), resolveReport);

module.exports = router;