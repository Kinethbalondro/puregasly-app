// Run with: node scripts/seedDemo.js  (or npm run seed:demo)
// Creates a ready-to-use Owner account with a store already attached, so you
// can log straight in and test "Manage Employees" without registering
// through the UI first. Change these credentials before this goes anywhere real.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Store = require('../models/Store');

const DEMO_OWNER_EMAIL = 'demo.owner@puregasly.com';
const DEMO_OWNER_PASSWORD = 'OwnerDemo123';
const DEMO_STORE_NAME = 'Demo LPG Depot';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  let owner = await User.findOne({ email: DEMO_OWNER_EMAIL });

  if (owner) {
    console.log('Demo owner already exists:', DEMO_OWNER_EMAIL);
  } else {
    owner = await User.create({
      name: 'Demo Owner',
      email: DEMO_OWNER_EMAIL,
      password: DEMO_OWNER_PASSWORD,
      role: 'owner',
    });

    const store = await Store.create({ name: DEMO_STORE_NAME, owner: owner._id, status: 'approved' });
    owner.storeId = store._id;
    await owner.save();

    console.log('Demo owner created:');
    console.log('  email:   ', DEMO_OWNER_EMAIL);
    console.log('  password:', DEMO_OWNER_PASSWORD);
    console.log('  store:   ', DEMO_STORE_NAME);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
