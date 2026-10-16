// Run with: npm run seed:admin
// The built-in admin is now created automatically whenever the API starts, so
// this script is only a manual way to trigger the same thing.
require('dotenv').config();
const mongoose = require('mongoose');
const { ensureBuiltInAdmin, ADMIN_EMAIL } = require('../bootstrap/bootstrap');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  await ensureBuiltInAdmin();
  console.log('Built-in admin is ready:', ADMIN_EMAIL);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
