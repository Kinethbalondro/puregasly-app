// Customer-facing order endpoints.
const crypto = require('crypto');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Store = require('../models/Store');
const { isValidId, round2 } = require('../utils/helpers');
const { reserveStock, restoreStock } = require('../utils/stock');
const { notify, notifyStoreStaff } = require('../utils/notify');
const { renderReceiptPdf } = require('../utils/receipt');
const Coupon = require('../models/Coupon');
const { claimCoupon } = require('../utils/coupons');

const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;

// Delivery time slots: each slot is 2 hours long, up to 7 days ahead,
// and must start at least 30 minutes from now.
const SLOT_HOURS = 2;
const MIN_LEAD_MS = 30 * 60 * 1000;
const MAX_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
});

// e.g. "Oct 19, 2026, 9:00 AM - 11:00 AM" (always in Philippine time)
function slotLabel(start) {
  const end = new Date(start.getTime() + SLOT_HOURS * 60 * 60 * 1000);
  return `${dateTimeFmt.format(start)} - ${timeFmt.format(end)}`;
}

function newOrderNo() {
  return 'PG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

// 4-digit proof-of-delivery code (1000-9999). Only the customer sees it.
function newDeliveryCode() {
  return String(crypto.randomInt(1000, 10000));
}

// Returns a valid coordinate number, or null if missing / out of range.
function cleanCoord(value, limit) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return n;
}

function shapeOrder(o, storeName) {
  return {
    id: o._id,
    orderNo: o.orderNo,
    storeId: o.storeId && o.storeId._id ? o.storeId._id : o.storeId,
    storeName: storeName || (o.storeId && o.storeId.name) || '',
    items: o.items,
    subtotal: o.subtotal,
    discount: o.discount || 0,
    couponCode: o.couponCode || '',
    total: o.total,
    status: o.status,
    statusHistory: o.statusHistory,
    deliveryAddress: o.deliveryAddress,
    contactNumber: o.contactNumber,
    deliveryLat: typeof o.deliveryLat === 'number' ? o.deliveryLat : null,
    deliveryLng: typeof o.deliveryLng === 'number' ? o.deliveryLng : null,
    deliveryTimeType: o.deliveryTimeType || 'asap',
    scheduledFor: o.scheduledFor || null,
    scheduledLabel: o.scheduledLabel || '',
    deliveryCode: o.deliveryCode || '',
    deliveredAt: o.deliveredAt || null,
    notes: o.notes,
    paymentMethod: o.paymentMethod,
    rider:
      o.rider && o.rider.name
        ? { id: o.rider._id, name: o.rider.name, avatar: o.rider.avatar ? String(o.rider.avatar) : null }
        : null,
    reviewed: !!o.reviewed,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// POST /api/orders
// body: { items:[{productId, qty}], deliveryAddress, contactNumber, notes, deliveryLat, deliveryLng,
//         deliveryTimeType: 'asap' | 'scheduled', scheduledFor: ISO date string (start of the slot) }
exports.create = async (req, res) => {
  try {
    const {
      items,
      deliveryAddress,
      contactNumber,
      notes,
      couponCode,
      deliveryLat,
      deliveryLng,
      deliveryTimeType,
      scheduledFor,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      return res.status(400).json({ message: 'Your cart is empty (or has too many items).' });
    }

    const address = String(deliveryAddress || '').trim();
    const phone = String(contactNumber || '').trim();
    if (address.length < 8) {
      return res.status(400).json({ message: 'Please enter a complete delivery address.' });
    }
    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: 'Please enter a valid contact number.' });
    }

    // The map pin is optional. Both values must be valid, or neither is kept.
    let lat = cleanCoord(deliveryLat, 90);
    let lng = cleanCoord(deliveryLng, 180);
    if (lat === null || lng === null) {
      lat = null;
      lng = null;
    }

    // Delivery time: ASAP (default) or a chosen time slot.
    let timeType = 'asap';
    let slotStart = null;
    let slotText = '';
    if (deliveryTimeType === 'scheduled') {
      const start = new Date(scheduledFor);
      if (!scheduledFor || Number.isNaN(start.getTime())) {
        return res.status(400).json({ message: 'Please choose a valid delivery time.' });
      }
      const now = Date.now();
      if (start.getTime() < now + MIN_LEAD_MS) {
        return res.status(400).json({ message: 'That delivery time is too soon. Please pick a later time slot.' });
      }
      if (start.getTime() > now + MAX_AHEAD_MS) {
        return res.status(400).json({ message: 'You can only schedule a delivery up to 7 days ahead.' });
      }
      timeType = 'scheduled';
      slotStart = start;
      slotText = slotLabel(start);
    }

    // Merge duplicate lines and validate quantities.
    const wanted = new Map();
    for (const line of items) {
      const qty = Number(line.qty);
      if (!isValidId(line.productId) || !Number.isInteger(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ message: 'Invalid item in cart.' });
      }
      wanted.set(String(line.productId), (wanted.get(String(line.productId)) || 0) + qty);
    }

    const products = await Product.find({ _id: { $in: [...wanted.keys()] }, active: { $ne: false } });
    if (products.length !== wanted.size) {
      return res.status(400).json({ message: 'Some items in your cart are no longer available.' });
    }

    const storeIds = new Set(products.map((p) => String(p.storeId)));
    if (storeIds.size !== 1) {
      return res.status(400).json({ message: 'You can only order from one store at a time.' });
    }

    const store = await Store.findOne({ _id: products[0].storeId, status: 'approved' });
    if (!store) {
      return res.status(400).json({ message: 'This store is not accepting orders right now.' });
    }

    const orderItems = products.map((p) => ({
      product: p._id,
      name: p.name,
      brand: p.brand,
      sizeKg: p.sizeKg,
      unitPrice: p.effectivePrice, // always priced server-side
      qty: wanted.get(String(p._id)),
    }));

    try {
      await reserveStock(orderItems);
    } catch (err) {
      if (err.code === 'OUT_OF_STOCK') return res.status(409).json({ message: err.message });
      throw err;
    }

    const subtotal = round2(orderItems.reduce((sum, it) => sum + it.unitPrice * it.qty, 0));

    // Coupon is optional and re-validated here, server-side, same as prices above.
    let discount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      // Claims the use atomically right away. If order creation fails below,
      // the claim is rolled back (coupon use refunded) in the catch block.
      const result = await claimCoupon(store._id, couponCode, subtotal);
      if (result.error) {
        await restoreStock(orderItems);
        return res.status(400).json({ message: result.error });
      }
      discount = result.discount;
      appliedCoupon = result.coupon;
    }
    const total = round2(subtotal - discount);

    let order;
    try {
      order = await Order.create({
        orderNo: newOrderNo(),
        customer: req.userId,
        storeId: store._id,
        items: orderItems,
        subtotal,
        discount,
        couponCode: appliedCoupon ? appliedCoupon.code : '',
        total,
        status: 'pending',
        statusHistory: [{ status: 'pending', at: new Date() }],
        deliveryAddress: address,
        contactNumber: phone,
        deliveryLat: lat,
        deliveryLng: lng,
        deliveryTimeType: timeType,
        scheduledFor: slotStart,
        scheduledLabel: slotText,
        deliveryCode: newDeliveryCode(),
        notes: String(notes || '').trim().slice(0, 200),
      });
    } catch (err) {
      await restoreStock(orderItems);
      // The order never got created, so give back the coupon use we already claimed.
      if (appliedCoupon) {
        Coupon.updateOne({ _id: appliedCoupon._id }, { $inc: { usedCount: -1 } }).catch(() => {});
      }
      throw err;
    }

    notifyStoreStaff(store._id, 'manage_orders', {
      type: 'order_placed',
      title: `New order ${order.orderNo}`,
      message: `${orderItems.length} item(s) · ₱${total.toFixed(2)} · ${timeType === 'scheduled' ? slotText : 'ASAP'}`,
      link: '/store-orders',
    });

    return res.status(201).json(shapeOrder(order, store.name));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// GET /api/orders/mine
