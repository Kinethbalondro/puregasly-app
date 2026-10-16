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

function newOrderNo() {
  return 'PG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
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
    notes: o.notes,
    paymentMethod: o.paymentMethod,
    rider: o.rider && o.rider.name ? { id: o.rider._id, name: o.rider.name } : null,
    reviewed: !!o.reviewed,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// POST /api/orders   body: { items:[{productId, qty}], deliveryAddress, contactNumber, notes }
exports.create = async (req, res) => {
  try {
    const { items, deliveryAddress, contactNumber, notes, couponCode } = req.body;

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
      message: `${orderItems.length} item(s) · ₱${total.toFixed(2)}`,
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
      .populate('rider', 'name')
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
