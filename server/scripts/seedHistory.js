// Run from the server folder:
//   node scripts/seedHistory.js            -> add demo customers + ~3 months of completed orders to EVERY store
//   node scripts/seedHistory.js --remove   -> delete only what this script added
//
// Demo customers: seed.hist.customer1..12@seed.puregasly.test  (password Seed1234)
// NOTE: the laptop and the live site share one database.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Store = require('../models/Store');
const Product = require('../models/Product');
const Order = require('../models/Order');

const REMOVE = process.argv.includes('--remove');
const PREFIX = 'SEED-HX-';
const CUSTOMER_COUNT = 12;
const ORDERS_PER_STORE = 45;
const DAYS = 90;
const PASSWORD = 'Seed1234';
const EMAIL = (n) => `seed.hist.customer${n}@seed.puregasly.test`;

const NAMES = [
  'Carlo Mendoza', 'Bea Villanueva', 'Rico Aquino', 'Jasmine Flores',
  'Miguel Torres', 'Angela Ramos', 'Daniel Castro', 'Kristine Navarro',
  'Joshua Pascual', 'Mary Grace Soriano', 'Noel Garcia', 'Patricia Domingo',
];

const ADDRESSES = [
  'Brgy. Bantay, Vigan City',
  'Brgy. Pagburnayan, Vigan City',
  'Brgy. Tamag, Vigan City',
  'Brgy. Mindoro, Vigan City',
  'Brgy. Salindeg, Vigan City',
  'Brgy. Poblacion, Dagupan City',
  'Brgy. Lucao, Dagupan City',
  'Brgy. Poblacion, Lingayen',
];

// Small deterministic random generator so every run makes the same kind of data.
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function remove() {
  const orders = await Order.find({ orderNo: { $regex: '^' + PREFIX } });
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    for (const it of o.items) {
      await Product.updateOne({ _id: it.product }, { $inc: { sold: -it.qty } });
    }
  }
  const del = await Order.deleteMany({ orderNo: { $regex: '^' + PREFIX } });
  const cust = await User.deleteMany({ email: { $regex: '^seed\\.hist\\.customer' } });
  console.log(`Removed ${del.deletedCount} orders and ${cust.deletedCount} demo customers. - seedHistory.js:58`);
}

async function add() {
  const exists = await Order.countDocuments({ orderNo: { $regex: '^' + PREFIX } });
  if (exists > 0) {
    console.log(`Already has ${exists} history orders. Run with remove first if you want to redo it. - seedHistory.js:64`);
    return;
  }

  // Customers
  const customers = [];
  for (let n = 1; n <= CUSTOMER_COUNT; n++) {
    let u = await User.findOne({ email: EMAIL(n) });
    if (!u) {
      u = await User.create({ name: NAMES[n - 1], email: EMAIL(n), password: PASSWORD, role: 'customer' });
    }
    customers.push(u);
  }
  const older = await User.find({ role: 'customer', email: { $regex: '^seed\\.customer[0-9]@seed\\.puregasly\\.test$' } });
  older.forEach((u) => customers.push(u));
  console.log(`Customers available: ${customers.length} - seedHistory.js:79`);

  const stores = await Store.find().sort({ name: 1 });
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const MIN = 60 * 1000;
  const soldBy = new Map();
  let grandTotal = 0;
  let grandCount = 0;

  for (let si = 0; si < stores.length; si++) {
    const store = stores[si];
    const products = (await Product.find({ storeId: store._id, active: true })).filter(
      (p) => p.price >= 50 && p.stock > 0
    );
    if (products.length === 0) {
      console.log(`${store.name} | skipped (no usable products) - seedHistory.js:95`);
      continue;
    }
    const riders = await User.find({ role: 'rider', storeId: store._id });
    const rng = makeRng(777 + si * 101);
    let storeTotal = 0;
    let storeCount = 0;

    for (let i = 0; i < ORDERS_PER_STORE; i++) {
      // Items
      const lines = 1 + Math.floor(rng() * 3);
      const picked = new Set();
      const items = [];
      for (let k = 0; k < lines; k++) {
        const prod = products[Math.floor(rng() * products.length)];
        if (picked.has(String(prod._id))) continue;
        picked.add(String(prod._id));
        items.push({
          product: prod._id,
          name: prod.name,
          brand: prod.brand,
          sizeKg: prod.sizeKg,
          unitPrice: prod.effectivePrice,
          qty: 1 + Math.floor(rng() * 2),
        });
      }
      const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);

      // Date: spread over the last 90 days, busier toward recent days
      const dayOffset = Math.floor((1 - Math.sqrt(rng())) * DAYS);
      const created = new Date(now - dayOffset * DAY);
      created.setHours(8 + Math.floor(rng() * 11), Math.floor(rng() * 60), 0, 0);
      let createdAt = created.getTime() > now ? new Date(now - 3 * 60 * MIN) : created;
      const stepAt = (mins) => new Date(Math.min(now, createdAt.getTime() + mins * MIN));

      // Status
      const r = rng();
      const status = r < 0.06 ? 'cancelled' : r < 0.7 ? 'received' : 'delivered';
      let history;
      let deliveredAt = null;
      if (status === 'cancelled') {
        history = [
          { status: 'pending', at: createdAt },
          { status: 'cancelled', at: stepAt(15) },
        ];
      } else {
        const deliverMins = 60 + Math.floor(rng() * 60);
        deliveredAt = stepAt(deliverMins);
        history = [
          { status: 'pending', at: createdAt },
          { status: 'preparing', at: stepAt(10) },
          { status: 'out_for_delivery', at: stepAt(30) },
          { status: 'delivered', at: deliveredAt },
        ];
        if (status === 'received') history.push({ status: 'received', at: stepAt(deliverMins + 10) });
      }

      const customer = customers[Math.floor(rng() * customers.length)];
      await Order.create({
        orderNo: `${PREFIX}${String(si + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
        customer: customer._id,
        storeId: store._id,
        items,
        subtotal,
        discount: 0,
        total: subtotal,
        status,
        statusHistory: history,
        deliveryAddress: ADDRESSES[Math.floor(rng() * ADDRESSES.length)],
        contactNumber: '09' + String(100000000 + Math.floor(rng() * 899999999)),
        deliveryTimeType: 'asap',
        deliveredAt,
        paymentMethod: 'COD',
        rider: status !== 'cancelled' && riders.length ? riders[Math.floor(rng() * riders.length)]._id : null,
        createdAt,
        updatedAt: deliveredAt || stepAt(15),
      });

      if (status !== 'cancelled') {
        storeTotal += subtotal;
        storeCount += 1;
        items.forEach((it) => {
          soldBy.set(String(it.product), (soldBy.get(String(it.product)) || 0) + it.qty);
        });
      }
    }

    grandTotal += storeTotal;
    grandCount += storeCount;
    console.log(`${store.name} | ${storeCount} completed orders | PHP ${storeTotal.toFixed(2)} - seedHistory.js:184`);
  }

  for (const [id, qty] of soldBy) {
    await Product.updateOne({ _id: id }, { $inc: { sold: qty } });
  }

  console.log(`Done. ${grandCount} completed orders across ${stores.length} stores, total PHP ${grandTotal.toFixed(2)}. - seedHistory.js:191`);
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