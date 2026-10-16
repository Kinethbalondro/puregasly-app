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

// Checks the email's domain actually has mail-capable DNS records (MX, or
// failing that A/AAAA, since some small domains route mail without a
// dedicated MX record). This catches typo'd/nonexistent domains
// (e.g. "user@gnail.con") without needing a paid verification API or
// sending an actual confirmation email (no email service is configured
// yet) - it does NOT confirm the mailbox itself exists, only that the
// domain could plausibly receive mail.
async function hasValidMailDomain(email) {
  const domain = String(email || '').split('@')[1];
  if (!domain) return false;

  const withTimeout = (promise) =>
    Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('dns timeout')), 3000))]);

  try {
    const mx = await withTimeout(dns.resolveMx(domain));
    if (mx && mx.length > 0) return true;
  } catch {
    // no MX records (or lookup failed) - fall through and try A/AAAA below
  }

  try {
    const a = await withTimeout(dns.resolve(domain));
    return !!(a && a.length > 0);
  } catch {
    try {
      const aaaa = await withTimeout(dns.resolve6(domain));
      return !!(aaaa && aaaa.length > 0);
    } catch {
      return false;
    }
  }
}

module.exports = { isValidName, hasValidMailDomain, EMAIL_REGEX };
