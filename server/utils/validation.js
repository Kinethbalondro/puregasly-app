const dns = require('dns').promises;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Letters (incl. accented/Unicode), spaces, hyphens, apostrophes, periods.
// Requires at least two "words" (a first and last name) since the field is
// labeled Full Name, and each word must have at least 2 letters - this is
// what actually rejects junk like "ab" or "11" that the plain length check
// let through before.
const NAME_REGEX = /^[\p{L}][\p{L}'.-]?[\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]?[\p{L}'.-]*)+$/u;

function isValidName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (name.length < 4 || name.length > 80) return false;
  return NAME_REGEX.test(name);
}

// Checks that the email's domain can plausibly receive mail (MX, or A/AAAA as a
// fallback). Catches typo'd domains like "user@gnail.con" without an email
// service. It ONLY rejects when DNS clearly says the domain has no records
// (ENOTFOUND / ENODATA). A timeout, SERVFAIL or other resolver hiccup - common
// on small hosting plans - is treated as "can't tell" and the email is allowed,
// so a flaky lookup never blocks a real person from signing up or being added.
const DEFINITE_NO = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);
const domainCache = new Map(); // domain -> { ok, at }
const CACHE_MS = 10 * 60 * 1000;

async function hasValidMailDomain(email) {
  const domain = String(email || '').split('@')[1];
  if (!domain) return false;
  const key = domain.toLowerCase();

  const hit = domainCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ok;

  const withTimeout = (promise) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('dns timeout'), { code: 'ETIMEOUT' })), 3000)),
    ]);

  // Returns 'yes' | 'no' | 'unknown' for one lookup.
  const attempt = async (fn) => {
    try {
      const r = await withTimeout(fn());
      return r && r.length > 0 ? 'yes' : 'no';
    } catch (err) {
      return DEFINITE_NO.has(err && err.code) ? 'no' : 'unknown';
    }
  };

  const results = [];
  for (const fn of [() => dns.resolveMx(key), () => dns.resolve(key), () => dns.resolve6(key)]) {
    const r = await attempt(fn);
    if (r === 'yes') {
      domainCache.set(key, { ok: true, at: Date.now() });
      return true;
    }
    results.push(r);
  }

  if (results.includes('unknown')) return true; // couldn't verify - don't block
  domainCache.set(key, { ok: false, at: Date.now() });
  return false; // every lookup said the domain doesn't exist
}

module.exports = { isValidName, hasValidMailDomain, EMAIL_REGEX };
