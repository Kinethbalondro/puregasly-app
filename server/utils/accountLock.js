// Account lockout after repeated failed login attempts.
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function msRemaining(user) {
  if (!user.lockUntil) return 0;
  return Math.max(0, new Date(user.lockUntil).getTime() - Date.now());
}

function isLocked(user) {
  return msRemaining(user) > 0;
}

function lockMessage(user) {
  const mins = Math.ceil(msRemaining(user) / 60000);
  return `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
}

// Called after a wrong password. Returns true if this failure just locked the account.
async function registerFailure(user) {
  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  let justLocked = false;
  if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
    user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    user.failedLoginAttempts = 0;
    justLocked = true;
  }
  await user.save();
  return justLocked;
}

async function registerSuccess(user) {
  if (user.failedLoginAttempts || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
  }
}

module.exports = { isLocked, lockMessage, registerFailure, registerSuccess, MAX_ATTEMPTS, LOCK_DURATION_MS };
