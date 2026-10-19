const User = require('../models/User');
const Store = require('../models/Store');
const RefreshToken = require('../models/RefreshToken');
const StoreDocument = require('../models/StoreDocument');
const { sniffType } = require('../middleware/upload');
const { REQUIRED_KEYS, labelOf } = require('../utils/documentTypes');
const accessGate = require('../utils/accessGate');
const { isLocked, lockMessage, registerFailure, registerSuccess } = require('../utils/accountLock');
const { newSessionId, signAccessToken, createRefreshTokenPair, hashToken } = require('../utils/tokens');
const { isValidName, hasValidMailDomain, EMAIL_REGEX } = require('../utils/validation');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000)); // 6 digits
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

// What each kind of code is for, and the email that carries it.
const OTP_EMAILS = {
  signup: {
    subject: 'Your PureGasly verification code',
    body: (otp) => `Your PureGasly verification code is ${otp}. It expires in 10 minutes. If you did not sign up, you can ignore this email.`,
  },
  reset: {
    subject: 'Reset your PureGasly password',
    body: (otp) => `Your PureGasly password reset code is ${otp}. It expires in 10 minutes. If you did not ask to reset your password, ignore this email - your password will not change.`,
  },
  email_change: {
    subject: 'Confirm your new PureGasly email',
    body: (otp) => `Your code to confirm this email address on PureGasly is ${otp}. It expires in 10 minutes. If you did not ask for this, ignore this email.`,
  },
};

// Don't email a new code for the same purpose more than once a minute.
const OTP_RESEND_GAP_MS = 60 * 1000;

function sentRecently(user, purpose) {
  return user.otpPurpose === purpose && user.otpSentAt && Date.now() - new Date(user.otpSentAt).getTime() < OTP_RESEND_GAP_MS;
}

