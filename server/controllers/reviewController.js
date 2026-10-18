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
    riderName: r.riderId && r.riderId.name ? r.riderId.name : undefined,
    riderRating: r.riderRating ?? null,
    riderComment: r.riderComment || '',
    storeReply:
      r.storeReply && r.storeReply.text
        ? { text: r.storeReply.text, repliedAt: r.storeReply.repliedAt }
        : null,
    createdAt: r.createdAt,
  };
}

// POST /api/reviews   body: { orderId, rating, comment, riderRating?, riderComment? }   (customer)
exports.create = async (req, res) => {
  try {
    const { orderId, rating, comment, riderRating, riderComment } = req.body;

    if (!isValidId(orderId)) return res.status(400).json({ message: 'Invalid order.' });

    const stars = Number(rating);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5.' });
    }

    // Optional rider rating
    const hasRiderRating = riderRating !== undefined && riderRating !== null && riderRating !== '';
    let riderStars = null;
    if (hasRiderRating) {
      riderStars = Number(riderRating);
      if (!Number.isInteger(riderStars) || riderStars < 1 || riderStars > 5) {
        return res.status(400).json({ message: 'Rider rating must be a whole number from 1 to 5.' });
      }
    }

    const order = await Order.findOne({ _id: orderId, customer: req.userId, status: 'received' });
    if (!order) {
      return res.status(400).json({ message: 'You can only review an order once it has been received.' });
    }
    if (order.reviewed) {
      return res.status(409).json({ message: 'You already reviewed this order.' });
    }

    // The rider who delivered this order (checks the common field names)
    const riderRef = order.riderId || order.rider || order.assignedRider || null;
    if (hasRiderRating && !riderRef) {
      return res.status(400).json({ message: 'This order has no rider to rate.' });
    }

    let review;
    try {
      review = await Review.create({
        order: order._id,
        customer: req.userId,
        storeId: order.storeId,
        rating: stars,
        comment: String(comment || '').trim().slice(0, 500),
        riderId: hasRiderRating ? riderRef : null,
        riderRating: riderStars,
        riderComment: hasRiderRating ? String(riderComment || '').trim().slice(0, 500) : '',
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

    // Let the rider know they were rated
    if (hasRiderRating && riderRef) {
      notify(riderRef, {
        type: 'new_rating',
        title: `New ${riderStars}-star rating`,
        message: review.riderComment ? review.riderComment.slice(0, 100) : '',
        link: '/dashboard',
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
      .populate('riderId', 'name')
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json(reviews.map(shape));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// POST /api/reviews/:id/reply   body: { text }   (owner / employee) - the store answers a review
exports.reply = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid review.' });

    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Please write a reply.' });
    if (text.length > 500) return res.status(400).json({ message: 'Replies can be up to 500 characters.' });

    const review = await Review.findOne({ _id: req.params.id, storeId: req.currentStore._id });
    if (!review) return res.status(404).json({ message: 'Review not found.' });

    review.storeReply = { text, repliedAt: new Date() };
    await review.save();

    notify(review.customer, {
      type: 'review_reply',
      title: `${req.currentStore.name || 'The store'} replied to your review`,
      message: text.slice(0, 100),
      link: '/orders',
    });

    const fresh = await Review.findById(review._id)
      .populate('customer', 'name')
      .populate('order', 'orderNo')
      .populate('riderId', 'name');
    return res.json(shape(fresh));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Something went wrong.' });
  }
};

// GET /api/reviews/rider   (rider) - ratings this rider received
exports.listForRider = async (req, res) => {
  try {
    const reviews = await Review.find({ riderId: req.userId, riderRating: { $ne: null } })
      .populate('customer', 'name')
      .sort({ createdAt: -1 })
      .limit(200);

    const count = reviews.length;
    const average = count ? reviews.reduce((sum, r) => sum + r.riderRating, 0) / count : null;

    return res.json({
      average: average === null ? null : Math.round(average * 10) / 10,
      count,
      reviews: reviews.map((r) => ({
        id: r._id,
        customerName: r.customer && r.customer.name ? r.customer.name : 'Customer',
        rating: r.riderRating,
        comment: r.riderComment || '',
        createdAt: r.createdAt,
      })),
    });
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
        riderRating: r.riderRating ?? null,
        storeReply: r.storeReply?.text || '',
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