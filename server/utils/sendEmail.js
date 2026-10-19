
// Sends a plain-text email: sendEmail(to, subject, text)
//
// LIVE SITE (Render's free plan blocks SMTP, so email goes out over HTTPS):
//   BREVO_API_KEY = your Brevo API key (starts with xkeysib-)
//   EMAIL_FROM    = a sender address that is verified in Brevo
//
// LOCAL TESTING (Gmail, no Brevo needed):
//   EMAIL_USER = the Gmail address
//   EMAIL_PASS = a Gmail "App Password", NOT the normal password
//
// If BREVO_API_KEY is set it is always used. Otherwise it falls back to Gmail.
const SENDER_NAME = 'PureGasly';
 
let transporter = null;
 
async function sendWithBrevo(to, subject, text) {
  if (typeof fetch !== 'function') {
    throw new Error('This Node version has no fetch. Use Node 18 or newer.');
  }
 
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!from) {
    throw new Error('EMAIL_FROM is not set');
  }
 
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: from },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });
 
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).message || '';
    } catch {
      // the response had no JSON body
    }
    throw new Error(`Brevo error ${res.status}${detail ? `: ${detail}` : ''}`);
  }
}
 
async function sendWithGmail(to, subject, text) {
  // Loaded only when needed, so the live site does not depend on it.
  const nodemailer = require('nodemailer');
 
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  await transporter.sendMail({
    from: `"${SENDER_NAME}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  });
}
 
module.exports = async function sendEmail(to, subject, text) {
  if (process.env.BREVO_API_KEY) {
    return sendWithBrevo(to, subject, text);
  }
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return sendWithGmail(to, subject, text);
  }
  throw new Error(
    'No email service is set. Set BREVO_API_KEY and EMAIL_FROM (live site), or EMAIL_USER and EMAIL_PASS (local).'
  );
};