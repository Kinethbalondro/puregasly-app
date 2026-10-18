const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const validateId = require('../middleware/validateId');
const { storeDocs } = require('../middleware/upload');
const {
  register,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  requestEmailChange,
  confirmEmailChange,
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

// Asking for a reset email is limited per IP; the controller also refuses to
// email the same account twice within a minute.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many reset requests. Please try again in a few minutes.' },
});

// multipart/form-data: owners attach their business documents here.
router.post('/register', storeDocs, register);
router.post('/verify-otp', verifyLimiter, verifyOtp);
router.post('/resend-otp', resendLimiter, resendOtp);
router.post('/forgot-password', forgotLimiter, forgotPassword);
router.post('/reset-password', verifyLimiter, resetPassword);
router.post('/login', login);
router.post('/change-password', requireAuth, passwordLimiter, changePassword);
router.post('/change-email/request', requireAuth, forgotLimiter, requestEmailChange);
router.post('/change-email/confirm', requireAuth, verifyLimiter, confirmEmailChange);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

router.get('/sessions', requireAuth, listSessions);
router.delete('/sessions/:id', requireAuth, validateId('id'), revokeSession);
router.post('/logout-all', requireAuth, logoutAll);
module.exports = router;
