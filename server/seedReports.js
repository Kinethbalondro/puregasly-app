require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Store = require('../models/Store');
const Report = require('../models/Report');

// Creates two DEMO reports so the admin Reports tab has something to show.
//   node scripts/seedReports.js            -> add the demo reports
//   node scripts/seedReports.js --remove   -> delete them again
const TAG = '[DEMO] ';

async function run() {
  await connectDB();

  if (process.argv.includes('--remove')) {
    const res = await Report.deleteMany({ reason: { $regex: '^\\[DEMO\\]' } });
    console.log(`Removed ${res.deletedCount} demo report(s). - seedReports.js:18`);
    return;
  }

  const customers = await User.find({ role: 'customer', banned: { $ne: true } }).limit(2);
  const store = await Store.findOne({ status: 'approved' });

  if (customers.length < 2 || !store) {
    console.log('Need at least 2 customers and 1 approved store in the database. - seedReports.js:26');
    return;
  }

  const [customerA, customerB] = customers;

  await Report.create([
    {
      // A customer reports a store for a fake listing.
      reporter: customerA._id,
      reportedStore: store._id,
      type: 'fake_listing',
      reason: TAG + 'The product photo and price do not match what was delivered.',
    },
    {
      // A customer reports another customer for an abusive message.
      reporter: customerA._id,
      reportedUser: customerB._id,
      type: 'abusive_message',
      reason: TAG + 'This user sent rude and abusive messages.',
    },
  ]);

  console.log(`Created 2 demo reports. - seedReports.js:49`);
  console.log(`1) ${customerA.name} reported store "${store.name}" (fake listing) - seedReports.js:50`);
  console.log(`2) ${customerA.name} reported ${customerB.name} (abusive message) - seedReports.js:51`);
}

run()
  .catch((err) => console.error(err))
  .finally(() => mongoose.disconnect());