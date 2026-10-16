const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const {
  register,
  verifyOtp,
  resendOtp,
  login,
  changePassword,
  refresh,
  logout,
  me,
  listSessions,
  revokeSession,
  logoutAll,
} = require('../controllers/authController');

// Limits for the OTP endpoints so codes can't be guessed and emails can't be spammed.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many code requests. Please try again in a few minutes.' },
});

// Limit for changing a password, since it checks the current password.
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

router.post('/register', register);
router.post('/verify-otp', verifyLimiter, verifyOtp);
router.post('/resend-otp', resendLimiter, resendOtp);
router.post('/login', login);
router.post('/change-password', requireAuth, passwordLimiter, changePassword);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

router.get('/sessions', requireAuth, listSessions);
router.delete('/sessions/:id', requireAuth, validateId('id'), revokeSession);
router.post('/logout-all', requireAuth, logoutAll);
module.exports = router;