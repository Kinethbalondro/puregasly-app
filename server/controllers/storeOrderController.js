// Store-facing order endpoints (owner, or employee with manage_orders).
const Order = require('../models/Order');
const Product = require('../models/Product');
const { ORDER_STATUSES } = require('../models/Order');
const { restoreStock } = require('../utils/stock');
const User = require('../models/User');
const { notify } = require('../utils/notify');
const { STATUS_LABELS } = require('../utils/orderStatus');
const { isValidId } = require('../utils/helpers');
const { renderReceiptPdf } = require('../utils/receipt');

// The only moves a store may make. The customer does delivered -> received.
const NEXT = {
  pending: 'preparing',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

function shape(o) {
  return {
    id: o._id,
    orderNo: o.orderNo,
    customer: o.customer && o.customer.name ? { name: o.customer.name, email: o.customer.email } : null,
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
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// GET /api/store-orders?status=
exports.list = async (req, res) => {
  try {
    const filter = { storeId: req.currentUser.storeId };
    if (ORDER_STATUSES.includes(req.query.status)) filter.status = req.query.status;

    const orders = await Order.find(filter)
      .populate('customer', 'name email')
      .populate('rider', 'name')
      .sort({ createdAt: -1 })
      .limit(300);
    return res.json(orders.map(shape));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/store-orders/:id/advance  - moves the order one step forward
exports.advance = async (req, res) => {
  try {
    const current = await Order.findOne({ _id: req.params.id, storeId: req.currentUser.storeId });
    if (!current) return res.status(404).json({ message: 'Order not found.' });

    const next = NEXT[current.status];
    if (!next) {
      return res.status(400).json({ message: 'This order cannot be moved forward any more.' });
    }

    // Guarding on the current status means a double-click can't skip a step.
    const order = await Order.findOneAndUpdate(
      { _id: current._id, status: current.status },
      { $set: { status: next }, $push: { statusHistory: { status: next, at: new Date() } } },
      { new: true }
    ).populate('customer', 'name email').populate('rider', 'name');

    if (!order) return res.status(409).json({ message: 'This order was just updated. Please refresh.' });

    // Sales are counted once the order is delivered.
    if (next === 'delivered') {
      await Promise.all(
        order.items.map((it) => Product.updateOne({ _id: it.product }, { $inc: { sold: it.qty } }))
      );
    }

    notify(order.customer._id, {
      type: 'order_status',
      title: `Order ${order.orderNo} is now ${STATUS_LABELS[next]}`,
      message: next === 'delivered' ? 'Tap ORDER RECEIVED once it arrives.' : '',
      link: '/orders',
    });

    return res.json(shape(order));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/store-orders/:id/assign-rider   body: { riderId }  (null to unassign)
exports.assignRider = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, storeId: req.currentUser.storeId });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (!['preparing', 'out_for_delivery'].includes(order.status)) {
      return res.status(400).json({ message: 'A rider can only be assigned once the order is being prepared.' });
    }

    const { riderId } = req.body;
    if (riderId === null || riderId === '') {
      order.rider = null;
      await order.save();
      return res.json(shape(await order.populate('customer', 'name email')));
    }

    if (!isValidId(riderId)) return res.status(400).json({ message: 'Invalid rider.' });

    const rider = await User.findOne({ _id: riderId, storeId: req.currentUser.storeId, role: 'rider', banned: false });
    if (!rider) return res.status(400).json({ message: 'Rider not found for this store.' });

    order.rider = rider._id;
    await order.save();

    notify(rider._id, {
      type: 'rider_assigned',
      title: `You've been assigned order ${order.orderNo}`,
      message: `Deliver to: ${order.deliveryAddress}`,
      link: '/dashboard',
    });

    await order.populate('customer', 'name email');
    await order.populate('rider', 'name');
    return res.json(shape(order));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/store-orders/:id/receipt
exports.receipt = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, storeId: req.currentUser.storeId });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${order.orderNo}-receipt.pdf"`);
    renderReceiptPdf(order, req.currentStore).pipe(res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/store-orders/:id/decline  - only while still pending
exports.decline = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, storeId: req.currentUser.storeId, status: 'pending' },
      { $set: { status: 'cancelled' }, $push: { statusHistory: { status: 'cancelled', at: new Date() } } },
      { new: true }
    ).populate('customer', 'name email');

    if (!order) return res.status(400).json({ message: 'Only new orders can be declined.' });

    await restoreStock(order.items);

    notify(order.customer._id, {
      type: 'order_status',
      title: `Order ${order.orderNo} was declined`,
      message: 'The store was unable to fulfill this order. Any charge will not be collected.',
      link: '/orders',
    });

    return res.json(shape(order));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
