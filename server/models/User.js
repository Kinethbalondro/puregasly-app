const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['admin', 'owner', 'employee', 'rider', 'customer'],
      default: 'customer',
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
    approvalReason: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Email OTP verification
    emailVerified: { type: Boolean, default: true },
    otpCode: { type: String, select: false, default: null },
    otpExpires: { type: Date, select: false, default: null },
    otpAttempts: { type: Number, default: 0 },
    // What the current code is for: 'signup' | 'reset' | 'email_change' ('' = an old signup code).
    // A code only works for the purpose it was made for.
    otpPurpose: { type: String, select: false, default: '' },
    otpSentAt: { type: Date, select: false, default: null },
    // The new address while an email change waits for its code.
    pendingEmail: { type: String, select: false, default: null },

    // Links owners AND employees to their store.
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
    },
    // Set by the store owner, employees only. e.g. ["manage_inventory"]
    permissions: { type: [String], default: [] },
    // Set by the platform admin. A banned user cannot log in or use the API.
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    bannedAt: { type: Date, default: null },
    // Profile picture (Media id). Shown to others where relevant (reviews, team lists).
    avatar: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', default: null },
    // Recorded when someone ticks the privacy-policy box at sign-up.
    privacyAcceptedAt: { type: Date, default: null },
    privacyVersion: { type: String, default: '' },
    // Account lockout after repeated failed login attempts.
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    // True while the user is still on a temporary password (employees and riders
    // created by an owner). They must set their own password at first login.
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash the password before saving, only if it changed.
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.hasPermission = function (permission) {
  if (this.role === 'owner') return true;
  return this.permissions.includes(permission);
};
module.exports = mongoose.model('User', userSchema);
