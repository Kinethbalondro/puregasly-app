const crypto = require('crypto');
const User = require('../models/User');
const { isValidName, hasValidMailDomain, EMAIL_REGEX } = require('../utils/validation');

const VALID_PERMISSIONS = ['manage_inventory', 'manage_orders', 'view_analytics', 'manage_riders', 'manage_coupons'];

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

function sanitizePermissions(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((p) => VALID_PERMISSIONS.includes(p));
}

function toSafeEmployee(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    permissions: user.permissions,
    mustChangePassword: !!user.mustChangePassword,
    createdAt: user.createdAt,
  };
}

// GET /api/employees - list this owner's employees
exports.list = async (req, res) => {
  try {
    const owner = req.currentUser; // set by requireRole middleware

    if (!owner.storeId) {
      return res.status(400).json({ message: 'You do not have a store set up yet.' });
    }

    const employees = await User.find({ storeId: owner.storeId, role: 'employee' }).sort({
      createdAt: -1,
    });

    return res.json(employees.map(toSafeEmployee));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/employees - create a new employee under this owner's store
// The server makes a temporary password and returns it ONCE in the response.
exports.create = async (req, res) => {
  try {
    const owner = req.currentUser;
    const { name, email, permissions } = req.body;

    if (!owner.storeId) {
      return res.status(400).json({ message: 'You do not have a store set up yet.' });
    }

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required.' });
    }

    if (!isValidName(name)) {
      return res.status(400).json({ message: "Please enter the employee's full name (first and last, letters only)." });
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

    let employee;
    try {
      employee = await User.create({
        name: String(name).trim().slice(0, 80),
        email: normalizedEmail,
        password: tempPassword,
        mustChangePassword: true,
        role: 'employee',
        storeId: owner.storeId,
        permissions: sanitizePermissions(permissions),
      });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' });
      throw err;
    }

    // tempPassword is only sent here, once. It is stored hashed and can't be read again.
    return res.status(201).json({ ...toSafeEmployee(employee), tempPassword });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/employees/:id - update an employee's permissions
exports.updatePermissions = async (req, res) => {
  try {
    const owner = req.currentUser;
    const { permissions } = req.body;

    const employee = await User.findOne({
      _id: req.params.id,
      storeId: owner.storeId,
      role: 'employee',
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    employee.permissions = sanitizePermissions(permissions);
    await employee.save();

    return res.json(toSafeEmployee(employee));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/employees/:id - remove an employee from this owner's store
exports.remove = async (req, res) => {
  try {
    const owner = req.currentUser;

    const employee = await User.findOneAndDelete({
      _id: req.params.id,
      storeId: owner.storeId,
      role: 'employee',
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    return res.json({ message: 'Employee removed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
}