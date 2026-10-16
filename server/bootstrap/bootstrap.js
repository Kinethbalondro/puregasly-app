const User = require('../models/User');
const Store = require('../models/Store');
const Order = require('../models/Order');

// Built-in platform admin. Created automatically on every server start if it
// doesn't exist yet. Override with ADMIN_EMAIL / ADMIN_PASSWORD in .env.
const ADMIN_NAME = 'PureGasly Admin';
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'PGAdmin@pgas.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Pg@s365T';

async function ensureBuiltInAdmin() {
  const existing = await User.findOne({ email: ADMIN_EMAIL });

  if (!existing) {
    await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' });
    console.log(`Built-in admin created: ${ADMIN_EMAIL}`);
    return;
  }

  // Make sure the built-in account can never be locked out or demoted.
  let changed = false;
  if (existing.role !== 'admin') {
    existing.role = 'admin';
    existing.storeId = null;
    changed = true;
  }
  if (existing.banned) {
    existing.banned = false;
    existing.banReason = '';
    changed = true;
  }
  if (changed) {
    await existing.save();
    console.log(`Built-in admin restored: ${ADMIN_EMAIL}`);
  }
}

// Data created before this phase has no `status` / `banned` fields stored.
// Fill them in so existing stores stay live and existing users stay active.
async function migrateLegacyData() {
  const stores = await Store.updateMany({ status: { $exists: false } }, { $set: { status: 'approved' } });
  const users = await User.updateMany({ banned: { $exists: false } }, { $set: { banned: false } });

  // `subtotal` became a REQUIRED field when coupons were added. Orders placed
  // before that change have no subtotal/discount/couponCode stored at all.
  // Without this backfill, the very next time code calls .save() on one of
  // these older orders (assigning a rider, leaving a review, a store ban
  // cancelling a pending order, etc.) Mongoose's validator would reject the
  // save with "subtotal is required" - a totally unrelated-looking crash
  // triggered by an old order that predates coupons ever existing. Backfill
  // subtotal = total (no discount applied back then, so that's exactly right)
  // using an aggregation pipeline update so it's one atomic query, not a
  // read-modify-write loop over every legacy order.
  const orders = await Order.updateMany({ subtotal: { $exists: false } }, [
    { $set: { subtotal: '$total', discount: 0, couponCode: '' } },
  ]);

  if (stores.modifiedCount || users.modifiedCount || orders.modifiedCount) {
    console.log(
      `Migrated legacy data: ${stores.modifiedCount} store(s), ${users.modifiedCount} user(s), ${orders.modifiedCount} order(s)`
    );
  }
}

async function runBootstrap() {
  await migrateLegacyData();
  await ensureBuiltInAdmin();
}

module.exports = { runBootstrap, ensureBuiltInAdmin, ADMIN_EMAIL };
