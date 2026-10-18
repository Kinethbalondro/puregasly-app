const nodemailer = require('nodemailer');

let transporter = null;

// Sends a plain-text email through Gmail. Needs EMAIL_USER (the Gmail address) and
// EMAIL_PASS (a Gmail "App Password", NOT the normal password) in the server environment.
// The transporter is created on first use so the server still starts without them.
module.exports = async function sendEmail(to, subject, text) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER / EMAIL_PASS are not set');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  await transporter.sendMail({
    from: `"PureGasly" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  });
};
