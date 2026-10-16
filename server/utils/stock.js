const Product = require('../models/Product');

// Atomically takes stock for every item. If any item is short, everything
// already taken is put back and an error with code OUT_OF_STOCK is thrown.
async function reserveStock(items) {
  const taken = [];
  try {
    for (const it of items) {
      const updated = await Product.findOneAndUpdate(
        { _id: it.product, stock: { $gte: it.qty }, active: { $ne: false } },
        { $inc: { stock: -it.qty } }
      );
      if (!updated) {
        const err = new Error(`Not enough stock for ${it.name}.`);
        err.code = 'OUT_OF_STOCK';
        throw err;
      }
      taken.push(it);
    }
  } catch (err) {
    await restoreStock(taken);
    throw err;
  }
}

async function restoreStock(items) {
  await Promise.all(items.map((it) => Product.updateOne({ _id: it.product }, { $inc: { stock: it.qty } })));
}

module.exports = { reserveStock, restoreStock };
