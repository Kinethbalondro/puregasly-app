// Run from the server folder:
//   node scripts/seedGhostStaff.js            -> add 2 demo employees + 2 demo riders to EVERY store
//   node scripts/seedGhostStaff.js --remove   -> delete only the demo staff this script added
//
// All demo accounts use the password Seed1234 and an email that starts with "ghost."
// NOTE: the laptop and the live site share one database.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Store = require('../models/Store');

const REMOVE = process.argv.includes('--remove');
const DOMAIN = '@seed.puregasly.test';
const PASSWORD = 'Seed1234';

const EMPLOYEES = [
  { name: 'Juan Dela Cruz', permissions: ['manage_inventory'] },
  { name: 'Maria Santos', permissions: [] },
];
const RIDERS = [
  { name: 'Pedro Ramos' },
  { name: 'Jose Bautista' },
];

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

async function remove() {
  const r = await User.deleteMany({ email: { $regex: '^ghost\\..*@seed\\.puregasly\\.test$' } });
  console.log('Removed demo staff accounts: - seedGhostStaff.js:29', r.deletedCount);
}

async function add() {
  const stores = await Store.find().sort({ name: 1 });
  const created = [];

  for (const store of stores) {
    const key = slug(store.name) + '.' + String(store._id).slice(-4);

    const people = [
      ...EMPLOYEES.map((p, i) => ({ ...p, role: 'employee', email: `ghost.${key}.emp${i + 1}${DOMAIN}` })),
      ...RIDERS.map((p, i) => ({ ...p, role: 'rider', email: `ghost.${key}.rider${i + 1}${DOMAIN}` })),
    ];

    for (const p of people) {
      const exists = await User.findOne({ email: p.email });
      if (exists) continue;
      await User.create({
        name: p.name,
        email: p.email,
        password: PASSWORD,
        role: p.role,
        storeId: store._id,
        permissions: p.permissions || [],
        mustChangePassword: false,
      });
      created.push(`${store.name} | ${p.role} | ${p.name} | ${p.email}`);
    }
  }

  created.forEach((l) => console.log(l));
  console.log(`Added ${created.length} demo staff accounts across ${stores.length} stores. Password: ${PASSWORD} - seedGhostStaff.js:61`);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  if (REMOVE) await remove();
  else await add();
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});