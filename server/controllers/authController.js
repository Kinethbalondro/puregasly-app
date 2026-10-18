const User = require('../models/User');
const Store = require('../models/Store');
const RefreshToken = require('../models/RefreshToken');
const accessGate = require('../utils/accessGate');
const { isLocked, lockMessage, registerFailure, registerSuccess } = require('../utils/accountLock');
const { signAccessToken, createRefreshTokenPair, hashToken } = require('../utils/tokens');
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

// Makes a new code, saves its hash on the user, and emails the code.
async function sendOtp(user) {
  const otp = generateOtp();
  user.otpCode = hashOtp(otp);
  user.otpExpires = new Date(Date.now() + OTP_TTL_MS);
  user.otpAttempts = 0;
  await user.save();

  // Testing only: show the code in the server terminal (never in production).
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] OTP for ${user.email}: ${otp} - authController.js:32`);
  }

  try {
    await sendEmail(
      user.email,
      'Your PureGasly verification code',
      `Your PureGasly verification code is ${otp}. It expires in 10 minutes. If you did not sign up, you can ignore this email.`
    );
  } catch (err) {
    console.error('Could not send OTP email: - authController.js:42', err.message);
    // In production a failed email is a real error. While testing, the code in the terminal is enough.
    if (process.env.NODE_ENV === 'production') throw err;
  }
}

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
async function issueTokens(userId, userAgent) {
  const accessToken = signAccessToken(userId);
  const { raw, tokenHash, expiresAt } = createRefreshTokenPair();
  await RefreshToken.create({ user: userId, tokenHash, expiresAt, userAgent: String(userAgent || '').slice(0, 300) });
  return { accessToken, refreshToken: raw };
}

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, storeName } = req.body;

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

    if (!['customer', 'owner'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role for self-registration.' });
    }

    if (role === 'owner' && (!storeName || String(storeName).trim().length < 2)) {
      return res.status(400).json({ message: 'Store name is required for store owners.' });
    }

    const existing = await User.findOne({ email: normalizedEmail });

    // Signed up before but never verified: just send a fresh code.
    if (existing && existing.emailVerified === false) {
      await sendOtp(existing);
      return res.status(200).json({
        message: 'We sent a new 6-digit code to your email.',
        otpRequired: true,
        email: existing.email,
      });
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

      return res.status(201).json({
        message: 'Application submitted. An admin needs to approve your store before you can log in.',
        pendingApproval: true,
      });
    }

    // Customers only: send the email OTP.
    await sendOtp(user);

    return res.status(201).json({
      message: 'We sent a 6-digit code to your email.',
      otpRequired: true,
      email: user.email,
    });
  } catch (err) {
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

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+otpCode +otpExpires');

    if (!user || user.emailVerified !== false || !user.otpCode) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many wrong attempts. Please request a new code.' });
    }

    if (!user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Code expired. Please request a new one.' });
    }

    if (hashOtp(String(otp).trim()) !== user.otpCode) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: 'Wrong code. Please try again.' });
    }

    user.emailVerified = true;
    user.otpCode = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    await user.save();

    return res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// POST /api/auth/resend-otp   body: { email }
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (user && user.emailVerified === false) {
      await sendOtp(user);
    }

    // Same answer either way so nobody can use this to check which emails exist.
    return res.json({ message: 'If that account needs verification, a new code was sent.' });
  } catch (err) {
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

    // Rotate: this refresh token is single-use. Revoke it and issue a new pair.
    stored.revokedAt = new Date();
    await stored.save();

    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user._id, req.headers['user-agent']);

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