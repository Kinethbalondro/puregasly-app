require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { runBootstrap } = require('./bootstrap/bootstrap');
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const adminRoutes = require('./routes/adminRoutes');
const shopRoutes = require('./routes/shopRoutes');
const orderRoutes = require('./routes/orderRoutes');
const storeOrderRoutes = require('./routes/storeOrderRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const storeRoutes = require('./routes/storeRoutes');
const riderRoutes = require('./routes/riderRoutes');
const riderOrderRoutes = require('./routes/riderOrderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const addressRoutes = require('./routes/addressRoutes');
const couponRoutes = require('./routes/couponRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const profileRoutes = require('./routes/profileRoutes');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('JWT_SECRET is missing or too short. Set a long random string in server/.env');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Render (and most hosts) put a proxy in front of the app. Without this every
// visitor looks like the same IP to the rate limiter.
app.set('trust proxy', 1);

// Express sends an ETag on every JSON response by default. A browser that
// still has an old ETag for the same URL can send it back and get a 304
// (not modified) instead of the fresh data a POST/PATCH/DELETE just wrote -
// which looks exactly like "my change didn't show up until I refresh or
// navigate away and back". Disabling it, plus explicitly marking every API
// response as never cacheable below, removes the possibility entirely.
app.set('etag', false);

// ---------- security middleware ----------
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(cors({ origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '10kb' }));
// Strips any $ or . keys from req.body/query/params so user input can't be
// crafted into a MongoDB operator (NoSQL injection).
app.use(mongoSanitize());

// Login/register are brute-force targets, so they get a tighter limit than
// the rest of the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per IP per window
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

const mediaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 2000,
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/media', mediaLimiter, mediaRoutes);

// General ceiling for everything else so one client can't hammer the API.
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 600,
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// ---------- routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/store-orders', storeOrderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/rider-orders', riderOrderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/profile', profileRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

// Malformed JSON etc. - never leak stack traces to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request body.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request too large.' });
  console.error(err);
  return res.status(500).json({ message: 'Something went wrong.' });
});

connectDB()
  .then(runBootstrap)
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`PureGasly API running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