exports.mine = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.userId })
      .populate('storeId', 'name')
      .populate('rider', 'name avatar')
      .sort({ createdAt: -1 });
    return res.json(orders.map((o) => shapeOrder(o)));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/orders/:id/received  - customer confirms the delivery arrived
exports.markReceived = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, customer: req.userId, status: 'delivered' },
      { $set: { status: 'received' }, $push: { statusHistory: { status: 'received', at: new Date() } } },
      { new: true }
    ).populate('storeId', 'name');

    if (!order) {
      return res.status(400).json({ message: 'This order can only be confirmed once it is marked Delivered.' });
    }
    return res.json(shapeOrder(order, order.storeId?.name));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/orders/:id/cancel  - only while the store hasn't accepted it yet
exports.cancel = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, customer: req.userId, status: 'pending' },
      { $set: { status: 'cancelled' }, $push: { statusHistory: { status: 'cancelled', at: new Date() } } },
      { new: true }
    ).populate('storeId', 'name');

    if (!order) {
      return res.status(400).json({ message: 'This order can no longer be cancelled.' });
    }
    await restoreStock(order.items);
    return res.json(shapeOrder(order));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/orders/:id/receipt  - customer downloads a PDF receipt
exports.receipt = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, customer: req.userId }).populate('storeId', 'name address phone');
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${order.orderNo}-receipt.pdf"`);
    renderReceiptPdf(order, order.storeId).pipe(res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

exports.shapeOrder = shapeOrder;