
const crypto = require('crypto');
const User = require('../models/User');
const Order = require('../models/Order');
const { isValidName, hasValidMailDomain, EMAIL_REGEX } = require('../utils/validation');
 
// Random 10-character password with at least one letter and one number.
// Skips look-alike characters (0/O, 1/l/I) so it is easy to read out loud.
function generateTempPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
 
  const chars = [
    letters[crypto.randomInt(letters.length)],
    digits[crypto.randomInt(digits.length)],
  ];
  while (chars.length < 10) {
    chars.push(all[crypto.randomInt(all.length)]);
  }
 
  // Shuffle so the letter and number are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
 
function toSafeRider(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    banned: !!user.banned,
    banReason: user.banReason || '',
    mustChangePassword: !!user.mustChangePassword,
    createdAt: user.createdAt,
  };
}
 
// GET /api/riders - this store's riders
exports.list = async (req, res) => {
  try {
    const riders = await User.find({ storeId: req.currentStore._id, role: 'rider' }).sort({ createdAt: -1 });
    return res.json(riders.map(toSafeRider));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
 
// POST /api/riders
// The server makes a temporary password and returns it ONCE in the response.
exports.create = async (req, res) => {
  try {
    const { name, email } = req.body;
 
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required.' });
    }
 
    if (!isValidName(name)) {
      return res.status(400).json({ message: "Please enter the rider's full name (first and last, letters only)." });
    }
 
    const normalizedEmail = String(email).trim().toLowerCase();
 
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
 
    if (!(await hasValidMailDomain(normalizedEmail))) {
      return res.status(400).json({ message: "We couldn't verify that email's domain. Please check for typos." });
    }
 
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }
 
    const tempPassword = generateTempPassword();
 
    let rider;
    try {
      rider = await User.create({
        name: String(name).trim().slice(0, 80),
        email: normalizedEmail,
        password: tempPassword,
        mustChangePassword: true,
        role: 'rider',
        storeId: req.currentStore._id,
      });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' });
      throw err;
    }
 
    // tempPassword is only sent here, once. It is stored hashed and can't be read again.
    return res.status(201).json({ ...toSafeRider(rider), tempPassword });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
 
// DELETE /api/riders/:id
exports.remove = async (req, res) => {
  try {
    const rider = await User.findOneAndDelete({
      _id: req.params.id,
      storeId: req.currentStore._id,
      role: 'rider',
    });
 
    if (!rider) return res.status(404).json({ message: 'Rider not found.' });
 
    // Don't leave orders pointing at a deleted rider.
    await Order.updateMany({ rider: rider._id }, { $set: { rider: null } });
 
    return res.json({ message: 'Rider removed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};