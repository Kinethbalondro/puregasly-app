// Run with: node scripts/seedProductImages.js
// Puts a sample photo on every product that has no photo yet.
// Pictures are read from server/seed-images: tank, regulator, hose, other.
// Add --all to replace photos that products already have.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Media = require('../models/Media');
const User = require('../models/User');
const { sniffImage } = require('../middleware/imageUpload');

const DIR = path.join(__dirname, '..', 'seed-images');
const EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const REPLACE_ALL = process.argv.includes('--all');

function findFile(base) {
  for (const ext of EXTS) {
    const p = path.join(DIR, base + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Pick which sample photo fits a product.
function pickKind(p) {
  const text = `${p.name} ${p.brand || ''}`.toLowerCase();
  if (text.includes('regulator')) return 'regulator';
  if (text.includes('hose')) return 'hose';
  if (p.category === 'lpg' || p.category === 'refill') return 'tank';
  return 'other';
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Load each sample photo once.
  const files = {};
  for (const kind of ['tank', 'regulator', 'hose', 'other']) {
    const file = findFile(kind);
    if (!file) {
      console.log(`Missing ${kind}.jpg/.png/.webp in seedimages  products of this kind will be skipped. - seedProductImages.js:43`);
      continue;
    }
    const buffer = fs.readFileSync(file);
    const mimeType = sniffImage(buffer);
    if (!mimeType) {
      console.log(`${path.basename(file)} is not a valid JPG, PNG or WebP  skipped. - seedProductImages.js:49`);
      continue;
    }
    if (buffer.length > 3 * 1024 * 1024) {
      console.log(`${path.basename(file)} is larger than 3 MB  skipped. - seedProductImages.js:53`);
      continue;
    }
    files[kind] = { buffer, mimeType };
  }

  if (!Object.keys(files).length) {
    console.log('No usable pictures found. Nothing to do. - seedProductImages.js:60');
    await mongoose.disconnect();
    return;
  }

  const uploader = await User.findOne({ role: 'owner' }).select('_id');
  if (!uploader) {
    console.log('No owner account found. Nothing to do. - seedProductImages.js:67');
    await mongoose.disconnect();
    return;
  }

  const filter = REPLACE_ALL ? {} : { $or: [{ image: null }, { image: { $exists: false } }] };
  const products = await Product.find(filter);

  // One Media document per kind and store keeps the database small.
  const cache = new Map();
  let done = 0;
  let skipped = 0;

  for (const p of products) {
    const kind = pickKind(p);
    const file = files[kind];
    if (!file) {
      skipped++;
      continue;
    }

    const key = `${kind}:${p.storeId}`;
    let mediaId = cache.get(key);
    if (!mediaId) {
      const media = await Media.create({
        kind: 'product',
        uploadedBy: uploader._id,
        mimeType: file.mimeType,
        size: file.buffer.length,
        data: file.buffer,
      });
      mediaId = media._id;
      cache.set(key, mediaId);
    }

    p.image = mediaId;
    await p.save();
    done++;
  }

  console.log(`Done. Photos added: ${done}. Skipped (no picture for that kind): ${skipped}. - seedProductImages.js:107`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});