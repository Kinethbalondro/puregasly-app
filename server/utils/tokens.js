const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function signAccessToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL });
}

// Raw refresh token given to the client, and the hash that gets stored.
function createRefreshTokenPair() {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(raw);
  return { raw, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) };
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { signAccessToken, createRefreshTokenPair, hashToken, REFRESH_TOKEN_TTL_MS };
