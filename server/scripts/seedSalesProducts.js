// Run from the server folder:
//   node scripts/seedSalesProducts.js            -> add sample products + completed orders
//   node scripts/seedSalesProducts.js --remove   -> delete only what this script added
//   node scripts/seedSalesProducts.js --store="Other Store Name"   -> use a different store
//
// Default store is "Test Gas Store". NOTE: the laptop and the live site share one
// database, so whatever this adds will also show on the live site.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Store = require('../models/Store');
const Product = require('../models/Product');
const Order = require('../models/Order');

const storeArg = process.argv.find((a) => a.startsWith('--store='));
const STORE_NAME = storeArg ? storeArg.split('=').slice(1).join('=') : 'Test Gas Store';
const REMOVE = process.argv.includes('--remove');

const ORDER_PREFIX = 'SEED-SP-';
const SEED_CUSTOMER_EMAIL = 'seed.sales.customer@seed.puregasly.test';
const SEED_CUSTOMER_PASSWORD = 'Seed1234';

const PRODUCTS = [
  { name: 'LPG 11kg Refill', brand: 'Petron Gasul', category: 'refill', sizeKg: 11, price: 950, promoPrice: null, stock: 40 },
  { name: 'LPG 22kg Refill', brand: 'Solane', category: 'refill', sizeKg: 22, price: 1900, promoPrice: null, stock: 25 },
  { name: 'LPG 50kg Refill', brand: 'Petron Gasul', category: 'refill', sizeKg: 50, price: 4300, promoPrice: null, stock: 12 },
  { name: 'LPG 11kg New Tank', brand: 'Gasul', category: 'lpg', sizeKg: 11, price: 2400, promoPrice: 2250, stock: 20 },
  { name: 'Gas Regulator', brand: 'Generic', category: 'accessory', price: 350, promoPrice: null, stock: 30 },
  { name: 'LPG Hose', brand: 'Generic', category: 'accessory', price: 180, promoPrice: 150, stock: 35 },
];

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

// Small deterministic random generator so every run makes the same kind of data.
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function findStore() {
  const store = await Store.findOne({ name: STORE_NAME });
  if (!store) {
    console.error(`Store "${STORE_NAME}" not found. Check the exact name, or pass store="Name". - seedSalesProducts.js:55`);
    await mongoose.disconnect();
    process.exit(1);
  }
  return store;
}

async function remove() {
  const store = await findStore();
  const orders = await Order.deleteMany({ storeId: store._id, orderNo: { $regex: `^${ORDER_PREFIX}` } });
  let products = 0;
  for (const p of PRODUCTS) {
    const r = await Product.deleteMany({ storeId: store._id, name: p.name, brand: p.brand });
    products += r.deletedCount;
  }
  const cust = await User.deleteOne({ email: SEED_CUSTOMER_EMAIL });
  console.log(`Removed from "${STORE_NAME}": ${orders.deletedCount} orders, ${products} products, ${cust.deletedCount} seed customer. - seedSalesProducts.js:71`);
}

async function add() {
  const store = await findStore();

  const already = await Order.countDocuments({ storeId: store._id, orderNo: { $regex: `^${ORDER_PREFIX}` } });
  if (already > 0) {
    console.log(`"${STORE_NAME}" already has ${already} seed orders. Run with remove first if you want to redo it. - seedSalesProducts.js:79`);
    return;
  }

  // 1. Products (skip ones that already exist)
  const products = [];
  for (const p of PRODUCTS) {
    let doc = await Product.findOne({ storeId: store._id, name: p.name, brand: p.brand });
    if (!doc) doc = await Product.create({ ...p, storeId: store._id });
    products.push(doc);
  }

  // 2. Customers: use existing customers, otherwise make one seed customer
  let customers = await User.find({ role: 'customer' }).limit(5);
  if (customers.length === 0) {
    const c = await User.create({
      name: 'Seed Customer',
      email: SEED_CUSTOMER_EMAIL,
      password: SEED_CUSTOMER_PASSWORD,
      role: 'customer',
    });
    customers = [c];
  }
  const riders = await User.find({ role: 'rider' }).limit(3);

  // 3. Completed orders spread over the last 30 days
  const rng = makeRng(20261019);
  const ORDER_COUNT = 25;
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const soldByProduct = new Map();
  let revenue = 0;

  for (let i = 0; i < ORDER_COUNT; i++) {
    const itemCount = 1 + Math.floor(rng() * 2); // 1-2 lines
    const picked = new Set();
    const items = [];
    for (let k = 0; k < itemCount; k++) {
      const prod = products[Math.floor(rng() * products.length)];
      if (picked.has(String(prod._id))) continue;
      picked.add(String(prod._id));
      const qty = 1 + Math.floor(rng() * 2);
      items.push({
        product: prod._id,
        name: prod.name,
        brand: prod.brand,
        sizeKg: prod.sizeKg,
        unitPrice: prod.effectivePrice,
        qty,
      });
      soldByProduct.set(String(prod._id), (soldByProduct.get(String(prod._id)) || 0) + qty);
    }

    const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
    const createdAt = new Date(now - Math.floor(rng() * 30 * DAY) - 2 * 60 * 60 * 1000);
    const preparingAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
    const outAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
    const deliveredAt = new Date(createdAt.getTime() + 75 * 60 * 1000);
    const finalStatus = rng() < 0.7 ? 'received' : 'delivered';
    const history = [
      { status: 'pending', at: createdAt },
      { status: 'preparing', at: preparingAt },
      { status: 'out_for_delivery', at: outAt },
      { status: 'delivered', at: deliveredAt },
    ];
    if (finalStatus === 'received') history.push({ status: 'received', at: new Date(deliveredAt.getTime() + 10 * 60 * 1000) });

    await Order.create({
      orderNo: `${ORDER_PREFIX}${String(i + 1).padStart(4, '0')}`,
      customer: customers[i % customers.length]._id,
      storeId: store._id,
      items,
      subtotal,
      discount: 0,
      total: subtotal,
      status: finalStatus,
      statusHistory: history,
      deliveryAddress: ADDRESSES[i % ADDRESSES.length],
      contactNumber: '09171234567',
      deliveryTimeType: 'asap',
      deliveredAt,
      paymentMethod: 'COD',
      rider: riders.length ? riders[i % riders.length]._id : null,
      createdAt,
      updatedAt: deliveredAt,
    });
    revenue += subtotal;
  }

  // 4. Update sold + stock to match the orders
  for (const prod of products) {
    const qty = soldByProduct.get(String(prod._id)) || 0;
    prod.sold = (prod.sold || 0) + qty;
    prod.stock = Math.max(0, prod.stock - qty);
    await prod.save();
  }

  console.log(`Added to "${STORE_NAME}": ${products.length} products, ${ORDER_COUNT} completed orders, total sales PHP ${revenue.toFixed(2)}. - seedSalesProducts.js:176`);
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