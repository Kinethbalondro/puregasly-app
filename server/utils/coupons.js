const Coupon = require('../models/Coupon');
const { round2 } = require('./helpers');

function computeDiscount(coupon, subtotal) {
  return coupon.type === 'percent'
    ? round2((subtotal * coupon.value) / 100)
    : Math.min(round2(coupon.value), subtotal);
}

function baseChecks(coupon, subtotal) {
  if (!coupon || !coupon.active) return 'Invalid coupon code.';
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return 'This coupon has expired.';
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return 'This coupon has reached its usage limit.';
  if (subtotal < coupon.minOrder) return `This coupon needs a minimum order of \u20b1${coupon.minOrder.toFixed(2)}.`;
  return null;
}

// Read-only preview - used by the cart's "validate" endpoint so a customer
// can see the discount before checking out. Does NOT consume a use.
async function checkCoupon(storeId, rawCode, subtotal) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { error: 'Please enter a coupon code.' };

  const coupon = await Coupon.findOne({ storeId, code });
  const error = baseChecks(coupon, subtotal);
  if (error) return { error };

  return { coupon, discount: computeDiscount(coupon, subtotal) };
}

// Atomically claims one use of the coupon - used at actual order creation.
// The usage-limit check and the increment happen in a single conditional
// update, so two simultaneous checkouts can never both slip through on the
// coupon's very last remaining use (checkCoupon alone can't guarantee that,
// since a plain read-then-write has a race window between the two steps).
async function claimCoupon(storeId, rawCode, subtotal) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { error: 'Please enter a coupon code.' };

  const coupon = await Coupon.findOne({ storeId, code });
  const error = baseChecks(coupon, subtotal);
  if (error) return { error };

  const filter = { _id: coupon._id, active: true };
  if (coupon.maxUses != null) filter.usedCount = { $lt: coupon.maxUses };

  const claimed = await Coupon.findOneAndUpdate(filter, { $inc: { usedCount: 1 } }, { new: true });
  if (!claimed) {
    // Someone else used the last slot (or it was disabled) between our read and this write.
    return { error: 'This coupon has just reached its usage limit. Please try again without it.' };
  }

  return { coupon: claimed, discount: computeDiscount(claimed, subtotal) };
}

module.exports = { checkCoupon, claimCoupon };
