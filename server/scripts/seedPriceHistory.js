// Run from the server folder:
//   node scripts/seedPriceHistory.js            -> add ~13 weeks of demo price changes to EVERY product
//   node scripts/seedPriceHistory.js --remove   -> delete only what this script added
//
// NOTE: the laptop and the live site share one database.
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const PriceHistory = require('../models/PriceHistory');

const REMOVE = process.argv.includes('--remove');
const WEEKS = 13;
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MARKER = 'seed-ph'; // stored in productName suffix is avoided; we tag by recordedAt + brand check below

// Small deterministic random generator so every run makes the same kind of data.
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function remove() {
  const del = await PriceHistory.deleteMany({ seeded: true });
  console.log(`Removed ${del.deletedCount} demo price rows. - seedPriceHistory.js:28`);
}

async function add() {
  const existing = await PriceHistory.countDocuments({ seeded: true });
  if (existing > 0) {
    console.log(`Already has ${existing} demo rows. Run with remove first if you want to redo it. - seedPriceHistory.js:34`);
    return;
  }

  const products = await Product.find({});
  const now = Date.now();
  let total = 0;

  for (let pi = 0; pi < products.length; pi++) {
    const p = products[pi];
    const rng = makeRng(4242 + pi * 37);

    // Walk backwards from the current price: small random weekly drift (about -3% to +4%).
    // Start with today's price, then work out what it was in earlier weeks.
    const rows = [];
    let price = p.price;
    for (let w = 0; w < WEEKS; w++) {
      const at = new Date(now - w * WEEK - Math.floor(rng() * 3) * DAY);
      const promo = p.promoPrice != null && w < 2 && p.promoPrice < price ? p.promoPrice : null;
      rows.push({
        product: p._id,
        storeId: p.storeId,
        productName: p.name,
        brand: p.brand,
        category: p.category,
        sizeKg: p.sizeKg ?? null,
        price: Math.round(price),
        promoPrice: promo,
        effectivePrice: Math.round(promo != null ? promo : price),
        recordedAt: at,
        seeded: true,
      });
      const drift = (rng() * 7 - 3) / 100; // -3% .. +4%
      price = Math.max(1, price / (1 + drift));
    }

    await PriceHistory.insertMany(rows);
    total += rows.length;
  }

  console.log(`Done. Added ${total} demo price rows across ${products.length} products. - seedPriceHistory.js:74`);
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