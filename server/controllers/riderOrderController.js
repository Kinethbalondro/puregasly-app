// Rider-facing: only orders assigned to this rider, and only the
// out_for_delivery / delivered steps (the store handles pending -> preparing).
const Order = require('../models/Order');
const Product = require('../models/Product');
const { notify } = require('../utils/notify');
const { STATUS_LABELS } = require('../utils/orderStatus');

const NEXT = { preparing: 'out_for_delivery', out_for_delivery: 'delivered' };

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

// PATCH /api/rider-orders/:id/advance
exports.advance = async (req, res) => {
  try {
    const current = await Order.findOne({ _id: req.params.id, rider: req.userId });
    if (!current) return res.status(404).json({ message: 'Delivery not found.' });

    const next = NEXT[current.status];
    if (!next) {
      return res.status(400).json({ message: 'This delivery cannot be moved forward any more.' });
    }

    const order = await Order.findOneAndUpdate(
      { _id: current._id, status: current.status },
      { $set: { status: next }, $push: { statusHistory: { status: next, at: new Date() } } },
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