// Makes a new code for `purpose`, saves its hash on the user, and emails it to `to`.
async function sendOtp(user, purpose = 'signup', to = user.email) {
  const otp = generateOtp();
  user.otpCode = hashOtp(otp);
  user.otpExpires = new Date(Date.now() + OTP_TTL_MS);
  user.otpAttempts = 0;
  user.otpPurpose = purpose;
  user.otpSentAt = new Date();
  await user.save();

  // Testing only: show the code in the server terminal (never in production).
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] ${purpose} code for ${to}: ${otp} - authController.js:60`);
  }

  try {
    await sendEmail(to, OTP_EMAILS[purpose].subject, OTP_EMAILS[purpose].body(otp));
  } catch (err) {
    console.error('Could not send OTP email: - authController.js:66', err.message);
    // In production a failed email is a real error. While testing, the code in the terminal is enough.
    if (process.env.NODE_ENV === 'production') {
      throw Object.assign(new Error('EMAIL_SEND_FAILED'), { code: 'EMAIL_SEND_FAILED' });
    }
  }
}

function clearOtp(user) {
  user.otpCode = null;
  user.otpExpires = null;
  user.otpAttempts = 0;
  user.otpPurpose = '';
  user.pendingEmail = null;
}

// Checks a code the person typed against the one we saved for `purpose`.
// Counts wrong guesses (5 max per code). Returns { ok: true } or { ok: false, status, message }.
// The user must have been loaded with +otpCode +otpExpires +otpPurpose.
async function checkOtp(user, purpose, otp) {
  const purposeOk = user.otpPurpose === purpose || (purpose === 'signup' && !user.otpPurpose);
  if (!user.otpCode || !purposeOk) {
    return { ok: false, status: 400, message: 'Invalid or expired code.' };
  }
  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, status: 429, message: 'Too many wrong attempts. Please request a new code.' };
  }
  if (!user.otpExpires || user.otpExpires < new Date()) {
    return { ok: false, status: 400, message: 'Code expired. Please request a new one.' };
  }
  const given = Buffer.from(hashOtp(String(otp).trim()));
  const saved = Buffer.from(user.otpCode);
  if (given.length !== saved.length || !crypto.timingSafeEqual(given, saved)) {
    user.otpAttempts += 1;
    await user.save();
    return { ok: false, status: 400, message: 'Wrong code. Please try again.' };
  }
  return { ok: true };
}

// Bump when the privacy policy text changes in a way users should re-accept.
const PRIVACY_VERSION = '2026-10-16';

function isStrongEnough(password) {
  // At least 8 characters, at least one letter and one number.
  return typeof password === 'string' && password.length >= 8 && password.length <= 128 &&
    /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

function toSafeUser(user) {
  const s = user.storeId && user.storeId.name ? user.storeId : null;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    avatar: user.avatar ? String(user.avatar) : null,
    mustChangePassword: Boolean(user.mustChangePassword),
    store: s
      ? {
          id: s._id,
          name: s.name,
          status: s.status,
          banReason: s.banReason,
          rejectionReason: s.rejectionReason,
          address: s.address,
          phone: s.phone,
          description: s.description,
          lat: typeof s.lat === 'number' ? s.lat : null,
          lng: typeof s.lng === 'number' ? s.lng : null,
          appeal: s.appeal
            ? {
                status: s.appeal.status,
                message: s.appeal.message,
                submittedAt: s.appeal.submittedAt,
                adminNote: s.appeal.adminNote,
              }
            : { status: 'none' },
        }
      : null,
  };
}

// Issues a fresh access + refresh token pair for a user and records the
// refresh token (hashed) in the DB so it can be looked up / revoked later.
async function issueTokens(userId, userAgent, sessionId) {
  // A new login starts a new session; a refresh keeps the existing one.
  const sid = sessionId || newSessionId();
  const accessToken = signAccessToken(userId, sid);
  const { raw, tokenHash, expiresAt } = createRefreshTokenPair();
  await RefreshToken.create({ user: userId, tokenHash, expiresAt, sessionId: sid, userAgent: String(userAgent || '').slice(0, 300) });
  return { accessToken, refreshToken: raw };
}

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, storeName, acceptedPrivacy } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const trimmedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!isValidName(trimmedName)) {
      return res.status(400).json({ message: 'Please enter your full name (first and last, letters only).' });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    if (!(await hasValidMailDomain(normalizedEmail))) {
      return res.status(400).json({ message: "We couldn't verify that email's domain. Please check for typos." });
    }

    if (!isStrongEnough(password)) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters and include a letter and a number.' });
    }

    // multipart bodies arrive as strings, JSON bodies as booleans.
    if (acceptedPrivacy !== true && acceptedPrivacy !== 'true') {
      return res.status(400).json({ message: 'Please read and accept the Privacy Policy to create an account.' });
    }

    if (!['customer', 'owner'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role for self-registration.' });
    }

    if (role === 'owner' && (!storeName || String(storeName).trim().length < 2)) {
      return res.status(400).json({ message: 'Store name is required for store owners.' });
    }

    // Store owners must attach their business documents. Validate them all
    // BEFORE creating anything so a bad upload never leaves a half-made account.
    const files = (req.files && typeof req.files === 'object') ? req.files : {};
    const docsToSave = [];
    if (role === 'owner') {
      for (const key of REQUIRED_KEYS) {
        if (!files[key] || !files[key][0]) {
          return res.status(400).json({ message: `Please upload: ${labelOf(key)}.` });
        }
      }
      for (const [key, arr] of Object.entries(files)) {
        const f = arr[0];
        const realType = sniffType(f.buffer);
        if (!realType) {
          return res.status(400).json({ message: `${labelOf(key)}: only PDF, JPG or PNG files are accepted.` });
        }
        docsToSave.push({
          type: key,
          originalName: String(f.originalname || '').replace(/[^\w.\- ]/g, '_').slice(0, 120),
          mimeType: realType,
          size: f.size,
          data: f.buffer,
        });
      }
    }

    let existing = await User.findOne({ email: normalizedEmail });

    // Signed up before but never verified: send a fresh code. The name and password
    // are replaced with what was just submitted - otherwise someone could register
    // another person's email first, and that person would then verify an account
    // whose password the other person chose.
    if (existing && existing.emailVerified === false && role === 'customer') {
      existing.name = trimmedName;
      existing.password = password; // hashed by the pre-save hook
      await sendOtp(existing);
      return res.status(200).json({
        message: 'We sent a new 6-digit code to your email.',
        otpRequired: true,
        email: existing.email,
      });
    }

    // A never-verified customer attempt is not a real account yet. If the same
    // email now signs up as a store owner, clear the old attempt instead of
    // saying the email already exists.
    if (existing && existing.emailVerified === false && role === 'owner' && existing.role === 'customer') {
      await User.deleteOne({ _id: existing._id });
      existing = null;
    }

    if (existing) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    let user;
    try {
      user = await User.create({
        name: trimmedName,
        email: normalizedEmail,
        password,
        role,
        privacyAcceptedAt: new Date(),
        privacyVersion: PRIVACY_VERSION,
        // Only customers verify by email OTP. Store owners are approved by the admin instead.
        emailVerified: role !== 'customer',
      });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' });
      throw err;
    }

    if (role === 'owner') {
      // New stores wait for admin approval before the owner can log in.
      const store = await Store.create({
        name: String(storeName).trim().slice(0, 80),
        owner: user._id,
        status: 'pending',
      });
      user.storeId = store._id;
      await user.save();

      try {
        await StoreDocument.insertMany(docsToSave.map((d) => ({ ...d, store: store._id })));
      } catch (docErr) {
        // Roll back so the person can simply try again with the same email.
        await StoreDocument.deleteMany({ store: store._id });
        await Store.deleteOne({ _id: store._id });
        await User.deleteOne({ _id: user._id });
        throw docErr;
      }

      return res.status(201).json({
        message: 'Application submitted. An admin needs to approve your store before you can log in.',
        pendingApproval: true,
      });
    }

    // Customers only: send the email OTP. If the email can't be sent, remove the
    // new account so the email is not counted as taken when they try again.
    try {
      await sendOtp(user);
    } catch (otpErr) {
      if (otpErr.code === 'EMAIL_SEND_FAILED') {
        await User.deleteOne({ _id: user._id });
      }
      throw otpErr;
    }

    return res.status(201).json({
      message: 'We sent a 6-digit code to your email.',
      otpRequired: true,
      email: user.email,
    });
  } catch (err) {
    if (err.code === 'EMAIL_SEND_FAILED') {
      return res.status(502).json({ message: "We couldn't send the verification email right now. Please try again in a few minutes." });
    }
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// POST /api/auth/verify-otp   body: { email, otp }
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email and code are required.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+otpCode +otpExpires +otpPurpose');

    if (!user || user.emailVerified !== false) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    const result = await checkOtp(user, 'signup', otp);
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    user.emailVerified = true;
    clearOtp(user);
    await user.save();

    return res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+otpPurpose +otpSentAt');
    if (user && user.emailVerified === false && !sentRecently(user, 'signup')) {
      await sendOtp(user, 'signup');
    }

    // Same answer either way so nobody can use this to check which emails exist.
    return res.json({ message: 'If that account needs verification, a new code was sent.' });
  } catch (err) {
    if (err.code === 'EMAIL_SEND_FAILED') {
      return res.status(502).json({ message: "We couldn't send the verification email right now. Please try again in a few minutes." });
    }
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail })
      .select('+password')
      .populate('storeId');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (isLocked(user)) {
      return res.status(423).json({ code: 'ACCOUNT_LOCKED', message: lockMessage(user) });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      const justLocked = await registerFailure(user);
      if (justLocked) {
        return res.status(423).json({ code: 'ACCOUNT_LOCKED', message: lockMessage(user) });
      }
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Password was correct, but the email was never verified with the OTP.
    if (user.emailVerified === false) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email first. Check your inbox for the 6-digit code.',
        email: user.email,
      });
    }

    // Only reveal ban / approval status once the password was correct.
    const blocked = accessGate(user, user.storeId);
    if (blocked) {
      return res.status(403).json(blocked);
    }

    await registerSuccess(user);

    const { accessToken, refreshToken } = await issueTokens(user._id, req.headers['user-agent']);

    return res.json({
      message: 'Login successful.',
      token: accessToken,
      refreshToken,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// POST /api/auth/change-password   body: { currentPassword, newPassword }
// Used to replace a temporary password (or to change a normal one).
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    if (!isStrongEnough(newPassword)) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters and include a letter and a number.' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'Your new password must be different from the current one.' });
    }

    const user = await User.findById(req.userId).select('+password').populate('storeId');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const match = await user.comparePassword(currentPassword);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    user.password = newPassword; // hashed by the pre-save hook in User.js
    user.mustChangePassword = false;
    await user.save();

    // Log out every other device, then keep this one signed in with a fresh session.
    await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    const { accessToken, refreshToken } = await issueTokens(user._id, req.headers['user-agent']);

    notifyByEmail(
      user.email,
      'Your PureGasly password was changed',
      'Your PureGasly password was just changed. If this was not you, reset it right away from the login page and contact support.'
    );

    return res.json({
      message: 'Password updated.',
      token: accessToken,
      refreshToken,
      user: toSafeUser(user),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// POST /api/auth/refresh   body: { refreshToken }
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({ message: 'Refresh token is required.' });
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await RefreshToken.findOne({ tokenHash });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    const user = await User.findById(stored.user).populate('storeId');
    if (!user) {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }

    // Re-check ban / store status on every refresh so a mid-session ban takes effect.
    const blocked = accessGate(user, user.storeId);
    if (blocked) {
      stored.revokedAt = new Date();
      await stored.save();
      return res.status(403).json(blocked);
    }

    // Rotate: this refresh token is single-use. Issue the new pair FIRST (same
    // sessionId, so the device stays signed in), then revoke the old token - the
    // other order leaves a moment with no live token for the session.
    // Tokens issued before sessions existed have no sessionId; they get one here.
    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(
      user._id,
      req.headers['user-agent'],
      stored.sessionId || undefined
    );
    stored.revokedAt = new Date();
    await stored.save();

    return res.json({ token: accessToken, refreshToken: newRefreshToken, user: toSafeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/auth/logout   body: { refreshToken }  - revokes just this session
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.updateOne({ tokenHash: hashToken(refreshToken) }, { $set: { revokedAt: new Date() } });
    }
    return res.json({ message: 'Logged out.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('storeId');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json(toSafeUser(user));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/auth/sessions   - this user's active (non-revoked, unexpired) sessions
exports.listSessions = async (req, res) => {
  try {
    const currentHash = req.query.current ? hashToken(String(req.query.current)) : null;

    const sessions = await RefreshToken.find({
      user: req.userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    return res.json(
      sessions.map((s) => ({
        id: s._id,
        userAgent: s.userAgent || 'Unknown device',
        createdAt: s.createdAt,
        current: currentHash === s.tokenHash,
      }))
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/auth/sessions/:id   - revoke one session (log that device out)
exports.revokeSession = async (req, res) => {
  try {
    const session = await RefreshToken.findOneAndUpdate(
      { _id: req.params.id, user: req.userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    if (!session) return res.status(404).json({ message: 'Session not found.' });
    return res.json({ message: 'Session logged out.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/auth/logout-all   - revoke every refresh token for this user
exports.logoutAll = async (req, res) => {
  try {
    await RefreshToken.updateMany({ user: req.userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    return res.json({ message: 'Logged out of all devices.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// Tells the person by email that something about their account changed. Never
// blocks or fails the request - it is only a heads-up in case it wasn't them.
function notifyByEmail(to, subject, text) {
  sendEmail(to, subject, text).catch((err) => console.error('Could not send notice email: - authController.js:626', err.message));
}

const EMAIL_SEND_FAILED_MESSAGE = "We couldn't send the email right now. Please try again in a few minutes.";

// ---------------------------------------------------------------------------
// Forgot password: ask for a code, then set a new password with it.
// ---------------------------------------------------------------------------

// POST /api/auth/forgot-password   body: { email }
// Always answers the same way, so it can't be used to find out which emails have accounts.
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+otpPurpose +otpSentAt');
    if (user && user.emailVerified !== false && !user.banned && !sentRecently(user, 'reset')) {
      await sendOtp(user, 'reset');
    }

    return res.json({ message: 'If an account exists for that email, we sent a 6-digit code to it.' });
  } catch (err) {
    if (err.code === 'EMAIL_SEND_FAILED') return res.status(502).json({ message: EMAIL_SEND_FAILED_MESSAGE });
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// POST /api/auth/reset-password   body: { email, otp, newPassword }
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword || [email, otp, newPassword].some((v) => typeof v !== 'string' && typeof v !== 'number')) {
      return res.status(400).json({ message: 'Email, code and new password are required.' });
    }
    // Checked first so a typo in the password doesn't use up a guess at the code.
    if (!isStrongEnough(String(newPassword))) {
      return res.status(400).json({ message: 'Password must be at least 8 characters and include a letter and a number.' });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password +otpCode +otpExpires +otpPurpose');
    // Same message as a wrong code, so this doesn't reveal whether the account exists.
    if (!user || user.banned || user.emailVerified === false) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    const result = await checkOtp(user, 'reset', otp);
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    user.password = String(newPassword); // hashed by the pre-save hook in User.js
    user.mustChangePassword = false;
    user.failedLoginAttempts = 0; // also lifts a "too many attempts" lock
    user.lockUntil = null;
    clearOtp(user);
    await user.save();

    // Whoever knew the old password is signed out everywhere.
    await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });

    notifyByEmail(
      user.email,
      'Your PureGasly password was changed',
      'Your PureGasly password was just reset. If this was not you, reset it again right away and contact support.'
    );

    return res.json({ message: 'Password updated. You can now log in.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// ---------------------------------------------------------------------------
// Change email (signed in): needs the password, then a code sent to the NEW address.
// ---------------------------------------------------------------------------

// POST /api/auth/change-email/request   body: { newEmail, currentPassword }
exports.requestEmailChange = async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;
    if (typeof newEmail !== 'string' || typeof currentPassword !== 'string' || !newEmail.trim() || !currentPassword) {
      return res.status(400).json({ message: 'New email and your current password are required.' });
    }
    const normalized = newEmail.trim().toLowerCase();
    if (normalized.length > 254 || !EMAIL_REGEX.test(normalized)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const user = await User.findById(req.userId).select('+password +otpPurpose +otpSentAt');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    if (normalized === user.email) {
      return res.status(400).json({ message: 'That is already your email address.' });
    }
    if (sentRecently(user, 'email_change')) {
      return res.status(429).json({ message: 'A code was just sent. Please wait a minute before asking for another.' });
    }
    if (!(await hasValidMailDomain(normalized))) {
      return res.status(400).json({ message: "We couldn't verify that email's domain. Please check for typos." });
    }
    if (await User.findOne({ email: normalized })) {
      return res.status(409).json({ message: 'That email is already used by another account.' });
    }

    user.pendingEmail = normalized;
    await sendOtp(user, 'email_change', normalized);

    return res.json({ message: `We sent a 6-digit code to ${normalized}.`, email: normalized });
  } catch (err) {
    if (err.code === 'EMAIL_SEND_FAILED') return res.status(502).json({ message: EMAIL_SEND_FAILED_MESSAGE });
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// POST /api/auth/change-email/confirm   body: { otp }
exports.confirmEmailChange = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp || (typeof otp !== 'string' && typeof otp !== 'number')) {
      return res.status(400).json({ message: 'Enter the 6-digit code.' });
    }

    const user = await User.findById(req.userId).select('+otpCode +otpExpires +otpPurpose +pendingEmail').populate('storeId');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!user.pendingEmail) {
      return res.status(400).json({ message: 'There is no email change waiting for a code. Start again.' });
    }

    const result = await checkOtp(user, 'email_change', otp);
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    // Someone else may have taken the address while the code was in the mail.
    if (await User.findOne({ email: user.pendingEmail, _id: { $ne: user._id } })) {
      clearOtp(user);
      await user.save();
      return res.status(409).json({ message: 'That email is now used by another account. Please choose a different one.' });
    }

    const oldEmail = user.email;
    const newEmail = user.pendingEmail;
    user.email = newEmail;
    clearOtp(user);
    try {
      await user.save();
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(409).json({ message: 'That email is now used by another account. Please choose a different one.' });
      }
      throw err;
    }

    notifyByEmail(
      oldEmail,
      'Your PureGasly email was changed',
      `The email on your PureGasly account was changed to ${newEmail}. If this was not you, contact support right away.`
    );

    return res.json({ message: 'Email updated.', user: toSafeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};