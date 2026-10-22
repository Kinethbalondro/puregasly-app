require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');

const ADDRESSES = [
  'Brgy. Poblacion, Alaminos City',
  'Brgy. Camaley, Binmaley',
  'Brgy. Poblacion East, Calasiao',
  'Brgy. Lucao, Dagupan City',
  'Brgy. Libsong East, Lingayen',
  'Brgy. Poblacion, Mangaldan',
  'Brgy. Bolingit, San Carlos City',
  'Brgy. Poblacion, Urdaneta City',
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const orders = await Order.find({ orderNo: { $regex: '^SEED-SP-' } }).sort({ orderNo: 1 });
  for (let i = 0; i < orders.length; i++) {
    await Order.updateOne(
      { _id: orders[i]._id },
      { $set: { deliveryAddress: ADDRESSES[i % ADDRESSES.length] } }
    );
  }
  console.log(`Updated ${orders.length} seed orders. - fixSeedAddresses.js:25`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});