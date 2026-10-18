// Rider-facing: only orders assigned to this rider, and only the
// out_for_delivery / delivered steps (the store handles pending -> preparing).
const Order = require('../models/Order');
const Product = require('../models/Product');
const { notify } = require('../utils/notify');
const { STATUS_LABELS } = require('../utils/orderStatus');

const NEXT = { preparing: 'out_for_delivery', out_for_delivery: 'delivered' };

// The rider never sees the code itself, only whether one is needed.
function shape(o) {
  return {
    id: o._id,
    orderNo: o.orderNo,
    customer: o.customer && o.customer.name ? { name: o.customer.name } : null,
    storeName: o.storeId && o.storeId.name ? o.storeId.name : '',
    items: o.items,
    total: o.total,
    status: o.status,
    deliveryAddress: o.deliveryAddress,
    contactNumber: o.contactNumber,
    deliveryLat: typeof o.deliveryLat === 'number' ? o.deliveryLat : null,
    deliveryLng: typeof o.deliveryLng === 'number' ? o.deliveryLng : null,
    deliveryTimeType: o.deliveryTimeType || 'asap',
    scheduledFor: o.scheduledFor || null,
    scheduledLabel: o.scheduledLabel || '',
    requiresCode: !!o.deliveryCode,
    deliveredAt: o.deliveredAt || null,
    notes: o.notes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// GET /api/rider-orders?active=true
exports.list = async (req, res) => {
  try {
    const filter = { rider: req.userId };
    if (req.query.active === 'true') filter.status = { $in: ['preparing', 'out_for_delivery'] };

    const orders = await Order.find(filter)
      .populate('customer', 'name')
      .populate('storeId', 'name')
      .sort({ createdAt: -1 })
      .limit(200);
    return res.json(orders.map(shape));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// PATCH /api/rider-orders/:id/advance   body: { code }  (code needed for the delivered step)
exports.advance = async (req, res) => {
  try {
    const current = await Order.findOne({ _id: req.params.id, rider: req.userId });
    if (!current) return res.status(404).json({ message: 'Delivery not found.' });

    const next = NEXT[current.status];
    if (!next) {
      return res.status(400).json({ message: 'This delivery cannot be moved forward any more.' });
    }

    // Proof of delivery: the customer's 4-digit code is needed to mark it delivered.
    // Older orders have no code, so they are not blocked.
    if (next === 'delivered' && current.deliveryCode) {
      const entered = String(req.body.code || '').trim();
      if (!entered) {
        return res.status(400).json({
          code: 'CODE_REQUIRED',
          message: 'Ask the customer for their 4-digit delivery code.',
        });
      }
      if (entered !== current.deliveryCode) {
        return res.status(400).json({
          code: 'WRONG_CODE',
          message: 'That code is not correct. Ask the customer to check their code in My Orders.',
        });
      }
    }

    const set = { status: next };
    if (next === 'delivered') set.deliveredAt = new Date();

    const order = await Order.findOneAndUpdate(
      { _id: current._id, status: current.status },
      { $set: set, $push: { statusHistory: { status: next, at: new Date() } } },
      { new: true }
    )
      .populate('customer', 'name')
      .populate('storeId', 'name');

    if (!order) return res.status(409).json({ message: 'This delivery was just updated. Please refresh.' });

    if (next === 'delivered') {
      await Promise.all(order.items.map((it) => Product.updateOne({ _id: it.product }, { $inc: { sold: it.qty } })));
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