const Order = require('../models/Order');
const Review = require('../models/Review');
const { isValidId } = require('../utils/helpers');
const { notify } = require('../utils/notify');

function shape(r) {
  return {
    id: r._id,
    orderNo: r.order && r.order.orderNo ? r.order.orderNo : undefined,
    customerName: r.customer && r.customer.name ? r.customer.name : 'Customer',
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
  };
}

// POST /api/reviews   body: { orderId, rating, comment }   (customer)
exports.create = async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;

    if (!isValidId(orderId)) return res.status(400).json({ message: 'Invalid order.' });

    const stars = Number(rating);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5.' });
    }

    const order = await Order.findOne({ _id: orderId, customer: req.userId, status: 'received' });
    if (!order) {
      return res.status(400).json({ message: 'You can only review an order once it has been received.' });
    }
    if (order.reviewed) {
      return res.status(409).json({ message: 'You already reviewed this order.' });
    }

    let review;
    try {
      review = await Review.create({
        order: order._id,
        customer: req.userId,
        storeId: order.storeId,
        rating: stars,
        comment: String(comment || '').trim().slice(0, 500),
      });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'You already reviewed this order.' });
      throw err;
    }

    order.reviewed = true;
    await order.save();

    const User = require('../models/User');
    const owner = await User.findOne({ storeId: order.storeId, role: 'owner' });
    if (owner) {
      notify(owner._id, {
        type: 'new_review',
        title: `New ${stars}-star review`,
        message: review.comment ? review.comment.slice(0, 100) : '',
        link: '/analytics',
      });
    }

    return res.status(201).json(shape(review));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/reviews/store   (owner / employee with view_analytics) - this store's reviews
exports.listForStore = async (req, res) => {
  try {
    const reviews = await Review.find({ storeId: req.currentStore._id })
      .populate('customer', 'name')
      .populate('order', 'orderNo')
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json(reviews.map(shape));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/admin/reviews  - moderation list
exports.listForAdmin = async (req, res) => {
  try {
    const Store = require('../models/Store');
    const reviews = await Review.find({})
      .populate('customer', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);
    const storeIds = [...new Set(reviews.map((r) => String(r.storeId)))];
    const stores = await Store.find({ _id: { $in: storeIds } }).select('name');
    const storeNames = new Map(stores.map((s) => [String(s._id), s.name]));

    return res.json(
      reviews.map((r) => ({
        id: r._id,
        storeName: storeNames.get(String(r.storeId)) || 'Unknown store',
        customerName: r.customer?.name || 'Customer',
        customerEmail: r.customer?.email || '',
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      }))
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// DELETE /api/admin/reviews/:id
exports.removeAsAdmin = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found.' });

    const { logAdminAction } = require('../utils/audit');
    logAdminAction({
      adminId: req.currentUser._id,
      adminName: req.currentUser.name,
      action: 'review.remove',
      targetType: 'review',
      targetId: review._id,
      details: `${review.rating}-star review removed`,
    });

    return res.json({ message: 'Review removed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};
